-- sync_shipment_container_columns() (last replaced in
-- 20260305170000_fix_sync_container_columns_legacy_name_columns.sql) made
-- the container_types/container_sizes display-name lookup resilient to
-- schema differences, but its container_size free-text -> id fallback
-- still hardcoded a reference to container_sizes.iso_code:
--   column "iso_code" does not exist
-- container_sizes has no name/size_name/iso_code/code column at all in the
-- current schema -- only dimensional data (see the container_sizes column
-- fix in the app layer, 7a061746). This crashed every INSERT/UPDATE on
-- shipment_containers or shipment_cargo_configurations that set the
-- free-text container_size without an accompanying container_size_id.
--
-- Fix: detect iso_code the same dynamic way v_size_name_col is already
-- detected, and skip id resolution (leave the free text as-is) rather than
-- guess when container_sizes has no label column to match against at all.

CREATE OR REPLACE FUNCTION public.sync_shipment_container_columns()
RETURNS TRIGGER AS $$
DECLARE
    v_type_name TEXT;
    v_type_id UUID;
    v_size_name TEXT;
    v_size_id UUID;
    v_type_name_col TEXT;
    v_size_name_col TEXT;
    v_size_has_iso_code BOOLEAN;
BEGIN
    -- Resolve display-name column names dynamically for compatibility.
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'container_types' AND column_name = 'name'
      ) THEN 'name'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'container_types' AND column_name = 'type_name'
      ) THEN 'type_name'
      ELSE NULL
    END INTO v_type_name_col;

    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'container_sizes' AND column_name = 'name'
      ) THEN 'name'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'container_sizes' AND column_name = 'size_name'
      ) THEN 'size_name'
      ELSE NULL
    END INTO v_size_name_col;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'container_sizes' AND column_name = 'iso_code'
    ) INTO v_size_has_iso_code;

    -- Sync Container Type
    IF NEW.container_type_id IS NOT NULL THEN
        IF v_type_name_col IS NOT NULL THEN
            EXECUTE format(
              'SELECT %I FROM public.container_types WHERE id = $1',
              v_type_name_col
            )
            INTO v_type_name
            USING NEW.container_type_id;
            IF v_type_name IS NOT NULL THEN
                NEW.container_type := v_type_name;
            END IF;
        END IF;
    ELSIF NEW.container_type IS NOT NULL THEN
        IF v_type_name_col IS NOT NULL THEN
            EXECUTE format(
              'SELECT id FROM public.container_types
               WHERE LOWER(%I) = LOWER(TRIM($1))
                  OR LOWER(code) = LOWER(TRIM($1))
               LIMIT 1',
              v_type_name_col
            )
            INTO v_type_id
            USING NEW.container_type;
        ELSE
            SELECT id INTO v_type_id
            FROM public.container_types
            WHERE LOWER(code) = LOWER(TRIM(NEW.container_type))
            LIMIT 1;
        END IF;

        IF v_type_id IS NOT NULL THEN
            NEW.container_type_id := v_type_id;
            IF v_type_name_col IS NOT NULL THEN
                EXECUTE format(
                  'SELECT %I FROM public.container_types WHERE id = $1',
                  v_type_name_col
                )
                INTO v_type_name
                USING v_type_id;
                NEW.container_type := COALESCE(v_type_name, NEW.container_type);
            END IF;
        END IF;
    END IF;

    -- Sync Container Size
    IF NEW.container_size_id IS NOT NULL THEN
        IF v_size_name_col IS NOT NULL THEN
            EXECUTE format(
              'SELECT %I FROM public.container_sizes WHERE id = $1',
              v_size_name_col
            )
            INTO v_size_name
            USING NEW.container_size_id;
            IF v_size_name IS NOT NULL THEN
                NEW.container_size := v_size_name;
            END IF;
        END IF;
    ELSIF NEW.container_size IS NOT NULL THEN
        IF v_size_name_col IS NOT NULL AND v_size_has_iso_code THEN
            EXECUTE format(
              'SELECT id FROM public.container_sizes
               WHERE LOWER(%I) = LOWER(TRIM($1))
                  OR LOWER(iso_code) = LOWER(TRIM($1))
               LIMIT 1',
              v_size_name_col
            )
            INTO v_size_id
            USING NEW.container_size;
        ELSIF v_size_name_col IS NOT NULL THEN
            EXECUTE format(
              'SELECT id FROM public.container_sizes
               WHERE LOWER(%I) = LOWER(TRIM($1))
               LIMIT 1',
              v_size_name_col
            )
            INTO v_size_id
            USING NEW.container_size;
        ELSIF v_size_has_iso_code THEN
            SELECT id INTO v_size_id
            FROM public.container_sizes
            WHERE LOWER(iso_code) = LOWER(TRIM(NEW.container_size))
            LIMIT 1;
        END IF;
        -- else: container_sizes has no label column (name/size_name/
        -- iso_code) to match free text against -- leave container_size
        -- and container_size_id as given rather than guess.

        IF v_size_id IS NOT NULL THEN
            NEW.container_size_id := v_size_id;
            IF v_size_name_col IS NOT NULL THEN
                EXECUTE format(
                  'SELECT %I FROM public.container_sizes WHERE id = $1',
                  v_size_name_col
                )
                INTO v_size_name
                USING v_size_id;
                NEW.container_size := COALESCE(v_size_name, NEW.container_size);
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
