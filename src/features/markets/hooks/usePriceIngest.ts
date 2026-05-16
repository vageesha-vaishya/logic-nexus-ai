/**
 * Markets — price ingest hooks.
 *
 *   useIngestPrices()    → mutation: POST /v1/jobs/prices/ingest/portfolio (2yr backfill)
 *   useRefreshPrices()   → mutation: POST /v1/jobs/prices/refresh/portfolio (30d refresh)
 *   usePriceIngestJob()  → query: poll GET /v1/jobs/prices/{jobId} until done
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { marketsKeys } from "./queryKeys";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "/api/markets-worker";

type IngestJobStatus = "queued" | "started" | "finished" | "failed" | "stopped" | "unknown";

interface IngestJobResult {
  job_id: string;
  portfolio_id: string;
  status: string;
}

interface IngestPollResult {
  job_id: string;
  status: IngestJobStatus;
  result: {
    total: number;
    ingested: number;
    failed: number;
    total_rows: number;
    failures: { symbol: string; error: string }[];
  } | null;
}

function useActiveScope() {
  const { roles } = useAuth();
  const franchiseScoped = roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id));
  const tenantScoped    = roles.find((r) => Boolean(r.tenant_id));
  const active          = franchiseScoped ?? tenantScoped ?? roles[0];
  return {
    tenantId:    active?.tenant_id    ?? null,
    franchiseId: active?.franchise_id ?? null,
  };
}

async function workerPost(path: string, body: object, token: string,
                           tenantId: string, franchiseId: string) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-tenant-id": tenantId,
      "x-franchise-id": franchiseId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Worker ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Full 2-year backfill ──────────────────────────────────────────────────────

export function useIngestPrices() {
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<IngestJobResult, Error, { portfolioId: string; lookbackDays?: number }>({
    mutationFn: async ({ portfolioId, lookbackDays = 730 }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      if (!tenantId || !franchiseId) throw new Error("Missing tenant/franchise context");
      return workerPost(
        "/v1/jobs/prices/ingest/portfolio",
        { portfolio_id: portfolioId, lookback_days: lookbackDays },
        token, tenantId, franchiseId,
      );
    },
  });
}

// ── 30-day refresh (for daily use after initial backfill) ─────────────────────

export function useRefreshPrices() {
  const { tenantId, franchiseId } = useActiveScope();
  const queryClient = useQueryClient();

  return useMutation<IngestJobResult, Error, { portfolioId: string }>({
    mutationFn: async ({ portfolioId }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      if (!tenantId || !franchiseId) throw new Error("Missing tenant/franchise context");
      return workerPost(
        "/v1/jobs/prices/refresh/portfolio",
        { portfolio_id: portfolioId },
        token, tenantId, franchiseId,
      );
    },
    onSuccess: () => {
      // Invalidate signals after refresh so they can be re-scored
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: marketsKeys.signals.all() });
      }, 3000);
    },
  });
}

// ── Poll a price ingest job ───────────────────────────────────────────────────

export function usePriceIngestJob(jobId?: string | null) {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<IngestPollResult | null>({
    queryKey: ["markets", "price-ingest", "poll", jobId ?? ""],
    enabled: Boolean(jobId),
    staleTime: 0,
    gcTime: 60_000,
    queryFn: async (): Promise<IngestPollResult | null> => {
      if (!jobId) return null;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return null;

      const res = await fetch(`${WORKER_URL}/v1/jobs/prices/${jobId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-tenant-id": tenantId ?? "",
          "x-franchise-id": franchiseId ?? "",
        },
      });
      if (!res.ok) return null;
      return res.json() as Promise<IngestPollResult>;
    },
    refetchInterval: (query) => {
      const data = query.state.data as IngestPollResult | null | undefined;
      if (!data) return 3_000;
      return ["queued", "started"].includes(data.status) ? 3_000 : false;
    },
  });
}
