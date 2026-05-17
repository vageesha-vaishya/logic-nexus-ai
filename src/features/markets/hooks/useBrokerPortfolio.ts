/**
 * Broker portfolio hooks — wraps /v1/brokers/connections/{id}/* endpoints.
 *
 *   useConnectionHoldings(connectionId)  → holdings for a broker connection
 *   useConnectionPositions(connectionId) → intraday positions
 *   useConnectionOrders(connectionId)    → order book
 */

import { useQuery, UseQueryResult, useMutation, UseMutationResult, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Local HTTP helpers (mirrors useBrokerConnections.ts — not exported there) ──

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
}

function useActiveScope() {
  const { roles } = useAuth();
  const scoped = roles.find(r => Boolean(r.tenant_id) && Boolean(r.franchise_id))
               ?? roles.find(r => Boolean(r.tenant_id))
               ?? roles[0];
  return { tenantId: scoped?.tenant_id ?? null, franchiseId: scoped?.franchise_id ?? null };
}

async function workerFetch(
  method: string, path: string,
  token: string, tenantId: string, franchiseId: string,
  body?: object,
): Promise<unknown> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-tenant-id":    tenantId,
      "x-franchise-id": franchiseId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.detail ?? json?.error ?? `Worker ${res.status}`);
  return json;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrokerHolding {
  id: string;
  qty: number;
  avg_cost: number;
  realized_pnl: number | null;
  last_updated_at: string | null;
  asset_class: string | null;
  metadata: {
    broker_connection_id: string;
    last_price?: number;
    pnl?: number;
    tradingsymbol?: string;
    exchange?: string;
    isin?: string;
    t1_quantity?: number;
    source?: string;
  };
  instrument: {
    symbol: string;
    exchange: string;
    isin: string | null;
    instrument_type: string;
  } | null;
}

export interface BrokerPosition {
  id: string;
  exchange: string;
  segment: string;
  tradingsymbol: string;
  product: string;
  quantity: number;
  overnight_quantity: number | null;
  buy_quantity: number | null;
  sell_quantity: number | null;
  avg_price: number;
  last_price: number | null;
  close_price: number | null;
  pnl: number | null;
  realised_pnl: number | null;
  m2m: number | null;
  multiplier: number | null;
  synced_at: string;
}

export interface BrokerOrder {
  id: string;
  broker_order_id: string | null;
  exchange: string;
  segment: string;
  tradingsymbol: string;
  order_type: string;
  product: string;
  transaction_type: string;
  quantity: number;
  price: number | null;
  trigger_price: number | null;
  validity: string;
  status: string;
  filled_quantity: number | null;
  avg_fill_price: number | null;
  pending_quantity: number | null;
  status_message: string | null;
  algo_tag: string | null;
  placed_at: string | null;
  created_at: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useConnectionHoldings(
  connectionId: string | null,
): UseQueryResult<BrokerHolding[]> {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<BrokerHolding[]>({
    queryKey: marketsKeys.brokers.holdings(connectionId!),
    enabled: Boolean(connectionId),
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getToken();
      const data = await workerFetch(
        "GET",
        `/v1/brokers/connections/${connectionId}/holdings`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      ) as { holdings: BrokerHolding[] };
      return data.holdings ?? [];
    },
  });
}

export function useConnectionPositions(
  connectionId: string | null,
): UseQueryResult<BrokerPosition[]> {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<BrokerPosition[]>({
    queryKey: marketsKeys.brokers.positions(connectionId!),
    enabled: Boolean(connectionId),
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getToken();
      const data = await workerFetch(
        "GET",
        `/v1/brokers/connections/${connectionId}/positions`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      ) as { positions: BrokerPosition[] };
      return data.positions ?? [];
    },
  });
}

export function useConnectionOrders(
  connectionId: string | null,
): UseQueryResult<BrokerOrder[]> {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<BrokerOrder[]>({
    queryKey: marketsKeys.brokers.orders(connectionId!),
    enabled: Boolean(connectionId),
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getToken();
      const data = await workerFetch(
        "GET",
        `/v1/brokers/connections/${connectionId}/orders`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      ) as { orders: BrokerOrder[] };
      return data.orders ?? [];
    },
  });
}

// ── Order mutations + margins ─────────────────────────────────────────────────

export type OrderMode = "regular" | "bracket" | "cover";

export interface PlaceOrderInput {
  tradingsymbol:    string;
  exchange:         string;
  transaction_type: "BUY" | "SELL";
  order_type:       "MARKET" | "LIMIT" | "SL" | "SL-M";
  product:          "CNC" | "MIS" | "NRML";
  quantity:         number;
  price?:           number | null;
  trigger_price?:   number | null;
  validity?:        "DAY" | "IOC";
  disclosed_qty?:   number;
  tag?:             string;
  // Bracket / Cover order extensions (forwarded to broker adapter; ignored if unsupported)
  order_mode?:      OrderMode;
  bracket_target?:  number;
  bracket_sl?:      number;
}

export interface PlaceOrderResult {
  order_id: string;
  status:   string;
  message?: string | null;
}

export interface BrokerMargins {
  // Normalised across brokers — whatever the broker returns
  available_cash?: number;
  used_margin?:    number;
  net?:            number;
  [key: string]: unknown;
}

export interface ModifyOrderInput {
  broker_order_id: string;
  order_type?:     string;
  quantity?:       number;
  price?:          number;
  trigger_price?:  number;
  validity?:       string;
}

