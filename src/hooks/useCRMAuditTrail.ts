import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_email: string;
  user_name: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_fields: string[] | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface CRMAuditTrailOptions {
  entityType?: string;
  entityId?: string;
  limit?: number;
}

// NOTE: `crm_audit_logs` is not yet present in the generated Supabase
// `Database` types (src/integrations/supabase/types.ts). Cast to `any` at
// the client boundary so this hook can query the table without waiting on
// a types regeneration pass, matching the existing pattern used elsewhere
// in the codebase for tables ahead of the generated types.
const auditLogsClient = supabase as any;

export function useCRMAuditTrail(options: CRMAuditTrailOptions) {
  const { entityType, entityId, limit = 50 } = options;
  const [liveData, setLiveData] = useState<AuditLog[]>([]);

  // Fetch historical data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['crm-audit-trail', entityType, entityId, limit],
    queryFn: async () => {
      if (!entityType || !entityId) return [];

      try {
        const query = auditLogsClient
          .from('crm_audit_logs')
          .select('*')
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('created_at', { ascending: false })
          .limit(limit);

        const { data, error } = await query;

        if (error) {
          logger.error('Failed to fetch audit trail:', error);
          return [];
        }

        return data as AuditLog[];
      } catch (err) {
        logger.error('Error fetching audit trail:', err);
        return [];
      }
    },
    enabled: !!entityType && !!entityId,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!entityType || !entityId) return;

    const channel = supabase
      .channel(`crm_audit_${entityType}_${entityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_audit_logs',
          filter: `entity_id=eq.${entityId}`,
        },
        (payload: { new: AuditLog }) => {
          const newEntry = payload.new as AuditLog;
          setLiveData((prev) => [newEntry, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId]);

  return {
    data: [...liveData, ...(data || [])],
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}
