-- Migration: Deduplicate platform_domains and add unique constraint

DO $$
DECLARE
    r RECORD;
    v_keep_id UUID;
BEGIN
    FOR r IN SELECT code FROM public.platform_domains GROUP BY code HAVING COUNT(*) > 1 LOOP
        -- Select one ID to keep (e.g., the oldest one)
        SELECT id INTO v_keep_id FROM public.platform_domains WHERE code = r.code ORDER BY created_at ASC LIMIT 1;
        
        -- Update references in tenants table
        UPDATE public.tenants 
        SET domain_id = v_keep_id 
        WHERE domain_id IN (SELECT id FROM public.platform_domains WHERE code = r.code AND id != v_keep_id);
        
        -- Delete duplicates
        DELETE FROM public.platform_domains 
        WHERE code = r.code AND id != v_keep_id;
        
        RAISE NOTICE 'Cleaned up duplicates for code: %', r.code;
    END LOOP;
END $$;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_domains_code_key') THEN
        ALTER TABLE public.platform_domains ADD CONSTRAINT platform_domains_code_key UNIQUE (code);
    END IF;
END $$;
