-- Migration: Dedupe Carriers and Enforce Unique Names
-- Date: 2026-02-05
-- Description: Merges duplicate carriers by name into a single global carrier record, then enforces uniqueness.

-- 1. Allow global carriers (tenant_id IS NULL)
ALTER TABLE public.carriers ALTER COLUMN tenant_id DROP NOT NULL;

DO $$
DECLARE
    r RECORD;
    survivor_id UUID;
BEGIN
    -- Loop through all carrier names that appear more than once (case-insensitive)
    FOR r IN 
        SELECT lower(trim(carrier_name)) as cname, array_agg(id ORDER BY tenant_id NULLS FIRST, created_at ASC) as ids
        FROM public.carriers
        GROUP BY lower(trim(carrier_name))
        HAVING count(*) > 1
    LOOP
        -- Pick the first one as the survivor (logic: prefer global (tenant_id null), then oldest)
        survivor_id := r.ids[1];

        -- Make the survivor global if it isn't already
        UPDATE public.carriers 
        SET tenant_id = NULL 
        WHERE id = survivor_id AND tenant_id IS NOT NULL;

        -- Update references in other tables
        -- 1. carrier_rates
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carrier_rates' AND column_name = 'carrier_id') THEN
            UPDATE public.carrier_rates
            SET carrier_id = survivor_id
            WHERE carrier_id = ANY(r.ids[2:])
            AND carrier_id != survivor_id;
        END IF;

        -- 2. shipments
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'carrier_id') THEN
            UPDATE public.shipments
            SET carrier_id = survivor_id
            WHERE carrier_id = ANY(r.ids[2:])
            AND carrier_id != survivor_id;
        END IF;

        -- 3. quotation_version_options
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotation_version_options' AND column_name = 'carrier_id') THEN
            UPDATE public.quotation_version_options
            SET carrier_id = survivor_id
            WHERE carrier_id = ANY(r.ids[2:])
            AND carrier_id != survivor_id;
        END IF;

        -- 3b. quotation_version_option_legs (Added to fix FK violation)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotation_version_option_legs' AND column_name = 'carrier_id') THEN
             UPDATE public.quotation_version_option_legs
             SET carrier_id = survivor_id
             WHERE carrier_id = ANY(r.ids[2:])
             AND carrier_id != survivor_id;
        END IF;

        -- 3c. quotation_version_option_legs (provider_id check)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotation_version_option_legs' AND column_name = 'provider_id') THEN
             UPDATE public.quotation_version_option_legs
             SET provider_id = survivor_id
             WHERE provider_id = ANY(r.ids[2:])
             AND provider_id != survivor_id;
        END IF;

        -- 4. carrier_service_types
        -- Use Copy-then-Delete to handle unique constraints safely
        INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active, created_at, updated_at)
        SELECT tenant_id, survivor_id, service_type, code_type, code_value, is_primary, is_active, created_at, updated_at
        FROM public.carrier_service_types
        WHERE carrier_id = ANY(r.ids[2:])
        ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;
        
        DELETE FROM public.carrier_service_types
        WHERE carrier_id = ANY(r.ids[2:]);

        -- 5. provider_rate_templates (from 20251120031350)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'provider_rate_templates') THEN
             INSERT INTO public.provider_rate_templates (tenant_id, carrier_id, service_type_id, template_name, template_type, rate_structure, min_chargeable_weight, max_chargeable_weight, requires_dimensional_weight, requires_origin_destination, is_active, effective_from, effective_until, created_at, updated_at)
             SELECT tenant_id, survivor_id, service_type_id, template_name, template_type, rate_structure, min_chargeable_weight, max_chargeable_weight, requires_dimensional_weight, requires_origin_destination, is_active, effective_from, effective_until, created_at, updated_at
             FROM public.provider_rate_templates
             WHERE carrier_id = ANY(r.ids[2:])
             ON CONFLICT (carrier_id, service_type_id, template_name) DO NOTHING;
             
             DELETE FROM public.provider_rate_templates
             WHERE carrier_id = ANY(r.ids[2:]);
        END IF;
        
        -- 6. vendor_preferred_carriers (from 20260205130000)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_preferred_carriers') THEN
             INSERT INTO public.vendor_preferred_carriers (vendor_id, carrier_id, mode, is_active, created_at, updated_at, created_by, updated_by)
             SELECT vendor_id, survivor_id, mode, is_active, created_at, updated_at, created_by, updated_by
             FROM public.vendor_preferred_carriers
             WHERE carrier_id = ANY(r.ids[2:])
             ON CONFLICT (vendor_id, carrier_id, mode) DO NOTHING;
             
             DELETE FROM public.vendor_preferred_carriers
             WHERE carrier_id = ANY(r.ids[2:]);
        END IF;

        -- Finally, delete the duplicate carriers
        DELETE FROM public.carriers
        WHERE id = ANY(r.ids[2:]);
        
        RAISE NOTICE 'Merged carriers for %: kept %, deleted %', r.cname, survivor_id, r.ids[2:];
    END LOOP;
END $$;

-- Create the unique index now that duplicates are gone
CREATE UNIQUE INDEX IF NOT EXISTS idx_carriers_name_unique 
ON public.carriers (lower(trim(carrier_name)));
