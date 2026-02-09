-- Fix duplicate carriers and enforce uniqueness
-- This migration cleans up duplicate carriers (keeping the most recently created one) 
-- and adds a unique index on (tenant_id, lower(trim(carrier_name))).

DO $$
DECLARE
    r RECORD;
    survivor_id UUID;
    duplicate_ids UUID[];
BEGIN
    -- Loop through all sets of duplicates
    FOR r IN 
        SELECT 
            tenant_id, 
            lower(trim(carrier_name)) as normalized_name, 
            array_agg(id ORDER BY created_at DESC) as ids
        FROM public.carriers
        GROUP BY tenant_id, lower(trim(carrier_name))
        HAVING count(*) > 1
    LOOP
        -- Keep the most recent one (first in the array because of DESC sort)
        survivor_id := r.ids[1];
        duplicate_ids := r.ids[2:array_length(r.ids, 1)];

        -- Update referencing tables
        
        -- bookings
        UPDATE public.bookings 
        SET carrier_id = survivor_id 
        WHERE carrier_id = ANY(duplicate_ids);

        -- shipments
        UPDATE public.shipments 
        SET carrier_id = survivor_id 
        WHERE carrier_id = ANY(duplicate_ids);

        -- quotation_version_options
        UPDATE public.quotation_version_options 
        SET carrier_id = survivor_id 
        WHERE carrier_id = ANY(duplicate_ids);
        
        -- carrier_rates
        -- Note: carrier_rates has ON DELETE CASCADE. 
        -- If we want to preserve rates, we must update them. 
        -- But updating might cause unique constraint violations if the survivor already has rates for the same service/route.
        -- For now, let's assume we want to preserve them and handle conflicts by doing nothing (let them cascade delete if conflict)
        BEGIN
            UPDATE public.carrier_rates 
            SET carrier_id = survivor_id 
            WHERE carrier_id = ANY(duplicate_ids);
        EXCEPTION WHEN unique_violation THEN
            -- If update fails, we leave them to be deleted (cascade)
            NULL;
        END;

        -- carrier_service_types
        BEGIN
            UPDATE public.carrier_service_types 
            SET carrier_id = survivor_id 
            WHERE carrier_id = ANY(duplicate_ids);
        EXCEPTION WHEN unique_violation THEN
            NULL;
        END;
        
        -- charge_tier_config
        UPDATE public.charge_tier_config 
        SET carrier_id = survivor_id 
        WHERE carrier_id = ANY(duplicate_ids);

        -- charge_weight_breaks
        UPDATE public.charge_weight_breaks 
        SET carrier_id = survivor_id 
        WHERE carrier_id = ANY(duplicate_ids);

        -- Now delete the duplicates
        DELETE FROM public.carriers WHERE id = ANY(duplicate_ids);
        
        RAISE NOTICE 'Merged duplicates for carrier % (Tenant: %): Kept %, Deleted %', 
            r.normalized_name, r.tenant_id, survivor_id, duplicate_ids;
            
    END LOOP;
END $$;

-- Create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_carriers_tenant_name_unique 
ON public.carriers (tenant_id, lower(trim(carrier_name)));
