/**
 * Phase 8f.1 — first slice extracted from useAmroWorkspaceState (3,099 LOC).
 *
 * Owns the "is the AMRO API in cooldown after a transient failure" state.
 * Used by every other AMRO slice that issues HTTP requests, but conceptually
 * belongs to none of them — hence pulled out first as the lowest-coupling
 * concern.
 *
 * Cooldown window: 30 seconds. Tuned to the prior monolithic value
 * (line 219 of the original hook); not raised here to keep the cutover
 * byte-identical with shipped behavior.
 *
 * The orchestrator wires `onUnavailable` to also flip the realtime-connected
 * flag false (that side effect lived inline in the original
 * markApiTemporarilyUnavailable), keeping this hook free of cross-slice
 * state references.
 */
import { useCallback, useState } from "react";

const API_DOWN_COOLDOWN_MS = 30_000;

export interface UseAmroApiAvailabilityOptions {
  /**
   * Called whenever the API transitions into the unavailable window.
   * The orchestrator uses this to flip realtime-connected false.
   */
  onUnavailable?: () => void;
}

export interface UseAmroApiAvailabilityReturn {
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;
}

export function useAmroApiAvailability(
  options: UseAmroApiAvailabilityOptions = {},
): UseAmroApiAvailabilityReturn {
  const [apiUnavailableUntil, setApiUnavailableUntil] = useState<number>(0);

  const isApiTemporarilyUnavailable = useCallback(
    () => Date.now() < apiUnavailableUntil,
    [apiUnavailableUntil],
  );

  const { onUnavailable } = options;
  const markApiTemporarilyUnavailable = useCallback(() => {
    setApiUnavailableUntil(Date.now() + API_DOWN_COOLDOWN_MS);
    onUnavailable?.();
  }, [onUnavailable]);

  return { isApiTemporarilyUnavailable, markApiTemporarilyUnavailable };
}
