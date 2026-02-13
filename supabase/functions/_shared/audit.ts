import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function logAiCall(
  supabase: SupabaseClient,
  payload: {
    tenant_id?: string | null;
    user_id?: string | null;
    function_name: string;
    model_used: string;
    model_version?: string | null;
    input_tokens?: number | null;
    output_tokens?: number | null;
    total_cost_usd?: number | null;
    latency_ms?: number | null;
    input_hash?: string | null;
    output_summary?: any;
    pii_detected?: boolean;
    pii_fields_redacted?: string[];
    cache_hit?: boolean;
    error_message?: string | null;
  }
) {
  await supabase.from("ai_audit_logs").insert({
    tenant_id: payload.tenant_id ?? null,
    user_id: payload.user_id ?? null,
    function_name: payload.function_name,
    model_used: payload.model_used,
    model_version: payload.model_version ?? null,
    input_tokens: payload.input_tokens ?? null,
    output_tokens: payload.output_tokens ?? null,
    total_cost_usd: payload.total_cost_usd ?? null,
    latency_ms: payload.latency_ms ?? null,
    input_hash: payload.input_hash ?? null,
    output_summary: payload.output_summary ?? null,
    pii_detected: payload.pii_detected ?? false,
    pii_fields_redacted: payload.pii_fields_redacted ?? [],
    cache_hit: payload.cache_hit ?? false,
    error_message: payload.error_message ?? null,
  });
}
