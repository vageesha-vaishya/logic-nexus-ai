import { logger } from '@/lib/logger';
import { DomainQuotationIsolationService } from '@/services/quotation/DomainQuotationIsolationService';

type SupabaseAdmin = {
  from: (table: string) => any;
};

type DomainAssignmentInput = {
  tenantIds: string[];
  domainId: string;
  actorUserId: string;
  batchId: string;
};

export type DomainAssignmentResult = {
  batchId: string;
  domainId: string;
  attempted: number;
  assigned: number;
  reactivated: number;
  skipped: number;
};

export type DomainRevokeResult = {
  batchId: string;
  domainId: string;
  attempted: number;
  revoked: number;
  skipped: number;
};

export type DomainAuditLog = {
  id: string;
  action: string;
  tenant_id: string | null;
  domain_id: string | null;
  actor_user_id: string | null;
  batch_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

function sanitizeIds(values: string[]): string[] {
  return Array.from(new Set((values || []).map((item) => String(item || '').trim()).filter(Boolean)));
}

function ensurePayload(input: DomainAssignmentInput): DomainAssignmentInput {
  const tenantIds = sanitizeIds(input.tenantIds);
  const domainId = String(input.domainId || '').trim();
  const actorUserId = String(input.actorUserId || '').trim();
  const batchId = String(input.batchId || '').trim() || crypto.randomUUID();

  if (!tenantIds.length) throw new Error('tenantIds are required');
  if (!domainId) throw new Error('domainId is required');
  if (!actorUserId) throw new Error('actorUserId is required');

  return {
    tenantIds,
    domainId,
    actorUserId,
    batchId,
  };
}

function isMissingDomainAuditSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code || '').toUpperCase();
  const message = String((error as any)?.message || '').toLowerCase();
  if (code === '42P01' || code === '42703') {
    return true;
  }
  return message.includes('domain_audit_log') && (
    message.includes('does not exist')
    || message.includes('undefined column')
  );
}

export class DomainAssignmentService {
  constructor(
    private readonly supabase: SupabaseAdmin,
    private readonly domainIsolationService: DomainQuotationIsolationService = new DomainQuotationIsolationService(),
  ) {}

  async assignTenants(input: DomainAssignmentInput): Promise<DomainAssignmentResult> {
    const payload = ensurePayload(input);

    const { data: existingRows, error: existingError } = await this.supabase
      .from('domain_tenant')
      .select('tenant_id, is_active')
      .eq('domain_id', payload.domainId)
      .in('tenant_id', payload.tenantIds);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingByTenant = new Map<string, boolean>();
    for (const row of existingRows || []) {
      existingByTenant.set(String(row.tenant_id), Boolean(row.is_active));
    }

    const upsertRows = payload.tenantIds.map((tenantId) => ({
      tenant_id: tenantId,
      domain_id: payload.domainId,
      assigned_by: payload.actorUserId,
      assigned_at: new Date().toISOString(),
      is_active: true,
    }));

    const { error: upsertError } = await this.supabase
      .from('domain_tenant')
      .upsert(upsertRows, { onConflict: 'tenant_id,domain_id' });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    const assigned = payload.tenantIds.filter((tenantId) => !existingByTenant.has(tenantId)).length;
    const reactivated = payload.tenantIds.filter((tenantId) => existingByTenant.get(tenantId) === false).length;
    const skipped = payload.tenantIds.length - assigned - reactivated;

    await this.writeAuditRows(payload, 'ASSIGN', {
      assigned,
      reactivated,
      skipped,
    });

    if (assigned > 0 || reactivated > 0) {
      const domainCode = await this.resolveDomainCode(payload.domainId);
      if (domainCode) {
        await this.domainIsolationService.onDomainAssign(this.supabase as any, {
          domainId: payload.domainId,
          domainCode,
          assignedBy: payload.actorUserId,
        });
      }
    }

    logger.info('[DomainAssignmentService] tenant bulk assignment complete', {
      batchId: payload.batchId,
      domainId: payload.domainId,
      attempted: payload.tenantIds.length,
      assigned,
      reactivated,
      skipped,
    });

    return {
      batchId: payload.batchId,
      domainId: payload.domainId,
      attempted: payload.tenantIds.length,
      assigned,
      reactivated,
      skipped,
    };
  }

