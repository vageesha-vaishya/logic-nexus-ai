import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { registerForPush, type PushRegisterOutcome } from "@/lib/push";

/**
 * Fire-and-forget push registration on mount, once per session.
 *
 * Web users get `outcome.reason='web'` immediately — no network, no
 * permission prompt. Android users get an OS permission dialog the first
 * time, then a silent FCM token assignment + POST to the worker.
 *
 * The hook re-runs only when the Supabase user_id changes — the worker
 * route requires an active session, and re-attempting on every render
 * would be wasteful.
 */
export function usePushRegistration() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const lastAttemptedUserId = useRef<string | null>(null);
  const [outcome, setOutcome] = useState<PushRegisterOutcome | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (lastAttemptedUserId.current === userId) return;
    lastAttemptedUserId.current = userId;

    let cancelled = false;
    void registerForPush().then((res) => {
      if (!cancelled) setOutcome(res);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return outcome;
}
