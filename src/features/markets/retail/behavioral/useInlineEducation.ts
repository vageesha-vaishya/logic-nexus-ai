// src/features/markets/retail/behavioral/useInlineEducation.ts
import { useCallback } from 'react';
import { useLogBehavioralEvent } from './useBehavioralEvents';
import type { EducationId } from './types';

export function useInlineEducation(seenEducationIds: Set<string>) {
  const { mutate: logEvent } = useLogBehavioralEvent();

  const markShown = useCallback(
    (educationId: EducationId) => {
      if (seenEducationIds.has(educationId)) return;
      logEvent({
        event_type: 'education_shown',
        severity: 'info',
        metadata: { education_id: educationId },
      });
    },
    [seenEducationIds, logEvent],
  );

  const hasBeenShown = useCallback(
    (educationId: EducationId) => seenEducationIds.has(educationId),
    [seenEducationIds],
  );

  return { markShown, hasBeenShown };
}

/** Derives seen education IDs from the behavioral events list. */
export function getSeenEducationIds(
  events: Array<{ event_type: string; metadata: Record<string, unknown> }>,
): Set<string> {
  return new Set(
    events
      .filter((e) => e.event_type === 'education_shown' && e.metadata?.education_id)
      .map((e) => e.metadata.education_id as string),
  );
}
