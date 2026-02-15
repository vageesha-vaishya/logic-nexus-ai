import { useCRM } from '@/hooks/useCRM';
import { cleanEmail, cleanPhone } from '@/lib/data-cleaning';

export interface DuplicateInfo {
  count: number;
  leadIds: string[];
}

export function useLeadDuplicateCheck() {
  const { supabase, context } = useCRM();

  const applyScope = (query: any) => {
    let q = query;
    if (context.tenantId) q = q.eq('tenant_id', context.tenantId);
    if (context.franchiseId) q = q.eq('franchise_id', context.franchiseId);
    return q;
  };

  const normalizeEmail = (email?: string | null) => {
    if (!email) return null;
    const cleaned = cleanEmail(email);
    if (cleaned.value) return cleaned.value;
    const trimmed = email.trim().toLowerCase();
    return trimmed || null;
  };

  const normalizePhone = (phone?: string | null) => {
    if (!phone) return null;
    const cleaned = cleanPhone(phone);
    if (cleaned.value) return cleaned.value;
    const trimmed = phone.trim();
    return trimmed || null;
  };

  const checkByEmail = async (email?: string | null): Promise<DuplicateInfo> => {
    const normalized = normalizeEmail(email);
    if (!normalized) return { count: 0, leadIds: [] };
    let query = supabase.from('leads').select('id').eq('email', normalized);
    query = applyScope(query);
    const { data, error } = await query;
    if (error) {
      return { count: 0, leadIds: [] };
    }
    const ids = (data || []).map((l: any) => l.id);
    return { count: ids.length, leadIds: ids };
  };

  const checkByPhone = async (phone?: string | null): Promise<DuplicateInfo> => {
    const normalized = normalizePhone(phone);
    if (!normalized) return { count: 0, leadIds: [] };
    let query = supabase.from('leads').select('id').eq('phone', normalized);
    query = applyScope(query);
    const { data, error } = await query;
    if (error) {
      return { count: 0, leadIds: [] };
    }
    const ids = (data || []).map((l: any) => l.id);
    return { count: ids.length, leadIds: ids };
  };

  const buildEmailDuplicateMap = async (emails: (string | null | undefined)[]): Promise<Record<string, DuplicateInfo>> => {
    const normalizedSet = new Set<string>();
    emails.forEach(e => {
      const n = normalizeEmail(e || '');
      if (n) normalizedSet.add(n);
    });
    const normalizedEmails = Array.from(normalizedSet);
    if (normalizedEmails.length === 0) return {};

    let query = supabase.from('leads').select('id,email').in('email', normalizedEmails);
    query = applyScope(query);
    const { data, error } = await query;
    if (error) return {};

    const map: Record<string, DuplicateInfo> = {};
    normalizedEmails.forEach(n => {
      map[n] = { count: 0, leadIds: [] };
    });
    (data || []).forEach((row: any) => {
      const key = row.email;
      if (!map[key]) {
        map[key] = { count: 0, leadIds: [] };
      }
      map[key].count += 1;
      map[key].leadIds.push(row.id);
    });
    return map;
  };

  return {
    checkByEmail,
    checkByPhone,
    buildEmailDuplicateMap,
  };
}

