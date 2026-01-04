-- User-specific history filter presets
CREATE TABLE IF NOT EXISTS public.history_filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.history_filter_presets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_history_filter_presets_user ON public.history_filter_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_history_filter_presets_tenant ON public.history_filter_presets(tenant_id);

CREATE POLICY "Platform admins can manage all presets"
  ON public.history_filter_presets FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can manage own presets"
  ON public.history_filter_presets FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_history_filter_presets_updated_at ON public.history_filter_presets;
CREATE TRIGGER update_history_filter_presets_updated_at
  BEFORE UPDATE ON public.history_filter_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

