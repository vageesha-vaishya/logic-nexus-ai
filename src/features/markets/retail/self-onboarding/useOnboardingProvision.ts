/**
 * Belt-and-suspenders provisioning fallback.
 *
 * The Supabase post-signup Auth hook (docs/Runbooks/2026-05-22-supabase-auth-hook-config.md)
 * is the primary path: it fires within milliseconds of email verification
 * and creates the user_roles binding + portfolio + paper_capital + holdings
 * + retail_profile.
 *
 * If that hook misfires (disabled, returned 500, or the user signed up
 * before the hook was configured), the wizard mounts with `retail_profile`
 * still missing. This hook detects that and re-invokes the same edge
 * function from the client. Idempotent — re-running for an already-
 * provisioned user is a no-op that returns the existing portfolio_id.
 *
 * Decision 14c + the "frontend retry path" referenced in the runbook.
 */
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface ProvisionResult {
  ok:           true;
  user_id:      string;
  portfolio_id: string;
}

export type ProvisionStatus = 'idle' | 'checking' | 'provisioning' | 'ready' | 'error';

/**
 * Ensures the calling user has a provisioned retail row set. Called from
 * the wizard mount; pairs with the route guard that won't render the
 * wizard until status === 'ready'.
 *
 * The check is cheap: a single retail_profile lookup. If the row exists,
 * status flips to 'ready' immediately. If absent, we POST the edge
 * function and re-check.
 */
export function useOnboardingProvision(): {
  status: ProvisionStatus;
  error:  string | null;
} {
  const { user } = useAuth();
  const [status, setStatus] = useState<ProvisionStatus>('idle');
  const [error,  setError]  = useState<string | null>(null);
  const ranForUserRef = useRef<string | null>(null);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    if (ranForUserRef.current === uid) return;
    ranForUserRef.current = uid;

    let cancelled = false;
    (async () => {
      setStatus('checking');
      setError(null);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: selectErr } = await (supabase as any)
          .schema('markets')
          .from('retail_profile')
          .select('user_id')
          .eq('user_id', uid)
          .maybeSingle();
        if (selectErr) throw selectErr;
        if (cancelled) return;

        if (data) {
          setStatus('ready');
          return;
        }

        // Missing row — Auth hook didn't fire or hasn't completed yet.
        // Invoke the edge function directly.
        setStatus('provisioning');
        logger.warn('Onboarding provisioning fallback firing', { user_id: uid });

        const { data: invokeData, error: invokeErr } = await supabase.functions.invoke<ProvisionResult>(
          'provision-retail-user',
          { body: { user_id: uid } },
        );
        if (invokeErr) throw invokeErr;
        if (!invokeData?.ok) {
          throw new Error('Edge function returned non-OK payload');
        }
        if (cancelled) return;
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        const detail = err instanceof Error ? err.message : String(err);
        logger.error('Onboarding provisioning failed', { detail });
        setError(detail);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { status, error };
}
