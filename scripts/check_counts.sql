
-- Check row counts for Quote Items tables
SELECT 
    (SELECT count(*) FROM quote_items_core) as core_count,
    (SELECT count(*) FROM quote_items_extension) as extension_count,
    (SELECT count(*) FROM information_schema.tables WHERE table_name = 'quote_items_legacy') as legacy_table_exists;

-- If legacy table exists, count its rows
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_items_legacy') THEN
        EXECUTE 'SELECT count(*) FROM quote_items_legacy';
    END IF;
END $$;
