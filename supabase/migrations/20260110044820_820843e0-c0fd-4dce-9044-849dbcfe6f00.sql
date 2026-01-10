-- Create user_preferences table for Admin Scope Switcher
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  admin_override_enabled BOOLEAN NOT NULL DEFAULT false,
  theme VARCHAR(20) DEFAULT 'system',
  language VARCHAR(10) DEFAULT 'en',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own preferences
CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
  ON public.user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: Set user scope preference (for Admin Override feature)
CREATE OR REPLACE FUNCTION public.set_user_scope_preference(
  p_tenant_id UUID DEFAULT NULL,
  p_franchise_id UUID DEFAULT NULL,
  p_admin_override BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled)
  VALUES (v_user_id, p_tenant_id, p_franchise_id, p_admin_override)
  ON CONFLICT (user_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    franchise_id = EXCLUDED.franchise_id,
    admin_override_enabled = EXCLUDED.admin_override_enabled,
    updated_at = now();
END;
$$;

-- RPC: Set admin override (specifically for toggling override mode)
CREATE OR REPLACE FUNCTION public.set_admin_override(
  p_enabled BOOLEAN,
  p_tenant_id UUID DEFAULT NULL,
  p_franchise_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_platform_admin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is platform admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND role = 'platform_admin'
  ) INTO v_is_platform_admin;

  IF NOT v_is_platform_admin THEN
    RAISE EXCEPTION 'Only platform admins can use admin override';
  END IF;

  INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled)
  VALUES (v_user_id, p_tenant_id, p_franchise_id, p_enabled)
  ON CONFLICT (user_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    franchise_id = EXCLUDED.franchise_id,
    admin_override_enabled = EXCLUDED.admin_override_enabled,
    updated_at = now();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.set_user_scope_preference TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_override TO authenticated;