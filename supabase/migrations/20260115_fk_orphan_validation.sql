CREATE OR REPLACE FUNCTION public.get_fk_orphans()
RETURNS TABLE (
    constraint_schema text,
    table_name text,
    constraint_name text,
    child_column text,
    parent_schema text,
    parent_table text,
    parent_column text,
    orphan_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec record;
    cnt bigint;
BEGIN
    FOR rec IN
        SELECT
            tc.constraint_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name AS child_column,
            ccu.table_schema AS parent_schema,
            ccu.table_name AS parent_table,
            ccu.column_name AS parent_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_schema IN ('public', 'auth', 'storage')
    LOOP
        cnt := 0;
        EXECUTE format(
            'SELECT count(*) FROM %I.%I AS child LEFT JOIN %I.%I AS parent ON child.%I = parent.%I WHERE child.%I IS NOT NULL AND parent.%I IS NULL',
            rec.constraint_schema,
            rec.table_name,
            COALESCE(rec.parent_schema, 'public'),
            rec.parent_table,
            rec.child_column,
            rec.parent_column,
            rec.child_column,
            rec.parent_column
        ) INTO cnt;
        IF cnt > 0 THEN
            constraint_schema := rec.constraint_schema;
            table_name := rec.table_name;
            constraint_name := rec.constraint_name;
            child_column := rec.child_column;
            parent_schema := COALESCE(rec.parent_schema, 'public');
            parent_table := rec.parent_table;
            parent_column := rec.parent_column;
            orphan_count := cnt;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

