import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AlertCondition = "above" | "below";
export type AlertStatus = "active" | "triggered" | "cancelled" | "expired";

export interface PriceAlert {
  id: string;
  user_id: string;
  instrument_id: string | null;
  symbol: string;
  exchange: string;
  condition: AlertCondition;
  trigger_price: number;
  status: AlertStatus;
  triggered_at: string | null;
  triggered_price: number | null;
  notes: string | null;
  created_at: string;
}

export interface CreateAlertInput {
  symbol: string;
  exchange?: string;
  instrument_id?: string;
  condition: AlertCondition;
  trigger_price: number;
  notes?: string;
}

export function usePriceAlerts(symbolFilter?: string) {
  const { user } = useAuth();
  return useQuery<PriceAlert[]>({
    queryKey: ["markets", "price_alerts", user?.id, symbolFilter],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = supabase.schema("markets" as any).from("price_alerts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (symbolFilter) q = q.eq("symbol", symbolFilter.toUpperCase());
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as PriceAlert[];
    },
    staleTime: 30_000,
    refetchInterval: 30_000, // poll for triggered alerts
  });
}

export function useCreatePriceAlert() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation<PriceAlert, Error, CreateAlertInput>({
    mutationFn: async (input) => {
      if (!user?.id) throw new Error("Not authenticated");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.schema("markets" as any).from("price_alerts" as any).insert({
        user_id: user.id,
        symbol: input.symbol.toUpperCase(),
        exchange: input.exchange ?? "NSE",
        instrument_id: input.instrument_id ?? null,
        condition: input.condition,
        trigger_price: input.trigger_price,
        notes: input.notes ?? null,
      }).select().single();
      if (error) throw new Error(error.message);
      return data as PriceAlert;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["markets", "price_alerts"] });
    },
  });
}

export function useCancelPriceAlert() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (alertId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.schema("markets" as any).from("price_alerts" as any)
        .update({ status: "cancelled" })
        .eq("id", alertId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["markets", "price_alerts"] });
    },
  });
}
