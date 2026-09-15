import { describe, expect, it, vi } from 'vitest';

const useFeatureFlagsMock = vi.fn();

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlags: (keys?: string[]) => useFeatureFlagsMock(keys),
}));

import { useAppFeatureFlag, FEATURE_FLAGS } from './feature-flags';

describe('useAppFeatureFlag', () => {
  it('calls useFeatureFlags with an array containing the requested key', () => {
    useFeatureFlagsMock.mockReturnValue({
      isEnabled: () => false,
      isLoading: false,
      error: null,
    });

    useAppFeatureFlag(FEATURE_FLAGS.AMRO_RBAC_FIX_ENABLED, true);

    expect(useFeatureFlagsMock).toHaveBeenCalledWith(['amro_rbac_fix_enabled']);
  });

  it('falls back to defaultValue when the resolved flags do not include the key', () => {
    useFeatureFlagsMock.mockReturnValue({
      isEnabled: (key: string, defaultValue: boolean) => defaultValue,
      isLoading: false,
      error: null,
    });

    const { enabled } = useAppFeatureFlag(FEATURE_FLAGS.DOMAIN_GROUPED_NAV, true);

    expect(enabled).toBe(true);
  });
});
