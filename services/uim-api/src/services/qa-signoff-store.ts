// Phase 7 UIM Step 4b.15 follow-up — DB-backed QA signoff store.
//
// Replaces the 4b.15 in-memory append-only Map with reads/writes
// against uim.qa_signoffs. The public function names + signatures
// are preserved with one breaking change: all three are now async.
// Callers (analytics-tail routes) await the results.
//
// Append-only contract: createUimQaSignoffRecord always inserts a
// new row; revocation is a new signoff_status='revoked' row, not an
// UPDATE.

import { createClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';

export type UimQaSignoffRecord = {
  signoff_id: string;
  tenant_id: string;
  franchise_id: string | null;
  signoff_status: 'signed_off' | 'revoked';
  signed_off_by: string;
  signed_off_role: string;
  signed_off_at: string;
  checklist: {
    reconciliation_verified: boolean;
    latency_target_met: boolean;
    data_dictionary_published: boolean;
    bi_cube_deployed: boolean;
  };
  notes: string;
};

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('uim-api QA signoff store requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecord(row: any): UimQaSignoffRecord {
  return {
    signoff_id: String(row.signoff_id),
    tenant_id: String(row.tenant_id),
    franchise_id: row.franchise_id ? String(row.franchise_id) : null,
    signoff_status: row.signoff_status === 'revoked' ? 'revoked' : 'signed_off',
    signed_off_by: String(row.signed_off_by || ''),
    signed_off_role: String(row.signed_off_role || ''),
    signed_off_at: String(row.signed_off_at || ''),
    checklist: {
      reconciliation_verified: Boolean(row.reconciliation_verified),
      latency_target_met: Boolean(row.latency_target_met),
      data_dictionary_published: Boolean(row.data_dictionary_published),
      bi_cube_deployed: Boolean(row.bi_cube_deployed),
    },
    notes: String(row.notes || ''),
  };
}

export async function listUimQaSignoffRecords(
  tenantId: string,
  franchiseId?: string | null,
): Promise<UimQaSignoffRecord[]> {
  try {
    const supabase = getServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (supabase as any)
      .schema('uim')
      .from('qa_signoffs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('signed_off_at', { ascending: false });
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    } else {
      query = query.is('franchise_id', null);
    }
    const { data, error } = await query;
    if (error) {
      logger.warn('qa-signoff list failed', { error: error.message });
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data || []) as any[]).map(rowToRecord);
  } catch (err) {
    logger.warn('qa-signoff list crashed', { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export async function getLatestUimQaSignoffRecord(
  tenantId: string,
  franchiseId?: string | null,
): Promise<UimQaSignoffRecord | null> {
  const records = await listUimQaSignoffRecords(tenantId, franchiseId);
  return records[0] || null;
}

export async function createUimQaSignoffRecord(input: {
  tenant_id: string;
  franchise_id?: string | null;
  signoff_status: 'signed_off' | 'revoked';
  signed_off_by: string;
  signed_off_role: string;
  checklist: UimQaSignoffRecord['checklist'];
  notes?: string;
}): Promise<UimQaSignoffRecord> {
  const next: UimQaSignoffRecord = {
    signoff_id: `uim-signoff-${input.tenant_id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenant_id: input.tenant_id,
    franchise_id: input.franchise_id || null,
    signoff_status: input.signoff_status,
    signed_off_by: input.signed_off_by,
    signed_off_role: input.signed_off_role,
    signed_off_at: new Date().toISOString(),
    checklist: {
      reconciliation_verified: Boolean(input.checklist.reconciliation_verified),
      latency_target_met: Boolean(input.checklist.latency_target_met),
      data_dictionary_published: Boolean(input.checklist.data_dictionary_published),
      bi_cube_deployed: Boolean(input.checklist.bi_cube_deployed),
    },
    notes: String(input.notes || '').trim(),
  };

  const supabase = getServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .schema('uim')
    .from('qa_signoffs')
    .insert({
      signoff_id: next.signoff_id,
      tenant_id: next.tenant_id,
      franchise_id: next.franchise_id,
      signoff_status: next.signoff_status,
      signed_off_by: next.signed_off_by,
      signed_off_role: next.signed_off_role,
      signed_off_at: next.signed_off_at,
      reconciliation_verified: next.checklist.reconciliation_verified,
      latency_target_met: next.checklist.latency_target_met,
      data_dictionary_published: next.checklist.data_dictionary_published,
      bi_cube_deployed: next.checklist.bi_cube_deployed,
      notes: next.notes,
    });
  if (error) {
    throw new Error(`Failed to create QA signoff: ${error.message}`);
  }
  return next;
}
