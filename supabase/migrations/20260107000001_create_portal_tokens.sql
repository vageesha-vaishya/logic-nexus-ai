CREATE TABLE IF NOT EXISTS public.portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  tenant_id UUID,
  last_ip TEXT,
  last_user_agent TEXT,
  flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON public.portal_tokens(token);

ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users manage tokens" ON public.portal_tokens
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to verify token and get quote details
CREATE OR REPLACE FUNCTION public.get_quote_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
  v_quote_record RECORD;
BEGIN
  SELECT * INTO v_token_record
  FROM public.portal_tokens
  WHERE token = p_token
    AND expires_at > NOW();

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired token');
  END IF;

  IF v_token_record.accessed_at IS NOT NULL AND (NOW() - v_token_record.accessed_at) < INTERVAL '5 seconds' THEN
    RETURN jsonb_build_object('error', 'Rate limit exceeded, please wait a moment');
  END IF;

  UPDATE public.portal_tokens
  SET accessed_at = NOW()
  WHERE id = v_token_record.id;

  UPDATE public.portal_tokens
  SET access_count = COALESCE(access_count, 0) + 1
  WHERE id = v_token_record.id;

  SELECT * INTO v_quote_record
  FROM public.quotes
  WHERE id = v_token_record.quote_id;

  IF v_token_record.tenant_id IS NULL AND v_quote_record IS NOT NULL THEN
    UPDATE public.portal_tokens SET tenant_id = v_quote_record.tenant_id WHERE id = v_token_record.id;
  END IF;

  IF (SELECT access_count FROM public.portal_tokens WHERE id = v_token_record.id) > 50 THEN
    UPDATE public.portal_tokens SET flagged = true WHERE id = v_token_record.id;
  END IF;

  RETURN jsonb_build_object(
    'quote', row_to_json(v_quote_record),
    'token_id', v_token_record.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quote_by_token(TEXT) TO anon;

CREATE TABLE IF NOT EXISTS public.quote_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.portal_tokens(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('accepted','rejected')),
  decided_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_acceptances_token ON public.quote_acceptances(token_id);
CREATE INDEX IF NOT EXISTS idx_quote_acceptances_quote ON public.quote_acceptances(quote_id);

CREATE OR REPLACE FUNCTION public.accept_quote_by_token(
  p_token TEXT,
  p_decision TEXT,
  p_name TEXT,
  p_email TEXT,
  p_ip TEXT,
  p_user_agent TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
  v_quote_record RECORD;
  v_recent RECORD;
BEGIN
  SELECT * INTO v_token_record
  FROM public.portal_tokens
  WHERE token = p_token
    AND expires_at > NOW();

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired token');
  END IF;

  SELECT * INTO v_recent
  FROM public.quote_acceptances
  WHERE token_id = v_token_record.id
    AND decided_at > NOW() - INTERVAL '60 seconds'
  LIMIT 1;

  IF v_recent IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Please wait before submitting again');
  END IF;

  SELECT * INTO v_quote_record
  FROM public.quotes
  WHERE id = v_token_record.quote_id;

  INSERT INTO public.quote_acceptances(
    quote_id, token_id, decision, name, email, ip_address, user_agent
  ) VALUES (
    v_token_record.quote_id, v_token_record.id, p_decision, p_name, p_email, p_ip, p_user_agent
  );

  UPDATE public.portal_tokens
  SET accessed_at = NOW(),
      access_count = COALESCE(access_count, 0) + 1,
      last_ip = p_ip,
      last_user_agent = p_user_agent
  WHERE id = v_token_record.id;

  IF p_decision = 'accepted' THEN
    UPDATE public.quotes
    SET status = 'accepted'
    WHERE id = v_token_record.quote_id
      AND status <> 'accepted';
  END IF;

  RETURN jsonb_build_object('success', true, 'quote_id', v_token_record.quote_id, 'decision', p_decision);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_quote_by_token(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