// 1. Margins query (staleTime 30s, enabled when connectionId is set)
export function useConnectionMargins(
  connectionId: string | null,
): UseQueryResult<BrokerMargins> {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<BrokerMargins>({
    queryKey: [...marketsKeys.brokers.connection(connectionId ?? ""), "margins"],
    enabled: Boolean(connectionId),
    staleTime: 30_000,
    queryFn: async () => {
      const token = await getToken();
      const data = await workerFetch(
        "GET",
        `/v1/brokers/connections/${connectionId}/margins`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      ) as { margins: BrokerMargins };
      return data.margins ?? {};
    },
  });
}

// 2. Place order mutation
export function usePlaceOrder(
  connectionId: string,
): UseMutationResult<PlaceOrderResult, Error, PlaceOrderInput> {
  const { tenantId, franchiseId } = useActiveScope();
  const queryClient = useQueryClient();

  return useMutation<PlaceOrderResult, Error, PlaceOrderInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      const data = await workerFetch(
        "POST",
        `/v1/brokers/connections/${connectionId}/orders`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
        input,
      ) as PlaceOrderResult;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.orders(connectionId) });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.positions(connectionId) });
      }, 3000);
    },
  });
}

// 3. Cancel order mutation (takes broker_order_id string)
export function useCancelOrder(
  connectionId: string,
): UseMutationResult<{ order_id: string; status: string }, Error, string> {
  const { tenantId, franchiseId } = useActiveScope();
  const queryClient = useQueryClient();

  return useMutation<{ order_id: string; status: string }, Error, string>({
    mutationFn: async (broker_order_id) => {
      const token = await getToken();
      const data = await workerFetch(
        "DELETE",
        `/v1/brokers/connections/${connectionId}/orders/${broker_order_id}`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      ) as { order_id: string; status: string };
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.orders(connectionId) });
    },
  });
}

// 4. Modify order mutation
export function useModifyOrder(
  connectionId: string,
): UseMutationResult<{ order_id: string; status: string }, Error, ModifyOrderInput> {
  const { tenantId, franchiseId } = useActiveScope();
  const queryClient = useQueryClient();

  return useMutation<{ order_id: string; status: string }, Error, ModifyOrderInput>({
    mutationFn: async ({ broker_order_id, ...rest }) => {
      const token = await getToken();
      const data = await workerFetch(
        "PATCH",
        `/v1/brokers/connections/${connectionId}/orders/${broker_order_id}`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
        rest,
      ) as { order_id: string; status: string };
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.orders(connectionId) });
    },
  });
}

// ── GTT types ─────────────────────────────────────────────────────────────────

export interface GTTTrigger {
  transaction_type: "BUY" | "SELL";
  quantity:         number;
  order_type:       "LIMIT" | "MARKET";
  trigger_price:    number;
  price:            number;
  product:          string;
}

export interface GTTOrder {
  gtt_id:           string;
  status:           "active" | "triggered" | "cancelled" | "expired";
  tradingsymbol:    string;
  exchange:         string;
  trigger_type:     "single" | "oco";
  ltp:              number;
  triggers:         GTTTrigger[];
  created_at:       string | null;
}

export interface CreateGTTInput {
  tradingsymbol:    string;
  exchange:         string;
  ltp:              number;
  trigger_type:     "single" | "oco";
  // Single GTT fields
  transaction_type?:  "BUY" | "SELL";
  quantity?:          number;
  trigger_price?:     number;
  price?:             number;
  product?:           string;
  order_type?:        string;
  // OCO upper leg (take profit)
  upper_trigger_price?:    number;
  upper_price?:            number;
  upper_quantity?:         number;
  upper_transaction_type?: "BUY" | "SELL";
  // OCO lower leg (stop loss)
  lower_trigger_price?:    number;
  lower_price?:            number;
  lower_quantity?:         number;
  lower_transaction_type?: "BUY" | "SELL";
}

// ── GTT hooks ─────────────────────────────────────────────────────────────────

// List active GTTs for a connection
export function useConnectionGtts(
  connectionId: string | null,
): UseQueryResult<GTTOrder[]> {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<GTTOrder[]>({
    queryKey: marketsKeys.brokers.gtts(connectionId!),
    enabled: Boolean(connectionId),
    staleTime: 30_000,
    queryFn: async () => {
      const token = await getToken();
      const data = await workerFetch(
        "GET",
        `/v1/brokers/connections/${connectionId}/gtts`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      ) as { gtts: GTTOrder[] };
      return data.gtts ?? [];
    },
  });
}

// Create GTT mutation
export function useCreateGtt(
  connectionId: string,
): UseMutationResult<{ gtt_id: string; status: string }, Error, CreateGTTInput> {
  const { tenantId, franchiseId } = useActiveScope();
  const queryClient = useQueryClient();

  return useMutation<{ gtt_id: string; status: string }, Error, CreateGTTInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      const data = await workerFetch(
        "POST",
        `/v1/brokers/connections/${connectionId}/gtts`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
        input,
      ) as { gtt_id: string; status: string };
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.gtts(connectionId) });
    },
  });
}

// Cancel GTT mutation (takes gtt_id string)
export function useCancelGtt(
  connectionId: string,
): UseMutationResult<{ gtt_id: string; status: string }, Error, string> {
  const { tenantId, franchiseId } = useActiveScope();
  const queryClient = useQueryClient();

  return useMutation<{ gtt_id: string; status: string }, Error, string>({
    mutationFn: async (gtt_id) => {
      const token = await getToken();
      const data = await workerFetch(
        "DELETE",
        `/v1/brokers/connections/${connectionId}/gtts/${gtt_id}`,
        token,
        tenantId ?? "",
        franchiseId ?? "",
      ) as { gtt_id: string; status: string };
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.gtts(connectionId) });
    },
  });
}
