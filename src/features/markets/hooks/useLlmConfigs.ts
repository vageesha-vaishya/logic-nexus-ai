/**
 * Markets — LLM provider configs (per-tenant).
 *
 * Hooks for tenant_admin / franchise_admin / platform_admin to manage which
 * provider + API key the LLM Gateway uses for their tenant's workloads.
 *
 *   useLlmConfigs()           → list configs for the active tenant
 *   useSaveLlmConfig()        → create OR update (PATCH if id provided)
 *   useDeleteLlmConfig()      → remove (also clears vault entry)
 *
 * The actual API key never round-trips back to the client; the list endpoint
 * returns only metadata (provider, display_name, default_model, is_default,
 * last_used_at). Keys are stored in supabase_vault on the server side.
 *
 * Per ADR-025: server state via react-query; no direct supabase from UI.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { marketsKeys } from "./queryKeys";
import type {
  CreateLlmConfigInput,
  LlmProviderConfig,
  UpdateLlmConfigInput,
} from "../types";

function useActiveScope(): { tenantId: string | null } {
  const { roles } = useAuth();
  const franchiseScoped = roles.find((r) => Boolean(r.tenant_id) && Boolean(r.franchise_id));
  const tenantScoped = roles.find((r) => Boolean(r.tenant_id));
  const active = franchiseScoped ?? tenantScoped ?? roles[0];
  return { tenantId: active?.tenant_id ?? null };
}

// ─── List ──────────────────────────────────────────────────────────────

export function useLlmConfigs() {
  const { tenantId } = useActiveScope();

  return useQuery({
    queryKey: ["markets", "llm_configs", { tenantId }] as const,
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<LlmProviderConfig[]> => {
      if (!tenantId) throw new Error("No tenant in context");
      const { data, error } = await supabase.functions.invoke<{ data: LlmProviderConfig[] }>(
        "markets-llm-config",
        {
          method: "GET",
          headers: { "x-tenant-id": tenantId },
        },
      );
      if (error) throw new Error(error.message ?? "Failed to load LLM configs");
      return data?.data ?? [];
    },
    staleTime: 30_000,
  });
}

// ─── Save (create or update) ───────────────────────────────────────────

interface SaveArgs {
  /** Existing config id → PATCH; absent → POST */
  id?: string;
  payload: CreateLlmConfigInput | UpdateLlmConfigInput;
}

export function useSaveLlmConfig() {
  const queryClient = useQueryClient();
  const { tenantId } = useActiveScope();

  return useMutation<LlmProviderConfig, Error, SaveArgs>({
    mutationFn: async ({ id, payload }): Promise<LlmProviderConfig> => {
      if (!tenantId) throw new Error("No tenant in context");
      const path = id ? `markets-llm-config?id=${encodeURIComponent(id)}` : "markets-llm-config";
      const method = id ? "PATCH" : "POST";

      const { data, error } = await supabase.functions.invoke<{ data: LlmProviderConfig }>(
        path,
        {
          method,
          headers: { "x-tenant-id": tenantId },
          body: payload,
        },
      );
      if (error) throw new Error(error.message ?? `Failed to ${id ? "update" : "create"} LLM config`);
      if (!data?.data) throw new Error("Edge function returned no data");
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["markets", "llm_configs"] });
    },
  });
}

// ─── Delete ─────────────────────────────────────────────────────────────

export function useDeleteLlmConfig() {
  const queryClient = useQueryClient();
  const { tenantId } = useActiveScope();

  return useMutation<void, Error, string>({
    mutationFn: async (id: string): Promise<void> => {
      if (!tenantId) throw new Error("No tenant in context");
      const { error } = await supabase.functions.invoke(
        `markets-llm-config?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { "x-tenant-id": tenantId },
        },
      );
      if (error) throw new Error(error.message ?? "Failed to delete LLM config");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["markets", "llm_configs"] });
    },
  });
}

// Helper consumed by the Settings page form — sensible default models per provider.
export function defaultModelFor(provider: string): string {
  switch (provider) {
    case "anthropic":  return "claude-sonnet-4-5";
    case "openrouter": return "anthropic/claude-3.5-sonnet";
    case "openai":     return "gpt-4o-mini";
    case "gemini":     return "gemini-1.5-flash-002";
    case "local-qwen": return "qwen2.5:32b";
    case "custom":     return "";
    default:           return "";
  }
}
