-- Migration to add caching for AI quotes
CREATE TABLE IF NOT EXISTS public.ai_quote_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_hash text NOT NULL,
    response_payload jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_quote_cache_hash ON public.ai_quote_cache(request_hash);

-- RLS Policies
ALTER TABLE public.ai_quote_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users"
ON public.ai_quote_cache FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow insert access to authenticated users"
ON public.ai_quote_cache FOR INSERT
TO authenticated
WITH CHECK (true);

-- Function to clean up expired cache
CREATE OR REPLACE FUNCTION clean_expired_ai_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM public.ai_quote_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
