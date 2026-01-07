BEGIN;
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  admin_override_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_preferences_tenant_id ON public.user_preferences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_franchise_id ON public.user_preferences(franchise_id);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON public.user_preferences FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Tenant admins manage tenant user preferences" ON public.user_preferences FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin')) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin'));
CREATE POLICY "Platform admins manage all user preferences" ON public.user_preferences FOR ALL USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TABLE IF NOT EXISTS public.admin_override_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_override_audit_tenant_id ON public.admin_override_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_override_audit_franchise_id ON public.admin_override_audit(franchise_id);
CREATE INDEX IF NOT EXISTS idx_admin_override_audit_user_id ON public.admin_override_audit(user_id);
ALTER TABLE public.admin_override_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own admin override audit" ON public.admin_override_audit FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Tenant admins view tenant admin override audit" ON public.admin_override_audit FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin'));
CREATE POLICY "Platform admins manage admin override audit" ON public.admin_override_audit FOR ALL USING (public.is_platform_admin(auth.uid()));
CREATE OR REPLACE FUNCTION public.set_user_franchise_preference(p_franchise_id UUID, p_admin_override BOOLEAN DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled, updated_at)
VALUES (auth.uid(), public.get_user_tenant_id(auth.uid()), p_franchise_id, COALESCE(p_admin_override, (SELECT admin_override_enabled FROM public.user_preferences WHERE user_id = auth.uid())), NOW())
ON CONFLICT (user_id) DO UPDATE
SET franchise_id = EXCLUDED.franchise_id,
    admin_override_enabled = EXCLUDED.admin_override_enabled,
    tenant_id = EXCLUDED.tenant_id,
    updated_at = NOW();
$$;
CREATE OR REPLACE FUNCTION public.audit_admin_override(p_enabled BOOLEAN, p_franchise_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
INSERT INTO public.admin_override_audit (user_id, tenant_id, franchise_id, enabled)
VALUES (auth.uid(), public.get_user_tenant_id(auth.uid()), p_franchise_id, p_enabled);
$$;
CREATE OR REPLACE FUNCTION public.set_admin_override(p_enabled BOOLEAN, p_franchise_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'tenant_admin') AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  PERFORM public.audit_admin_override(p_enabled, p_franchise_id);
  PERFORM public.set_user_franchise_preference(p_franchise_id, p_enabled);
END;
$$;
COMMIT;
