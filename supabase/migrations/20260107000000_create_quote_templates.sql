-- Create quote_templates table
CREATE TABLE IF NOT EXISTS public.quote_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_quote_templates_tenant_id ON public.quote_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quote_templates_category ON public.quote_templates(category);
CREATE INDEX IF NOT EXISTS idx_quote_templates_is_active ON public.quote_templates(is_active);

-- Enable RLS
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view templates from their tenant"
    ON public.quote_templates
    FOR SELECT
    USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create templates for their tenant"
    ON public.quote_templates
    FOR INSERT
    WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update templates from their tenant"
    ON public.quote_templates
    FOR UPDATE
    USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete templates from their tenant"
    ON public.quote_templates
    FOR DELETE
    USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_quote_templates_updated_at ON public.quote_templates;
CREATE TRIGGER update_quote_templates_updated_at
    BEFORE UPDATE ON public.quote_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
