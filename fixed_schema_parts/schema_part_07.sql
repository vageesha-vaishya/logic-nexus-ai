COMMIT;-- Force types regeneration
COMMENT ON TABLE tenants IS 'Tenant organizations in the system';-- POD Support Migration: add enum value, shipment flags, and attachment type
-- 1) Add 'proof_of_delivery' to public.document_type enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'document_type'
      AND n.nspname = 'public'
      AND e.enumlabel = 'proof_of_delivery'
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'proof_of_delivery';
  END IF;
END
$$;

-- 2) Add POD indicators to shipments
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS pod_received boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pod_received_at timestamptz NULL;

-- 3) Extend shipment_attachments with document_type
ALTER TABLE public.shipment_attachments
  ADD COLUMN IF NOT EXISTS document_type public.document_type NULL;

-- 4) Helpful index for filtering POD attachments per shipment
CREATE INDEX IF NOT EXISTS idx_shipment_attachments_shipment_id_document_type
  ON public.shipment_attachments (shipment_id, document_type);

COMMENT ON COLUMN public.shipment_attachments.document_type IS 'Document type (e.g., proof_of_delivery) for this attachment';-- POD (Proof of Delivery) Support
-- Add POD-related columns to shipments table if they don't exist

DO $$ 
BEGIN
  -- Add pod_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_status'
  ) THEN
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pod_status TEXT DEFAULT 'pending' CHECK (pod_status IN ('pending', 'received', 'rejected', 'disputed'));
  END IF;

  -- Add pod_received_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_received_at'
  ) THEN
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pod_received_at TIMESTAMPTZ;
  END IF;

  -- Add pod_received_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_received_by'
  ) THEN
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pod_received_by TEXT;
  END IF;

  -- Add pod_signature_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_signature_url'
  ) THEN
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pod_signature_url TEXT;
  END IF;

  -- Add pod_notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_notes'
  ) THEN
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pod_notes TEXT;
  END IF;

  -- Add pod_documents column for storing multiple POD document URLs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_documents'
  ) THEN
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pod_documents JSONB DEFAULT '[]';
  END IF;
END $$;

-- Create index on pod_status for faster queries
CREATE INDEX IF NOT EXISTS idx_shipments_pod_status ON public.shipments(pod_status);

-- Create index on pod_received_at for date-based queries
CREATE INDEX IF NOT EXISTS idx_shipments_pod_received_at ON public.shipments(pod_received_at);

COMMENT ON COLUMN public.shipments.pod_documents IS 'Array of POD document URLs and metadata';-- Seed Default Simple Theme
-- Create themes table if it doesn't exist and seed a default theme

CREATE TABLE IF NOT EXISTS public.themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  colors JSONB DEFAULT '{}',
  typography JSONB DEFAULT '{}',
  spacing JSONB DEFAULT '{}',
  borders JSONB DEFAULT '{}',
  shadows JSONB DEFAULT '{}',
  custom_css TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS on themes
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for themes
DROP POLICY IF EXISTS "Users can view themes in their tenant" ON public.themes;
DROP POLICY IF EXISTS "Users can view themes in their tenant" ON public.themes;
CREATE POLICY "Users can view themes in their tenant" ON public.themes FOR SELECT 
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles 
      WHERE user_id = auth.uid()
    )
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Tenant admins can manage themes" ON public.themes;
DROP POLICY IF EXISTS "Tenant admins can manage themes" ON public.themes;
CREATE POLICY "Tenant admins can manage themes" ON public.themes FOR ALL 
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('tenant_admin', 'platform_admin')
    )
    OR public.is_platform_admin(auth.uid())
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_themes_tenant_id ON public.themes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_themes_is_default ON public.themes(is_default);
CREATE INDEX IF NOT EXISTS idx_themes_is_active ON public.themes(is_active);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_themes_updated_at ON public.themes;
CREATE TRIGGER update_themes_updated_at 
  BEFORE UPDATE ON public.themes 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default simple theme for existing tenants
INSERT INTO public.themes (tenant_id, name, is_default, is_active, colors, typography, spacing, borders, shadows)
SELECT 
  t.id,
  'Simple Default',
  true,
  true,
  jsonb_build_object(
    'primary', '#3b82f6',
    'secondary', '#64748b',
    'success', '#10b981',
    'warning', '#f59e0b',
    'danger', '#ef4444',
    'background', '#ffffff',
    'foreground', '#0f172a',
    'muted', '#f1f5f9',
    'mutedForeground', '#64748b',
    'border', '#e2e8f0',
    'input', '#e2e8f0',
    'ring', '#3b82f6'
  ),
  jsonb_build_object(
    'fontFamily', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    'fontSize', '16px',
    'fontWeightNormal', '400',
    'fontWeightMedium', '500',
    'fontWeightBold', '700',
    'lineHeight', '1.5'
  ),
  jsonb_build_object(
    'xs', '0.25rem',
    'sm', '0.5rem',
    'md', '1rem',
    'lg', '1.5rem',
    'xl', '2rem',
    '2xl', '3rem'
  ),
  jsonb_build_object(
    'radius', '0.5rem',
    'radiusSm', '0.25rem',
    'radiusLg', '0.75rem',
    'width', '1px'
  ),
  jsonb_build_object(
    'sm', '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    'md', '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    'lg', '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    'xl', '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  )
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.themes 
  WHERE tenant_id = t.id AND is_default = true
)
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN public.themes.custom_css IS 'Additional custom CSS';-- Fix is_platform_admin function
-- Enhance the function to handle edge cases and improve reliability
-- Use CREATE OR REPLACE to avoid dependency issues

DROP FUNCTION IF EXISTS public.is_platform_admin(check_user_id UUID);
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return false if check_user_id is NULL
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user has platform_admin role and profile is active
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = check_user_id
      AND ur.role = 'platform_admin'
      AND p.is_active = true
  );
END;
$$;

-- Create a convenience function to check current user
DROP FUNCTION IF EXISTS public.is_current_user_platform_admin();
CREATE OR REPLACE FUNCTION public.is_current_user_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin(auth.uid());
$$;

-- Create a function to get all platform admin users
DROP FUNCTION IF EXISTS public.get_platform_admins();
CREATE OR REPLACE FUNCTION public.get_platform_admins()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  is_active BOOLEAN,
  assigned_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.is_active,
    ur.assigned_at
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'platform_admin'
    AND p.is_active = true
  ORDER BY ur.assigned_at DESC;
$$;

COMMENT ON FUNCTION public.get_platform_admins() IS 'Get list of all active platform administrators';-- Seed platform-wide default theme: "Default Simple"
-- Ensures a clean, accessible light palette is the default across the app

begin;

-- Remove existing platform theme with the same name to avoid conflicts
delete from public.ui_themes
 where scope = 'platform'
   and lower(name) = lower('Default Simple');

-- Clear previous platform defaults
update public.ui_themes
   set is_default = false
 where scope = 'platform';

-- Insert the Default Simple preset as the platform default
insert into public.ui_themes (name, tokens, scope, is_default, is_active)
values (
  'Default Simple',
  '{
    "start": "220 80% 98%",
    "end": "220 70% 94%",
    "primary": "220 90% 55%",
    "accent": "200 70% 50%",
    "angle": 120,
    "radius": "0.5rem",
    "sidebarBackground": "0 0% 100%",
    "sidebarAccent": "220 15% 95%",
    "dark": false,
    "bgStart": "0 0% 100%",
    "bgEnd": "220 20% 97%",
    "bgAngle": 120,
    "tableHeaderText": "222.2 84% 4.9%",
    "tableHeaderSeparator": "220 20% 80%",
    "tableHeaderBackground": "220 50% 96%",
    "tableBackground": "0 0% 100%",
    "tableForeground": "222.2 84% 4.9%"
  }'::jsonb,
  'platform',
  true,
  true
);

commit;DROP FUNCTION IF EXISTS public.is_platform_admin(check_user_id UUID);
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(check_user_id, 'platform_admin'::public.app_role);
$$;-- Create quote_legs table for multi-modal quotations
CREATE TABLE IF NOT EXISTS public.quote_legs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  quote_option_id UUID NOT NULL,
  leg_number INTEGER NOT NULL DEFAULT 1,
  mode TEXT,
  service_type_id UUID,
  origin_location TEXT,
  destination_location TEXT,
  carrier_id UUID,
  transit_days INTEGER,
  departure_date TIMESTAMP WITH TIME ZONE,
  arrival_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  sort_order INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.quote_legs ENABLE ROW LEVEL SECURITY;

-- Create stub records for existing leg_ids in quote_charges
INSERT INTO public.quote_legs (id, tenant_id, quote_option_id, leg_number, mode)
SELECT DISTINCT 
  qc.leg_id,
  qc.tenant_id,
  qc.quote_option_id,
  1,
  'ocean'
FROM public.quote_charges qc
WHERE qc.leg_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies
DROP POLICY IF EXISTS "Platform admins can manage all quote legs" ON public.quote_legs;
CREATE POLICY "Platform admins can manage all quote legs" ON public.quote_legs
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant quote legs" ON public.quote_legs;
CREATE POLICY "Tenant admins can manage tenant quote legs" ON public.quote_legs
  FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view franchise quote legs" ON public.quote_legs;
