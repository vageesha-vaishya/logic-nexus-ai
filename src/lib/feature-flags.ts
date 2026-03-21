import { useFeatureFlags } from '@/hooks/useFeatureFlags';

export const FEATURE_FLAGS = {
  QUICK_QUOTE_V2: 'quick_quote_v2',
  QUOTATION_PHASE2_GUARDS: 'quotation_phase2_guards',
  COMPOSER_MULTI_LEG_AUTOFILL: 'composer_multi_leg_autofill',
  QUOTATION_IMPORT_EXPORT_V2: 'quotation_import_export_v2',
  GATEWAY_COMPAT_FACADE_V1: 'gateway_compat_facade_v1',
  GATEWAY_V2_SHADOW_READ: 'gateway_v2_shadow_read',
  ROUTE_INVENTORY_DASHBOARD_V1: 'route_inventory_dashboard_v1',
  MIGRATION_BASELINE_SLO_V1: 'migration_baseline_slo_v1',
  HYBRID_ROUTE_CONFIGURATION_V1: 'hybrid_route_configuration_v1',
  HYBRID_ROUTE_METRICS_DASHBOARD_V1: 'hybrid_route_metrics_dashboard_v1',
  LEAD_THREE_SECTION_LAYOUT: 'lead_three_section_layout',
  LEAD_WORKSPACE_ENHANCEMENTS_V1: 'lead_workspace_enhancements_v1',
  LEAD_WORKSPACE_SCROLLING_V1: 'lead_workspace_scrolling_v1',
  USER_INFO_HEADER_MODULE: 'user_info_header_module',
  USER_INFO_HEADER_DUAL_MODE: 'user_info_header_dual_mode',
  HEADER_DEBUG_BUTTON: 'header_debug_button',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export function useAppFeatureFlag(key: FeatureFlagKey, defaultValue: boolean = false) {
  const { isEnabled, isLoading, error } = useFeatureFlags();
  const envOverride = resolveFeatureFlagEnvOverride(key);
  const enabled = envOverride ?? isEnabled(key, defaultValue);
  return { enabled, isLoading, error };
}

function resolveFeatureFlagEnvOverride(key: FeatureFlagKey): boolean | undefined {
  if (typeof import.meta === 'undefined' || !import.meta.env) return undefined;
  const mapRaw = import.meta.env.VITE_FEATURE_FLAG_OVERRIDES;
  if (typeof mapRaw === 'string' && mapRaw.trim()) {
    try {
      const parsed = JSON.parse(mapRaw) as Record<string, unknown>;
      const mappedValue = parsed[key];
      if (typeof mappedValue === 'boolean') return mappedValue;
      if (typeof mappedValue === 'string') return normalizeBoolean(mappedValue);
    } catch {
      return undefined;
    }
  }

  const specificKey = `VITE_FF_${key.toUpperCase()}`;
  const specificRaw = (import.meta.env as Record<string, unknown>)[specificKey];
  if (typeof specificRaw === 'boolean') return specificRaw;
  if (typeof specificRaw === 'string') return normalizeBoolean(specificRaw);

  return undefined;
}

function normalizeBoolean(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'off') return false;
  return undefined;
}
