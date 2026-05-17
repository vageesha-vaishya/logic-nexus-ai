/**
 * Markets — AI Portfolio Advisor hook.
 *
 * usePortfolioAdvisor(portfolioId)
 *   Reads the latest brief from markets.ai_briefs directly via Supabase.
 *   staleTime: 30 minutes (briefs don't change constantly).
 *
 * useGeneratePortfolioAdvisor(portfolioId)
 *   POST mutation to ${WORKER_URL}/v1/portfolio/advisor/{portfolioId}.
 *   Invalidates the query on success so the card refreshes.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
}

function useActiveScope() {
  const { roles } = useAuth();
  const scoped =
    roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id)) ??
    roles.find((r) => Boolean(r.tenant_id)) ??
    roles[0];
  return {
    tenantId: scoped?.tenant_id ?? null,
    franchiseId: scoped?.franchise_id ?? null,
  };
}

export interface PortfolioAdvisorBrief {
  brief_id?: string;
  content: string;
  generated_at: string;
  portfolio_id: string;
  cached?: boolean;
}

// Query key factory
const advisorKeys = {
  latest: (portfolioId: string) =>
    ["markets", "portfolio_advisor", portfolioId] as const,
};

/**
 * Load the latest cached brief from markets.ai_briefs for this portfolio.
 * Reads directly via Supabase client (RLS scoped to auth.uid()).
 */
export function usePortfolioAdvisor(portfolioId: string | undefined) {
  return useQuery<PortfolioAdvisorBrief | null>({
    queryKey: portfolioId ? advisorKeys.latest(portfolioId) : ["markets", "portfolio_advisor", "_none"],
    enabled: Boolean(portfolioId),
    staleTime: 30 * 60_000, // 30 minutes
    queryFn: async (): Promise<PortfolioAdvisorBrief | null> => {
      if (!portfolioId) return null;
      const { data, error } = await (supabase as any)
        .schema("markets")
        .from("ai_briefs")
        .select("id, content, generated_at, portfolio_id")
        .eq("portfolio_id", portfolioId)
        .eq("scope", "portfolio_advisor")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message ?? "Failed to load advisor brief");
      if (!data) return null;
      return {
        brief_id:     data.id as string,
        content:      data.content as string,
        generated_at: data.generated_at as string,
        portfolio_id: data.portfolio_id as string,
      };
    },
  });
}

/**
 * POST mutation to generate a new advisor brief via the markets-worker.
 * On success, replaces the cached query data and invalidates.
 */
export function useGeneratePortfolioAdvisor(portfolioId: string | undefined) {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<PortfolioAdvisorBrief, Error, void>({
    mutationFn: async (): Promise<PortfolioAdvisorBrief> => {
      if (!portfolioId) throw new Error("No portfolio selected");

      const token = await getToken();
      const res = await fetch(
        `${WORKER_URL}/v1/portfolio/advisor/${portfolioId}`,
        {
          method: "POST",
          headers: {
            Authorization:    `Bearer ${token}`,
            "Content-Type":   "application/json",
            "x-tenant-id":    tenantId ?? "",
            "x-franchise-id": franchiseId ?? "",
          },
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { detail?: string; error?: string })?.detail ??
          (err as { detail?: string; error?: string })?.error ??
          `Advisor generation failed (${res.status})`,
        );
      }

      const json = (await res.json()) as {
        brief_id: string;
        content: string;
        generated_at: string;
        portfolio_id: string;
        cached?: boolean;
      };

      return {
        brief_id:     json.brief_id,
        content:      json.content,
        generated_at: json.generated_at,
        portfolio_id: json.portfolio_id,
        cached:       json.cached,
      };
    },
    onSuccess: (brief) => {
      if (!portfolioId) return;
      queryClient.setQueryData<PortfolioAdvisorBrief | null>(
        advisorKeys.latest(portfolioId),
        brief,
      );
    },
  });
}