CREATE POLICY "Users can view franchise quote legs" ON public.quote_legs
  FOR SELECT
  USING (
    quote_option_id IN (
      SELECT qvo.id FROM quotation_version_options qvo
      JOIN quotation_versions qv ON qvo.quotation_version_id = qv.id
      JOIN quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create franchise quote legs" ON public.quote_legs;
CREATE POLICY "Users can create franchise quote legs" ON public.quote_legs
  FOR INSERT
  WITH CHECK (
    quote_option_id IN (
      SELECT qvo.id FROM quotation_version_options qvo
      JOIN quotation_versions qv ON qvo.quotation_version_id = qv.id
      JOIN quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quote_legs_option ON public.quote_legs(quote_option_id);
CREATE INDEX IF NOT EXISTS idx_quote_legs_tenant ON public.quote_legs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quote_legs_service_type ON public.quote_legs(service_type_id);

-- Add foreign key constraints
ALTER TABLE public.quote_legs DROP CONSTRAINT IF EXISTS fk_quote_legs_tenant;
ALTER TABLE public.quote_legs ADD CONSTRAINT fk_quote_legs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.quote_legs DROP CONSTRAINT IF EXISTS fk_quote_legs_option;
ALTER TABLE public.quote_legs ADD CONSTRAINT fk_quote_legs_option FOREIGN KEY (quote_option_id) REFERENCES public.quotation_version_options(id) ON DELETE CASCADE;

-- Add foreign key for quote_charges to quote_legs
ALTER TABLE public.quote_charges
  ADD CONSTRAINT fk_quote_charges_leg
  FOREIGN KEY (leg_id) REFERENCES public.quote_legs(id) ON DELETE CASCADE;

-- Create updated_at trigger
DROP TRIGGER IF EXISTS set_quote_legs_updated_at ON public.quote_legs;
CREATE TRIGGER set_quote_legs_updated_at
  BEFORE UPDATE ON public.quote_legs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Phase 1: Critical Database Schema Fixes for Quotation Module

-- Step 1: Drop conflicting foreign key constraint on quote_charges.leg_id
-- This constraint was pointing to quote_legs which is deprecated
ALTER TABLE quote_charges DROP CONSTRAINT IF EXISTS fk_quote_charges_leg;

-- Step 2: Add mode column to quotation_version_option_legs if it doesn't exist
-- This allows storing the transport mode (air, sea, road, rail) directly on the leg
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_version_option_legs' 
        AND column_name = 'mode'
    ) THEN
        ALTER TABLE quotation_version_option_legs ADD COLUMN IF NOT EXISTS mode TEXT;
    END IF;
END $$;

-- Step 3: Rename leg_order to sort_order for consistency
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_version_option_legs' 
        AND column_name = 'leg_order'
    ) THEN
        ALTER TABLE quotation_version_option_legs RENAME COLUMN leg_order TO sort_order;
    END IF;
END $$;

-- Step 4: Add is_active flag to quotation_versions for version management
ALTER TABLE quotation_versions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Step 5: Create index to ensure only one active version per quote
DROP INDEX IF EXISTS idx_active_version_per_quote;
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_version_per_quote ON quotation_versions(quote_id) 
WHERE is_active = true;

-- Step 6: Add missing audit fields
ALTER TABLE quotation_version_options ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE quotation_version_option_legs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 7: Add trigger for updated_at on quotation_version_option_legs
DROP TRIGGER IF EXISTS update_quotation_version_option_legs_updated_at ON quotation_version_option_legs;
CREATE TRIGGER update_quotation_version_option_legs_updated_at 
BEFORE UPDATE ON quotation_version_option_legs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_quote_charges_leg_id ON quote_charges(leg_id);
CREATE INDEX IF NOT EXISTS idx_quote_charges_quote_option_id ON quote_charges(quote_option_id);
CREATE INDEX IF NOT EXISTS idx_quotation_version_option_legs_option_id ON quotation_version_option_legs(quotation_version_option_id);-- Add option_name column to quotation_version_options
ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS option_name TEXT;

-- Add a comment explaining the column

-- Create function to generate next option name for a version
DROP FUNCTION IF EXISTS generate_next_option_name(p_version_id UUID);
CREATE OR REPLACE FUNCTION generate_next_option_name(p_version_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_next_letter CHAR(1);
BEGIN
  -- Count existing options for this version
  SELECT COUNT(*) INTO v_count
  FROM quotation_version_options
  WHERE quotation_version_id = p_version_id;
  
  -- Generate letter: A=65 in ASCII, so A is 0, B is 1, etc.
  v_next_letter := CHR(65 + v_count);
  
  RETURN 'Option ' || v_next_letter;
END;
$$;-- Fix search_path for generate_next_option_name function
DROP FUNCTION IF EXISTS generate_next_option_name(p_version_id UUID);
CREATE OR REPLACE FUNCTION generate_next_option_name(p_version_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_next_letter CHAR(1);
BEGIN
  -- Count existing options for this version
  SELECT COUNT(*) INTO v_count
  FROM quotation_version_options
  WHERE quotation_version_id = p_version_id;
  
  -- Generate letter: A=65 in ASCII, so A is 0, B is 1, etc.
  v_next_letter := CHR(65 + v_count);
  
  RETURN 'Option ' || v_next_letter;
END;
$$;-- ==========================================
-- PHASE 1: DATABASE RESTRUCTURING (FINAL)
-- Quotation Module Enhancement
-- ==========================================

-- Step 1: Create audit log table
CREATE TABLE IF NOT EXISTS quotation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  quotation_version_id UUID REFERENCES quotation_versions(id) ON DELETE CASCADE,
  quotation_version_option_id UUID REFERENCES quotation_version_options(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_quote_id ON quotation_audit_log(quote_id);
CREATE INDEX IF NOT EXISTS idx_audit_version_id ON quotation_audit_log(quotation_version_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON quotation_audit_log(created_at DESC);

-- Step 2: Fix orphaned charges - create default legs for options with charges but no legs
DO $$
DECLARE
  orphaned_charge RECORD;
  new_leg_id UUID;
BEGIN
  FOR orphaned_charge IN 
    SELECT DISTINCT qc.quote_option_id, qc.tenant_id
    FROM quote_charges qc
    WHERE qc.leg_id IS NULL
  LOOP
    INSERT INTO quotation_version_option_legs (
      id,
      tenant_id,
      quotation_version_option_id,
      sort_order,
      mode,
      origin_location,
      destination_location
    ) VALUES (
      gen_random_uuid(),
      orphaned_charge.tenant_id,
      orphaned_charge.quote_option_id,
      1,
      'ocean',
      'Origin',
      'Destination'
    )
    RETURNING id INTO new_leg_id;
    
    UPDATE quote_charges
    SET leg_id = new_leg_id
    WHERE quote_option_id = orphaned_charge.quote_option_id 
    AND leg_id IS NULL;
    
    RAISE NOTICE 'Created default leg % for option %', new_leg_id, orphaned_charge.quote_option_id;
  END LOOP;
END $$;

-- Step 3: Make leg_id NOT NULL in quote_charges
ALTER TABLE quote_charges 
  ALTER COLUMN leg_id SET NOT NULL;

-- Step 4: Add new fields to quotation_versions
ALTER TABLE quotation_versions
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add unique constraints for version identification
ALTER TABLE quotation_versions
  DROP CONSTRAINT IF EXISTS uq_quote_version_number,
  ADD CONSTRAINT uq_quote_version_number UNIQUE (quote_id, version_number);

ALTER TABLE quotation_versions
  DROP CONSTRAINT IF EXISTS uq_quote_major_minor,
  ADD CONSTRAINT uq_quote_major_minor UNIQUE (quote_id, major, minor);

CREATE INDEX IF NOT EXISTS idx_quotation_versions_current 
  ON quotation_versions(quote_id, is_current) WHERE is_current = true;

-- Step 5: Enhance quotation_version_options with calculated fields
ALTER TABLE quotation_version_options
  ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_buy NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sell NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leg_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charge_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ;

-- Step 6: Add current_version_id to quotes table
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES quotation_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_current_version 
  ON quotes(current_version_id) WHERE current_version_id IS NOT NULL;

-- Step 7: Set latest version as current for each quote
UPDATE quotes q
SET current_version_id = (
  SELECT qv.id 
  FROM quotation_versions qv 
  WHERE qv.quote_id = q.id 
  ORDER BY qv.version_number DESC 
  LIMIT 1
)
WHERE current_version_id IS NULL;

UPDATE quotation_versions qv
SET is_current = true
WHERE id IN (
  SELECT current_version_id 
  FROM quotes 
  WHERE current_version_id IS NOT NULL
);

-- Step 8: Create version management trigger
DROP FUNCTION IF EXISTS validate_version_uniqueness();
CREATE OR REPLACE FUNCTION validate_version_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE quotation_versions
    SET is_current = false
    WHERE quote_id = NEW.quote_id 
    AND id != NEW.id
    AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_current_version ON quotation_versions;
CREATE TRIGGER trg_validate_current_version
  BEFORE INSERT OR UPDATE OF is_current ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION validate_version_uniqueness();

-- Step 9: Create option totals calculation function
DROP FUNCTION IF EXISTS calculate_option_totals(p_option_id UUID);
CREATE OR REPLACE FUNCTION calculate_option_totals(p_option_id UUID)
RETURNS TABLE(
  leg_count INTEGER,
  charge_count INTEGER,
  total_buy NUMERIC,
  total_sell NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT ql.id)::INTEGER as leg_count,
    COUNT(qc.id)::INTEGER as charge_count,
    COALESCE(SUM(CASE WHEN cs.code = 'BUY' THEN qc.amount ELSE 0 END), 0) as total_buy,
    COALESCE(SUM(CASE WHEN cs.code = 'SELL' THEN qc.amount ELSE 0 END), 0) as total_sell
  FROM quotation_version_options qvo
  LEFT JOIN quotation_version_option_legs ql ON ql.quotation_version_option_id = qvo.id
  LEFT JOIN quote_charges qc ON qc.leg_id = ql.id
  LEFT JOIN charge_sides cs ON cs.id = qc.charge_side_id
  WHERE qvo.id = p_option_id
  GROUP BY qvo.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 10: Create auto-calculation trigger
DROP FUNCTION IF EXISTS update_option_totals();
CREATE OR REPLACE FUNCTION update_option_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_option_id UUID;
  v_totals RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = OLD.leg_id;
  ELSE
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = NEW.leg_id;
  END IF;
  
  SELECT * INTO v_totals FROM calculate_option_totals(v_option_id);
  
  UPDATE quotation_version_options
  SET 
    leg_count = v_totals.leg_count,
    charge_count = v_totals.charge_count,
    total_buy = v_totals.total_buy,
    total_sell = v_totals.total_sell,
    margin_amount = v_totals.total_sell - v_totals.total_buy,
    total_amount = v_totals.total_sell,
    last_calculated_at = now()
  WHERE id = v_option_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_option_totals_on_charge_change ON quote_charges;
CREATE TRIGGER trg_update_option_totals_on_charge_change
  AFTER INSERT OR UPDATE OR DELETE ON quote_charges
  FOR EACH ROW
  EXECUTE FUNCTION update_option_totals();

-- Step 11: Add leg sort validation
DROP FUNCTION IF EXISTS validate_leg_sort_order();
CREATE OR REPLACE FUNCTION validate_leg_sort_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sort_order = 1 OR NEW.sort_order IS NULL THEN
    SELECT COALESCE(MAX(sort_order), 0) + 100
    INTO NEW.sort_order
    FROM quotation_version_option_legs
    WHERE quotation_version_option_id = NEW.quotation_version_option_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_leg_sort_order ON quotation_version_option_legs;
CREATE TRIGGER trg_validate_leg_sort_order
  BEFORE INSERT ON quotation_version_option_legs
  FOR EACH ROW
  EXECUTE FUNCTION validate_leg_sort_order();

-- Step 12: Calculate totals for existing options
DO $$
DECLARE
  opt RECORD;
  totals RECORD;
BEGIN
  FOR opt IN SELECT id FROM quotation_version_options
  LOOP
    SELECT * INTO totals FROM calculate_option_totals(opt.id);
    
    UPDATE quotation_version_options
    SET 
      leg_count = totals.leg_count,
      charge_count = totals.charge_count,
      total_buy = totals.total_buy,
      total_sell = totals.total_sell,
      margin_amount = totals.total_sell - totals.total_buy,
      total_amount = totals.total_sell,
      last_calculated_at = now()
    WHERE id = opt.id;
  END LOOP;
END $$;

-- Step 13: Add RLS policies for audit log
ALTER TABLE quotation_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view franchise audit logs" ON quotation_audit_log;
CREATE POLICY "Users can view franchise audit logs" ON quotation_audit_log FOR SELECT
  USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Tenant admins can view all audit logs" ON quotation_audit_log;
CREATE POLICY "Tenant admins can view all audit logs" ON quotation_audit_log FOR SELECT
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON quotation_audit_log;
CREATE POLICY "Platform admins can view all audit logs" ON quotation_audit_log FOR SELECT
  USING (is_platform_admin(auth.uid()));

-- Step 14: Add documentation

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 1 Complete - Database restructured successfully';
END $$;-- Phase 2 Prep: Add franchise_id to quotation tables (handling NULLs)

-- Step 1: Add franchise_id columns (nullable)
ALTER TABLE quotation_versions ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id);
ALTER TABLE quotation_version_options ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id);
ALTER TABLE quotation_version_option_legs ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id);
ALTER TABLE quote_charges ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id);

-- Step 2: Backfill franchise_id from quotes table
UPDATE quotation_versions qv
SET franchise_id = q.franchise_id
FROM quotes q
WHERE qv.quote_id = q.id;

UPDATE quotation_version_options qvo
SET franchise_id = qv.franchise_id
FROM quotation_versions qv
WHERE qvo.quotation_version_id = qv.id;

UPDATE quotation_version_option_legs qvol
SET franchise_id = qvo.franchise_id
FROM quotation_version_options qvo
WHERE qvol.quotation_version_option_id = qvo.id;

UPDATE quote_charges qc
SET franchise_id = qvol.franchise_id
FROM quotation_version_option_legs qvol
WHERE qc.leg_id = qvol.id;

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotation_versions_franchise ON quotation_versions(franchise_id);
CREATE INDEX IF NOT EXISTS idx_quotation_version_options_franchise ON quotation_version_options(franchise_id);
CREATE INDEX IF NOT EXISTS idx_quotation_version_option_legs_franchise ON quotation_version_option_legs(franchise_id);
CREATE INDEX IF NOT EXISTS idx_quote_charges_franchise ON quote_charges(franchise_id);

-- Step 4: Drop old complex RLS policies
DROP POLICY IF EXISTS "Platform admins can manage all quotation versions" ON quotation_versions;
DROP POLICY IF EXISTS "Tenant admins can manage tenant quotation versions" ON quotation_versions;
DROP POLICY IF EXISTS "Users can create franchise quotation versions" ON quotation_versions;
DROP POLICY IF EXISTS "Users can view franchise quotation versions" ON quotation_versions;

DROP POLICY IF EXISTS "Platform admins can manage all quotation options" ON quotation_version_options;
DROP POLICY IF EXISTS "Tenant admins can manage tenant quotation options" ON quotation_version_options;
DROP POLICY IF EXISTS "Users can create franchise quotation options" ON quotation_version_options;
DROP POLICY IF EXISTS "Users can view franchise quotation options" ON quotation_version_options;

DROP POLICY IF EXISTS "Platform admins can manage all option legs" ON quotation_version_option_legs;
DROP POLICY IF EXISTS "Tenant admins can manage tenant option legs" ON quotation_version_option_legs;
DROP POLICY IF EXISTS "Users can create franchise option legs" ON quotation_version_option_legs;
DROP POLICY IF EXISTS "Users can view franchise option legs" ON quotation_version_option_legs;

DROP POLICY IF EXISTS "Platform admins can manage all quote charges" ON quote_charges;
DROP POLICY IF EXISTS "Tenant admins can manage tenant quote charges" ON quote_charges;
DROP POLICY IF EXISTS "Users can create franchise quote charges" ON quote_charges;
DROP POLICY IF EXISTS "Users can view franchise quote charges" ON quote_charges;
DROP POLICY IF EXISTS "quote_charges_manage" ON quote_charges;
DROP POLICY IF EXISTS "quote_charges_read" ON quote_charges;

-- Step 5: Create simplified RLS policies (allowing NULL for legacy data)

-- Quotation Versions
DROP POLICY IF EXISTS "Platform admins full access to quotation versions" ON quotation_versions;
CREATE POLICY "Platform admins full access to quotation versions" ON quotation_versions FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage tenant quotation versions" ON quotation_versions;
CREATE POLICY "Tenant admins manage tenant quotation versions" ON quotation_versions FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'tenant_admin'::app_role) 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Franchise admins manage franchise quotation versions" ON quotation_versions;
CREATE POLICY "Franchise admins manage franchise quotation versions" ON quotation_versions FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'franchise_admin'::app_role) 
  AND (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL)
);

DROP POLICY IF EXISTS "Users view franchise quotation versions" ON quotation_versions;
CREATE POLICY "Users view franchise quotation versions" ON quotation_versions FOR SELECT
TO authenticated
USING (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL);

DROP POLICY IF EXISTS "Users create franchise quotation versions" ON quotation_versions;
CREATE POLICY "Users create franchise quotation versions" ON quotation_versions FOR INSERT
TO authenticated
WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- Quotation Version Options
DROP POLICY IF EXISTS "Platform admins full access to quotation options" ON quotation_version_options;
CREATE POLICY "Platform admins full access to quotation options" ON quotation_version_options FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage tenant quotation options" ON quotation_version_options;
CREATE POLICY "Tenant admins manage tenant quotation options" ON quotation_version_options FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'tenant_admin'::app_role) 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Franchise admins manage franchise quotation options" ON quotation_version_options;
CREATE POLICY "Franchise admins manage franchise quotation options" ON quotation_version_options FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'franchise_admin'::app_role) 
  AND (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL)
);

DROP POLICY IF EXISTS "Users view franchise quotation options" ON quotation_version_options;
CREATE POLICY "Users view franchise quotation options" ON quotation_version_options FOR SELECT
TO authenticated
USING (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL);

DROP POLICY IF EXISTS "Users create franchise quotation options" ON quotation_version_options;
CREATE POLICY "Users create franchise quotation options" ON quotation_version_options FOR INSERT
TO authenticated
WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- Quotation Version Option Legs
DROP POLICY IF EXISTS "Platform admins full access to option legs" ON quotation_version_option_legs;
CREATE POLICY "Platform admins full access to option legs" ON quotation_version_option_legs FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage tenant option legs" ON quotation_version_option_legs;
CREATE POLICY "Tenant admins manage tenant option legs" ON quotation_version_option_legs FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'tenant_admin'::app_role) 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Franchise admins manage franchise option legs" ON quotation_version_option_legs;
CREATE POLICY "Franchise admins manage franchise option legs" ON quotation_version_option_legs FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'franchise_admin'::app_role) 
  AND (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL)
);

DROP POLICY IF EXISTS "Users view franchise option legs" ON quotation_version_option_legs;
CREATE POLICY "Users view franchise option legs" ON quotation_version_option_legs FOR SELECT
TO authenticated
USING (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL);

DROP POLICY IF EXISTS "Users create franchise option legs" ON quotation_version_option_legs;
CREATE POLICY "Users create franchise option legs" ON quotation_version_option_legs FOR INSERT
TO authenticated
WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- Quote Charges
DROP POLICY IF EXISTS "Platform admins full access to quote charges" ON quote_charges;
CREATE POLICY "Platform admins full access to quote charges" ON quote_charges FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage tenant quote charges" ON quote_charges;
CREATE POLICY "Tenant admins manage tenant quote charges" ON quote_charges FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'tenant_admin'::app_role) 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Franchise admins manage franchise quote charges" ON quote_charges;
CREATE POLICY "Franchise admins manage franchise quote charges" ON quote_charges FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'franchise_admin'::app_role) 
  AND (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL)
);

DROP POLICY IF EXISTS "Users view franchise quote charges" ON quote_charges;
CREATE POLICY "Users view franchise quote charges" ON quote_charges FOR SELECT
TO authenticated
USING (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL);

DROP POLICY IF EXISTS "Users create franchise quote charges" ON quote_charges;
CREATE POLICY "Users create franchise quote charges" ON quote_charges FOR INSERT
TO authenticated
WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));-- Phase 2: Backend Business Logic Implementation

-- =====================================================
-- 1. AUTOMATIC VERSION NUMBERING
-- =====================================================

