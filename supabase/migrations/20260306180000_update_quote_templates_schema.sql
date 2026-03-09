-- Migration: Update Quote Templates Schema and Add Upsert RPC
-- Date: 2026-03-06
-- Description: Adds missing columns to quote_templates and creates upsert_main_template RPC.

BEGIN;

-- 1. Add missing columns to quote_templates
ALTER TABLE public.quote_templates
ADD COLUMN IF NOT EXISTS template_name TEXT,
ADD COLUMN IF NOT EXISTS rate_options JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS transport_modes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS legs_config JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS carrier_selections JSONB DEFAULT '[]'::jsonb;

-- Add index on template_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_quote_templates_template_name ON public.quote_templates(template_name);

-- 1.5 Add missing columns to tenant_profile (referenced by edge functions)
ALTER TABLE public.tenant_profile
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- 2. Create upsert_main_template RPC
DROP FUNCTION IF EXISTS public.upsert_main_template(UUID, JSONB, JSONB, JSONB, JSONB, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.upsert_main_template(
    p_tenant_id UUID,
    p_content JSONB,
    p_rate_options JSONB,
    p_transport_modes JSONB,
    p_legs_config JSONB,
    p_carrier_selections JSONB,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_template_id UUID;
    v_result JSONB;
BEGIN
    -- Check if MGL-Main-Template exists for this tenant
    SELECT id INTO v_template_id
    FROM public.quote_templates
    WHERE tenant_id = p_tenant_id
      AND template_name = 'MGL-Main-Template'
    LIMIT 1;

    IF v_template_id IS NOT NULL THEN
        -- Update existing template
        UPDATE public.quote_templates
        SET
            content = p_content,
            rate_options = p_rate_options,
            transport_modes = p_transport_modes,
            legs_config = p_legs_config,
            carrier_selections = p_carrier_selections,
            updated_by = p_user_id,
            updated_at = NOW()
        WHERE id = v_template_id
        RETURNING to_jsonb(quote_templates.*) INTO v_result;
    ELSE
        -- Insert new template
        INSERT INTO public.quote_templates (
            tenant_id,
            name,
            template_name,
            content,
            rate_options,
            transport_modes,
            legs_config,
            carrier_selections,
            created_by,
            updated_by,
            is_active
        ) VALUES (
            p_tenant_id,
            'MGL Main Template',
            'MGL-Main-Template',
            p_content,
            p_rate_options,
            p_transport_modes,
            p_legs_config,
            p_carrier_selections,
            p_user_id,
            p_user_id,
            true
        )
        RETURNING to_jsonb(quote_templates.*) INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;

COMMIT;
