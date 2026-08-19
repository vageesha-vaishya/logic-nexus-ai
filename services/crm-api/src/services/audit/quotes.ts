// Phase 3 Task 11 — CRM audit logging for quote operations.
//
// See contacts.ts in this same directory for the full rationale: crm-api has
// no first-party routes (app.ts confirms it's a post-Phase-5 shim), and there
// is no quotes route/service anywhere in services/ yet (quote CRUD lives in
// src/services/quotation/CoreQuoteService.ts on the frontend). This module is
// a ready-to-wire audit shim, writing directly to `crm_audit_logs` with a
// service-role Supabase client rather than importing the browser-only
// src/lib/crm-audit.ts (unreachable from this standalone Node service).
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger.js';

export interface AuditActor {
  userId?: string | null;
  userEmail?: string | null;
}

function getAuditClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function insertAuditLog(record: Record<string, unknown>): Promise<void> {
  const supabase = getAuditClient();
  if (!supabase) {
    logger.warn('Skipping quote audit log: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  const { error } = await supabase.from('crm_audit_logs').insert(record);
  if (error) {
    throw new Error(error.message);
  }
}

export async function auditQuoteCreated(
  quoteId: string,
  opportunityId: string,
  quoteData: Record<string, any>,
  tenantId: string,
  franchiseId?: string | null,
  actor?: AuditActor
): Promise<void> {
  try {
    await insertAuditLog({
      action: 'create',
      entity_type: 'quote',
      entity_id: quoteId,
      related_entity_id: opportunityId,
      related_entity_type: 'opportunity',
      new_values: quoteData,
      changed_fields: Object.keys(quoteData || {}),
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
      user_id: actor?.userId ?? null,
      user_email: actor?.userEmail ?? null,
    });
  } catch (error) {
    logger.warn('Failed to audit quote creation:', error);
  }
}

export async function auditQuoteApproved(
  quoteId: string,
  tenantId: string,
  franchiseId?: string | null,
  actor?: AuditActor
): Promise<void> {
  try {
    await insertAuditLog({
      action: 'approve',
      entity_type: 'quote',
      entity_id: quoteId,
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
      user_id: actor?.userId ?? null,
      user_email: actor?.userEmail ?? null,
    });
  } catch (error) {
    logger.warn('Failed to audit quote approval:', error);
  }
}