-- Function to calculate next version number for a quote
DROP FUNCTION IF EXISTS calculate_next_version_number(p_quote_id UUID);
CREATE OR REPLACE FUNCTION calculate_next_version_number(p_quote_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO v_max_version
  FROM quotation_versions
  WHERE quote_id = p_quote_id;
  
  RETURN v_max_version + 1;
END;
$$;

-- Trigger to auto-assign version number
DROP FUNCTION IF EXISTS auto_assign_version_number();
CREATE OR REPLACE FUNCTION auto_assign_version_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    NEW.version_number := calculate_next_version_number(NEW.quote_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_version_number ON quotation_versions;
CREATE TRIGGER trigger_auto_assign_version_number
  BEFORE INSERT ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_version_number();

-- =====================================================
-- 2. STATUS WORKFLOW VALIDATION
-- =====================================================

-- Function to validate status transitions
DROP FUNCTION IF EXISTS validate_version_status_transition();
CREATE OR REPLACE FUNCTION validate_version_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  -- Get old status if updating
  IF TG_OP = 'UPDATE' THEN
    v_old_status := OLD.status;
    
    -- Define allowed transitions
    -- draft -> sent, internal_review, cancelled
    -- sent -> accepted, rejected, expired, cancelled
    -- internal_review -> draft, sent, cancelled
    -- accepted -> fulfilled (future state)
    -- rejected, expired, cancelled are terminal states
    
    IF v_old_status = 'draft' AND NEW.status NOT IN ('draft', 'sent', 'internal_review', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from draft to %', NEW.status;
    ELSIF v_old_status = 'sent' AND NEW.status NOT IN ('sent', 'accepted', 'rejected', 'expired', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from sent to %', NEW.status;
    ELSIF v_old_status = 'internal_review' AND NEW.status NOT IN ('internal_review', 'draft', 'sent', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from internal_review to %', NEW.status;
    ELSIF v_old_status IN ('accepted', 'rejected', 'expired', 'cancelled') AND NEW.status != v_old_status THEN
      RAISE EXCEPTION 'Cannot change status from terminal state %', v_old_status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_version_status ON quotation_versions;
CREATE TRIGGER trigger_validate_version_status
  BEFORE INSERT OR UPDATE ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION validate_version_status_transition();

-- =====================================================
-- 3. MARGIN CALCULATIONS
-- =====================================================

-- Function to calculate option margins from charges
DROP FUNCTION IF EXISTS calculate_option_margins(p_option_id UUID);
CREATE OR REPLACE FUNCTION calculate_option_margins(p_option_id UUID)
RETURNS TABLE(
  total_buy NUMERIC,
  total_sell NUMERIC,
  margin_amount NUMERIC,
  margin_percentage NUMERIC,
  charge_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_buy NUMERIC := 0;
  v_total_sell NUMERIC := 0;
  v_margin_amount NUMERIC := 0;
  v_margin_percentage NUMERIC := 0;
  v_charge_count INTEGER := 0;
BEGIN
  -- Calculate totals from charges
  SELECT 
    COALESCE(SUM(CASE WHEN cs.code = 'BUY' THEN qc.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cs.code = 'SELL' THEN qc.amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_total_buy, v_total_sell, v_charge_count
  FROM quote_charges qc
  JOIN quotation_version_option_legs qvol ON qvol.id = qc.leg_id
  JOIN charge_sides cs ON cs.id = qc.charge_side_id
  WHERE qvol.quotation_version_option_id = p_option_id;
  
  -- Calculate margin
  v_margin_amount := v_total_sell - v_total_buy;
  
  -- Calculate margin percentage (avoid division by zero)
  IF v_total_buy > 0 THEN
    v_margin_percentage := (v_margin_amount / v_total_buy) * 100;
  ELSIF v_total_sell > 0 THEN
    v_margin_percentage := 100; -- 100% margin if no cost
  ELSE
    v_margin_percentage := 0;
  END IF;
  
  RETURN QUERY SELECT v_total_buy, v_total_sell, v_margin_amount, v_margin_percentage, v_charge_count;
END;
$$;

-- Trigger to auto-update option totals when charges change
DROP FUNCTION IF EXISTS update_option_margins_on_charge_change();
CREATE OR REPLACE FUNCTION update_option_margins_on_charge_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_option_id UUID;
  v_margins RECORD;
BEGIN
  -- Get the option_id
  IF TG_OP = 'DELETE' THEN
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = OLD.leg_id;
  ELSE
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = NEW.leg_id;
  END IF;
  
  -- Calculate margins
  SELECT * INTO v_margins FROM calculate_option_margins(v_option_id);
  
  -- Update the option
  UPDATE quotation_version_options
  SET 
    total_buy = v_margins.total_buy,
    total_sell = v_margins.total_sell,
    total_amount = v_margins.total_sell,
    margin_amount = v_margins.margin_amount,
    margin_percentage = v_margins.margin_percentage,
    charge_count = v_margins.charge_count,
    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_option_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_option_margins ON quote_charges;
CREATE TRIGGER trigger_update_option_margins
  AFTER INSERT OR UPDATE OR DELETE ON quote_charges
  FOR EACH ROW
  EXECUTE FUNCTION update_option_margins_on_charge_change();

-- =====================================================
-- 4. CUSTOMER SELECTION VALIDATION
-- =====================================================

-- Function to validate only one selection per version
DROP FUNCTION IF EXISTS validate_single_selection_per_version();
CREATE OR REPLACE FUNCTION validate_single_selection_per_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  -- Check if there's already a selection for this version
  SELECT COUNT(*) INTO v_existing_count
  FROM customer_selections
  WHERE quotation_version_id = NEW.quotation_version_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
  
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'A customer selection already exists for this quotation version';
  END IF;
  
  -- Validate that the option belongs to the version
  IF NOT EXISTS (
    SELECT 1 FROM quotation_version_options
    WHERE id = NEW.quotation_version_option_id
      AND quotation_version_id = NEW.quotation_version_id
  ) THEN
    RAISE EXCEPTION 'The selected option does not belong to this quotation version';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_customer_selection ON customer_selections;
CREATE TRIGGER trigger_validate_customer_selection
  BEFORE INSERT OR UPDATE ON customer_selections
  FOR EACH ROW
  EXECUTE FUNCTION validate_single_selection_per_version();

-- =====================================================
-- 5. AUTOMATIC AUDIT LOGGING
-- =====================================================

-- Function to log version changes
DROP FUNCTION IF EXISTS log_version_changes();
CREATE OR REPLACE FUNCTION log_version_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_changes JSONB;
BEGIN
  v_action := TG_OP;
  
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := row_to_json(OLD)::JSONB;
  END IF;
  
  INSERT INTO quotation_audit_log (
    tenant_id,
    quote_id,
    quotation_version_id,
    entity_type,
    entity_id,
    action,
    changes,
    user_id
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.quote_id, OLD.quote_id),
    COALESCE(NEW.id, OLD.id),
    'quotation_version',
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_changes,
    auth.uid()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_version_changes ON quotation_versions;
CREATE TRIGGER trigger_log_version_changes
  AFTER INSERT OR UPDATE OR DELETE ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION log_version_changes();

-- Function to log option changes
DROP FUNCTION IF EXISTS log_option_changes();
CREATE OR REPLACE FUNCTION log_option_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_changes JSONB;
BEGIN
  v_action := TG_OP;
  
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := row_to_json(OLD)::JSONB;
  END IF;
  
  INSERT INTO quotation_audit_log (
    tenant_id,
    quotation_version_id,
    quotation_version_option_id,
    entity_type,
    entity_id,
    action,
    changes,
    user_id
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.quotation_version_id, OLD.quotation_version_id),
    COALESCE(NEW.id, OLD.id),
    'quotation_version_option',
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_changes,
    auth.uid()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_option_changes ON quotation_version_options;
CREATE TRIGGER trigger_log_option_changes
  AFTER INSERT OR UPDATE OR DELETE ON quotation_version_options
  FOR EACH ROW
  EXECUTE FUNCTION log_option_changes();

-- =====================================================
-- 6. HELPER FUNCTIONS FOR BUSINESS LOGIC
-- =====================================================

-- Function to mark version as current and unmark others
DROP FUNCTION IF EXISTS set_current_version(p_version_id UUID);
CREATE OR REPLACE FUNCTION set_current_version(p_version_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id UUID;
BEGIN
  -- Get the quote_id
  SELECT quote_id INTO v_quote_id
  FROM quotation_versions
  WHERE id = p_version_id;
  
  -- Unmark all other versions
  UPDATE quotation_versions
  SET is_current = FALSE
  WHERE quote_id = v_quote_id AND id != p_version_id;
  
  -- Mark this version as current
  UPDATE quotation_versions
  SET is_current = TRUE
  WHERE id = p_version_id;
  
  -- Update the quote's current_version_id
  UPDATE quotes
  SET current_version_id = p_version_id
  WHERE id = v_quote_id;
END;
$$;

-- Function to compare two versions
DROP FUNCTION IF EXISTS compare_versions(p_version_id_1 UUID, p_version_id_2 UUID);
CREATE OR REPLACE FUNCTION compare_versions(p_version_id_1 UUID, p_version_id_2 UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comparison JSONB;
  v_version_1 RECORD;
  v_version_2 RECORD;
BEGIN
  -- Get version details
  SELECT * INTO v_version_1 FROM quotation_versions WHERE id = p_version_id_1;
  SELECT * INTO v_version_2 FROM quotation_versions WHERE id = p_version_id_2;
  
  v_comparison := jsonb_build_object(
    'version_1', row_to_json(v_version_1),
    'version_2', row_to_json(v_version_2),
    'differences', jsonb_build_object(
      'status_changed', v_version_1.status != v_version_2.status,
      'created_at_diff', EXTRACT(EPOCH FROM (v_version_2.created_at - v_version_1.created_at))
    )
  );
  
  RETURN v_comparison;
END;
$$;

COMMENT ON FUNCTION compare_versions IS 'Compares two versions and returns differences';-- Create transport_modes table
CREATE TABLE IF NOT EXISTS public.transport_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  color TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.transport_modes ENABLE ROW LEVEL SECURITY;

-- Everyone can view active transport modes
DROP POLICY IF EXISTS "Anyone can view active transport modes" ON public.transport_modes;
CREATE POLICY "Anyone can view active transport modes" ON public.transport_modes
  FOR SELECT
  USING (is_active = true);

-- Platform admins can manage transport modes
DROP POLICY IF EXISTS "Platform admins can manage transport modes" ON public.transport_modes;
CREATE POLICY "Platform admins can manage transport modes" ON public.transport_modes
  FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Add mode_id to service_types
ALTER TABLE public.service_types
ADD COLUMN IF NOT EXISTS mode_id UUID REFERENCES public.transport_modes(id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_service_types_mode_id ON public.service_types(mode_id);

-- Insert initial transport modes based on current hardcoded values
INSERT INTO public.transport_modes (code, name, icon_name, color, display_order) VALUES
  ('ocean', 'Ocean Freight', 'Ship', 'hsl(var(--chart-1))', 100),
  ('air', 'Air Freight', 'Plane', 'hsl(var(--chart-2))', 200),
  ('road', 'Road Transport', 'Truck', 'hsl(var(--chart-3))', 300),
  ('rail', 'Rail Transport', 'Train', 'hsl(var(--chart-4))', 400)
ON CONFLICT (code) DO NOTHING;

-- Update existing service_types to link to transport modes
UPDATE public.service_types
SET mode_id = (SELECT id FROM public.transport_modes WHERE code = 'ocean')
WHERE code IN ('ocean_freight', 'ocean_breakbulk', 'ocean_lcl', 'ocean_roro')
AND mode_id IS NULL;

UPDATE public.service_types
SET mode_id = (SELECT id FROM public.transport_modes WHERE code = 'air')
WHERE code = 'air_freight'
AND mode_id IS NULL;

UPDATE public.service_types
SET mode_id = (SELECT id FROM public.transport_modes WHERE code = 'road')
WHERE code IN ('road_freight', 'trucking')
AND mode_id IS NULL;

UPDATE public.service_types
SET mode_id = (SELECT id FROM public.transport_modes WHERE code = 'rail')
WHERE code = 'rail_freight'
AND mode_id IS NULL;

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_transport_modes_updated_at ON public.transport_modes;
CREATE TRIGGER update_transport_modes_updated_at
  BEFORE UPDATE ON public.transport_modes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Add margin_percentage column to quotation_version_options table
ALTER TABLE quotation_version_options 
ADD COLUMN IF NOT EXISTS margin_percentage numeric;

-- Add comment to explain the column

-- Update existing records to calculate margin_percentage based on buy_subtotal and margin_amount
UPDATE quotation_version_options
SET margin_percentage = CASE 
  WHEN buy_subtotal > 0 THEN (margin_amount / buy_subtotal) * 100
  ELSE 0
END
WHERE margin_percentage IS NULL;-- Create charge_tier_config table for defining tiered pricing rules
CREATE TABLE IF NOT EXISTS charge_tier_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  basis_id UUID REFERENCES charge_bases(id), -- links to 'Per KG', 'Per CBM', etc.
  category_id UUID REFERENCES charge_categories(id), -- optional: specific charge category
  service_type_id UUID REFERENCES service_types(id), -- optional: specific service type
  carrier_id UUID REFERENCES carriers(id), -- optional: carrier-specific tiers
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_tier_config_name UNIQUE (tenant_id, name)
);

-- Create charge_tier_ranges table for individual tier levels
CREATE TABLE IF NOT EXISTS charge_tier_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_config_id UUID NOT NULL REFERENCES charge_tier_config(id) ON DELETE CASCADE,
  min_value NUMERIC NOT NULL CHECK (min_value >= 0),
  max_value NUMERIC CHECK (max_value IS NULL OR max_value > min_value), -- NULL = infinity
  rate NUMERIC NOT NULL CHECK (rate >= 0),
  currency_id UUID REFERENCES currencies(id),
  sort_order INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_charge_tier_config_tenant ON charge_tier_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_charge_tier_config_basis ON charge_tier_config(basis_id);
CREATE INDEX IF NOT EXISTS idx_charge_tier_config_category ON charge_tier_config(category_id);
CREATE INDEX IF NOT EXISTS idx_charge_tier_config_service_type ON charge_tier_config(service_type_id);
CREATE INDEX IF NOT EXISTS idx_charge_tier_config_carrier ON charge_tier_config(carrier_id);
CREATE INDEX IF NOT EXISTS idx_charge_tier_ranges_config ON charge_tier_ranges(tier_config_id);
CREATE INDEX IF NOT EXISTS idx_charge_tier_ranges_values ON charge_tier_ranges(min_value, max_value);

-- Add RLS policies for charge_tier_config
ALTER TABLE charge_tier_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can manage all tier configs" ON charge_tier_config;
CREATE POLICY "Platform admins can manage all tier configs" ON charge_tier_config FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tier configs" ON charge_tier_config;
CREATE POLICY "Tenant admins can manage tier configs" ON charge_tier_config FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant tier configs" ON charge_tier_config;
CREATE POLICY "Users can view tenant tier configs" ON charge_tier_config FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add RLS policies for charge_tier_ranges
ALTER TABLE charge_tier_ranges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can manage all tier ranges" ON charge_tier_ranges;
CREATE POLICY "Platform admins can manage all tier ranges" ON charge_tier_ranges FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tier ranges" ON charge_tier_ranges;
CREATE POLICY "Tenant admins can manage tier ranges" ON charge_tier_ranges FOR ALL
  USING (
    tier_config_id IN (
      SELECT id FROM charge_tier_config 
      WHERE tenant_id = get_user_tenant_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view tenant tier ranges" ON charge_tier_ranges;
CREATE POLICY "Users can view tenant tier ranges" ON charge_tier_ranges FOR SELECT
  USING (
    tier_config_id IN (
      SELECT id FROM charge_tier_config 
      WHERE tenant_id = get_user_tenant_id(auth.uid())
    )
  );

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_charge_tier_config_updated_at ON charge_tier_config;
CREATE TRIGGER update_charge_tier_config_updated_at
  BEFORE UPDATE ON charge_tier_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_charge_tier_ranges_updated_at ON charge_tier_ranges;
CREATE TRIGGER update_charge_tier_ranges_updated_at
  BEFORE UPDATE ON charge_tier_ranges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helper function to get applicable rate for a given value
DROP FUNCTION IF EXISTS get_tier_rate(p_tier_config_id UUID, p_value NUMERIC);
CREATE OR REPLACE FUNCTION get_tier_rate(
  p_tier_config_id UUID,
  p_value NUMERIC
) RETURNS TABLE(
  range_id UUID,
  rate NUMERIC,
  currency_id UUID,
  min_value NUMERIC,
  max_value NUMERIC
) 
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    id,
    rate,
    currency_id,
    min_value,
    max_value
  FROM charge_tier_ranges
  WHERE tier_config_id = p_tier_config_id
    AND min_value <= p_value
    AND (max_value IS NULL OR max_value >= p_value)
  ORDER BY sort_order, min_value
  LIMIT 1;
$$;

-- Add comments for documentation

COMMENT ON FUNCTION get_tier_rate IS 'Returns the applicable tier rate for a given value';-- Fix search_path security issue for get_tier_rate function
DROP FUNCTION IF EXISTS get_tier_rate(p_tier_config_id UUID, p_value NUMERIC);
CREATE OR REPLACE FUNCTION get_tier_rate(
  p_tier_config_id UUID,
  p_value NUMERIC
) RETURNS TABLE(
  range_id UUID,
  rate NUMERIC,
  currency_id UUID,
  min_value NUMERIC,
  max_value NUMERIC
) 
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    id,
    rate,
    currency_id,
    min_value,
    max_value
  FROM charge_tier_ranges
  WHERE tier_config_id = p_tier_config_id
    AND min_value <= p_value
    AND (max_value IS NULL OR max_value >= p_value)
  ORDER BY sort_order, min_value
  LIMIT 1;
$$;-- Add leg_type and service_only_category columns to quotation_version_option_legs
ALTER TABLE quotation_version_option_legs 
ADD COLUMN leg_type TEXT DEFAULT 'transport' CHECK (leg_type IN ('transport', 'service')),
ADD COLUMN service_only_category TEXT;

-- Add index for leg_type queries
CREATE INDEX IF NOT EXISTS idx_quotation_version_option_legs_leg_type ON quotation_version_option_legs(leg_type);

-- Add comments for documentation

-- Create a helper function to validate service leg requirements
DROP FUNCTION IF EXISTS validate_service_leg_requirements();
CREATE OR REPLACE FUNCTION validate_service_leg_requirements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If leg_type is 'service', service_only_category must be set
  IF NEW.leg_type = 'service' AND (NEW.service_only_category IS NULL OR NEW.service_only_category = '') THEN
    RAISE EXCEPTION 'service_only_category is required for service-type legs';
  END IF;
  
  -- If leg_type is 'transport', origin and destination should be set
  -- (We'll make this a soft validation since existing data might not comply)
  IF NEW.leg_type = 'transport' AND NEW.service_only_category IS NOT NULL THEN
    -- Clear service_only_category for transport legs
    NEW.service_only_category := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to validate service leg requirements
DROP TRIGGER IF EXISTS validate_service_leg_before_insert_update ON quotation_version_option_legs;
CREATE TRIGGER validate_service_leg_before_insert_update
  BEFORE INSERT OR UPDATE ON quotation_version_option_legs
  FOR EACH ROW
  EXECUTE FUNCTION validate_service_leg_requirements();

-- Create a view for common service categories (for UI dropdowns)
CREATE TABLE IF NOT EXISTS service_leg_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies for service_leg_categories
ALTER TABLE service_leg_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active service leg categories" ON service_leg_categories;
CREATE POLICY "Anyone can view active service leg categories" ON service_leg_categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Platform admins can manage service leg categories" ON service_leg_categories;
CREATE POLICY "Platform admins can manage service leg categories" ON service_leg_categories FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Populate default service leg categories
INSERT INTO service_leg_categories (code, name, description, icon_name, sort_order) VALUES
('warehousing', 'Warehousing & Storage', 'Storage, distribution, and warehouse services', 'Warehouse', 100),
('customs', 'Customs Clearance', 'Import/export customs brokerage and clearance', 'FileCheck', 200),
('packing', 'Packing & Crating', 'Professional packing, crating, and palletization', 'Package', 300),
('inspection', 'Quality Inspection', 'Pre-shipment inspection and quality control', 'Search', 400),
('insurance', 'Cargo Insurance', 'Insurance coverage and documentation', 'Shield', 500),
('documentation', 'Documentation Services', 'Bill of lading, certificates, permits', 'FileText', 600),
('fumigation', 'Fumigation & Treatment', 'Pest control and cargo treatment services', 'Bug', 700),
('consolidation', 'Consolidation Services', 'Cargo consolidation and deconsolidation', 'Package2', 800),
('sorting', 'Sorting & Labeling', 'Cargo sorting, labeling, and marking', 'SortAsc', 900),
('other', 'Other Services', 'Miscellaneous service-only offerings', 'MoreHorizontal', 1000);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_service_leg_categories_updated_at ON service_leg_categories;
CREATE TRIGGER update_service_leg_categories_updated_at
  BEFORE UPDATE ON service_leg_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE service_leg_categories IS 'Predefined categories for service-only legs (warehousing, customs, etc.)';-- Phase 4.1: Weight Break Support
-- Create charge_weight_breaks table for defining weight-based tiered pricing
CREATE TABLE IF NOT EXISTS charge_weight_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID REFERENCES carriers(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES service_types(id),
  name TEXT NOT NULL,
  description TEXT,
  min_weight_kg NUMERIC NOT NULL CHECK (min_weight_kg >= 0),
  max_weight_kg NUMERIC CHECK (max_weight_kg IS NULL OR max_weight_kg > min_weight_kg),
  rate_per_kg NUMERIC NOT NULL CHECK (rate_per_kg >= 0),
  currency_id UUID REFERENCES currencies(id),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_effective_dates CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_charge_weight_breaks_tenant ON charge_weight_breaks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_charge_weight_breaks_carrier ON charge_weight_breaks(carrier_id);
CREATE INDEX IF NOT EXISTS idx_charge_weight_breaks_service_type ON charge_weight_breaks(service_type_id);
CREATE INDEX IF NOT EXISTS idx_charge_weight_breaks_weight ON charge_weight_breaks(min_weight_kg, max_weight_kg);
CREATE INDEX IF NOT EXISTS idx_charge_weight_breaks_dates ON charge_weight_breaks(effective_from, effective_until);

-- Phase 4.2: Dimensional Weight Support
-- Add dimensional weight flag to service_types
ALTER TABLE service_types 
ADD COLUMN use_dimensional_weight BOOLEAN DEFAULT false,
ADD COLUMN dim_divisor NUMERIC DEFAULT 6000 CHECK (dim_divisor > 0);

-- Add dimensional weight calculation to cargo_details (already has dimensions_cm)
ALTER TABLE cargo_details
ADD COLUMN actual_weight_kg NUMERIC CHECK (actual_weight_kg IS NULL OR actual_weight_kg >= 0),
ADD COLUMN volumetric_weight_kg NUMERIC CHECK (volumetric_weight_kg IS NULL OR volumetric_weight_kg >= 0),
ADD COLUMN chargeable_weight_kg NUMERIC CHECK (chargeable_weight_kg IS NULL OR chargeable_weight_kg >= 0);

-- Create function to calculate dimensional weight
DROP FUNCTION IF EXISTS calculate_dimensional_weight(p_length_cm NUMERIC, p_width_cm NUMERIC, p_height_cm NUMERIC, p_divisor NUMERIC);
CREATE OR REPLACE FUNCTION calculate_dimensional_weight(
  p_length_cm NUMERIC,
  p_width_cm NUMERIC,
  p_height_cm NUMERIC,
  p_divisor NUMERIC DEFAULT 6000
) RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN p_length_cm IS NULL OR p_width_cm IS NULL OR p_height_cm IS NULL OR p_divisor <= 0 
    THEN NULL
    ELSE (p_length_cm * p_width_cm * p_height_cm) / p_divisor
  END;
$$;

-- Create function to get chargeable weight
DROP FUNCTION IF EXISTS get_chargeable_weight(p_actual_weight_kg NUMERIC, p_volumetric_weight_kg NUMERIC);
CREATE OR REPLACE FUNCTION get_chargeable_weight(
  p_actual_weight_kg NUMERIC,
  p_volumetric_weight_kg NUMERIC
) RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$
  SELECT GREATEST(
    COALESCE(p_actual_weight_kg, 0),
    COALESCE(p_volumetric_weight_kg, 0)
  );
$$;

-- Phase 4.3: Container Type Variations
-- Add container ownership and special types to container_types
ALTER TABLE container_types
ADD COLUMN ownership_type TEXT CHECK (ownership_type IN ('COC', 'SOC', 'BOTH', NULL)),
ADD COLUMN is_special BOOLEAN DEFAULT false,
ADD COLUMN special_type TEXT;

-- Add special container attributes to container_sizes
ALTER TABLE container_sizes
ADD COLUMN has_ventilation BOOLEAN DEFAULT false,
ADD COLUMN has_temperature_control BOOLEAN DEFAULT false,
ADD COLUMN is_open_top BOOLEAN DEFAULT false,
ADD COLUMN is_flat_rack BOOLEAN DEFAULT false;

-- Insert common container ownership variants
INSERT INTO container_types (name, code, ownership_type, is_active, is_special, special_type) VALUES
('Dry COC', 'DRY_COC', 'COC', true, false, NULL),
('Dry SOC', 'DRY_SOC', 'SOC', true, false, NULL),
('Reefer COC', 'REEFER_COC', 'COC', true, true, 'refrigerated'),
('Reefer SOC', 'REEFER_SOC', 'SOC', true, true, 'refrigerated'),
('Open Top', 'OPEN_TOP', 'BOTH', true, true, 'open_top'),
('Flat Rack', 'FLAT_RACK', 'BOTH', true, true, 'flat_rack'),
('Tank Container', 'TANK', 'BOTH', true, true, 'tank')
ON CONFLICT (code) DO NOTHING;

-- Add RLS policies for charge_weight_breaks
ALTER TABLE charge_weight_breaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can manage all weight breaks" ON charge_weight_breaks;
CREATE POLICY "Platform admins can manage all weight breaks" ON charge_weight_breaks FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage weight breaks" ON charge_weight_breaks;
CREATE POLICY "Tenant admins can manage weight breaks" ON charge_weight_breaks FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant weight breaks" ON charge_weight_breaks;
CREATE POLICY "Users can view tenant weight breaks" ON charge_weight_breaks FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_charge_weight_breaks_updated_at ON charge_weight_breaks;
CREATE TRIGGER update_charge_weight_breaks_updated_at
  BEFORE UPDATE ON charge_weight_breaks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helper function to find applicable weight break rate
DROP FUNCTION IF EXISTS get_weight_break_rate(p_tenant_id UUID, p_carrier_id UUID, p_service_type_id UUID, p_weight_kg NUMERIC, p_effective_date DATE);
CREATE OR REPLACE FUNCTION get_weight_break_rate(
  p_tenant_id UUID,
  p_carrier_id UUID,
  p_service_type_id UUID,
  p_weight_kg NUMERIC,
  p_effective_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(
  id UUID,
  rate_per_kg NUMERIC,
  currency_id UUID,
  min_weight_kg NUMERIC,
  max_weight_kg NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    id,
    rate_per_kg,
    currency_id,
    min_weight_kg,
    max_weight_kg
  FROM charge_weight_breaks
  WHERE tenant_id = p_tenant_id
    AND (carrier_id = p_carrier_id OR carrier_id IS NULL)
    AND (service_type_id = p_service_type_id OR service_type_id IS NULL)
    AND min_weight_kg <= p_weight_kg
    AND (max_weight_kg IS NULL OR max_weight_kg >= p_weight_kg)
    AND effective_from <= p_effective_date
    AND (effective_until IS NULL OR effective_until >= p_effective_date)
    AND is_active = true
  ORDER BY 
    CASE WHEN carrier_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN service_type_id IS NOT NULL THEN 1 ELSE 2 END,
    min_weight_kg DESC
  LIMIT 1;
$$;

-- Add comments

COMMENT ON FUNCTION get_weight_break_rate IS 'Finds the applicable weight break rate for given parameters';-- ================================================
-- Phase 5: Provider-Specific Workflows
-- ================================================
-- This migration adds support for carrier-specific configurations,
-- rate structures, and API integration readiness.

-- ================================================
-- 1. Provider Rate Templates
-- ================================================
-- Define how different carriers structure their rates
CREATE TABLE IF NOT EXISTS provider_rate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES service_types(id) ON DELETE SET NULL,
  
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'weight_based', 'zone_based', 'distance_based', 'flat_rate'
  
  -- Rate structure configuration
  rate_structure JSONB NOT NULL DEFAULT '{}', -- Provider-specific rate structure
  
  -- Validation rules
  min_chargeable_weight NUMERIC,
  max_chargeable_weight NUMERIC,
  requires_dimensional_weight BOOLEAN DEFAULT false,
  requires_origin_destination BOOLEAN DEFAULT true,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  effective_until TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT provider_rate_templates_unique UNIQUE(carrier_id, service_type_id, template_name)
);

-- ================================================
-- 2. Provider Charge Mappings
-- ================================================
-- Map internal charge types to provider-specific charge codes
CREATE TABLE IF NOT EXISTS provider_charge_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  
  -- Internal charge reference
  charge_category_id UUID REFERENCES charge_categories(id) ON DELETE SET NULL,
  charge_basis_id UUID REFERENCES charge_bases(id) ON DELETE SET NULL,
  
  -- Provider-specific details
  provider_charge_code TEXT NOT NULL,
  provider_charge_name TEXT NOT NULL,
  provider_charge_description TEXT,
  
  -- Calculation rules
  calculation_method TEXT, -- 'fixed', 'percentage', 'per_unit', 'tiered'
  default_rate NUMERIC,
  currency_id UUID REFERENCES currencies(id) ON DELETE SET NULL,
  
  -- Conditions
  applies_to_service_types TEXT[], -- Array of service type codes
  min_shipment_value NUMERIC,
  max_shipment_value NUMERIC,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT provider_charge_mappings_unique UNIQUE(carrier_id, provider_charge_code)
);

-- ================================================
-- 3. Provider API Configurations
-- ================================================
-- Store API credentials and endpoints for carrier integrations
CREATE TABLE IF NOT EXISTS provider_api_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  
  -- API details
  api_provider TEXT NOT NULL, -- 'fedex', 'ups', 'dhl', 'custom'
  api_version TEXT,
  
  -- Endpoints
  base_url TEXT NOT NULL,
  rate_endpoint TEXT,
  tracking_endpoint TEXT,
  label_endpoint TEXT,
  
  -- Authentication
  auth_type TEXT NOT NULL, -- 'api_key', 'oauth', 'basic', 'bearer'
  auth_config JSONB NOT NULL DEFAULT '{}', -- Encrypted credentials
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER,
  
  -- Features
  supports_rate_shopping BOOLEAN DEFAULT false,
  supports_tracking BOOLEAN DEFAULT false,
  supports_label_generation BOOLEAN DEFAULT false,
  supports_document_upload BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_health_check TIMESTAMP WITH TIME ZONE,
  health_status TEXT, -- 'healthy', 'degraded', 'down'
  
  -- Metadata
  timeout_seconds INTEGER DEFAULT 30,
  retry_attempts INTEGER DEFAULT 3,
  custom_headers JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT provider_api_configs_unique UNIQUE(tenant_id, carrier_id)
);

-- ================================================
-- 4. Provider Rate Rules
-- ================================================
-- Define provider-specific business rules and validations
CREATE TABLE IF NOT EXISTS provider_rate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES service_types(id) ON DELETE CASCADE,
  
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'surcharge', 'discount', 'validation', 'calculation'
  
  -- Conditions
  conditions JSONB NOT NULL DEFAULT '{}', -- When this rule applies
  
  -- Actions
  actions JSONB NOT NULL DEFAULT '{}', -- What to do when conditions are met
  
  -- Priority
  priority INTEGER DEFAULT 100, -- Lower numbers execute first
  
  -- Validation
  validation_message TEXT, -- Custom message for validation rules
  is_blocking BOOLEAN DEFAULT false, -- If validation fails, block the quote
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================
-- 5. Provider Surcharge Definitions
-- ================================================
-- Define carrier-specific surcharges
CREATE TABLE IF NOT EXISTS provider_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  
  surcharge_code TEXT NOT NULL,
  surcharge_name TEXT NOT NULL,
  surcharge_description TEXT,
  
  -- Calculation
  calculation_type TEXT NOT NULL, -- 'fixed', 'percentage', 'per_unit', 'tiered'
  rate NUMERIC,
  currency_id UUID REFERENCES currencies(id) ON DELETE SET NULL,
  
  -- Application rules
  applies_to_service_types TEXT[],
  applies_to_weight_range JSONB, -- {min: 0, max: 1000}
  applies_to_zones TEXT[],
  applies_to_countries TEXT[],
  
  -- Conditions
  requires_special_handling BOOLEAN DEFAULT false,
  requires_hazmat BOOLEAN DEFAULT false,
  requires_temperature_control BOOLEAN DEFAULT false,
  
  -- Validity
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  effective_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT provider_surcharges_unique UNIQUE(carrier_id, surcharge_code)
);

-- ================================================
-- Indexes
-- ================================================
CREATE INDEX IF NOT EXISTS idx_provider_rate_templates_carrier ON provider_rate_templates(carrier_id);
CREATE INDEX IF NOT EXISTS idx_provider_rate_templates_service_type ON provider_rate_templates(service_type_id);
CREATE INDEX IF NOT EXISTS idx_provider_rate_templates_active ON provider_rate_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_provider_charge_mappings_carrier ON provider_charge_mappings(carrier_id);
CREATE INDEX IF NOT EXISTS idx_provider_charge_mappings_category ON provider_charge_mappings(charge_category_id);
CREATE INDEX IF NOT EXISTS idx_provider_charge_mappings_active ON provider_charge_mappings(is_active);

CREATE INDEX IF NOT EXISTS idx_provider_api_configs_carrier ON provider_api_configs(carrier_id);
CREATE INDEX IF NOT EXISTS idx_provider_api_configs_active ON provider_api_configs(is_active);

CREATE INDEX IF NOT EXISTS idx_provider_rate_rules_carrier ON provider_rate_rules(carrier_id);
CREATE INDEX IF NOT EXISTS idx_provider_rate_rules_service_type ON provider_rate_rules(service_type_id);
CREATE INDEX IF NOT EXISTS idx_provider_rate_rules_priority ON provider_rate_rules(priority);
CREATE INDEX IF NOT EXISTS idx_provider_rate_rules_active ON provider_rate_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_provider_surcharges_carrier ON provider_surcharges(carrier_id);
CREATE INDEX IF NOT EXISTS idx_provider_surcharges_active ON provider_surcharges(is_active);

-- ================================================
-- Row Level Security (RLS)
-- ================================================

-- Provider Rate Templates
ALTER TABLE provider_rate_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins full access to provider rate templates" ON provider_rate_templates;
CREATE POLICY "Platform admins full access to provider rate templates" ON provider_rate_templates
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage provider rate templates" ON provider_rate_templates;
CREATE POLICY "Tenant admins manage provider rate templates" ON provider_rate_templates
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users view tenant provider rate templates" ON provider_rate_templates;
CREATE POLICY "Users view tenant provider rate templates" ON provider_rate_templates
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Provider Charge Mappings
ALTER TABLE provider_charge_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins full access to provider charge mappings" ON provider_charge_mappings;
CREATE POLICY "Platform admins full access to provider charge mappings" ON provider_charge_mappings
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage provider charge mappings" ON provider_charge_mappings;
CREATE POLICY "Tenant admins manage provider charge mappings" ON provider_charge_mappings
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users view tenant provider charge mappings" ON provider_charge_mappings;
CREATE POLICY "Users view tenant provider charge mappings" ON provider_charge_mappings
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Provider API Configurations
ALTER TABLE provider_api_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins full access to provider api configs" ON provider_api_configs;
CREATE POLICY "Platform admins full access to provider api configs" ON provider_api_configs
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage provider api configs" ON provider_api_configs;
CREATE POLICY "Tenant admins manage provider api configs" ON provider_api_configs
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

-- Provider Rate Rules
ALTER TABLE provider_rate_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins full access to provider rate rules" ON provider_rate_rules;
CREATE POLICY "Platform admins full access to provider rate rules" ON provider_rate_rules
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage provider rate rules" ON provider_rate_rules;
CREATE POLICY "Tenant admins manage provider rate rules" ON provider_rate_rules
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users view tenant provider rate rules" ON provider_rate_rules;
CREATE POLICY "Users view tenant provider rate rules" ON provider_rate_rules
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Provider Surcharges
ALTER TABLE provider_surcharges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins full access to provider surcharges" ON provider_surcharges;
CREATE POLICY "Platform admins full access to provider surcharges" ON provider_surcharges
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage provider surcharges" ON provider_surcharges;
CREATE POLICY "Tenant admins manage provider surcharges" ON provider_surcharges
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Users view tenant provider surcharges" ON provider_surcharges;
CREATE POLICY "Users view tenant provider surcharges" ON provider_surcharges
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- ================================================
-- Triggers for updated_at
-- ================================================
DROP TRIGGER IF EXISTS update_provider_rate_templates_updated_at ON provider_rate_templates;
CREATE TRIGGER update_provider_rate_templates_updated_at
  BEFORE UPDATE ON provider_rate_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_charge_mappings_updated_at ON provider_charge_mappings;
CREATE TRIGGER update_provider_charge_mappings_updated_at
  BEFORE UPDATE ON provider_charge_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_api_configs_updated_at ON provider_api_configs;
CREATE TRIGGER update_provider_api_configs_updated_at
  BEFORE UPDATE ON provider_api_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_rate_rules_updated_at ON provider_rate_rules;
CREATE TRIGGER update_provider_rate_rules_updated_at
  BEFORE UPDATE ON provider_rate_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_surcharges_updated_at ON provider_surcharges;
CREATE TRIGGER update_provider_surcharges_updated_at
  BEFORE UPDATE ON provider_surcharges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- Helper Functions
-- ================================================

-- Function to get applicable provider surcharges for a shipment
DROP FUNCTION IF EXISTS get_applicable_provider_surcharges(p_carrier_id UUID, p_service_type TEXT, p_weight_kg NUMERIC, p_country_code TEXT, p_is_hazmat BOOLEAN, p_is_temperature_controlled BOOLEAN);
CREATE OR REPLACE FUNCTION get_applicable_provider_surcharges(
  p_carrier_id UUID,
  p_service_type TEXT,
  p_weight_kg NUMERIC,
  p_country_code TEXT DEFAULT NULL,
  p_is_hazmat BOOLEAN DEFAULT false,
  p_is_temperature_controlled BOOLEAN DEFAULT false
)
RETURNS TABLE (
  surcharge_id UUID,
  surcharge_code TEXT,
  surcharge_name TEXT,
  calculation_type TEXT,
  rate NUMERIC,
  currency_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.surcharge_code,
    ps.surcharge_name,
    ps.calculation_type,
    ps.rate,
    c.code as currency_code
  FROM provider_surcharges ps
  LEFT JOIN currencies c ON c.id = ps.currency_id
  WHERE 
    ps.carrier_id = p_carrier_id
    AND ps.is_active = true
    AND now() BETWEEN ps.effective_from AND COALESCE(ps.effective_until, 'infinity'::timestamp)
    AND (
      ps.applies_to_service_types IS NULL 
      OR p_service_type = ANY(ps.applies_to_service_types)
    )
    AND (
      ps.applies_to_weight_range IS NULL
      OR (
        p_weight_kg >= COALESCE((ps.applies_to_weight_range->>'min')::numeric, 0)
        AND p_weight_kg <= COALESCE((ps.applies_to_weight_range->>'max')::numeric, 999999)
      )
    )
    AND (
      ps.applies_to_countries IS NULL
      OR p_country_code = ANY(ps.applies_to_countries)
    )
    AND (
      NOT ps.requires_hazmat OR p_is_hazmat
    )
    AND (
      NOT ps.requires_temperature_control OR p_is_temperature_controlled
    )
  ORDER BY ps.surcharge_code;
END;
$$;

-- Function to evaluate provider rate rules
DROP FUNCTION IF EXISTS evaluate_provider_rate_rules(p_carrier_id UUID, p_service_type_id UUID, p_quote_data JSONB);
CREATE OR REPLACE FUNCTION evaluate_provider_rate_rules(
  p_carrier_id UUID,
  p_service_type_id UUID,
  p_quote_data JSONB
)
RETURNS TABLE (
  rule_id UUID,
  rule_name TEXT,
  rule_type TEXT,
  actions JSONB,
  validation_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    prr.id,
    prr.rule_name,
    prr.rule_type,
    prr.actions,
    prr.validation_message
  FROM provider_rate_rules prr
  WHERE 
    prr.carrier_id = p_carrier_id
    AND (prr.service_type_id IS NULL OR prr.service_type_id = p_service_type_id)
    AND prr.is_active = true
    -- Note: Actual condition evaluation would be done in application logic
  ORDER BY prr.priority ASC;
END;
$$;-- ================================================
-- Phase 6: Customer-Facing Enhancements
-- ================================================

DROP TABLE IF EXISTS quote_presentation_templates CASCADE;
DROP TABLE IF EXISTS quote_shares CASCADE;
DROP TABLE IF EXISTS quote_access_logs CASCADE;
DROP TABLE IF EXISTS quote_comments CASCADE;
DROP TABLE IF EXISTS quote_documents CASCADE;
DROP TABLE IF EXISTS quote_approval_workflows CASCADE;
DROP TABLE IF EXISTS quote_approvals CASCADE;
DROP TABLE IF EXISTS quote_email_history CASCADE;

CREATE TABLE IF NOT EXISTS quote_presentation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  font_family TEXT DEFAULT 'Arial',
  layout_config JSONB DEFAULT '{}',
  header_template TEXT,
  footer_template TEXT,
  terms_conditions_template TEXT,
  show_carrier_details BOOLEAN DEFAULT true,
  show_transit_times BOOLEAN DEFAULT true,
  show_buy_prices BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  access_type TEXT DEFAULT 'view_only',
  max_views INTEGER,
  current_views INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_share_id UUID REFERENCES quote_shares(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  visitor_email TEXT,
  action_type TEXT
);

CREATE TABLE IF NOT EXISTS quote_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  author_type TEXT NOT NULL,
  author_user_id UUID REFERENCES profiles(id),
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT,
  is_public BOOLEAN DEFAULT false,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_email_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  to_emails TEXT[] NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivery_status TEXT DEFAULT 'sent'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qpt_t ON quote_presentation_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qs_q ON quote_shares(quote_id);
CREATE INDEX IF NOT EXISTS idx_qc_q ON quote_comments(quote_id);
CREATE INDEX IF NOT EXISTS idx_qd_q ON quote_documents(quote_id);

-- RLS
ALTER TABLE quote_presentation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_email_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pt_admin" ON quote_presentation_templates;
CREATE POLICY "pt_admin" ON quote_presentation_templates FOR ALL TO authenticated USING (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "pt_tenant" ON quote_presentation_templates;
CREATE POLICY "pt_tenant" ON quote_presentation_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS "pt_view" ON quote_presentation_templates;
CREATE POLICY "pt_view" ON quote_presentation_templates FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "qs_admin" ON quote_shares;
CREATE POLICY "qs_admin" ON quote_shares FOR ALL TO authenticated USING (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "qs_user" ON quote_shares;
CREATE POLICY "qs_user" ON quote_shares FOR ALL TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));
DROP POLICY IF EXISTS "qs_public" ON quote_shares;
CREATE POLICY "qs_public" ON quote_shares FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "qal_insert" ON quote_access_logs;
CREATE POLICY "qal_insert" ON quote_access_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "qal_view" ON quote_access_logs;
CREATE POLICY "qal_view" ON quote_access_logs FOR SELECT TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));

DROP POLICY IF EXISTS "qc_admin" ON quote_comments;
CREATE POLICY "qc_admin" ON quote_comments FOR ALL TO authenticated USING (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "qc_user" ON quote_comments;
CREATE POLICY "qc_user" ON quote_comments FOR ALL TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));
DROP POLICY IF EXISTS "qc_public" ON quote_comments;
CREATE POLICY "qc_public" ON quote_comments FOR INSERT TO anon, authenticated WITH CHECK (author_type = 'customer');

DROP POLICY IF EXISTS "qd_admin" ON quote_documents;
CREATE POLICY "qd_admin" ON quote_documents FOR ALL TO authenticated USING (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "qd_user" ON quote_documents;
CREATE POLICY "qd_user" ON quote_documents FOR ALL TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));
DROP POLICY IF EXISTS "qd_public" ON quote_documents;
CREATE POLICY "qd_public" ON quote_documents FOR SELECT TO anon, authenticated USING (is_public = true);

DROP POLICY IF EXISTS "qeh_view" ON quote_email_history;
CREATE POLICY "qeh_view" ON quote_email_history FOR SELECT TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));
DROP POLICY IF EXISTS "qeh_insert" ON quote_email_history;
CREATE POLICY "qeh_insert" ON quote_email_history FOR INSERT TO authenticated WITH CHECK (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));

DROP TRIGGER IF EXISTS upd_qpt ON quote_presentation_templates;
CREATE TRIGGER upd_qpt BEFORE UPDATE ON quote_presentation_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS upd_qc ON quote_comments;
CREATE TRIGGER upd_qc BEFORE UPDATE ON quote_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP FUNCTION IF EXISTS generate_share_token();
CREATE OR REPLACE FUNCTION generate_share_token() RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$ BEGIN RETURN encode(gen_random_bytes(32), 'base64'); END; $$;

DROP FUNCTION IF EXISTS create_quote_share(p_tenant_id UUID, p_quote_id UUID, p_expires_in_days INTEGER);
CREATE OR REPLACE FUNCTION create_quote_share(p_tenant_id UUID, p_quote_id UUID, p_expires_in_days INTEGER DEFAULT 30) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO quote_shares (tenant_id, quote_id, share_token, expires_at)
  VALUES (p_tenant_id, p_quote_id, generate_share_token(), now() + (COALESCE(p_expires_in_days, 30) || ' days')::INTERVAL)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;-- Link International Courier service type to the Courier transport mode
UPDATE service_types 
SET mode_id = (SELECT id FROM transport_modes WHERE code = 'courier')
WHERE code = 'international_courier' AND mode_id IS NULL;-- Fix quotation_audit_log foreign key constraints to allow logging of deletions
-- The issue: when deleting a version/option, the audit trigger tries to log it,
-- but the foreign key constraint prevents this because the referenced record is being deleted

-- Make quotation_version_option_id nullable and change constraint to SET NULL on delete
ALTER TABLE quotation_audit_log 
  ALTER COLUMN quotation_version_option_id DROP NOT NULL;

-- Drop and recreate the foreign key constraint with ON DELETE SET NULL
ALTER TABLE quotation_audit_log 
  DROP CONSTRAINT IF EXISTS quotation_audit_log_quotation_version_option_id_fkey;

ALTER TABLE quotation_audit_log 
  ADD CONSTRAINT quotation_audit_log_quotation_version_option_id_fkey 
  FOREIGN KEY (quotation_version_option_id) 
  REFERENCES quotation_version_options(id) 
  ON DELETE SET NULL;

-- Also update quotation_version_id to SET NULL on delete to maintain audit trail
ALTER TABLE quotation_audit_log 
  DROP CONSTRAINT IF EXISTS quotation_audit_log_quotation_version_id_fkey;

ALTER TABLE quotation_audit_log 
  ADD CONSTRAINT quotation_audit_log_quotation_version_id_fkey 
  FOREIGN KEY (quotation_version_id) 
  REFERENCES quotation_versions(id) 
  ON DELETE SET NULL;

-- Update the triggers to fire BEFORE delete to capture data before cascade
DROP TRIGGER IF EXISTS log_version_changes_trigger ON quotation_versions;
DROP TRIGGER IF EXISTS log_option_changes_trigger ON quotation_version_options;

DROP TRIGGER IF EXISTS log_version_changes_trigger ON quotation_versions;
CREATE TRIGGER log_version_changes_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON quotation_versions
  FOR EACH ROW EXECUTE FUNCTION log_version_changes();

DROP TRIGGER IF EXISTS log_option_changes_trigger ON quotation_version_options;
CREATE TRIGGER log_option_changes_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON quotation_version_options
  FOR EACH ROW EXECUTE FUNCTION log_option_changes();-- Clean up duplicate audit log triggers and ensure they fire BEFORE delete

-- Remove any existing triggers for version/option logging
DROP TRIGGER IF EXISTS trigger_log_version_changes ON quotation_versions;
DROP TRIGGER IF EXISTS trigger_log_option_changes ON quotation_version_options;
DROP TRIGGER IF EXISTS log_version_changes_trigger ON quotation_versions;
DROP TRIGGER IF EXISTS log_option_changes_trigger ON quotation_version_options;

-- Recreate a single BEFORE trigger on each table so parent rows still exist
DROP TRIGGER IF EXISTS trigger_log_version_changes ON quotation_versions;
CREATE TRIGGER trigger_log_version_changes
  BEFORE INSERT OR UPDATE OR DELETE ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION log_version_changes();

DROP TRIGGER IF EXISTS trigger_log_option_changes ON quotation_version_options;
CREATE TRIGGER trigger_log_option_changes
  BEFORE INSERT OR UPDATE OR DELETE ON quotation_version_options
  FOR EACH ROW
  EXECUTE FUNCTION log_option_changes();-- Fix the log_version_changes trigger to use AFTER INSERT instead of BEFORE
-- This ensures the version exists before trying to log it

DROP TRIGGER IF EXISTS log_version_changes_trigger ON quotation_versions;
CREATE TRIGGER log_version_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON quotation_versions
FOR EACH ROW
EXECUTE FUNCTION log_version_changes();

-- Also fix the log_option_changes trigger
DROP TRIGGER IF EXISTS log_option_changes_trigger ON quotation_version_options;
CREATE TRIGGER log_option_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON quotation_version_options
FOR EACH ROW
EXECUTE FUNCTION log_option_changes();-- Fix the log_version_changes function to defer audit logging for inserts
-- The issue is that NEW.id isn't available in quotation_versions when the trigger fires

DROP FUNCTION IF EXISTS log_version_changes() CASCADE;

DROP FUNCTION IF EXISTS public.log_version_changes();
CREATE OR REPLACE FUNCTION public.log_version_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_action TEXT;
  v_changes JSONB;
BEGIN
  v_action := TG_OP;
  
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := row_to_json(OLD)::JSONB;
  END IF;
  
  -- Only log after the row is committed (AFTER trigger ensures this)
  -- Use a conditional insert that won't fail if quotation_version doesn't exist yet
  BEGIN
    INSERT INTO quotation_audit_log (
      tenant_id,
      quote_id,
      quotation_version_id,
      entity_type,
      entity_id,
      action,
      changes,
      user_id
    ) VALUES (
      COALESCE(NEW.tenant_id, OLD.tenant_id),
      COALESCE(NEW.quote_id, OLD.quote_id),
      COALESCE(NEW.id, OLD.id),
      'quotation_version',
      COALESCE(NEW.id, OLD.id),
      v_action,
      v_changes,
      auth.uid()
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      -- Silently ignore FK violations during insert (row not yet committed)
      NULL;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS log_version_changes_trigger ON quotation_versions;
CREATE TRIGGER log_version_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON quotation_versions
FOR EACH ROW
EXECUTE FUNCTION log_version_changes();-- Create opportunity probability history table
CREATE TABLE IF NOT EXISTS public.opportunity_probability_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  old_probability INTEGER,
  new_probability INTEGER,
  old_stage opportunity_stage,
  new_stage opportunity_stage,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.opportunity_probability_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view history of opportunities they can view" ON public.opportunity_probability_history;
CREATE POLICY "Users can view history of opportunities they can view" ON public.opportunity_probability_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_probability_history.opportunity_id
      -- Add your opportunity access logic here, usually relying on existing RLS or helper functions
      -- For simplicity, assuming if you can see the opportunity, you can see its history
    )
  );

-- Function to log changes
DROP FUNCTION IF EXISTS public.log_opportunity_probability_changes();
CREATE OR REPLACE FUNCTION public.log_opportunity_probability_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.probability IS DISTINCT FROM NEW.probability) OR (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.opportunity_probability_history (
      opportunity_id,
      old_probability,
      new_probability,
      old_stage,
      new_stage,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.probability,
      NEW.probability,
      OLD.stage,
      NEW.stage,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS log_opportunity_probability_changes_trigger ON public.opportunities;
CREATE TRIGGER log_opportunity_probability_changes_trigger
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_opportunity_probability_changes();
-- Advanced Lead Scoring Schema

-- 1. Lead Activities Table
CREATE TABLE IF NOT EXISTS public.lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'email_opened', 'link_clicked', 'page_view', 'form_submission'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id UUID REFERENCES public.tenants(id) -- Optional, for multi-tenancy if leads are tenant-scoped
);

-- Index for faster querying of activities by lead
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON public.lead_activities(created_at);

-- 2. Lead Score Configuration Table
CREATE TABLE IF NOT EXISTS public.lead_score_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    weights_json JSONB NOT NULL DEFAULT '{
        "demographic": {
            "title_cxo": 20,
            "title_vp": 15,
            "title_manager": 10
        },
        "behavioral": {
            "email_opened": 5,
            "link_clicked": 10,
            "page_view": 2,
            "form_submission": 20
        },
        "logistics": {
            "high_value_cargo": 20,
            "urgent_shipment": 15
        },
        "decay": {
            "weekly_percentage": 10
        }
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- 3. RLS Policies

-- Enable RLS
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_score_config ENABLE ROW LEVEL SECURITY;

-- Policies for lead_activities
-- Assuming users can view activities for leads they have access to
DROP POLICY IF EXISTS "Users can view activities for their leads" ON public.lead_activities;
CREATE POLICY "Users can view activities for their leads" ON public.lead_activities
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = lead_activities.lead_id
            -- Add additional checks here if leads are scoped by user/tenant
        )
    );

DROP POLICY IF EXISTS "Users can insert activities" ON public.lead_activities;
CREATE POLICY "Users can insert activities" ON public.lead_activities
    FOR INSERT
    WITH CHECK (true); -- Or restrict to authenticated users

-- Policies for lead_score_config
DROP POLICY IF EXISTS "Users can view their tenant score config" ON public.lead_score_config;
CREATE POLICY "Users can view their tenant score config" ON public.lead_score_config
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
    );

DROP POLICY IF EXISTS "Admins can update their tenant score config" ON public.lead_score_config;
CREATE POLICY "Admins can update their tenant score config" ON public.lead_score_config
    FOR UPDATE
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND public.has_role(auth.uid(), 'tenant_admin')
    );

-- 4. Lead Score Logs (Optional, for audit/history)
CREATE TABLE IF NOT EXISTS public.lead_score_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    old_score INTEGER,
    new_score INTEGER,
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_score_logs_lead_id ON public.lead_score_logs(lead_id);

ALTER TABLE public.lead_score_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view score logs for their leads" ON public.lead_score_logs;
CREATE POLICY "Users can view score logs for their leads" ON public.lead_score_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = lead_score_logs.lead_id
        )
    );
