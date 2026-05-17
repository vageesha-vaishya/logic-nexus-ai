import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface RiskControls {
  id: string;
  user_id: string;
  portfolio_id: string | null;
  daily_loss_limit_inr: number | null;
  max_position_pct: number;
  equity_enabled: boolean;
  fno_enabled: boolean;
  mf_enabled: boolean;
  kill_switch_active: boolean;
  kill_switch_reason: string | null;
  updated_at: string;
}

export interface UpsertRiskControlsInput {
  portfolio_id?: string | null;
  daily_loss_limit_inr?: number | null;
  max_position_pct?: number;
  equity_enabled?: boolean;
  fno_enabled?: boolean;
  mf_enabled?: boolean;
  kill_switch_active?: boolean;
  kill_switch_reason?: string | null;
}

const QUERY_KEY = (userId: string | undefined, portfolioId?: string) =>
  ["markets", "risk_controls", userId, portfolioId ?? null] as const;

export function useRiskControls(portfolioId?: string) {
  const { user } = useAuth();
  return useQuery<RiskControls | null>({
    queryKey: QUERY_KEY(user?.id, portfolioId),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = supabase.schema("markets" as any).from("risk_controls" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });

      if (portfolioId) {
        // Return portfolio-specific or global (null portfolio_id)
        q = q.or(`portfolio_id.eq.${portfolioId},portfolio_id.is.null`);
      } else {
        q = q.is("portfolio_id", null);
      }

      const { data, error } = await q.limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as RiskControls | null) ?? null;
    },
    staleTime: 30_000,
  });
}

export function useUpsertRiskControls() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<RiskControls, Error, UpsertRiskControlsInput>({
    mutationFn: async (input) => {
      if (!user?.id) throw new Error("Not authenticated");

      const payload: Record<string, unknown> = {
        user_id: user.id,
        portfolio_id: input.portfolio_id ?? null,
        ...(input.daily_loss_limit_inr !== undefined && { daily_loss_limit_inr: input.daily_loss_limit_inr }),
        ...(input.max_position_pct !== undefined && { max_position_pct: input.max_position_pct }),
        ...(input.equity_enabled !== undefined && { equity_enabled: input.equity_enabled }),
        ...(input.fno_enabled !== undefined && { fno_enabled: input.fno_enabled }),
        ...(input.mf_enabled !== undefined && { mf_enabled: input.mf_enabled }),
        ...(input.kill_switch_active !== undefined && { kill_switch_active: input.kill_switch_active }),
        ...(input.kill_switch_reason !== undefined && { kill_switch_reason: input.kill_switch_reason }),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.schema("markets" as any).from("risk_controls" as any)
        .upsert(payload, {
          onConflict: "user_id,portfolio_id",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as RiskControls;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["markets", "risk_controls", user?.id],
      });
      // Also invalidate portfolio-specific key if relevant
      if (variables.portfolio_id) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEY(user?.id, variables.portfolio_id),
        });
      }
    },
  });
}
