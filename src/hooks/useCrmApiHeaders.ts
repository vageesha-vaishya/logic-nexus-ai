import { useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';

export interface CrmApiHeaderOverrides {
  /** Overrides context.tenantId, e.g. for a platform admin creating a record on behalf of another tenant. */
  tenantId?: string;
  franchiseId?: string;
}

export function useCrmApiHeaders() {
  const { supabase, context } = useCRM();

  return useCallback(async (overrides?: CrmApiHeaderOverrides) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || '';
    const tenantId = overrides?.tenantId || context?.tenantId || '';
    const franchiseId = overrides?.franchiseId || context?.franchiseId || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      ...(franchiseId ? { 'x-franchise-id': franchiseId } : {}),
      ...(context?.userId ? { 'x-user-id': context.userId } : {}),
    };
  }, [context?.franchiseId, context?.tenantId, context?.userId, supabase.auth]);
}
