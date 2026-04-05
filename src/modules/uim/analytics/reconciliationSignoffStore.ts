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

type ScopeKey = string;

const signoffStore = new Map<ScopeKey, UimQaSignoffRecord[]>();

function buildScopeKey(tenantId: string, franchiseId?: string | null): ScopeKey {
  return `${tenantId}::${franchiseId || ''}`;
}

export function listUimQaSignoffRecords(tenantId: string, franchiseId?: string | null): UimQaSignoffRecord[] {
  const key = buildScopeKey(tenantId, franchiseId);
  const records = signoffStore.get(key) || [];
  return [...records].sort((a, b) => b.signed_off_at.localeCompare(a.signed_off_at));
}

export function getLatestUimQaSignoffRecord(tenantId: string, franchiseId?: string | null): UimQaSignoffRecord | null {
  const records = listUimQaSignoffRecords(tenantId, franchiseId);
  return records[0] || null;
}

export function createUimQaSignoffRecord(input: {
  tenant_id: string;
  franchise_id?: string | null;
  signoff_status: 'signed_off' | 'revoked';
  signed_off_by: string;
  signed_off_role: string;
  checklist: UimQaSignoffRecord['checklist'];
  notes?: string;
}): UimQaSignoffRecord {
  const key = buildScopeKey(input.tenant_id, input.franchise_id);
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
  const records = signoffStore.get(key) || [];
  records.push(next);
  signoffStore.set(key, records);
  return next;
}

export function resetUimQaSignoffStore(): void {
  signoffStore.clear();
}
