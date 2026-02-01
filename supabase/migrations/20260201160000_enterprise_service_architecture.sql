-- Enterprise Service Architecture: Sales, Fulfillment, Billing, VRM
-- Addresses: Global/Tenant Hierarchy, Pricing/Billing/Fulfillment Engines

BEGIN;

-----------------------------------------------------------------------------
-- 1. Enable Global Services (Tenant-Agnostic)
-----------------------------------------------------------------------------
-- Allow tenant_id to be NULL for Global/Template services
ALTER TABLE public.services ALTER COLUMN tenant_id DROP NOT NULL;

-- Add Hierarchy & Template Flags
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS parent_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_services_parent_id ON public.services(parent_service_id);
CREATE INDEX IF NOT EXISTS idx_services_is_template ON public.services(is_template);


-----------------------------------------------------------------------------
-- 2. Enterprise Configuration Modules (JSONB)
-----------------------------------------------------------------------------
-- We use JSONB for flexible configuration engines while maintaining high-level columns for querying

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS billing_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS fulfillment_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS compliance_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.services.billing_config IS 'Billing rules: tax_code, gl_accounts, invoice_trigger, billing_frequency';
COMMENT ON COLUMN public.services.pricing_config IS 'Pricing rules: model (flat/tiered), currency, uom, price_lists';
COMMENT ON COLUMN public.services.fulfillment_config IS 'Ops rules: provisioning_type (manual/auto), workflow_id, sla_hours';
COMMENT ON COLUMN public.services.compliance_config IS 'Regulatory: required_docs, hazmat_class, customs_codes';


-----------------------------------------------------------------------------
-- 3. Vendor Relationship Management (VRM) Support
-----------------------------------------------------------------------------
-- Create Vendors table if it doesn't exist (simplistic version for Service linkage)
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- Nullable for Global Vendors
    name TEXT NOT NULL,
    code TEXT,
    type TEXT CHECK (type IN ('carrier', 'agent', 'broker', 'warehouse', 'technology', 'other')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    contact_info JSONB DEFAULT '{}'::jsonb,
    compliance_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON public.vendors(tenant_id);

-- Service <-> Vendor Linkage (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.service_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT false,
    cost_structure JSONB DEFAULT '{}'::jsonb, -- Vendor cost, currency, validity
    sla_agreement JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(service_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_service_vendors_service ON public.service_vendors(service_id);
CREATE INDEX IF NOT EXISTS idx_service_vendors_vendor ON public.service_vendors(vendor_id);


-----------------------------------------------------------------------------
-- 4. Advanced Pricing Tiers (Relational)
-----------------------------------------------------------------------------
-- For complex tiered pricing that needs efficient SQL querying
CREATE TABLE IF NOT EXISTS public.service_pricing_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    min_quantity NUMERIC NOT NULL,
    max_quantity NUMERIC, -- NULL means infinity
    unit_price NUMERIC NOT NULL,
    flat_fee NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_service ON public.service_pricing_tiers(service_id);


-----------------------------------------------------------------------------
-- 5. Fix Unique Constraint for Global Services (Before Seeding)
-----------------------------------------------------------------------------
-- Standard UNIQUE(tenant_id, service_code) allows multiple rows with tenant_id=NULL and same code.
-- We want to enforce unique service_code for Global Services (where tenant_id is NULL).

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_global_service_code 
ON public.services (service_code) 
WHERE tenant_id IS NULL;


-----------------------------------------------------------------------------
-- 6. Seed Enterprise Example: Global Ocean Service
-----------------------------------------------------------------------------
-- We insert a Global Template Service that tenants can inherit/clone

DO $$
DECLARE
    v_global_ocean_id UUID;
    v_global_vendor_id UUID;
    v_ocean_type_id UUID;
BEGIN
    -- Get ID for 'ocean' service type (assuming it exists from previous seeds)
    SELECT id INTO v_ocean_type_id FROM service_types WHERE code = 'ocean_fcl' LIMIT 1;
    
    -- If no ocean_fcl, fallback to any ocean
    IF v_ocean_type_id IS NULL THEN
         SELECT id INTO v_ocean_type_id FROM service_types WHERE name ILIKE '%ocean%' LIMIT 1;
    END IF;

    -- 1. Create Global Vendor (Maersk Example)
    INSERT INTO vendors (name, code, type, status)
    VALUES ('Maersk Line (Global)', 'MAEU', 'carrier', 'active')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_global_vendor_id;

    -- Handle case where vendor already existed
    IF v_global_vendor_id IS NULL THEN
        SELECT id INTO v_global_vendor_id FROM vendors WHERE code = 'MAEU';
    END IF;

    -- 2. Create Global Template Service
    IF v_ocean_type_id IS NOT NULL THEN
        -- Check if exists first to avoid partial index conflict issues
        SELECT id INTO v_global_ocean_id FROM services WHERE service_code = 'GLOBAL-OC-FCL-20' AND tenant_id IS NULL;

        IF v_global_ocean_id IS NULL THEN
            INSERT INTO services (
                tenant_id, 
                service_code, 
                service_name, 
                service_type, 
                service_type_id,
                description, 
                is_template, 
                base_price, 
                pricing_unit, 
                is_active,
                billing_config,
                pricing_config,
                fulfillment_config,
                compliance_config
            ) VALUES (
                NULL, -- Global
                'GLOBAL-OC-FCL-20', 
                'Global Ocean FCL 20ft Standard', 
                'ocean', 
                v_ocean_type_id,
                'Template for Ocean FCL 20ft shipments with standard billing rules', 
                true, 
                0, -- Base price is 0 for template
                'container', 
                true,
                -- Billing Config
                '{
                    "tax_code": "FRT-INTL-001", 
                    "gl_income_account": "4000-OCEAN-REV", 
                    "gl_expense_account": "5000-OCEAN-COST",
                    "invoice_trigger": "shipment_departed",
                    "billing_frequency": "one_time"
                }'::jsonb,
                -- Pricing Config
                '{
                    "model": "tiered", 
                    "currency": "USD", 
                    "allow_override": true
                }'::jsonb,
                -- Fulfillment Config
                '{
                    "provisioning_type": "manual_booking", 
                    "workflow_id": "wf_ocean_export_std"
                }'::jsonb,
                -- Compliance Config
                '{
                    "required_docs": ["bill_of_lading", "commercial_invoice", "packing_list"],
                    "hazmat_supported": true
                }'::jsonb
            )
            RETURNING id INTO v_global_ocean_id;
        END IF;

        -- If we have the ID (inserted or found), let's ensure related data exists
        IF v_global_ocean_id IS NOT NULL THEN
            -- Link Vendor
            INSERT INTO service_vendors (service_id, vendor_id, is_preferred, cost_structure)
            VALUES (v_global_ocean_id, v_global_vendor_id, true, '{"contract_ref": "GL-MAEU-2026"}'::jsonb)
            ON CONFLICT (service_id, vendor_id) DO NOTHING;

            -- Add Pricing Tiers (Delete existing first to avoid duplication if re-running)
            DELETE FROM service_pricing_tiers WHERE service_id = v_global_ocean_id;
            
            INSERT INTO service_pricing_tiers (service_id, min_quantity, max_quantity, unit_price)
            VALUES 
                (v_global_ocean_id, 1, 10, 1500.00),
                (v_global_ocean_id, 11, 50, 1450.00),
                (v_global_ocean_id, 51, NULL, 1400.00);
        END IF;
    END IF;

END $$;


COMMIT;
