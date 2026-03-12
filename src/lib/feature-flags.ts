import { useFeatureFlags } from '@/hooks/useFeatureFlags';

export const FEATURE_FLAGS = {
  QUICK_QUOTE_V2: 'quick_quote_v2',
  QUOTATION_PHASE2_GUARDS: 'quotation_phase2_guards',
  COMPOSER_MULTI_LEG_AUTOFILL: 'composer_multi_leg_autofill',
  QUOTATION_IMPORT_EXPORT_V2: 'quotation_import_export_v2',
  HYBRID_ROUTE_CONFIGURATION_V1: 'hybrid_route_configuration_v1',
  HYBRID_ROUTE_METRICS_DASHBOARD_V1: 'hybrid_route_metrics_dashboard_v1',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export function useAppFeatureFlag(key: FeatureFlagKey, defaultValue: boolean = false) {
  const { isEnabled, isLoading, error } = useFeatureFlags();
  const enabled = isEnabled(key, defaultValue);
  return { enabled, isLoading, error };
}
