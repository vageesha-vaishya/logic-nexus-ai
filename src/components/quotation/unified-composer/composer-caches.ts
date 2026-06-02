// Module-level caches for UnifiedQuoteComposer extracted from
// the main file (Slice C). These caches persist across composer
// mounts within the same session; their windows are tuned for the
// CRM / configuration reference data that rarely changes.
//
// Kept as plain module state on purpose — these are not state to
// be reactively observed; they're memoization to avoid hammering
// Supabase on every composer open.

export const HYDRATION_CACHE_WINDOW_MS = 1000 * 60 * 5;
export const CRM_REFERENCE_CACHE_WINDOW_MS = 1000 * 60 * 10;
export const CONFIG_CACHE_WINDOW_MS = 1000 * 60 * 10;

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CrmReferenceData {
  accounts: any[];
  contacts: any[];
  opportunities: any[];
  ports: any[];
}

export const crmReferenceCache: {
  data: CrmReferenceData | null;
  cachedAt: number;
} = {
  data: null,
  cachedAt: 0,
};

export const quotationConfigCache: Record<string, { config: any; cachedAt: number }> = {};
