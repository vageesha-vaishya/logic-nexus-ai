
DO $$
DECLARE
    r RECORD;
    cmd TEXT;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'SELECT relrowsecurity FROM pg_class WHERE oid = ''' || quote_ident(r.tablename) || '''::regclass' INTO cmd;
        IF cmd = 'f' THEN
            RAISE NOTICE 'Table % does NOT have RLS enabled.', r.tablename;
        ELSE
            RAISE NOTICE 'Table % has RLS enabled.', r.tablename;
        END IF;
    END LOOP;
END$$;
