// useGlAccounts — list + mutate finance.gl_accounts for the
// configured tenant. Used by the admin chart-of-accounts page AND
// by the InvoiceLineClassifyPanel host insertion (which feeds the
// fetched chart straight into the LLM prompt input).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type GlAccountType =
  | 'revenue' | 'cost_of_sales' | 'expense'
  | 'pass_through_liability' | 'tax_payable' | 'tax_receivable' | 'other';

export interface GlAccount {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: GlAccountType;
  tags: string[];
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GlAccountWriteInput {
  code: string;
  name: string;
  type: GlAccountType;
  tags?: string[];
  description?: string | null;
  is_active?: boolean;
}

const QUERY_KEY = ['finance', 'gl_accounts'] as const;

// The finance schema isn't in the generated types, so we cast through
// `as any` at the supabase boundary. The hook's return type is fully
// typed; the cast just appeases the strongly-typed client.
function financeTable<T = unknown>() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).schema('finance').from('gl_accounts') as T;
}

export function useGlAccounts(includeInactive = false) {
  return useQuery({
    queryKey: [...QUERY_KEY, includeInactive],
    queryFn: async (): Promise<GlAccount[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = financeTable<any>().select('*').order('code');
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GlAccount[];
    },
  });
}

export function useCreateGlAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GlAccountWriteInput): Promise<GlAccount> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (financeTable<any>()
        .insert([{
          code: input.code,
          name: input.name,
          type: input.type,
          tags: input.tags ?? [],
          description: input.description ?? null,
          is_active: input.is_active ?? true,
        }])
        .select()
        .single());
      if (error) throw error;
      if (!data) throw new Error('insert returned null');
      return data as GlAccount;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('GL account created');
    },
    onError: (e: unknown) => {
      toast.error(`Failed to create GL account: ${(e as Error).message}`);
    },
  });
}

export function useUpdateGlAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<GlAccountWriteInput>): Promise<void> => {
      const { id, ...rest } = input;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (financeTable<any>().update(rest).eq('id', id));
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('GL account updated');
    },
    onError: (e: unknown) => {
      toast.error(`Failed to update GL account: ${(e as Error).message}`);
    },
  });
}

export function useSeedDefaultChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string): Promise<Array<{ code: string; action: string }>> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        'seed_default_chart_for_tenant',
        { p_tenant_id: tenantId },
      );
      if (error) throw error;
      return (data ?? []) as Array<{ code: string; action: string }>;
    },
    onSuccess: (rows) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      const inserted = rows.filter((r) => r.action === 'inserted').length;
      const skipped = rows.filter((r) => r.action === 'skipped_existing').length;
      toast.success(`Seeded ${inserted} new accounts (${skipped} already existed)`);
    },
    onError: (e: unknown) => {
      toast.error(`Failed to seed default chart: ${(e as Error).message}`);
    },
  });
}
