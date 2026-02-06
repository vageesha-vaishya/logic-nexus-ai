
-- Migration: Cleanup Duplicate Container Types
-- Description: Merges duplicate container types (case-insensitive name match) before applying unique constraints.
-- Strategy: Identify duplicates, pick survivor (min ID), reassign references, delete duplicates.

BEGIN;

DO $$
DECLARE
    r RECORD;
    survivor_id UUID;
    victim_ids UUID[];
    dup_name TEXT;
BEGIN
    -- Loop through names that have more than 1 entry (case-insensitive)
    FOR r IN 
        SELECT lower(trim(name)) as clean_name, count(*) 
        FROM public.container_types 
        GROUP BY lower(trim(name)) 
        HAVING count(*) > 1
    LOOP
        dup_name := r.clean_name;
        
        -- Identify Survivor (First created or simply lowest ID)
        SELECT id INTO survivor_id
        FROM public.container_types
        WHERE lower(trim(name)) = dup_name
        ORDER BY created_at ASC, id ASC
        LIMIT 1;
        
        -- Identify Victims
        SELECT array_agg(id) INTO victim_ids
        FROM public.container_types
        WHERE lower(trim(name)) = dup_name
        AND id != survivor_id;
        
        RAISE NOTICE 'Merging duplicates for "%": Survivor %, Victims %', dup_name, survivor_id, victim_ids;
        
        IF survivor_id IS NOT NULL AND victim_ids IS NOT NULL THEN
            -- 1. Reassign container_sizes
            UPDATE public.container_sizes
            SET type_id = survivor_id
            WHERE type_id = ANY(victim_ids);
            
            -- 2. Reassign quote_cargo_configurations (if columns exist and populated)
            -- Note: We wrap in checking if column exists just in case, though we assume previous migration ran
             IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_cargo_configurations' AND column_name = 'container_type_id') THEN
                UPDATE public.quote_cargo_configurations
                SET container_type_id = survivor_id
                WHERE container_type_id = ANY(victim_ids);
             END IF;
            
            -- 3. Delete Victims
            DELETE FROM public.container_types
            WHERE id = ANY(victim_ids);
        END IF;
    END LOOP;
END $$;

COMMIT;
