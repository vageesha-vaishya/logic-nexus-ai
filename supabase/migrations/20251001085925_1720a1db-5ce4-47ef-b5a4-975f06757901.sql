-- Create OAuth configurations table
CREATE TABLE IF NOT EXISTS public.oauth_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('office365', 'gmail', 'other')),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  tenant_id_provider TEXT, -- For Office 365 Azure AD tenant ID
  redirect_uri TEXT NOT NULL,
  scopes JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.oauth_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own OAuth configs"
  ON public.oauth_configurations
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins can manage all OAuth configs"
  ON public.oauth_configurations
  FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Create index
CREATE INDEX idx_oauth_configurations_user_provider ON public.oauth_configurations(user_id, provider);

-- Add updated_at trigger
CREATE TRIGGER update_oauth_configurations_updated_at
  BEFORE UPDATE ON public.oauth_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();