import { useFeatureFlags } from '@/hooks/useFeatureFlags';

export const FEATURE_FLAGS = {
  QUICK_QUOTE_V2: 'quick_quote_v2',
  QUOTATION_PHASE2_GUARDS: 'quotation_phase2_guards',
  COMPOSER_MULTI_LEG_AUTOFILL: 'composer_multi_leg_autofill',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export function useAppFeatureFlag(key: FeatureFlagKey, defaultValue: boolean = false) {
  const { isEnabled, isLoading, error } = useFeatureFlags();
  const enabled = isEnabled(key, defaultValue);
  return { enabled, isLoading, error };
}

