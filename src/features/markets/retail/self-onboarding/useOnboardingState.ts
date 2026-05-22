/**
 * Hybrid persistence for the self-onboarding wizard.
 *
 * In-flight form values (the half-typed nominee, the half-answered quiz)
 * survive a page reload via localStorage. Step completions persist to the
 * database — risk_profiles, portfolio_tiers, retail_profile — so the route
 * guard can resume from the right step on a fresh device.
 *
 * Decision 9d: hybrid persistence. See design doc §"State persistence".
 */
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import type { WizardDraft } from './types';

const KEY_PREFIX = 'sthira.onboarding.draft.';

function readDraft(userId: string): WizardDraft {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDraft(userId: string, draft: WizardDraft) {
  try {
    localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(draft));
  } catch {
    /* quota / private mode — ignore; the next Step Continue will persist to DB */
  }
}

/**
 * Reactive draft store keyed by user id. Updates are merged shallowly into
 * the existing draft. `clearKeys` removes specific fields after a successful
 * DB write so the localStorage copy doesn't drift from the canonical record.
 */
export function useOnboardingDraft() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [draft, setDraft] = useState<WizardDraft>(() =>
    userId ? readDraft(userId) : {},
  );

  useEffect(() => {
    if (!userId) return;
    setDraft(readDraft(userId));
  }, [userId]);

  const merge = useCallback(
    (patch: Partial<WizardDraft>) => {
      setDraft((prev) => {
        const next = { ...prev, ...patch };
        if (userId) writeDraft(userId, next);
        return next;
      });
    },
    [userId],
  );

  const clearKeys = useCallback(
    (keys: Array<keyof WizardDraft>) => {
      setDraft((prev) => {
        const next: WizardDraft = { ...prev };
        for (const k of keys) delete next[k];
        if (userId) writeDraft(userId, next);
        return next;
      });
    },
    [userId],
  );

  const clearAll = useCallback(() => {
    if (!userId) return;
    try { localStorage.removeItem(KEY_PREFIX + userId); } catch { /* ignore */ }
    setDraft({});
  }, [userId]);

  return { draft, merge, clearKeys, clearAll };
}
