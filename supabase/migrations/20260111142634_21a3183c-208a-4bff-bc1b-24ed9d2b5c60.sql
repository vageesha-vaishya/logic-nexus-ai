-- Create dashboard_preferences table
CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID REFERENCES public.tenants(id),
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  layout JSONB,
  theme_overrides JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Create index
CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_user_id ON public.dashboard_preferences(user_id);

-- RLS Policies - Users can only manage their own preferences
CREATE POLICY "Users can view own dashboard preferences"
ON public.dashboard_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own dashboard preferences"
ON public.dashboard_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own dashboard preferences"
ON public.dashboard_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own dashboard preferences"
ON public.dashboard_preferences FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Update timestamp trigger
CREATE TRIGGER trg_dashboard_preferences_updated
BEFORE UPDATE ON public.dashboard_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_scheduled_email_timestamp();