  async revokeTenants(input: DomainAssignmentInput): Promise<DomainRevokeResult> {
    const payload = ensurePayload(input);

    const { data: existingRows, error: existingError } = await this.supabase
      .from('domain_tenant')
      .select('tenant_id, is_active')
      .eq('domain_id', payload.domainId)
      .in('tenant_id', payload.tenantIds);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const activeTenantIds = (existingRows || [])
      .filter((row: any) => Boolean(row.is_active))
      .map((row: any) => String(row.tenant_id));

    if (activeTenantIds.length > 0) {
      const { error: deactivateError } = await this.supabase
        .from('domain_tenant')
        .update({ is_active: false })
        .eq('domain_id', payload.domainId)
        .in('tenant_id', activeTenantIds);

      if (deactivateError) {
        throw new Error(deactivateError.message);
      }
    }

    const revoked = activeTenantIds.length;
    const skipped = payload.tenantIds.length - revoked;

    await this.writeAuditRows(payload, 'REVOKE', {
      revoked,
      skipped,
    });

    if (revoked > 0) {
      const domainCode = await this.resolveDomainCode(payload.domainId);
      if (domainCode) {
        this.domainIsolationService.onDomainRevoke({
          domainId: payload.domainId,
          domainCode,
          revokedBy: payload.actorUserId,
        });
      }
    }

    logger.info('[DomainAssignmentService] tenant bulk revoke complete', {
      batchId: payload.batchId,
      domainId: payload.domainId,
      attempted: payload.tenantIds.length,
      revoked,
      skipped,
    });

    return {
      batchId: payload.batchId,
      domainId: payload.domainId,
      attempted: payload.tenantIds.length,
      revoked,
      skipped,
    };
  }

  async listAuditHistory(params: {
    tenantId?: string;
    domainId?: string;
    batchId?: string;
    limit?: number;
  }): Promise<DomainAuditLog[]> {
    let query = this.supabase
      .from('domain_audit_log')
      .select('id, action, tenant_id, domain_id, actor_user_id, batch_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(Number(params.limit || 50), 1), 200));

    if (params.tenantId) query = query.eq('tenant_id', params.tenantId);
    if (params.domainId) query = query.eq('domain_id', params.domainId);
    if (params.batchId) query = query.eq('batch_id', params.batchId);

    const { data, error } = await query;
    if (error) {
      if (isMissingDomainAuditSchemaError(error)) {
        logger.warn('[DomainAssignmentService] domain audit history unavailable, returning empty list', {
          message: (error as any)?.message || 'unknown',
          code: (error as any)?.code || null,
        });
        return [];
      }
      throw new Error(error.message);
    }
    return (data || []) as DomainAuditLog[];
  }

  private async writeAuditRows(
    payload: DomainAssignmentInput,
    action: 'ASSIGN' | 'REVOKE',
    summary: Record<string, unknown>,
  ): Promise<void> {
    const rows = payload.tenantIds.map((tenantId) => ({
      tenant_id: tenantId,
      domain_id: payload.domainId,
      action: `DOMAIN_${action}`,
      actor_user_id: payload.actorUserId,
      batch_id: payload.batchId,
      metadata: summary,
    }));

    const { error } = await this.supabase.from('domain_audit_log').insert(rows);
    if (error) {
      if (isMissingDomainAuditSchemaError(error)) {
        logger.warn('[DomainAssignmentService] domain audit write skipped due to unavailable schema', {
          message: (error as any)?.message || 'unknown',
          code: (error as any)?.code || null,
          batchId: payload.batchId,
          domainId: payload.domainId,
        });
        return;
      }
      throw new Error(error.message);
    }
  }

  private async resolveDomainCode(domainId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('platform_domains')
      .select('code')
      .eq('id', domainId)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    const code = String((data as any)?.code || '').trim().toUpperCase();
    return code || null;
  }
}
