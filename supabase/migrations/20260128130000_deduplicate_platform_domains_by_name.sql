-- Migration: Deduplicate platform_domains by name and add unique constraint on name

DO $$
DECLARE
    r RECORD;
    v_keep_id UUID;
BEGIN
    -- Loop through duplicate names
    FOR r IN SELECT name FROM public.platform_domains GROUP BY name HAVING COUNT(*) > 1 LOOP
        RAISE NOTICE 'Processing duplicate name: %', r.name;
        
        -- Select one ID to keep (prioritize the one with the simpler code, or just oldest)
        -- Strategy: Prefer 'banking' over 'banking_1', or just take the oldest created_at
        SELECT id INTO v_keep_id FROM public.platform_domains 
        WHERE name = r.name 
        ORDER BY 
            length(code) ASC, -- Prefer shorter codes usually
            created_at ASC 
        LIMIT 1;
        
        RAISE NOTICE 'Keeping ID: %', v_keep_id;
        
        -- Update references in tenants table
        UPDATE public.tenants 
        SET domain_id = v_keep_id 
        WHERE domain_id IN (SELECT id FROM public.platform_domains WHERE name = r.name AND id != v_keep_id);
        
        -- Delete duplicates
        DELETE FROM public.platform_domains 
        WHERE name = r.name AND id != v_keep_id;
        
        RAISE NOTICE 'Cleaned up duplicates for name: %', r.name;
    END LOOP;
END $$;

-- Add unique constraint on name if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_domains_name_key') THEN
        ALTER TABLE public.platform_domains ADD CONSTRAINT platform_domains_name_key UNIQUE (name);
    END IF;
END $$;
