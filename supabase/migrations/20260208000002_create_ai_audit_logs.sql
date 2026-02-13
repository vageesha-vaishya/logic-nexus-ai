CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  user_id uuid REFERENCES auth.users(id),
  function_name text NOT NULL,
  model_used text NOT NULL,
  model_version text,
  input_tokens int,
  output_tokens int,
  total_cost_usd numeric(10,6),
  latency_ms int,
  input_hash text,
  output_summary jsonb,
  pii_detected boolean DEFAULT false,
  pii_fields_redacted text[],
  cache_hit boolean DEFAULT false,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_audit_tenant_date ON public.ai_audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_function ON public.ai_audit_logs (function_name, created_at DESC);