-- Safe Migration for Queues
-- 1. Create Queues Table (Safe if exists)
CREATE TABLE IF NOT EXISTS public.queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    type TEXT CHECK (type IN ('holding', 'round_robin')) DEFAULT 'holding',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Tenant admins can manage queues" ON public.queues;
DROP POLICY IF EXISTS "Admins can manage queues" ON public.queues;
DROP POLICY IF EXISTS "Users can view queues in their tenant" ON public.queues;

-- 3. Re-create Policies
DROP POLICY IF EXISTS "Tenant admins can manage queues" ON public.queues;
CREATE POLICY "Tenant admins can manage queues" ON public.queues
FOR ALL
USING (
  has_role(auth.uid(), 'tenant_admin') 
  AND tenant_id = get_user_tenant_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'tenant_admin') 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage queues" ON public.queues;
CREATE POLICY "Admins can manage queues" ON public.queues
FOR ALL
USING (has_role(auth.uid(), 'platform_admin'))
WITH CHECK (has_role(auth.uid(), 'platform_admin'));

DROP POLICY IF EXISTS "Users can view queues in their tenant" ON public.queues;
CREATE POLICY "Users can view queues in their tenant" ON public.queues
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
);

-- 4. Queue Members Table
CREATE TABLE IF NOT EXISTS public.queue_members (
    queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (queue_id, user_id)
);

