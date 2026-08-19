// Phase 3 Task 11 — CRM audit logging for opportunity operations.
//
// See contacts.ts in this same directory for the full rationale: crm-api has
// no first-party routes (app.ts confirms it's a post-Phase-5 shim), and there
// is no opportunities route/service anywhere in services/ yet. This module is
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
    logger.warn('Skipping opportunity audit log: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  const { error } = await supabase.from('crm_audit_logs').insert(record);
  if (error) {
    throw new Error(error.message);
  }
}

export async function auditOpportunityCreated(
  opportunityId: string,
  leadId: string,
  oppData: Record<string, any>,
  tenantId: string,
  franchiseId?: string | null,
  actor?: AuditActor
): Promise<void> {
  try {
    await insertAuditLog({
      action: 'create',
      entity_type: 'opportunity',
      entity_id: opportunityId,
      related_entity_id: leadId,
      related_entity_type: 'lead',
      new_values: oppData,
      changed_fields: Object.keys(oppData || {}),
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
      user_id: actor?.userId ?? null,
      user_email: actor?.userEmail ?? null,
    });
  } catch (error) {
    logger.warn('Failed to audit opportunity creation:', error);
  }
}

export async function auditPipelineMove(
  opportunityId: string,
  fromStage: string,
  toStage: string,
  tenantId: string,
  franchiseId?: string | null,
  actor?: AuditActor
): Promise<void> {
  try {
    await insertAuditLog({
      action: 'move',
      entity_type: 'opportunity',
      entity_id: opportunityId,
      metadata: { stage_from: fromStage, stage_to: toStage },
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
      user_id: actor?.userId ?? null,
      user_email: actor?.userEmail ?? null,
    });
  } catch (error) {
    logger.warn('Failed to audit pipeline move:', error);
  }
}
