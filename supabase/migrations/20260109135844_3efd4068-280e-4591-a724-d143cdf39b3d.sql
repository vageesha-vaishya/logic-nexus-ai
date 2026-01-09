-- Create import_history table
CREATE TABLE IF NOT EXISTS public.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  imported_by UUID REFERENCES public.profiles(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'partial' CHECK (status IN ('success', 'partial', 'failed', 'reverted')),
  summary JSONB DEFAULT '{}'::jsonb,
  reverted_at TIMESTAMPTZ,
  reverted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create import_history_details table
CREATE TABLE IF NOT EXISTS public.import_history_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.import_history(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('insert', 'update')),
  previous_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_import_history_tenant ON public.import_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_history_table ON public.import_history(table_name);
CREATE INDEX IF NOT EXISTS idx_import_history_details_import ON public.import_history_details(import_id);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_history
CREATE POLICY "Users can view import history for their tenant"
  ON public.import_history FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert import history for their tenant"
  ON public.import_history FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update import history for their tenant"
  ON public.import_history FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for import_history_details
CREATE POLICY "Users can view import details for their tenant"
  ON public.import_history_details FOR SELECT
  USING (import_id IN (SELECT id FROM public.import_history WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

CREATE POLICY "Users can insert import details for their tenant"
  ON public.import_history_details FOR INSERT
  WITH CHECK (import_id IN (SELECT id FROM public.import_history WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

CREATE POLICY "Users can update import details for their tenant"
  ON public.import_history_details FOR UPDATE
  USING (import_id IN (SELECT id FROM public.import_history WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));