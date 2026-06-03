// Phase 6 Comms — admin hooks for the WhatsApp phone-edit page.
//
// Talks to services/comms-api admin-whatsapp routes:
//   GET   /api/v1/admin/phones
//   PATCH /api/v1/admin/phones/:id
//   POST  /api/v1/admin/phones/whatsapp-bulk-enable
//
// Platform-admin gated server-side. The /dashboard/admin/whatsapp-phones
// route is also PLATFORM_ADMIN_ROLE-gated client-side so non-admins
// don't see the page at all.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const BASE = '/api/comms/v1/admin/phones';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token ?? '';
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const errBody = body as { error?: string; code?: string } | null;
    throw new Error(errBody?.error ?? `comms-api returned ${res.status}`);
  }
  return body as T;
}

export interface AdminPhoneRow {
  id: string;
  e164: string;
  country: string | null;
  whatsapp_capable: boolean;
  verified_at: string | null;
  updated_at: string;
  party_id: string | null;
  party_display_name: string | null;
}

export interface AdminPhoneListResponse {
  items: AdminPhoneRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminPhoneFilters {
  tenant_id: string;
  capable?: boolean;
  country_code?: string;
  limit?: number;
  offset?: number;
}

export function useAdminPhoneList(filters: AdminPhoneFilters) {
  return useQuery({
    queryKey: ['admin', 'comms', 'phones', filters],
    enabled: Boolean(filters.tenant_id),
    queryFn: async (): Promise<AdminPhoneListResponse> => {
      const params = new URLSearchParams({ tenant_id: filters.tenant_id });
      if (filters.capable !== undefined) params.set('capable', String(filters.capable));
      if (filters.country_code) params.set('country_code', filters.country_code);
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.offset) params.set('offset', String(filters.offset));
      const res = await fetch(`${BASE}?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: await authHeaders(),
      });
      return parseOrThrow<AdminPhoneListResponse>(res);
    },
    staleTime: 30_000,
  });
}

export function useToggleWhatsappCapable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; whatsapp_capable: boolean }) => {
      const res = await fetch(`${BASE}/${encodeURIComponent(input.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: await authHeaders(),
        body: JSON.stringify({ whatsapp_capable: input.whatsapp_capable }),
      });
      return parseOrThrow<{ data: { id: string; e164: string; whatsapp_capable: boolean } }>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'comms', 'phones'] });
    },
    onError: (e: unknown) => {
      toast.error(`Update failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}

export function useBulkEnableWhatsapp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tenant_id: string; country_code?: string; dry_run?: boolean }) => {
      const res = await fetch(`${BASE}/whatsapp-bulk-enable`, {
        method: 'POST',
        credentials: 'include',
        headers: await authHeaders(),
        body: JSON.stringify(input),
      });
      return parseOrThrow<{
        matched: number;
        updated: number;
        dry_run: boolean;
        sample: Array<{ id: string; e164: string; country: string | null }>;
      }>(res);
    },
    onSuccess: (result) => {
      const msg = result.dry_run
        ? `Dry run: ${result.matched} phones would be enabled`
        : `Enabled ${result.updated} phones`;
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ['admin', 'comms', 'phones'] });
    },
    onError: (e: unknown) => {
      toast.error(`Bulk enable failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