ALTER TABLE public.queue_members ENABLE ROW LEVEL SECURITY;

-- Drop policies for queue_members
DROP POLICY IF EXISTS "Tenant admins can manage queue members" ON public.queue_members;
DROP POLICY IF EXISTS "Admins can manage queue members" ON public.queue_members;
DROP POLICY IF EXISTS "Users can view queue members in their tenant" ON public.queue_members;

-- Re-create policies
DROP POLICY IF EXISTS "Tenant admins can manage queue members" ON public.queue_members;
CREATE POLICY "Tenant admins can manage queue members" ON public.queue_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_members.queue_id
    AND q.tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'tenant_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_members.queue_id
    AND q.tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'tenant_admin')
  )
);

DROP POLICY IF EXISTS "Admins can manage queue members" ON public.queue_members;
CREATE POLICY "Admins can manage queue members" ON public.queue_members
FOR ALL
USING (has_role(auth.uid(), 'platform_admin'))
WITH CHECK (has_role(auth.uid(), 'platform_admin'));

DROP POLICY IF EXISTS "Users can view queue members in their tenant" ON public.queue_members;
CREATE POLICY "Users can view queue members in their tenant" ON public.queue_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_members.queue_id
    AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- 5. Add columns to related tables (Safe if exists)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS owner_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL;

