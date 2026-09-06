/**
 * Markets — provider model catalog hook.
 *
 * Currently only OpenRouter is supported (public catalog, no API key needed).
 *
 * Anthropic/OpenAI/Gemini all require an API key to list models, which means
 * we'd need a server-side proxy. Defer those — for v1 the user can type
 * those model names manually (free-text input with a sensible default).
 */

import { useQuery } from "@tanstack/react-query";
import type { LlmProviderKind } from "../types";

export interface ProviderModel {
  id: string;                 // e.g. "anthropic/claude-3.5-sonnet"
  name: string;               // human label
  contextLength: number | null;
  pricePromptPerMillion: number | null;   // USD
  priceCompletionPerMillion: number | null;
  description?: string;
}

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export function useProviderModels(provider: LlmProviderKind, baseUrl?: string | null) {
  // For non-OpenRouter providers, return an empty disabled query so the UI
  // can fall back to free-text input without a runtime branch.
  const enabled = provider === "openrouter";

  return useQuery({
    queryKey: ["markets", "provider_models", provider, baseUrl ?? null] as const,
    enabled,
    queryFn: async (): Promise<ProviderModel[]> => {
      // Defensive: only honor a baseUrl override that actually looks like an http(s) URL.
      // Chrome's autofill can stuff emails into the base_url Input field on the
      // Settings form, so trust nothing that doesn't have a protocol prefix.
      const trimmed = baseUrl?.trim() ?? "";
      const isValidOverride = /^https?:\/\//i.test(trimmed);
      const root = isValidOverride ? trimmed.replace(/\/+$/, "") : "https://openrouter.ai/api/v1";
      const fetchUrl = `${root}/models`;
      const resp = await fetch(fetchUrl, {
        headers: { "Accept": "application/json" },
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`OpenRouter /models ${resp.status}: ${txt.slice(0, 200)}`);
      }
      const json: any = await resp.json();
      const list: any[] = Array.isArray(json?.data) ? json.data : [];

      return list
        .map((m: any): ProviderModel | null => {
          if (!m?.id || typeof m.id !== "string") return null;
          const prompt = parseFloatOrNull(m?.pricing?.prompt);
          const completion = parseFloatOrNull(m?.pricing?.completion);
          return {
            id: m.id,
            name: typeof m.name === "string" ? m.name : m.id,
            contextLength: typeof m.context_length === "number" ? m.context_length : null,
            // OpenRouter prices are per-token (e.g., "0.000003"); convert to per-million.
            pricePromptPerMillion: prompt != null ? prompt * 1_000_000 : null,
            priceCompletionPerMillion: completion != null ? completion * 1_000_000 : null,
            description: typeof m.description === "string" ? m.description : undefined,
          };
        })
        .filter((x: ProviderModel | null): x is ProviderModel => x !== null)
        // Sort by id alphabetically — predictable for users hunting via type-ahead.
        .sort((a: ProviderModel, b: ProviderModel) => a.id.localeCompare(b.id));
    },
    // OpenRouter's catalog changes slowly; cache for 1 hour.
    staleTime: 60 * 60_000,
    gcTime: 6 * 60 * 60_000,
    retry: 1,
  });
}

function parseFloatOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
