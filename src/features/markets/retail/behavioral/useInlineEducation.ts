/**
 * useInlineEducation — tracks which InlineEducation cards a user has already
 * seen so each one fires at most once.
 *
 * Phase 2 Stream 3 backs this with localStorage to stay independent of the
 * `behavioral_events` table (Stream 2). When Stream 2 lands, swap the
 * read/write paths to TanStack Query against `markets.behavioral_events` —
 * the public hook signature stays the same.
 */
import { useCallback, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';

import type { EducationId } from './types';

const STORAGE_PREFIX = 'lnai_education_seen_';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function readSeen(userId: string): Set<EducationId> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed as EducationId[]);
  } catch {
    return new Set();
  }
}

function writeSeen(userId: string, ids: Set<EducationId>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch {
    // storage quota / private mode — ignore
  }
}

export interface UseInlineEducationResult {
  /** True when the card has already been dismissed once for this user. */
  hasBeenShown: (id: EducationId) => boolean;
  /** Record that a card was dismissed. Idempotent. */
  markShown: (id: EducationId) => void;
  /** Wipe seen state for the current user — useful from a debug pane. */
  reset: () => void;
}

export function useInlineEducation(): UseInlineEducationResult {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [seen, setSeen] = useState<Set<EducationId>>(() => readSeen(userId));

  const hasBeenShown = useCallback(
    (id: EducationId) => seen.has(id),
    [seen],
  );

  const markShown = useCallback(
    (id: EducationId) => {
      if (!userId) return;
      setSeen((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        writeSeen(userId, next);
        return next;
      });
    },
    [userId],
  );

  const reset = useCallback(() => {
    if (!userId) return;
    setSeen(() => {
      writeSeen(userId, new Set());
      return new Set();
    });
  }, [userId]);

  return { hasBeenShown, markShown, reset };
}