ALTER TABLE public.lead_assignment_rules 
ADD COLUMN IF NOT EXISTS assigned_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assignment_type TEXT CHECK (assignment_type IN ('user', 'queue', 'round_robin_group')) DEFAULT 'user';

-- 6. Refresh Schema Cache
NOTIFY pgrst, 'reload config';
-- Add opportunity_id to activities table
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_opportunity_id ON public.activities(opportunity_id);

-- Function to update lead.last_activity_date
DROP FUNCTION IF EXISTS public.update_lead_last_activity();
CREATE OR REPLACE FUNCTION public.update_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lead_id IS NOT NULL THEN
        UPDATE public.leads
        SET last_activity_date = NOW()
        WHERE id = NEW.lead_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for lead.last_activity_date
DROP TRIGGER IF EXISTS trigger_update_lead_last_activity ON public.activities;
CREATE TRIGGER trigger_update_lead_last_activity
AFTER INSERT OR UPDATE ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_last_activity();

-- Function to cleanup old audit logs
DROP FUNCTION IF EXISTS cleanup_old_logs(days_to_keep int);
CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep int DEFAULT 90)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete logs older than the specified retention period
  DELETE FROM audit_logs
  WHERE created_at < now() - (days_to_keep || ' days')::interval;
  
  -- Log the cleanup action (optional, into a separate system log if needed, or just console output if run manually)
  RAISE NOTICE 'Deleted audit logs older than % days', days_to_keep;
END;
$$;
-- Opportunity probability and stage change history
CREATE TABLE IF NOT EXISTS public.opportunity_probability_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  old_probability INTEGER,
  new_probability INTEGER,
  old_stage public.opportunity_stage,
  new_stage public.opportunity_stage,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.opportunity_probability_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_opportunity_probability_history_opportunity_id
  ON public.opportunity_probability_history(opportunity_id);

DROP POLICY IF EXISTS "Users can view history within tenant" ON public.opportunity_probability_history;
CREATE POLICY "Users can view history within tenant" ON public.opportunity_probability_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.opportunities o
      WHERE o.id = opportunity_probability_history.opportunity_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

DROP FUNCTION IF EXISTS public.log_opportunity_probability_changes();
CREATE OR REPLACE FUNCTION public.log_opportunity_probability_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.probability IS DISTINCT FROM NEW.probability)
     OR (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.opportunity_probability_history (
      opportunity_id,
      old_probability,
      new_probability,
      old_stage,
      new_stage,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.probability,
      NEW.probability,
      OLD.stage,
      NEW.stage,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_opportunity_probability_changes_trigger ON public.opportunities;
CREATE TRIGGER log_opportunity_probability_changes_trigger
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_opportunity_probability_changes();

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

DROP POLICY IF EXISTS "Platform admins can manage all presets" ON public.history_filter_presets;
CREATE POLICY "Platform admins can manage all presets" ON public.history_filter_presets FOR ALL
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can manage own presets" ON public.history_filter_presets;
CREATE POLICY "Users can manage own presets" ON public.history_filter_presets FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_history_filter_presets_updated_at ON public.history_filter_presets;
CREATE TRIGGER update_history_filter_presets_updated_at
  BEFORE UPDATE ON public.history_filter_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure territories table exists (referenced by foreign key)
CREATE TABLE IF NOT EXISTS public.territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on territories if not already enabled
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for territories (Idempotent)
DROP POLICY IF EXISTS "Platform admins can manage all territories" ON public.territories;
DROP POLICY IF EXISTS "Platform admins can manage all territories" ON public.territories;
CREATE POLICY "Platform admins can manage all territories" ON public.territories FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant territories" ON public.territories;
DROP POLICY IF EXISTS "Tenant admins can manage tenant territories" ON public.territories;
CREATE POLICY "Tenant admins can manage tenant territories" ON public.territories FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

-- Create table for linking territories to geographical entities
CREATE TABLE IF NOT EXISTS public.territory_geographies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  continent_id UUID REFERENCES public.continents(id) ON DELETE CASCADE,
  country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE,
  state_id UUID REFERENCES public.states(id) ON DELETE CASCADE,
  city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure exactly one reference is set per row
  CONSTRAINT territory_geography_type_check CHECK (
    (continent_id IS NOT NULL)::int +
    (country_id IS NOT NULL)::int +
    (state_id IS NOT NULL)::int +
    (city_id IS NOT NULL)::int = 1
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_territory_geographies_territory ON public.territory_geographies(territory_id);
CREATE INDEX IF NOT EXISTS idx_territory_geographies_continent ON public.territory_geographies(continent_id);
CREATE INDEX IF NOT EXISTS idx_territory_geographies_country ON public.territory_geographies(country_id);
CREATE INDEX IF NOT EXISTS idx_territory_geographies_state ON public.territory_geographies(state_id);

-- Enable RLS
ALTER TABLE public.territory_geographies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Platform admins can manage all
DROP POLICY IF EXISTS "Platform admins can manage all territory geographies" ON public.territory_geographies;
DROP POLICY IF EXISTS "Platform admins can manage all territory geographies" ON public.territory_geographies;
CREATE POLICY "Platform admins can manage all territory geographies" ON public.territory_geographies FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Tenant admins can manage their territory geographies via the territory
DROP POLICY IF EXISTS "Tenant admins can manage their territory geographies" ON public.territory_geographies;
DROP POLICY IF EXISTS "Tenant admins can manage their territory geographies" ON public.territory_geographies;
CREATE POLICY "Tenant admins can manage their territory geographies" ON public.territory_geographies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.territories t
      WHERE t.id = territory_geographies.territory_id
      AND t.tenant_id = get_user_tenant_id(auth.uid())
    )
  );

-- View access
DROP POLICY IF EXISTS "Users can view territory geographies" ON public.territory_geographies;
DROP POLICY IF EXISTS "Users can view territory geographies" ON public.territory_geographies;
CREATE POLICY "Users can view territory geographies" ON public.territory_geographies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.territories t
      WHERE t.id = territory_geographies.territory_id
      AND (
        t.tenant_id = get_user_tenant_id(auth.uid()) OR
        is_platform_admin(auth.uid())
      )
    )
  );

-- Grants to ensure PostgREST exposes tables for anon/authenticated roles
DO $$
BEGIN
  -- Schema usage for anon/authenticated (idempotent)
  BEGIN
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT USAGE ON SCHEMA public TO anon;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Table grants for territory_geographies
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.territory_geographies TO authenticated;
    GRANT SELECT ON TABLE public.territory_geographies TO anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table public.territory_geographies not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for territory_geographies: %', SQLERRM;
  END;

  -- Table grants for territories (for completeness)
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.territories TO authenticated;
    GRANT SELECT ON TABLE public.territories TO anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table public.territories not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for territories: %', SQLERRM;
  END;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
-- Territory geography mappings (used by territory assignment module)
create table if not exists public.territory_geographies (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references public.territories(id) on delete cascade,
  continent_id uuid null references public.continents(id),
  country_id uuid null references public.countries(id),
  state_id uuid null references public.states(id),
  city_id uuid null references public.cities(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_territory_geographies_territory_id
  on public.territory_geographies(territory_id);

create index if not exists idx_territory_geographies_continent_id
  on public.territory_geographies(continent_id);

create index if not exists idx_territory_geographies_country_id
  on public.territory_geographies(country_id);

create index if not exists idx_territory_geographies_state_id
  on public.territory_geographies(state_id);

create index if not exists idx_territory_geographies_city_id
  on public.territory_geographies(city_id);

alter table public.territory_geographies enable row level security;

-- Access: users can manage geographies for territories in their tenant; platform admins can manage all.
DROP POLICY IF EXISTS "Territory geographies readable" ON public.territory_geographies;
CREATE POLICY "Territory geographies readable" ON public.territory_geographies
for select
using (
  exists (
    select 1
    from public.user_roles ur
    join public.territories t on t.id = territory_geographies.territory_id
    where ur.user_id = auth.uid()
      and (ur.role = 'platform_admin'::app_role or ur.tenant_id = t.tenant_id)
  )
);

DROP POLICY IF EXISTS "Territory geographies insertable" ON public.territory_geographies;
CREATE POLICY "Territory geographies insertable" ON public.territory_geographies
for insert
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.territories t on t.id = territory_geographies.territory_id
    where ur.user_id = auth.uid()
      and (ur.role = 'platform_admin'::app_role or ur.tenant_id = t.tenant_id)
  )
);

DROP POLICY IF EXISTS "Territory geographies updatable" ON public.territory_geographies;
CREATE POLICY "Territory geographies updatable" ON public.territory_geographies
for update
using (
  exists (
    select 1
    from public.user_roles ur
    join public.territories t on t.id = territory_geographies.territory_id
    where ur.user_id = auth.uid()
      and (ur.role = 'platform_admin'::app_role or ur.tenant_id = t.tenant_id)
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.territories t on t.id = territory_geographies.territory_id
    where ur.user_id = auth.uid()
      and (ur.role = 'platform_admin'::app_role or ur.tenant_id = t.tenant_id)
  )
);

DROP POLICY IF EXISTS "Territory geographies deletable" ON public.territory_geographies;
CREATE POLICY "Territory geographies deletable" ON public.territory_geographies
for delete
using (
  exists (
    select 1
    from public.user_roles ur
    join public.territories t on t.id = territory_geographies.territory_id
    where ur.user_id = auth.uid()
      and (ur.role = 'platform_admin'::app_role or ur.tenant_id = t.tenant_id)
  )
);

-- Ensure the API schema cache picks up the new table immediately
select pg_notify('pgrst', 'reload schema');
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS name TEXT;
    UPDATE public.leads 
      SET name = CONCAT_WS(' ', first_name, last_name)
      WHERE name IS NULL;
  END IF;
END $$;
-- Create queues table (used by Queue Management + Lead Routing)
create table if not exists public.queues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text null,
  email text null,
  type text not null default 'holding',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create queue_members table (many-to-many between queues and users)
create table if not exists public.queue_members (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.queues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (queue_id, user_id)
);

create index if not exists idx_queues_tenant_id on public.queues(tenant_id);
create index if not exists idx_queue_members_queue_id on public.queue_members(queue_id);
create index if not exists idx_queue_members_user_id on public.queue_members(user_id);

alter table public.queues enable row level security;
alter table public.queue_members enable row level security;

