import { createClient } from '@supabase/supabase-js';
import { InvoiceRecord, FinalizeInvoiceResponse, InvoiceStatus } from '../types/crm.types.js';
import { financeEventsProducer } from '../events/finance-events.producer.js';
import { BillingEngineService } from './billing/billing-engine.service.js';

type FinalizationMetadata = {
  idempotency_key?: string;
  gl_job_id?: string;
  gl_mode?: 'kafka' | 'in_process';
  finalized_by?: string;
  finalized_at?: string;
};

export class InvoicesService {
  private supabase = this.createSupabaseClient();
  private billingEngine = new BillingEngineService();

  private createSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    return createClient(supabaseUrl, supabaseServiceKey);
  }

  async finalizeInvoice(
    invoiceId: string,
    tenantId: string,
    userId: string,
    franchiseId?: string,
    idempotencyKey?: string
  ): Promise<FinalizeInvoiceResponse> {
    const { data: invoice, error: invoiceError } = await this.getScopedInvoice(invoiceId, tenantId, franchiseId);

    if (invoiceError) {
      throw invoiceError;
    }

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const metadata = this.normalizeMetadata(invoice.metadata);
    const finalizationMetadata = this.extractFinalizationMetadata(metadata.finalization);

    if (idempotencyKey && finalizationMetadata.idempotency_key === idempotencyKey) {
      const replayJobId = finalizationMetadata.gl_job_id || this.buildGLJobId(tenantId, invoiceId);
      const tenantDomainCode = await this.resolveTenantDomainCode(tenantId);
      return {
        invoice,
        statusChanged: false,
        glSync: {
          queued: true,
          mode: finalizationMetadata.gl_mode || 'in_process',
          jobId: replayJobId,
        },
        idempotency: {
          key: idempotencyKey,
          replayed: true,
        },
        billing: this.billingEngine.generate(tenantDomainCode, invoice as InvoiceRecord)
      };
    }

    this.validateStatusForFinalize(invoice.status);

    const nextStatus = invoice.status === 'draft' ? 'issued' : invoice.status;
    const issueDate = invoice.issue_date || new Date().toISOString().slice(0, 10);
    const glSyncResult = await financeEventsProducer.enqueueInvoiceFinalized({
      tenantId,
      franchiseId: franchiseId || null,
      userId,
      invoiceId,
      idempotencyKey: idempotencyKey || null
    });
    const updatedMetadata = {
      ...metadata,
      finalization: {
        ...finalizationMetadata,
        idempotency_key: idempotencyKey,
        gl_job_id: glSyncResult.jobId,
        gl_mode: glSyncResult.mode,
        finalized_by: userId,
        finalized_at: new Date().toISOString(),
      },
    };

    const { data: updatedInvoice, error: updateError } = await this.supabase
      .from('invoices')
      .update({
        status: nextStatus,
        issue_date: issueDate,
        metadata: updatedMetadata,
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (updateError || !updatedInvoice) {
      throw updateError || new Error('Failed to update invoice');
    }

    const tenantDomainCode = await this.resolveTenantDomainCode(tenantId);

    return {
      invoice: updatedInvoice as InvoiceRecord,
      statusChanged: invoice.status !== nextStatus,
      glSync: glSyncResult,
      idempotency: {
        key: idempotencyKey || null,
        replayed: false,
      },
      billing: this.billingEngine.generate(tenantDomainCode, updatedInvoice as InvoiceRecord)
    };
  }

  private async getScopedInvoice(invoiceId: string, tenantId: string, franchiseId?: string) {
    let query = this.supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }

    return query.maybeSingle();
  }

  private validateStatusForFinalize(status: InvoiceStatus) {
    if (status === 'void' || status === 'cancelled') {
      throw new Error(`Invoice cannot be finalized from status ${status}`);
    }
  }

  private normalizeMetadata(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private extractFinalizationMetadata(value: unknown): FinalizationMetadata {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as FinalizationMetadata;
    }
    return {};
  }

  private buildGLJobId(tenantId: string, invoiceId: string): string {
    return `gl-sync:${tenantId}:INVOICE:${invoiceId}`;
  }

  private async resolveTenantDomainCode(tenantId: string): Promise<string> {
    const { data } = await this.supabase
      .from('tenants')
      .select(
        `
        domain_id,
        platform_domains (
          code
        )
      `
      )
      .eq('id', tenantId)
      .maybeSingle();

    if (!data) {
      return 'LOGISTICS';
    }

    const tenant = data as {
      platform_domains?: { code?: string } | { code?: string }[] | null;
    };
    const domain = tenant.platform_domains;
    if (Array.isArray(domain)) {
      return (domain[0]?.code || 'LOGISTICS').toUpperCase();
    }
    return (domain?.code || 'LOGISTICS').toUpperCase();
  }
}
