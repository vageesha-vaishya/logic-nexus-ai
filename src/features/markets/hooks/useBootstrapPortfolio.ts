import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

/**
 * Bootstrap a freshly-created portfolio on the worker — schedules the daily
 * refresh+signals job at 07:00 IST AND fires an immediate run so the user
 * sees content on their first visit to the Signals tab.
 *
 * Closed-beta dealbreaker fix #D1: previously the daily job loop only
 * picked up portfolios that existed at worker startup, so any new friend
 * signup saw an empty Signals tab until the worker happened to restart.
 *
 * Always best-effort: callers should NOT block the user flow on this
 * mutation succeeding. Errors are logged and swallowed.
 */
export function useBootstrapPortfolio() {
  return useMutation<{ portfolio_id: string; immediate_job_id: string | null }, Error, string>({
    mutationFn: async (portfolio_id) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const resp = await fetch(`${WORKER_URL}/v1/jobs/bootstrap-portfolio`, {
        method:  "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ portfolio_id }),
      });
      if (!resp.ok) {
        throw new Error(`Bootstrap failed: ${resp.status} ${await resp.text().catch(() => "")}`);
      }
      return resp.json();
    },
    onError: (error, portfolio_id) => {
      // Don't surface to the user — the portfolio still exists and signals
      // will eventually generate at the next worker restart. Log it so we
      // can find dropped bootstraps in the RUM dashboard.
      logger.warn("bootstrap-portfolio failed (signals will lag)", {
        portfolio_id,
        error: error.message,
      });
    },
  });
}
