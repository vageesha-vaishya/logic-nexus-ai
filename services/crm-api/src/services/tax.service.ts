import { createClient } from '@supabase/supabase-js';
import {
  TaxCalculationItem,
  TaxCalculationRequest,
  TaxCalculationResponse,
  TaxExemptionCertificate,
  TaxExemptionCertificateUploadRequest,
  TaxNexusAddress
} from '../types/crm.types.js';
import { logger } from '../utils/logger.js';

type TaxRuleRow = {
  rate: number | string;
  tax_codes: { code: string } | { code: string }[] | null;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type AccountRow = {
  custom_fields: Record<string, unknown> | null;
};

export class TaxService {
  private static nexusCache = new Map<string, CacheEntry<string[]>>();
  private static taxRuleCache = new Map<string, CacheEntry<TaxRuleRow[]>>();
  private static cacheTtlMs = Number(process.env.TAX_CACHE_TTL_MS || 60000);
  private static latencyWarnMs = Number(process.env.TAX_LATENCY_WARN_MS || 200);
  private supabase = this.createSupabaseClient();

  private createSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    return createClient(supabaseUrl, supabaseServiceKey);
  }

  async calculateTax(tenantId: string, request: TaxCalculationRequest): Promise<TaxCalculationResponse> {
    const startedAt = Date.now();
    const nexusResult = await this.determineNexus(tenantId, request.destination);

    if (!nexusResult.hasNexus) {
      const response = {
        hasNexus: false,
        jurisdictions: [],
        totalTax: 0,
        breakdown: [],
        lineItems: request.items.map((item) => ({
          id: item.id,
          taxAmount: 0,
          taxRate: 0
        }))
      };
      this.logLatency(startedAt, tenantId, nexusResult.jurisdictions[0] || 'NO_NEXUS');
      return response;
    }

    const jurisdictionCode = nexusResult.jurisdictions[0];
    const exemptionCertificate =
      request.customerId && jurisdictionCode
        ? await this.getValidExemptionCertificate(tenantId, request.customerId)
        : null;
    if (exemptionCertificate) {
      const response = {
        hasNexus: true,
        jurisdictions: nexusResult.jurisdictions,
        jurisdictionCode,
        totalTax: 0,
        breakdown: [],
        lineItems: request.items.map((item) => ({
          id: item.id,
          taxAmount: 0,
          taxRate: 0
        })),
        exemptionApplied: {
          accountId: request.customerId as string,
          certificateNumber: exemptionCertificate.certificateNumber,
          expirationDate: exemptionCertificate.expirationDate,
          exemptionType: exemptionCertificate.exemptionType
        }
      };
      this.logLatency(startedAt, tenantId, jurisdictionCode);
      return response;
    }

    const calculation = await this.calculateForJurisdiction(jurisdictionCode, request.items);

    const response = {
      hasNexus: true,
      jurisdictions: nexusResult.jurisdictions,
      jurisdictionCode,
      ...calculation
    };
    this.logLatency(startedAt, tenantId, jurisdictionCode);
    return response;
  }

  async uploadExemptionCertificate(
    tenantId: string,
    userId: string | undefined,
    request: TaxExemptionCertificateUploadRequest
  ): Promise<TaxExemptionCertificate> {
    const { data: account, error: accountError } = await this.supabase
      .from('accounts')
      .select('custom_fields')
      .eq('id', request.accountId)
      .eq('tenant_id', tenantId)
      .single();

    if (accountError || !account) {
      throw new Error('Account not found');
    }

    const customFields =
      account.custom_fields && typeof account.custom_fields === 'object' && !Array.isArray(account.custom_fields)
        ? { ...account.custom_fields }
        : {};
    const certificate: TaxExemptionCertificate = {
      certificateNumber: request.certificateNumber,
      issuingAuthority: request.issuingAuthority,
      exemptionType: request.exemptionType,
      expirationDate: request.expirationDate,
      documentUrl: request.documentUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId
    };

    const nextCustomFields = {
      ...customFields,
      tax_exemption_certificate: certificate
    };

    const { error: updateError } = await this.supabase
      .from('accounts')
      .update({
        custom_fields: nextCustomFields
      })
      .eq('id', request.accountId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw updateError;
    }

    return certificate;
  }

  private async determineNexus(tenantId: string, destination: TaxNexusAddress) {
    const potentialJurisdictions: string[] = [];

    if (destination.country) {
      potentialJurisdictions.push(destination.country.toUpperCase());
    }

    if (destination.country.toUpperCase() === 'US' && destination.state) {
      potentialJurisdictions.push(`US-${destination.state.toUpperCase()}`);
    }

    const tenantNexus = await this.getTenantNexus(tenantId);
    const activeNexus = potentialJurisdictions.filter((code) => tenantNexus.includes(code));

    return {
      hasNexus: activeNexus.length > 0,
      jurisdictions: activeNexus
    };
  }

  private async getTenantNexus(tenantId: string): Promise<string[]> {
    const cacheKey = tenantId;
    const cached = this.getCacheValue(TaxService.nexusCache, cacheKey);
    if (cached) {
      return cached;
    }

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await this.supabase
      .schema('finance')
      .from('tenant_nexus')
      .select(
        `
        jurisdiction_id,
        tax_jurisdictions (
          code
        )
      `
      )
      .eq('tenant_id', tenantId)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`);

    if (error) {
      throw error;
    }

    const nexusCodes = (data || [])
      .map((item: { tax_jurisdictions: { code: string } | { code: string }[] | null }) => {
        const jurisdiction = item.tax_jurisdictions;
        if (Array.isArray(jurisdiction)) {
          return jurisdiction[0]?.code;
        }
        return jurisdiction?.code;
      })
      .filter((code): code is string => Boolean(code));

    this.setCacheValue(TaxService.nexusCache, cacheKey, nexusCodes);
    return nexusCodes;
  }

  private async calculateForJurisdiction(jurisdictionCode: string, items: TaxCalculationItem[]) {
    const rules = await this.getTaxRules(jurisdictionCode);
    const standardRule = rules.find((rule) => !rule.tax_codes);
    const standardRate = standardRule ? Number(standardRule.rate) : 0;

    let totalTax = 0;
    const lineItems = items.map((item) => {
      let applicableRate = standardRate;

      if (item.taxCode) {
        const specificRule = rules.find((rule) => {
          if (!rule.tax_codes) {
            return false;
          }
          const code = Array.isArray(rule.tax_codes) ? rule.tax_codes[0]?.code : rule.tax_codes.code;
          return code === item.taxCode;
        });
        if (specificRule) {
          applicableRate = Number(specificRule.rate);
        }
      }

      const itemTax = item.amount * applicableRate;
      totalTax += itemTax;

      return {
        id: item.id,
        taxAmount: Number(itemTax.toFixed(2)),
        taxRate: applicableRate
      };
    });

    const taxableAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const breakdown =
      totalTax > 0 && taxableAmount > 0
        ? [
            {
              level: 'JURISDICTION',
              rate: Number((totalTax / taxableAmount).toFixed(4)),
              amount: Number(totalTax.toFixed(2))
            }
          ]
        : [];

    return {
      totalTax: Number(totalTax.toFixed(2)),
      breakdown,
      lineItems
    };
  }

  private async getTaxRules(jurisdictionCode: string): Promise<TaxRuleRow[]> {
    const cached = this.getCacheValue(TaxService.taxRuleCache, jurisdictionCode);
    if (cached) {
      return cached;
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .schema('finance')
      .from('tax_rules')
      .select(
        `
        rate,
        tax_codes (
          code
        ),
        tax_jurisdictions!inner (
          code
        )
      `
      )
      .eq('tax_jurisdictions.code', jurisdictionCode)
      .lte('effective_from', now)
      .or(`effective_to.is.null,effective_to.gte.${now}`)
      .order('priority', { ascending: false });

    if (error) {
      throw error;
    }

    const rules = (data || []) as TaxRuleRow[];
    this.setCacheValue(TaxService.taxRuleCache, jurisdictionCode, rules);
    return rules;
  }

  private getCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
    cache.set(key, {
      value,
      expiresAt: Date.now() + TaxService.cacheTtlMs
    });
  }

  private logLatency(startedAt: number, tenantId: string, jurisdictionCode: string): void {
    const latencyMs = Date.now() - startedAt;
    if (latencyMs > TaxService.latencyWarnMs) {
      logger.warn('Tax calculation latency threshold exceeded', {
        tenantId,
        jurisdictionCode,
        latencyMs,
        thresholdMs: TaxService.latencyWarnMs
      });
    }
  }

  private async getValidExemptionCertificate(
    tenantId: string,
    accountId: string
  ): Promise<TaxExemptionCertificate | null> {
    const { data, error } = await this.supabase
      .from('accounts')
      .select('custom_fields')
      .eq('id', accountId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.extractValidCertificate(data as AccountRow);
  }

  private extractValidCertificate(account: AccountRow): TaxExemptionCertificate | null {
    const customFields = account.custom_fields;
    if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) {
      return null;
    }

    const candidate = (customFields as Record<string, unknown>).tax_exemption_certificate;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return null;
    }

    const certificate = candidate as Record<string, unknown>;
    const certificateNumber = certificate.certificateNumber;
    const issuingAuthority = certificate.issuingAuthority;
    const exemptionType = certificate.exemptionType;
    const expirationDate = certificate.expirationDate;
    const uploadedAt = certificate.uploadedAt;
    const documentUrl = certificate.documentUrl;
    const uploadedBy = certificate.uploadedBy;

    if (
      typeof certificateNumber !== 'string' ||
      typeof issuingAuthority !== 'string' ||
      typeof exemptionType !== 'string' ||
      typeof expirationDate !== 'string' ||
      typeof uploadedAt !== 'string'
    ) {
      return null;
    }

    const expiration = new Date(expirationDate);
    if (Number.isNaN(expiration.getTime())) {
      return null;
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (expiration < now) {
      return null;
    }

    return {
      certificateNumber,
      issuingAuthority,
      exemptionType,
      expirationDate,
      uploadedAt,
      documentUrl: typeof documentUrl === 'string' ? documentUrl : undefined,
      uploadedBy: typeof uploadedBy === 'string' ? uploadedBy : undefined
    };
  }
}
