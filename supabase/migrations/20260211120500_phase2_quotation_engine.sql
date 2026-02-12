
-- Create tenant_branding table
CREATE TABLE IF NOT EXISTS public.tenant_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID, -- References auth.users or tenants table if exists
    company_name TEXT,
    logo_url TEXT, -- Or base64 string
    primary_color TEXT DEFAULT '#0087b5', -- MGL Blueish default
    secondary_color TEXT DEFAULT '#dceef2', -- MGL Light Blue default
    accent_color TEXT DEFAULT '#000000',
    font_family TEXT DEFAULT 'Helvetica',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure RLS is enabled on tenant_branding
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

-- Create quote_templates table if not exists (referenced in code but not found in migrations)
CREATE TABLE IF NOT EXISTS public.quote_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    content JSONB NOT NULL, -- The template JSON structure
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist (if table already existed with different schema)
ALTER TABLE public.quote_templates ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.quote_templates ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0.0';

-- Force version to be TEXT if it was INTEGER
ALTER TABLE public.quote_templates ALTER COLUMN version TYPE TEXT USING version::TEXT;

-- Ensure RLS is enabled on quote_templates
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

-- Add template_snapshot column to quotation_versions for versioning/snapshotting
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'quotation_versions'
        AND column_name = 'template_snapshot'
    ) THEN
        ALTER TABLE public.quotation_versions ADD COLUMN template_snapshot JSONB;
    END IF;
END $$;

-- Seed default branding (MGL) if not exists
INSERT INTO public.tenant_branding (company_name, primary_color, secondary_color, accent_color, font_family)
SELECT 'Miami Global Lines', '#0087b5', '#dceef2', '#000000', 'Helvetica'
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_branding WHERE company_name = 'Miami Global Lines');

-- Seed default template if not exists
INSERT INTO public.quote_templates (name, description, content, is_default, version)
SELECT 
    'MGL Standard Granular', 
    'Standard granular quote template for MGL',
    '{
        "layout": "mgl_granular",
        "header": { "show_logo": true, "company_info": true, "title": "QUOTATION" },
        "sections": [
            { "type": "customer_matrix_header", "title": "Customer Information" },
            { "type": "shipment_matrix_details", "title": "Details (with Equipment/QTY)" },
            { "type": "rates_matrix", "title": "Freight Charges Matrix" },
            { "type": "terms", "title": "Terms & Conditions" }
        ],
        "footer": { "text": "Thank you for your business." }
    }'::jsonb,
    true,
    '1.0.0'
WHERE NOT EXISTS (SELECT 1 FROM public.quote_templates WHERE name = 'MGL Standard Granular');

-- Function to snapshot template on version creation
CREATE OR REPLACE FUNCTION public.snapshot_quote_template()
RETURNS TRIGGER AS $$
DECLARE
    v_template_content JSONB;
BEGIN
    -- If template_snapshot is already provided, keep it
    IF NEW.template_snapshot IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch default template content (or specific one if we had a template_id link)
    -- For now, we use the default template if no snapshot is present
    SELECT content INTO v_template_content
    FROM public.quote_templates
    WHERE is_default = true
    LIMIT 1;

    IF v_template_content IS NOT NULL THEN
        NEW.template_snapshot := v_template_content;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-snapshot template
DROP TRIGGER IF EXISTS trigger_snapshot_quote_template ON public.quotation_versions;
CREATE TRIGGER trigger_snapshot_quote_template
BEFORE INSERT ON public.quotation_versions
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_quote_template();

