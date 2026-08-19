// Phase 1 Task 3 — CRM audit logging for lead operations.
//
// The lead routes were lifted from crm-api to sales-api in Phase 4 Sales
// Step 4 (see services/crm-api/src/app.ts, which is now a shim with no
// first-party routes). Audit hooks are colocated here for that reason.
//
// The frontend CRMAuditService (src/lib/crm-audit.ts) is browser-only: it
// wraps a user-session Supabase client supplied via `.initialize()` from
// src/main.tsx and is not reachable from this standalone Node service (no
// npm workspaces / `@/` path alias link the two packages). This module
// instead writes directly to `crm_audit_logs` using a service-role Supabase
// client, mirroring the pattern already used by LeadsService.getClient()
// and crm-api's `auditApiRequest` request logger.
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger.js';

type AuditAction = 'created' | 'updated' | 'deleted';

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

function computeChangedFields(
  oldValues: Record<string, any> | null | undefined,
  newValues: Record<string, any> | null | undefined
): string[] {
  const keys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]);
  const changed: string[] = [];
  keys.forEach((key) => {
    if ((oldValues || {})[key] !== (newValues || {})[key]) {
      changed.push(key);
    }
  });
  return changed;
}

async function insertAuditLog(entry: {
  action: AuditAction;
  leadId: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  changedFields: string[] | null;
  tenantId: string;
  franchiseId?: string | null;
  actor?: AuditActor;
}): Promise<void> {
  const supabase = getAuditClient();
  if (!supabase) {
    logger.warn('Skipping lead audit log: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  const { error } = await supabase.from('crm_audit_logs').insert({
    tenant_id: entry.tenantId,
    franchise_id: entry.franchiseId ?? null,
    user_id: entry.actor?.userId ?? null,
    user_email: entry.actor?.userEmail ?? null,
    action: entry.action,
    entity_type: 'lead',
    entity_id: entry.leadId,
    old_values: entry.oldValues,
    new_values: entry.newValues,
    changed_fields: entry.changedFields,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function auditLeadCreated(
  leadId: string,
  leadData: Record<string, any>,
  tenantId: string,
  franchiseId?: string | null,
  actor?: AuditActor
): Promise<void> {
  try {
    await insertAuditLog({
      action: 'created',
      leadId,
      oldValues: null,
      newValues: leadData,
      changedFields: Object.keys(leadData || {}),
      tenantId,
      franchiseId,
      actor,
    });
  } catch (error) {
    logger.warn('Failed to audit lead creation:', error);
  }
}

export async function auditLeadUpdated(
  leadId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  tenantId: string,
  franchiseId?: string | null,
  actor?: AuditActor
): Promise<void> {
  try {
    await insertAuditLog({
      action: 'updated',
      leadId,
      oldValues: oldData,
      newValues: newData,
      changedFields: computeChangedFields(oldData, newData),
      tenantId,
      franchiseId,
      actor,
    });
  } catch (error) {
    logger.warn('Failed to audit lead update:', error);
  }
}

export async function auditLeadDeleted(
  leadId: string,
  leadData: Record<string, any>,
  tenantId: string,
  franchiseId?: string | null,
  actor?: AuditActor
): Promise<void> {
  try {
    await insertAuditLog({
      action: 'deleted',
      leadId,
      oldValues: leadData,
      newValues: null,
      changedFields: Object.keys(leadData || {}),
      tenantId,
      franchiseId,
      actor,
    });
  } catch (error) {
    logger.warn('Failed to audit lead deletion:', error);
  }
}
