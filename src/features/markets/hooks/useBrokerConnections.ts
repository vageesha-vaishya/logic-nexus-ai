/**
 * Broker connection hooks — wraps /v1/brokers/* endpoints on the Python worker.
 *
 *   useSupportedBrokers()              → list of broker metadata (full-api + import-only)
 *   useBrokerConnections()             → list user's connected accounts
 *   useAddBrokerConnection()           → mutation: POST /v1/brokers/connections
 *   useRemoveBrokerConnection()        → mutation: DELETE /v1/brokers/connections/{id}
 *   useTriggerBrokerSync()             → mutation: POST /v1/brokers/connections/{id}/sync
 *   useGetBrokerAuthUrl()              → query: GET /v1/brokers/auth-url
 *   useExchangeBrokerCode()            → mutation: POST /v1/brokers/exchange-code
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Shared broker types ───────────────────────────────────────────────────────

export type BrokerTier   = "full_api" | "preview" | "import_only";
export type BrokerAuth   = "session_token" | "totp" | "api_key" | "api_key_secret" | "oauth" | "otp" | "totp_api_key" | "none";
export type BrokerRefresh = "automated" | "manual" | "otp" | "none";
export type ConnStatus   = "pending" | "active" | "expired" | "revoked" | "error";

export interface SupportedBroker {
  id:           string;
  name:         string;
  auth_type:    BrokerAuth;
  data_cost:    string;
  supports:     string[];
  refresh:      BrokerRefresh;
  logo:         string;
  tier:         BrokerTier;
  import_note?: string;
  request_url?: string;
  note?:        string;
}

export interface BrokerConnection {
  id:                  string;
  broker:              string;
  broker_client_id:    string;
  display_name:        string;
  status:              ConnStatus;
  segments:            string[];
  can_trade:           boolean;
  can_read_holdings:   boolean;
  can_read_positions:  boolean;
  token_expires_at:    string | null;
  last_synced_at:      string | null;
  error_message:       string | null;
  created_at:          string;
}

export interface AddConnectionInput {
  broker:           string;
  broker_client_id: string;
  display_name:     string;
  portfolio_id?:    string | null;
  credentials:      Record<string, string>;
  segments?:        string[];
  can_trade?:       boolean;
}

export interface ExchangeCodeInput {
  broker: string;
  code:   string;
  extra:  Record<string, string>;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

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

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useSupportedBrokers() {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<SupportedBroker[]>({
    queryKey: marketsKeys.brokers.supported(),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const token = await getToken();
      const data = await workerFetch("GET", "/v1/brokers", token, tenantId ?? "", franchiseId ?? "") as { brokers: SupportedBroker[] };
      return data.brokers ?? [];
    },
  });
}

export function useBrokerConnections() {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<BrokerConnection[]>({
    queryKey: marketsKeys.brokers.connections(),
    staleTime: 30_000,
    queryFn: async () => {
      const token = await getToken();
      const data = await workerFetch("GET", "/v1/brokers/connections", token, tenantId ?? "", franchiseId ?? "") as { connections: BrokerConnection[] };
      return data.connections ?? [];
    },
  });
}

export function useAddBrokerConnection() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<BrokerConnection, Error, AddConnectionInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      if (!tenantId || !franchiseId) throw new Error("Missing tenant/franchise context");
      const data = await workerFetch("POST", "/v1/brokers/connections",
        token, tenantId, franchiseId, input) as { connection: BrokerConnection };
      return data.connection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.connections() });
    },
  });
}

export function useRemoveBrokerConnection() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<void, Error, string>({
    mutationFn: async (connectionId) => {
      const token = await getToken();
      await workerFetch("DELETE", `/v1/brokers/connections/${connectionId}`,
        token, tenantId ?? "", franchiseId ?? "");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.connections() });
    },
  });
}

export function useTriggerBrokerSync() {
  const queryClient = useQueryClient();
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<{ job_id: string }, Error, string>({
    mutationFn: async (connectionId) => {
      const token = await getToken();
      return await workerFetch("POST", `/v1/brokers/connections/${connectionId}/sync`,
        token, tenantId ?? "", franchiseId ?? "") as { job_id: string };
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.connections() });
      }, 3000);
    },
  });
}

export function useExchangeBrokerCode() {
  const { tenantId, franchiseId } = useActiveScope();

  return useMutation<{
    access_token: string; refresh_token?: string;
    feed_token?: string; expires_at?: string; extra?: Record<string, string>;
  }, Error, ExchangeCodeInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      return await workerFetch("POST", "/v1/brokers/exchange-code",
        token, tenantId ?? "", franchiseId ?? "", input) as {
          access_token: string; refresh_token?: string;
          feed_token?: string; expires_at?: string;
          extra?: Record<string, string>;
      };
    },
  });
}

export function useGetBrokerAuthUrl(broker: string, apiKey: string, redirectUri: string) {
  const { tenantId, franchiseId } = useActiveScope();

  return useQuery<string | null>({
    queryKey: ["broker-auth-url", broker, apiKey],
    enabled: Boolean(broker) && Boolean(apiKey),
    staleTime: Infinity,
    queryFn: async () => {
      const token = await getToken();
      const params = new URLSearchParams({ broker, api_key: apiKey, redirect_uri: redirectUri });
      const data = await workerFetch("GET", `/v1/brokers/auth-url?${params}`,
        token, tenantId ?? "", franchiseId ?? "") as { auth_url?: string };
      return data.auth_url ?? null;
    },
  });
}
