// Phase 3 Task 11 — CRM audit logging for contact operations.
//
// crm-api has no first-party routes as of the Phase 5 lift (see app.ts:
// "crm-api is a shim post-Phase-5; no first-party routes remain."). There is
// also no contacts route/service anywhere in services/ yet — contact CRUD is
// currently performed directly from the frontend against Supabase. These
// hooks are provided as a ready-to-wire audit shim for whichever service
// eventually owns contact routes (crm-api per its "future slices" note, or a
// dedicated service), matching the pattern established for leads in
// services/sales-api/src/services/audit/leads.ts.
//
// The frontend CRMAuditService (src/lib/crm-audit.ts) is browser-only: it
// wraps a user-session Supabase client supplied via `.initialize()` from
// src/main.tsx and is not reachable from this standalone Node service (no
// npm workspaces / `@/` path alias link the two packages). This module
// instead writes directly to `crm_audit_logs` using a service-role Supabase
// client, mirroring src/lib/crm-audit.ts's logContactCreated/Updated/
// Interaction methods field-for-field.
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

function computeChangeSet(
  oldValues: Record<string, any> | null | undefined,
  newValues: Record<string, any> | null | undefined
): { changed_fields: string[]; old_values: Record<string, any>; new_values: Record<string, any> } {
  const keys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]);
  const changed_fields: string[] = [];
  const old_values: Record<string, any> = {};
  const new_values: Record<string, any> = {};
  keys.forEach((key) => {
    const before = (oldValues || {})[key];
    const after = (newValues || {})[key];
    if (before !== after) {
      changed_fields.push(key);
      old_values[key] = before;
      new_values[key] = after;
    }
  });
  return { changed_fields, old_values, new_values };
}

async function insertAuditLog(record: Record<string, unknown>): Promise<void> {
  const supabase = getAuditClient();
  if (!supabase) {
    logger.warn('Skipping contact audit log: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  const { error } = await supabase.from('crm_audit_logs').insert(record);
  if (error) {
    throw new Error(error.message);
  }
}

export async function auditContactCreated(
  contactId: string,
  leadId: string,
  contactData: Record<string, any>,
  tenantId: string,
  franchiseId?: string | null,
  actor?: AuditActor
): Promise<void> {
  try {
    await insertAuditLog({
      action: 'create',
      entity_type: 'contact',
      entity_id: contactId,
      related_entity_id: leadId,
      related_entity_type: 'lead',
      new_values: contactData,
      changed_fields: Object.keys(contactData || {}),
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
      user_id: actor?.userId ?? null,
      user_email: actor?.userEmail ?? null,
    });
  } catch (error) {
    logger.warn('Failed to audit contact creation:', error);
  }
}

export async function auditContactUpdated(
  contactId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  tenantId: string,
  franchiseId?: string | null,
  actor?: AuditActor
): Promise<void> {
  try {
    const { changed_fields, old_values, new_values } = computeChangeSet(oldData, newData);
    if (changed_fields.length === 0) return;
    await insertAuditLog({
      action: 'update',
      entity_type: 'contact',
      entity_id: contactId,
      old_values,
      new_values,
      changed_fields,
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
      user_id: actor?.userId ?? null,
      user_email: actor?.userEmail ?? null,
    });
  } catch (error) {
    logger.warn('Failed to audit contact update:', error);
  }
}

export async function auditContactInteraction(
  contactId: string,
  type: 'call' | 'email' | 'meeting',
  details: Record<string, any>,
  tenantId: string,
  franchiseId?: string | null,
  actor?: AuditActor
): Promise<void> {
  try {
    await insertAuditLog({
      action: 'interaction',
      entity_type: 'interaction',
      entity_id: `${contactId}-${Date.now()}`,
      related_entity_id: contactId,
      related_entity_type: 'contact',
      new_values: details,
      metadata: { interaction_type: type },
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
      user_id: actor?.userId ?? null,
      user_email: actor?.userEmail ?? null,
    });
  } catch (error) {
    logger.warn('Failed to audit contact interaction:', error);
  }
}
