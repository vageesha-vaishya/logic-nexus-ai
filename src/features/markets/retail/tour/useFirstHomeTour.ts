/**
 * Gates the first-Home coach-marked tour and persists tour_completed.
 *
 * Reads markets.retail_profile.tour_completed. If the profile hasn't loaded
 * yet, or if the row exists with tour_completed=true, the tour is hidden.
 * On finish OR skip we upsert tour_completed=true so it never runs again on
 * any device (DB is the source of truth).
 *
 * Returns a boolean (`shouldRun`) the consumer uses to mount HomeTour, plus
 * the dismiss callback to pass into both onFinish + onSkip.
 */
import { useCallback } from 'react';

import { useRetailProfile, useUpsertRetailProfile } from '../self-onboarding/useRetailProfile';

export function useFirstHomeTour() {
  const { data: profile, isLoading } = useRetailProfile();
  const upsert                       = useUpsertRetailProfile();

  const dismiss = useCallback(() => {
    // Fire-and-forget — the optimistic-ish version: flip the local cache via
    // invalidation in onSuccess, but don't block UI if the network is slow.
    upsert.mutate({ tour_completed: true });
  }, [upsert]);

  const shouldRun = !isLoading && Boolean(profile) && profile?.tour_completed === false;

  return { shouldRun, dismiss };
}
