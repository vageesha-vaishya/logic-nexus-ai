import { useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';

export function useCrmApiHeaders() {
  const { supabase, context } = useCRM();

  return useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || '';
    const tenantId = context?.tenantId || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      ...(context?.franchiseId ? { 'x-franchise-id': context.franchiseId } : {}),
      ...(context?.userId ? { 'x-user-id': context.userId } : {}),
    };
  }, [context?.franchiseId, context?.tenantId, context?.userId, supabase.auth]);
}
