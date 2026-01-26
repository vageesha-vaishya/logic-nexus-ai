CREATE TABLE IF NOT EXISTS public.ai_quote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    request_payload JSONB NOT NULL,
    response_payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'generated', -- generated, converted
    quote_id UUID REFERENCES public.quotes(id) -- Linked if converted
);

-- Add RLS
ALTER TABLE public.ai_quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI requests"
    ON public.ai_quote_requests
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI requests"
    ON public.ai_quote_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.ai_quote_requests TO authenticated;
