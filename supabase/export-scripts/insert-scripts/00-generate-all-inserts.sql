-- ==========================================
-- AUTOMATED INSERT SCRIPT GENERATOR
-- ==========================================
-- This script generates INSERT statements for ALL tables
-- by querying actual table schemas to avoid column mismatches
-- Execute this in Supabase SQL Editor to generate all insert scripts

-- ==========================================
-- HELPER FUNCTION: Generate INSERT for any table
-- ==========================================
DO $$
DECLARE
    table_rec RECORD;
    column_list TEXT;
    insert_stmt TEXT;
BEGIN
    -- Loop through all tables in public schema
    FOR table_rec IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        -- Get actual column list for this table
        SELECT string_agg(
            column_name || ' ' || 
            CASE 
                WHEN data_type = 'jsonb' THEN '::jsonb'
                WHEN data_type = 'USER-DEFINED' THEN '::' || udt_name
                ELSE ''
            END,
            ', '
        )
        INTO column_list
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = table_rec.tablename
        ORDER BY ordinal_position;

        -- Generate INSERT statement
        RAISE NOTICE E'\n-- ==========================================';
        RAISE NOTICE '-- Table: %', table_rec.tablename;
        RAISE NOTICE E'-- ==========================================';
        
        insert_stmt := format(
            'SELECT ''INSERT INTO %I (%s) VALUES '' ||
              string_agg(
                ''('' || %s || '')'',
                '', ''
              ) || '' ON CONFLICT DO NOTHING;''
            FROM %I
            WHERE EXISTS (SELECT 1 FROM %I LIMIT 1);',
            table_rec.tablename,
            (SELECT string_agg(column_name, ', ') 
             FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = table_rec.tablename
             ORDER BY ordinal_position),
            (SELECT string_agg(
                CASE 
                    WHEN data_type = 'jsonb' THEN 'COALESCE(' || column_name || '::text, ''null'')'
                    WHEN data_type = 'USER-DEFINED' THEN 'COALESCE(' || column_name || '::text, ''NULL'')'
                    WHEN data_type LIKE '%char%' OR data_type = 'text' THEN 'COALESCE(quote_literal(' || column_name || '), ''NULL'')'
                    WHEN data_type LIKE 'timestamp%' THEN 'COALESCE(quote_literal(' || column_name || '::text), ''NULL'')'
                    WHEN data_type = 'date' THEN 'COALESCE(quote_literal(' || column_name || '::text), ''NULL'')'
                    WHEN data_type = 'boolean' THEN 'COALESCE(' || column_name || '::text, ''NULL'')'
                    WHEN data_type = 'uuid' THEN 'COALESCE(quote_literal(' || column_name || '::text), ''NULL'')'
                    ELSE 'COALESCE(' || column_name || '::text, ''NULL'')'
                END,
                ' || '', '' || '
             )
             FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = table_rec.tablename
             ORDER BY ordinal_position),
            table_rec.tablename,
            table_rec.tablename
        );
        
        RAISE NOTICE '%', insert_stmt;
        RAISE NOTICE '';
    END LOOP;
END $$;