-- Queues policies
DROP POLICY IF EXISTS "Platform admins can manage all queues" ON public.queues;
CREATE POLICY "Platform admins can manage all queues" ON public.queues
for all
using (is_platform_admin(auth.uid()))
with check (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant queues" ON public.queues;
CREATE POLICY "Tenant admins can manage tenant queues" ON public.queues
for all
using (
  has_role(auth.uid(), 'tenant_admin'::public.app_role)
  and tenant_id = get_user_tenant_id(auth.uid())
)
with check (
  has_role(auth.uid(), 'tenant_admin'::public.app_role)
  and tenant_id = get_user_tenant_id(auth.uid())
);

-- Queue members policies
DROP POLICY IF EXISTS "Platform admins can manage all queue members" ON public.queue_members;
CREATE POLICY "Platform admins can manage all queue members" ON public.queue_members
for all
using (is_platform_admin(auth.uid()))
with check (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage members of their tenant queues" ON public.queue_members;
CREATE POLICY "Tenant admins can manage members of their tenant queues" ON public.queue_members
for all
using (
  has_role(auth.uid(), 'tenant_admin'::public.app_role)
  and exists (
    select 1
    from public.queues q
    where q.id = queue_members.queue_id
      and q.tenant_id = get_user_tenant_id(auth.uid())
  )
)
with check (
  has_role(auth.uid(), 'tenant_admin'::public.app_role)
  and exists (
    select 1
    from public.queues q
    where q.id = queue_members.queue_id
      and q.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Best-effort schema cache refresh signal
select pg_notify('pgrst', 'reload schema');-- Create quote_templates table
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
DROP POLICY IF EXISTS "Users can view templates from their tenant" ON public.quote_templates;
CREATE POLICY "Users can view templates from their tenant" ON public.quote_templates
    FOR SELECT
    USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can create templates for their tenant" ON public.quote_templates;
CREATE POLICY "Users can create templates for their tenant" ON public.quote_templates
    FOR INSERT
    WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update templates from their tenant" ON public.quote_templates;
CREATE POLICY "Users can update templates from their tenant" ON public.quote_templates
    FOR UPDATE
    USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete templates from their tenant" ON public.quote_templates;
CREATE POLICY "Users can delete templates from their tenant" ON public.quote_templates
    FOR DELETE
    USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_quote_templates_updated_at ON public.quote_templates;
CREATE TRIGGER update_quote_templates_updated_at
    BEFORE UPDATE ON public.quote_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
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

DROP POLICY IF EXISTS "Internal users manage tokens" ON public.portal_tokens;
CREATE POLICY "Internal users manage tokens" ON public.portal_tokens
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to verify token and get quote details
DROP FUNCTION IF EXISTS public.get_quote_by_token(p_token TEXT);
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

DROP FUNCTION IF EXISTS public.accept_quote_by_token(p_token TEXT, p_decision TEXT, p_name TEXT, p_email TEXT, p_ip TEXT, p_user_agent TEXT);
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

-- ==========================================
-- PHASE: MISSING TABLES FOR ROLES, TEMPLATES, AND PORTAL
-- ==========================================

-- Quote Templates Table
CREATE TABLE IF NOT EXISTS quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  content JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Portal Tokens Table for sharing quotes
CREATE TABLE IF NOT EXISTS portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auth Roles Table (for dynamic role management)
CREATE TABLE IF NOT EXISTS auth_roles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  can_manage_scopes TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auth Permissions Table
CREATE TABLE IF NOT EXISTS auth_permissions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auth Role Permissions Junction Table
CREATE TABLE IF NOT EXISTS auth_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id TEXT NOT NULL REFERENCES auth_roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES auth_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Lead Activities Table (for lead scoring)
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lead Score Config Table
CREATE TABLE IF NOT EXISTS lead_score_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  weights_json JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Lead Score Logs Table
CREATE TABLE IF NOT EXISTS lead_score_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  old_score INTEGER,
  new_score INTEGER,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shipment Attachments Table
CREATE TABLE IF NOT EXISTS shipment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quote_templates_tenant ON quote_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_quote ON portal_tokens(quote_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_role_permissions_role ON auth_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_score_logs_lead ON lead_score_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_shipment_attachments_shipment ON shipment_attachments(shipment_id);

-- Enable RLS
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quote_templates
DROP POLICY IF EXISTS "Users can view their tenant templates" ON quote_templates;
DROP POLICY IF EXISTS "Users can view their tenant templates" ON quote_templates;
CREATE POLICY "Users can view their tenant templates" ON quote_templates
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

DROP POLICY IF EXISTS "Users can manage their tenant templates" ON quote_templates;
DROP POLICY IF EXISTS "Users can manage their tenant templates" ON quote_templates;
CREATE POLICY "Users can manage their tenant templates" ON quote_templates
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- RLS Policies for portal_tokens
DROP POLICY IF EXISTS "Users can view their quote tokens" ON portal_tokens;
DROP POLICY IF EXISTS "Users can view their quote tokens" ON portal_tokens;
CREATE POLICY "Users can view their quote tokens" ON portal_tokens
  FOR SELECT USING (
    quote_id IN (SELECT id FROM quotes WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

DROP POLICY IF EXISTS "Users can manage their quote tokens" ON portal_tokens;
DROP POLICY IF EXISTS "Users can manage their quote tokens" ON portal_tokens;
CREATE POLICY "Users can manage their quote tokens" ON portal_tokens
  FOR ALL USING (
    quote_id IN (SELECT id FROM quotes WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- RLS Policies for auth tables (admin only)
DROP POLICY IF EXISTS "Platform admins can manage auth_roles" ON auth_roles;
DROP POLICY IF EXISTS "Platform admins can manage auth_roles" ON auth_roles;
CREATE POLICY "Platform admins can manage auth_roles" ON auth_roles
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

DROP POLICY IF EXISTS "All authenticated can read auth_roles" ON auth_roles;
DROP POLICY IF EXISTS "All authenticated can read auth_roles" ON auth_roles;
CREATE POLICY "All authenticated can read auth_roles" ON auth_roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Platform admins can manage auth_permissions" ON auth_permissions;
DROP POLICY IF EXISTS "Platform admins can manage auth_permissions" ON auth_permissions;
CREATE POLICY "Platform admins can manage auth_permissions" ON auth_permissions
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

DROP POLICY IF EXISTS "All authenticated can read auth_permissions" ON auth_permissions;
DROP POLICY IF EXISTS "All authenticated can read auth_permissions" ON auth_permissions;
CREATE POLICY "All authenticated can read auth_permissions" ON auth_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Platform admins can manage auth_role_permissions" ON auth_role_permissions;
DROP POLICY IF EXISTS "Platform admins can manage auth_role_permissions" ON auth_role_permissions;
CREATE POLICY "Platform admins can manage auth_role_permissions" ON auth_role_permissions
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

DROP POLICY IF EXISTS "All authenticated can read auth_role_permissions" ON auth_role_permissions;
DROP POLICY IF EXISTS "All authenticated can read auth_role_permissions" ON auth_role_permissions;
CREATE POLICY "All authenticated can read auth_role_permissions" ON auth_role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for lead_activities
DROP POLICY IF EXISTS "Users can view their tenant lead activities" ON lead_activities;
DROP POLICY IF EXISTS "Users can view their tenant lead activities" ON lead_activities;
CREATE POLICY "Users can view their tenant lead activities" ON lead_activities
  FOR SELECT USING (
    lead_id IN (SELECT id FROM leads WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

DROP POLICY IF EXISTS "Users can manage their tenant lead activities" ON lead_activities;
DROP POLICY IF EXISTS "Users can manage their tenant lead activities" ON lead_activities;
CREATE POLICY "Users can manage their tenant lead activities" ON lead_activities
  FOR ALL USING (
    lead_id IN (SELECT id FROM leads WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- RLS Policies for lead_score_config
DROP POLICY IF EXISTS "Users can view their tenant score config" ON lead_score_config;
DROP POLICY IF EXISTS "Users can view their tenant score config" ON lead_score_config;
CREATE POLICY "Users can view their tenant score config" ON lead_score_config
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

DROP POLICY IF EXISTS "Admins can manage score config" ON lead_score_config;
DROP POLICY IF EXISTS "Admins can manage score config" ON lead_score_config;
CREATE POLICY "Admins can manage score config" ON lead_score_config
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin'))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- RLS Policies for lead_score_logs
DROP POLICY IF EXISTS "Users can view their tenant score logs" ON lead_score_logs;
DROP POLICY IF EXISTS "Users can view their tenant score logs" ON lead_score_logs;
CREATE POLICY "Users can view their tenant score logs" ON lead_score_logs
  FOR SELECT USING (
    lead_id IN (SELECT id FROM leads WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- RLS Policies for shipment_attachments
DROP POLICY IF EXISTS "Users can view their shipment attachments" ON shipment_attachments;
DROP POLICY IF EXISTS "Users can view their shipment attachments" ON shipment_attachments;
CREATE POLICY "Users can view their shipment attachments" ON shipment_attachments
  FOR SELECT USING (
    shipment_id IN (SELECT id FROM shipments WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

DROP POLICY IF EXISTS "Users can manage their shipment attachments" ON shipment_attachments;
DROP POLICY IF EXISTS "Users can manage their shipment attachments" ON shipment_attachments;
CREATE POLICY "Users can manage their shipment attachments" ON shipment_attachments
  FOR ALL USING (
    shipment_id IN (SELECT id FROM shipments WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- Update triggers
DROP TRIGGER IF EXISTS update_quote_templates_updated_at ON quote_templates;
CREATE TRIGGER update_quote_templates_updated_at BEFORE UPDATE ON quote_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auth_roles_updated_at ON auth_roles;
CREATE TRIGGER update_auth_roles_updated_at BEFORE UPDATE ON auth_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lead_score_config_updated_at ON lead_score_config;
CREATE TRIGGER update_lead_score_config_updated_at BEFORE UPDATE ON lead_score_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
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
DROP POLICY IF EXISTS "Users can view import history for their tenant" ON public.import_history;
CREATE POLICY "Users can view import history for their tenant" ON public.import_history FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert import history for their tenant" ON public.import_history;
CREATE POLICY "Users can insert import history for their tenant" ON public.import_history FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update import history for their tenant" ON public.import_history;
CREATE POLICY "Users can update import history for their tenant" ON public.import_history FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for import_history_details
DROP POLICY IF EXISTS "Users can view import details for their tenant" ON public.import_history_details;
CREATE POLICY "Users can view import details for their tenant" ON public.import_history_details FOR SELECT
  USING (import_id IN (SELECT id FROM public.import_history WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can insert import details for their tenant" ON public.import_history_details;
CREATE POLICY "Users can insert import details for their tenant" ON public.import_history_details FOR INSERT
  WITH CHECK (import_id IN (SELECT id FROM public.import_history WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can update import details for their tenant" ON public.import_history_details;
CREATE POLICY "Users can update import details for their tenant" ON public.import_history_details FOR UPDATE
  USING (import_id IN (SELECT id FROM public.import_history WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));-- Fix RLS for import history so tenant-scoped users are restricted, while platform admins can operate without a tenant assignment.

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history_details ENABLE ROW LEVEL SECURITY;

-- Drop previous policies (names may vary across earlier iterations)
DROP POLICY IF EXISTS "Users can view import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can insert import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can update import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can delete import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can view import history for their tenant" ON public.import_history;
DROP POLICY IF EXISTS "Users can insert import history for their tenant" ON public.import_history;
DROP POLICY IF EXISTS "Users can update import history for their tenant" ON public.import_history;

DROP POLICY IF EXISTS "Users can view import details" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can insert import details" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can update import details" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can view import details for their tenant" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can insert import details for their tenant" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can update import details for their tenant" ON public.import_history_details;

-- Helper predicate embedded in each policy:
-- 1) platform_admin can access everything
-- 2) otherwise limited to user's tenant_id(s) from user_roles

-- import_history policies
DROP POLICY IF EXISTS "Import history: select" ON public.import_history;
CREATE POLICY "Import history: select" ON public.import_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR tenant_id IN (
    SELECT ur.tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Import history: insert" ON public.import_history;
CREATE POLICY "Import history: insert" ON public.import_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR tenant_id IN (
    SELECT ur.tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Import history: update" ON public.import_history;
CREATE POLICY "Import history: update" ON public.import_history
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR tenant_id IN (
    SELECT ur.tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR tenant_id IN (
    SELECT ur.tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
  )
);

-- import_history_details policies (linked via import_id -> import_history.tenant_id)
DROP POLICY IF EXISTS "Import details: select" ON public.import_history_details;
CREATE POLICY "Import details: select" ON public.import_history_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR import_id IN (
    SELECT ih.id
    FROM public.import_history ih
    WHERE ih.tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Import details: insert" ON public.import_history_details;
CREATE POLICY "Import details: insert" ON public.import_history_details
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR import_id IN (
    SELECT ih.id
    FROM public.import_history ih
    WHERE ih.tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
);

DROP POLICY IF EXISTS "Import details: update" ON public.import_history_details;
CREATE POLICY "Import details: update" ON public.import_history_details
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR import_id IN (
    SELECT ih.id
    FROM public.import_history ih
    WHERE ih.tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR import_id IN (
    SELECT ih.id
    FROM public.import_history ih
    WHERE ih.tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
);

-- Ensure authenticated role has table privileges (RLS still enforces row access)

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    franchise_id UUID REFERENCES public.franchises(id),
    admin_override_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Policies (Drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RPC: set_user_scope_preference
DROP FUNCTION IF EXISTS public.set_user_scope_preference(p_tenant_id UUID, p_franchise_id UUID, p_admin_override BOOLEAN);
CREATE OR REPLACE FUNCTION public.set_user_scope_preference(
    p_tenant_id UUID,
    p_franchise_id UUID,
    p_admin_override BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled)
    VALUES (auth.uid(), p_tenant_id, p_franchise_id, p_admin_override)
    ON CONFLICT (user_id)
    DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        franchise_id = EXCLUDED.franchise_id,
        admin_override_enabled = EXCLUDED.admin_override_enabled,
        updated_at = NOW();
END;
$$;

-- RPC: set_admin_override (Updated)
DROP FUNCTION IF EXISTS public.set_admin_override(p_enabled BOOLEAN, p_tenant_id UUID, p_franchise_id UUID);
CREATE OR REPLACE FUNCTION public.set_admin_override(
    p_enabled BOOLEAN,
    p_tenant_id UUID DEFAULT NULL,
    p_franchise_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_preferences (user_id, admin_override_enabled, tenant_id, franchise_id)
    VALUES (auth.uid(), p_enabled, p_tenant_id, p_franchise_id)
    ON CONFLICT (user_id)
    DO UPDATE SET
        admin_override_enabled = EXCLUDED.admin_override_enabled,
        tenant_id = COALESCE(p_tenant_id, user_preferences.tenant_id),
        franchise_id = COALESCE(p_franchise_id, user_preferences.franchise_id),
        updated_at = NOW();
END;
$$;
-- Safe, idempotent setup for audit logs, document versioning, and import history

-- 1) Audit logs table, indexes, RLS, and policies
DO $$
BEGIN
  -- Create audit_logs table if missing
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
  ) THEN
    CREATE TABLE IF NOT EXISTS public.audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      details JSONB DEFAULT '{}'::jsonb,
      ip_address INET,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;

  -- Ensure core columns exist (schema drift tolerance)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'details'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
    ON public.audit_logs(user_id);

  CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type
    ON public.audit_logs(resource_type);

  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON public.audit_logs(created_at);

  -- Enable RLS
  ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

  -- Reset policies to a known-good state
  DROP POLICY IF EXISTS "Platform admins view all logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "Users view own logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "Users can insert logs" ON public.audit_logs;

  -- Platform Admins can view all logs
  DROP POLICY IF EXISTS "Platform admins view all logs" ON public.audit_logs;
CREATE POLICY "Platform admins view all logs" ON public.audit_logs
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'platform_admin'
      )
    );

  -- Users can view their own logs
  DROP POLICY IF EXISTS "Users view own logs" ON public.audit_logs;
CREATE POLICY "Users view own logs" ON public.audit_logs
    FOR SELECT
    USING (auth.uid() = user_id);

  -- Users can insert logs for themselves
  DROP POLICY IF EXISTS "Users can insert logs" ON public.audit_logs;
CREATE POLICY "Users can insert logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
END $$;

-- 2) Documents and document_versions for long-form docs
DO $$
BEGIN
  -- documents
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'documents'
  ) THEN
    CREATE TABLE IF NOT EXISTS public.documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      path TEXT NOT NULL UNIQUE,
      current_version TEXT NOT NULL DEFAULT '1.0.0',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;

  -- Tolerate existing schemas where documents table lacks expected columns
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'path'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS path TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'current_version'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS current_version TEXT DEFAULT '1.0.0';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Ensure a unique index supporting ON CONFLICT (path)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_path_unique
    ON public.documents(path);

  -- document_versions
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'document_versions'
  ) THEN
    CREATE TABLE IF NOT EXISTS public.document_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      content TEXT NOT NULL,
      diff_summary JSONB,
      change_type TEXT CHECK (change_type IN ('major', 'minor', 'patch')),
      change_notes TEXT,
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(document_id, version)
    );
  END IF;

  -- Enable RLS
  ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

  -- Reset policies
  DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.documents;
  DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.document_versions;
  DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON public.documents;
  DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON public.document_versions;

  -- Read policies
  DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.documents;
CREATE POLICY "Allow read access to authenticated users" ON public.documents
    FOR SELECT TO authenticated USING (true);

  DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.document_versions;
CREATE POLICY "Allow read access to authenticated users" ON public.document_versions
    FOR SELECT TO authenticated USING (true);

  -- Write policies
  DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON public.documents;
CREATE POLICY "Allow insert/update access to authenticated users" ON public.documents
    FOR ALL TO authenticated USING (true);

  DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON public.document_versions;
CREATE POLICY "Allow insert/update access to authenticated users" ON public.document_versions
    FOR ALL TO authenticated USING (true);
END $$;

-- 3) Seed an initial document + version with compact, safely-quoted content
DO $$
DECLARE
  v_doc_id UUID;
  v_has_non_nullable_tenant_id BOOLEAN;
BEGIN
  -- If documents table enforces a non-null tenant_id, skip seeding to avoid constraint violations.
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'tenant_id'
      AND is_nullable = 'NO'
  ) INTO v_has_non_nullable_tenant_id;

  IF v_has_non_nullable_tenant_id THEN
    RAISE NOTICE 'Skipping seed for documents: tenant_id is non-nullable and not handled in this migration.';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.documents (path, current_version)
    VALUES ('docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md', '1.0.0')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_doc_id;
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'Skipping documents seed insert due to error: %', SQLERRM;
      RETURN;
  END;

  IF v_doc_id IS NULL THEN
    -- Either row already existed or insert failed; no need to seed a version here.
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.document_versions (document_id, version, content, change_type, change_notes)
    VALUES (
      v_doc_id,
      '1.0.0',
      'SOS Logistics Pro competitive analysis and strategic roadmap. Initial seeded version; full markdown can be updated via the application UI.',
      'major',
      'Initial version'
    )
    ON CONFLICT (document_id, version) DO NOTHING;
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'Skipping document_versions seed insert due to error: %', SQLERRM;
  END;
END $$;

-- 4) Ensure dashboards.view permission exists and is granted
INSERT INTO auth_permissions (id, category, description)
VALUES ('dashboards.view', 'Dashboard', 'View dashboards')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('platform_admin', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('tenant_admin', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('franchise_admin', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('user', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5) Import history and details tables + RLS/policies
DO $$
BEGIN
  -- import_history table
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'import_history'
  ) THEN
    CREATE TABLE IF NOT EXISTS public.import_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      file_name TEXT,
      imported_at TIMESTAMPTZ DEFAULT NOW(),
      imported_by UUID REFERENCES auth.users(id),
      status TEXT CHECK (status IN ('success', 'partial', 'failed', 'reverted')),
      summary JSONB,
      reverted_at TIMESTAMPTZ,
      reverted_by UUID REFERENCES auth.users(id)
    );
  END IF;

  -- import_history_details table
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'import_history_details'
  ) THEN
    CREATE TABLE IF NOT EXISTS public.import_history_details (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      import_id UUID REFERENCES public.import_history(id) ON DELETE CASCADE,
      record_id TEXT NOT NULL,
      operation_type TEXT CHECK (operation_type IN ('insert', 'update')),
      previous_data JSONB,
      new_data JSONB
    );
  END IF;

  -- Enable RLS if tables exist
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'import_history'
  ) THEN
    ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'import_history_details'
  ) THEN
    ALTER TABLE public.import_history_details ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Reset policies before recreating
  DROP POLICY IF EXISTS "Users can view import history" ON public.import_history;
  DROP POLICY IF EXISTS "Users can insert import history" ON public.import_history;
  DROP POLICY IF EXISTS "Users can update import history" ON public.import_history;
  DROP POLICY IF EXISTS "Users can delete import history" ON public.import_history;

  DROP POLICY IF EXISTS "Users can view import details" ON public.import_history_details;
  DROP POLICY IF EXISTS "Users can insert import details" ON public.import_history_details;

  -- Recreate policies
  DROP POLICY IF EXISTS "Users can view import history" ON public.import_history;
CREATE POLICY "Users can view import history" ON public.import_history
    FOR SELECT
    USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Users can insert import history" ON public.import_history;
CREATE POLICY "Users can insert import history" ON public.import_history
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Users can update import history" ON public.import_history;
CREATE POLICY "Users can update import history" ON public.import_history
    FOR UPDATE
    USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Users can view import details" ON public.import_history_details;
CREATE POLICY "Users can view import details" ON public.import_history_details
    FOR SELECT
    USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Users can insert import details" ON public.import_history_details;
CREATE POLICY "Users can insert import details" ON public.import_history_details
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

  -- Index for details
  CREATE INDEX IF NOT EXISTS idx_import_history_details_import_id
    ON public.import_history_details(import_id);

  -- Grants for authenticated role
  GRANT SELECT, INSERT, UPDATE ON public.import_history TO authenticated;
  GRANT SELECT, INSERT ON public.import_history_details TO authenticated;
END $$;
-- Fix backend schema drift: add missing import_errors + transfer system + required RPCs

-- 1) Import reporting
ALTER TABLE public.import_history
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.import_history(id) ON DELETE CASCADE,
  row_number INTEGER,
  field TEXT,
  error_message TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

-- Clean up potentially older/unsafe policies (idempotent)
DROP POLICY IF EXISTS "Users can view import errors" ON public.import_errors;
DROP POLICY IF EXISTS "Users can insert import errors" ON public.import_errors;
DROP POLICY IF EXISTS "Platform admins can manage all import errors" ON public.import_errors;

-- Scoped policies (platform admin OR same-tenant via import_history)
DROP POLICY IF EXISTS "Import errors: select" ON public.import_errors;
CREATE POLICY "Import errors: select" ON public.import_errors
FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.import_history ih
    WHERE ih.id = import_errors.import_id
      AND ih.tenant_id IN (
        SELECT ur.tenant_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id IS NOT NULL
      )
  )
);

DROP POLICY IF EXISTS "Import errors: insert" ON public.import_errors;
CREATE POLICY "Import errors: insert" ON public.import_errors
FOR INSERT
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.import_history ih
    WHERE ih.id = import_errors.import_id
      AND ih.tenant_id IN (
        SELECT ur.tenant_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id IS NOT NULL
      )
  )
);

DROP POLICY IF EXISTS "Import errors: update (platform admin)" ON public.import_errors;
CREATE POLICY "Import errors: update (platform admin)" ON public.import_errors
FOR UPDATE
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Import errors: delete (platform admin)" ON public.import_errors;
CREATE POLICY "Import errors: delete (platform admin)" ON public.import_errors
FOR DELETE
USING (public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_import_errors_import_id
  ON public.import_errors(import_id);

-- 2) Transfer system (missing tables/types/functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'transfer_status'
  ) THEN BEGIN
    CREATE TYPE public.transfer_status AS ENUM ('pending', 'approved', 'rejected', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'transfer_type'
  ) THEN BEGIN
    CREATE TYPE public.transfer_type AS ENUM ('tenant_to_tenant', 'tenant_to_franchise', 'franchise_to_franchise');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'transfer_entity_type'
  ) THEN BEGIN
    CREATE TYPE public.transfer_entity_type AS ENUM ('lead', 'opportunity', 'quote', 'shipment', 'account', 'contact', 'activity');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.entity_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  source_franchise_id UUID REFERENCES public.franchises(id),
  target_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  target_franchise_id UUID REFERENCES public.franchises(id),
  transfer_type public.transfer_type NOT NULL,
  status public.transfer_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL,
  approved_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add the exact FK names the frontend expects for PostgREST joins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='entity_transfers' AND c.conname='entity_transfers_requested_by_fkey_profiles'
  ) THEN
    ALTER TABLE public.entity_transfers DROP CONSTRAINT IF EXISTS entity_transfers_requested_by_fkey_profiles;
ALTER TABLE public.entity_transfers ADD CONSTRAINT entity_transfers_requested_by_fkey_profiles FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='entity_transfers' AND c.conname='entity_transfers_approved_by_fkey_profiles'
  ) THEN
    ALTER TABLE public.entity_transfers DROP CONSTRAINT IF EXISTS entity_transfers_approved_by_fkey_profiles;
ALTER TABLE public.entity_transfers ADD CONSTRAINT entity_transfers_approved_by_fkey_profiles FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.entity_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.entity_transfers(id) ON DELETE CASCADE,
  entity_type public.transfer_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  status public.transfer_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_transfer_items ENABLE ROW LEVEL SECURITY;

-- Updated-at triggers (safe if function exists)
DROP TRIGGER IF EXISTS update_entity_transfers_updated_at ON public.entity_transfers;
CREATE TRIGGER update_entity_transfers_updated_at
BEFORE UPDATE ON public.entity_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_entity_transfer_items_updated_at ON public.entity_transfer_items;
CREATE TRIGGER update_entity_transfer_items_updated_at
BEFORE UPDATE ON public.entity_transfer_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Policies (drop old names if they exist)
DROP POLICY IF EXISTS "Users can view transfers for their tenant" ON public.entity_transfers;
DROP POLICY IF EXISTS "Users can create transfers from their tenant" ON public.entity_transfers;
DROP POLICY IF EXISTS "Target admins can update status" ON public.entity_transfers;

DROP POLICY IF EXISTS "Entity transfers: select" ON public.entity_transfers;
CREATE POLICY "Entity transfers: select" ON public.entity_transfers
FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR source_tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
  )
  OR target_tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Entity transfers: insert" ON public.entity_transfers;
CREATE POLICY "Entity transfers: insert" ON public.entity_transfers
FOR INSERT
WITH CHECK (
  (public.is_platform_admin(auth.uid()) OR source_tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
  ))
  AND requested_by = auth.uid()
);

DROP POLICY IF EXISTS "Entity transfers: update" ON public.entity_transfers;
CREATE POLICY "Entity transfers: update" ON public.entity_transfers
FOR UPDATE
USING (
  public.is_platform_admin(auth.uid())
  OR target_tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Entity transfers: delete (platform admin)" ON public.entity_transfers;
CREATE POLICY "Entity transfers: delete (platform admin)" ON public.entity_transfers
FOR DELETE
USING (public.is_platform_admin(auth.uid()));

-- Items
DROP POLICY IF EXISTS "View transfer items" ON public.entity_transfer_items;
DROP POLICY IF EXISTS "Create transfer items" ON public.entity_transfer_items;

DROP POLICY IF EXISTS "Entity transfer items: select" ON public.entity_transfer_items;
CREATE POLICY "Entity transfer items: select" ON public.entity_transfer_items
FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.entity_transfers et
    WHERE et.id = entity_transfer_items.transfer_id
      AND (
        et.source_tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL)
        OR et.target_tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL)
      )
  )
);

DROP POLICY IF EXISTS "Entity transfer items: insert" ON public.entity_transfer_items;
CREATE POLICY "Entity transfer items: insert" ON public.entity_transfer_items
FOR INSERT
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.entity_transfers et
    WHERE et.id = entity_transfer_items.transfer_id
      AND et.source_tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
      )
  )
);

