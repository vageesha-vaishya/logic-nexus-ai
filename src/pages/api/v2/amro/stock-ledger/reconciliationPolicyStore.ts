import { parseReconciliationPolicy, type ReconciliationPolicy, DEFAULT_RECONCILIATION_POLICY } from './shared';

type SupabaseAdmin = {
  from: (table: string) => any;
};

const POLICY_KEY = 'stock_ledger_reconciliation_policy';

export async function loadReconciliationPolicy(
  supabase: SupabaseAdmin,
  tenantId: string,
): Promise<ReconciliationPolicy> {
  const { data, error } = await supabase
    .from('tenant_profile')
    .select('emergency_contact_info')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  const info = (data?.emergency_contact_info && typeof data.emergency_contact_info === 'object')
    ? (data.emergency_contact_info as Record<string, unknown>)
    : {};
  return parseReconciliationPolicy(info[POLICY_KEY], DEFAULT_RECONCILIATION_POLICY);
}

export async function saveReconciliationPolicy(
  supabase: SupabaseAdmin,
  tenantId: string,
  policyInput: unknown,
): Promise<ReconciliationPolicy> {
  const policy = parseReconciliationPolicy(policyInput, DEFAULT_RECONCILIATION_POLICY);
  const { data, error } = await supabase
    .from('tenant_profile')
    .select('tenant_id,emergency_contact_info')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;

  const currentInfo = (data?.emergency_contact_info && typeof data.emergency_contact_info === 'object')
    ? (data.emergency_contact_info as Record<string, unknown>)
    : {};
  const mergedInfo = {
    ...currentInfo,
    [POLICY_KEY]: policy,
  };

  if (!data?.tenant_id) {
    const { error: insertError } = await supabase.from('tenant_profile').insert({
      tenant_id: tenantId,
      emergency_contact_info: mergedInfo,
    });
    if (insertError) throw insertError;
    return policy;
  }

  const { error: updateError } = await supabase
    .from('tenant_profile')
    .update({
      emergency_contact_info: mergedInfo,
    })
    .eq('tenant_id', tenantId);
  if (updateError) throw updateError;
  return policy;
}
