-- Make container sync trigger resilient to legacy master-data schemas.
-- Some environments use container_types.type_name / container_sizes.size_name
-- instead of `name`, which caused runtime errors:
--   column "name" does not exist

CREATE OR REPLACE FUNCTION public.sync_shipment_container_columns()
RETURNS TRIGGER AS $$
DECLARE
    v_type_name TEXT;
    v_type_id UUID;
    v_size_name TEXT;
    v_size_id UUID;
    v_type_name_col TEXT;
    v_size_name_col TEXT;
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
        IF v_size_name_col IS NOT NULL THEN
            EXECUTE format(
              'SELECT id FROM public.container_sizes
               WHERE LOWER(%I) = LOWER(TRIM($1))
                  OR LOWER(iso_code) = LOWER(TRIM($1))
               LIMIT 1',
              v_size_name_col
            )
            INTO v_size_id
            USING NEW.container_size;
        ELSE
            SELECT id INTO v_size_id
            FROM public.container_sizes
            WHERE LOWER(iso_code) = LOWER(TRIM(NEW.container_size))
            LIMIT 1;
        END IF;

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