DROP POLICY IF EXISTS "Entity transfer items: update (platform admin)" ON public.entity_transfer_items;
CREATE POLICY "Entity transfer items: update (platform admin)" ON public.entity_transfer_items
FOR UPDATE
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Entity transfer items: delete (platform admin)" ON public.entity_transfer_items;
CREATE POLICY "Entity transfer items: delete (platform admin)" ON public.entity_transfer_items
FOR DELETE
USING (public.is_platform_admin(auth.uid()));

-- 3) RPCs expected by the frontend
DROP FUNCTION IF EXISTS public.execute_transfer(p_transfer_id UUID, p_approver_id UUID);
CREATE OR REPLACE FUNCTION public.execute_transfer(p_transfer_id UUID, p_approver_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_success_count INT := 0;
  v_fail_count INT := 0;
  v_error_msg TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF auth.uid() <> p_approver_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Approver mismatch');
  END IF;

  SELECT * INTO v_transfer FROM public.entity_transfers WHERE id = p_transfer_id;

  IF v_transfer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transfer not found');
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transfer is not pending');
  END IF;

  -- Authorization: platform admin OR member of target tenant
  IF NOT (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = v_transfer.target_tenant_id
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized to approve this transfer');
  END IF;

  -- Mark approved (then completed after processing)
  UPDATE public.entity_transfers
  SET approved_by = p_approver_id,
      status = 'approved',
      updated_at = now()
  WHERE id = p_transfer_id;

  FOR v_item IN SELECT * FROM public.entity_transfer_items WHERE transfer_id = p_transfer_id LOOP
    BEGIN
      CASE v_item.entity_type
        WHEN 'lead' THEN
          UPDATE public.leads
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'opportunity' THEN
          UPDATE public.opportunities
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'quote' THEN
          UPDATE public.quotes
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'shipment' THEN
          UPDATE public.shipments
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'account' THEN
          UPDATE public.accounts
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'contact' THEN
          UPDATE public.contacts
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        WHEN 'activity' THEN
          UPDATE public.activities
          SET tenant_id = v_transfer.target_tenant_id,
              franchise_id = v_transfer.target_franchise_id,
              updated_at = now()
          WHERE id = v_item.entity_id;
        ELSE
          RAISE EXCEPTION 'Unknown entity type: %', v_item.entity_type;
      END CASE;

      UPDATE public.entity_transfer_items
      SET status = 'completed', updated_at = now(), error_message = NULL
      WHERE id = v_item.id;

      v_success_count := v_success_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_fail_count := v_fail_count + 1;
      v_error_msg := SQLERRM;

      UPDATE public.entity_transfer_items
      SET status = 'failed', error_message = v_error_msg, updated_at = now()
      WHERE id = v_item.id;
    END;
  END LOOP;

  UPDATE public.entity_transfers
  SET status = 'completed', updated_at = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_success_count + v_fail_count,
    'succeeded', v_success_count,
    'failed', v_fail_count
  );
END;
$$;

DROP FUNCTION IF EXISTS public.assign_franchisee_account_contact(p_tenant_id UUID, p_franchise_id UUID, p_account_data JSONB, p_contact_data JSONB);
CREATE OR REPLACE FUNCTION public.assign_franchisee_account_contact(
  p_tenant_id UUID,
  p_franchise_id UUID,
  p_account_data JSONB,
  p_contact_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_contact_id UUID;
  v_tenant_exists BOOLEAN;
  v_franchise_exists BOOLEAN;
  v_account_name TEXT;
  v_contact_email TEXT;
  v_contact_first_name TEXT;
  v_contact_last_name TEXT;
  v_actor UUID;
BEGIN
  v_actor := auth.uid();

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Authorization: platform admin OR member of the tenant
  IF NOT (
    public.is_platform_admin(v_actor)
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.tenant_id = p_tenant_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for tenant %', p_tenant_id;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) INTO v_tenant_exists;
  IF NOT v_tenant_exists THEN
    RAISE EXCEPTION 'Tenant with ID % does not exist', p_tenant_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.franchises
    WHERE id = p_franchise_id AND tenant_id = p_tenant_id
  ) INTO v_franchise_exists;
  IF NOT v_franchise_exists THEN
    RAISE EXCEPTION 'Franchise with ID % does not exist or does not belong to Tenant %', p_franchise_id, p_tenant_id;
  END IF;

  v_account_name := p_account_data->>'name';
  IF v_account_name IS NULL OR v_account_name = '' THEN
    RAISE EXCEPTION 'Account name is required';
  END IF;

  IF NULLIF(p_account_data->>'id','') IS NOT NULL THEN
    v_account_id := (p_account_data->>'id')::UUID;

    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = v_account_id AND tenant_id = p_tenant_id) THEN
      RAISE EXCEPTION 'Account ID % not found in Tenant %', v_account_id, p_tenant_id;
    END IF;

    UPDATE public.accounts
    SET franchise_id = p_franchise_id,
        updated_at = now()
    WHERE id = v_account_id;
  ELSE
    SELECT id INTO v_account_id
    FROM public.accounts
    WHERE tenant_id = p_tenant_id AND name = v_account_name
    LIMIT 1;

    IF v_account_id IS NOT NULL THEN
      UPDATE public.accounts
      SET franchise_id = p_franchise_id, updated_at = now()
      WHERE id = v_account_id;
    ELSE
      INSERT INTO public.accounts (
        tenant_id, franchise_id, name,
        industry, website, phone, email,
        billing_address, shipping_address,
        created_by
      ) VALUES (
        p_tenant_id,
        p_franchise_id,
        v_account_name,
        p_account_data->>'industry',
        p_account_data->>'website',
        p_account_data->>'phone',
        p_account_data->>'email',
        p_account_data->'billing_address',
        p_account_data->'shipping_address',
        COALESCE(NULLIF(p_account_data->>'created_by','')::UUID, v_actor)
      ) RETURNING id INTO v_account_id;
    END IF;
  END IF;
