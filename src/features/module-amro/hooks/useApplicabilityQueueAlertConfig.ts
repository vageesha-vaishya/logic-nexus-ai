// useApplicabilityQueueAlertConfig — hooks for the amro queue-depth
// notification config (table amro.applicability_queue_alert_config,
// RPC amro.configure_applicability_queue_alerts).
//
// Per AOG/Directive Applicability S8 admin UI follow-up.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface QueueAlertConfig {
  tenant_id: string;
  enabled: boolean;
  threshold: number;
  recipient_role_id: string | null;
  recipient_user_id: string | null;
  recipient_team_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfigureInput {
  tenant_id: string;
  enabled: boolean;
  threshold?: number;
  recipient_role_id?: string | null;
  recipient_user_id?: string | null;
  recipient_team_id?: string | null;
  notes?: string | null;
}

const KEY = ['amro', 'applicability_queue_alert_config'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const amroTable = () => (supabase as any).schema('amro').from('applicability_queue_alert_config');

export function useApplicabilityQueueAlertConfig() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<QueueAlertConfig | null> => {
      const { data, error } = await amroTable().select('*').limit(1).maybeSingle();
      if (error) throw error;
      return (data as QueueAlertConfig | null) ?? null;
    },
  });
}

export function useConfigureApplicabilityQueueAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConfigureInput): Promise<QueueAlertConfig> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        'configure_applicability_queue_alerts',
        {
          p_tenant_id: input.tenant_id,
          p_enabled: input.enabled,
          p_threshold: input.threshold ?? 20,
          p_recipient_role_id: input.recipient_role_id ?? null,
          p_recipient_user_id: input.recipient_user_id ?? null,
          p_recipient_team_id: input.recipient_team_id ?? null,
          p_notes: input.notes ?? null,
        },
      );
      if (error) throw error;
      return data as QueueAlertConfig;
    },
    onSuccess: (cfg) => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success(
        cfg.enabled
          ? `Alerts enabled — threshold ${cfg.threshold}`
          : 'Alerts disabled',
      );
    },
    onError: (e: unknown) => {
      toast.error(`Failed to save config: ${(e as Error).message}`);
    },
  });
}

export interface AuthRole {
  id: string;
  label: string;
  description: string | null;
}

export function useAuthRoles() {
  return useQuery({
    queryKey: ['auth_roles'],
    queryFn: async (): Promise<AuthRole[]> => {
      const { data, error } = await supabase
        .from('auth_roles')
        .select('id, label, description')
        .order('label');
      if (error) throw error;
      return (data as AuthRole[]) ?? [];
    },
  });
}
