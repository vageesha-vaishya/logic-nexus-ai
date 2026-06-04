// useTenantTaxRules — read + update the single per-tenant tax rules
// row. Apply-preset uses the seed_default_tax_rules_for_tenant RPC.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type TaxLabel = 'GST' | 'VAT' | 'Sales Tax' | 'Service Tax' | 'None';

export interface TenantTaxRules {
  id: string;
  tenant_id: string;
  jurisdiction: string;
  tax_label: TaxLabel;
  default_rate_pct: number | null;
  reverse_charge_applicable_codes: string[];
  zero_rated_charges: string[];
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ['finance', 'tenant_tax_rules'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const taxTable = () => (supabase as any).schema('finance').from('tenant_tax_rules');

export function useTenantTaxRules() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<TenantTaxRules | null> => {
      const { data, error } = await taxTable().select('*').limit(1).maybeSingle();
      if (error) throw error;
      return (data as TenantTaxRules | null) ?? null;
    },
  });
}

export function useApplyTaxPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tenantId: string; jurisdiction: string }): Promise<TenantTaxRules> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        'seed_default_tax_rules_for_tenant',
        { p_tenant_id: input.tenantId, p_jurisdiction: input.jurisdiction },
      );
      if (error) throw error;
      return data as TenantTaxRules;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`Applied ${row.tax_label} preset (${row.jurisdiction})`);
    },
    onError: (e: unknown) => {
      toast.error(`Failed to apply preset: ${(e as Error).message}`);
    },
  });
}

export function useUpdateTenantTaxRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<Omit<TenantTaxRules, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<void> => {
      const { id, ...rest } = input;
      const { error } = await taxTable().update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Tax rules updated');
    },
    onError: (e: unknown) => {
      toast.error(`Failed to update tax rules: ${(e as Error).message}`);
    },
  });
}
