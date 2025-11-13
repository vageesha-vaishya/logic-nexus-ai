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
    insert_stmt TEXT;
    col_names TEXT;
    val_tokens TEXT;
    fk_conditions TEXT;
    value_args TEXT;
    fk_args TEXT;
BEGIN
    FOR table_rec IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        SELECT string_agg(format('%I', column_name), ', ')
        INTO col_names
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = table_rec.tablename
        ORDER BY ordinal_position;

        SELECT string_agg(
          CASE 
            WHEN data_type = 'jsonb' THEN '%L::jsonb'
            WHEN data_type = 'USER-DEFINED' THEN '%L::' || udt_name
            ELSE '%L'
          END,
          ', '
        )
        INTO val_tokens
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = table_rec.tablename
        ORDER BY ordinal_position;

        SELECT string_agg(
          '((%L' || CASE WHEN c.data_type = 'jsonb' THEN '::jsonb' WHEN c.data_type = 'USER-DEFINED' THEN '::' || c.udt_name ELSE '' END || 
          ') IS NULL OR EXISTS (SELECT 1 FROM ' || quote_ident(ccu.table_schema) || '.' || quote_ident(ccu.table_name) || 
          ' WHERE ' || quote_ident(ccu.column_name) || ' = %L' || CASE WHEN c.data_type = 'jsonb' THEN '::jsonb' WHEN c.data_type = 'USER-DEFINED' THEN '::' || c.udt_name ELSE '' END || '))',
          ' AND '
        )
        INTO fk_conditions
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        JOIN information_schema.columns c
          ON c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name AND c.column_name = kcu.column_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = table_rec.tablename;

        RAISE NOTICE E'\n-- ==========================================';
        RAISE NOTICE '-- Table: %', table_rec.tablename;
        RAISE NOTICE E'-- ==========================================';

        SELECT string_agg(column_name, ', ')
        INTO value_args
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = table_rec.tablename
        ORDER BY ordinal_position;

        SELECT string_agg(column_name, ', ')
        INTO fk_args
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = table_rec.tablename
        ORDER BY kcu.ordinal_position;

        IF fk_conditions IS NOT NULL AND fk_conditions <> '' THEN
          insert_stmt := format(
            'SELECT string_agg(
               format(''INSERT INTO %I (%s) SELECT %s WHERE %s ON CONFLICT DO NOTHING;'', %s), E''\n'')
             FROM %I
             WHERE EXISTS (SELECT 1 FROM %I LIMIT 1);',
            table_rec.tablename,
            col_names,
            val_tokens,
            fk_conditions,
            value_args || CASE WHEN fk_args IS NULL OR fk_args = '' THEN '' ELSE ', ' || fk_args || ', ' || fk_args END,
            table_rec.tablename,
            table_rec.tablename
          );
        ELSE
          insert_stmt := format(
            'SELECT ''INSERT INTO %I (%s) VALUES '' ||
              string_agg(
                format(''(%s)'', %s),
                '', ''
              ) || '' ON CONFLICT DO NOTHING;''
            FROM %I
            WHERE EXISTS (SELECT 1 FROM %I LIMIT 1);',
            table_rec.tablename,
            col_names,
            val_tokens,
            value_args,
            table_rec.tablename,
            table_rec.tablename
          );
        END IF;

        RAISE NOTICE '%', insert_stmt;
        RAISE NOTICE '';
    END LOOP;
END $$;
