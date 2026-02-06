-- Migration to add defensive synchronization triggers for container columns
-- Ensures container_type_id and container_type (text) remain in sync
-- Prioritizes ID if provided, falls back to text lookup

BEGIN;

-- 1. Function to sync container type/size columns
CREATE OR REPLACE FUNCTION public.sync_shipment_container_columns()
RETURNS TRIGGER AS $$
DECLARE
    v_type_name TEXT;
    v_type_id UUID;
    v_size_name TEXT;
    v_size_id UUID;
BEGIN
    -- Sync Container Type
    IF NEW.container_type_id IS NOT NULL THEN
        -- ID provided: force text to match master data
        SELECT name INTO v_type_name FROM public.container_types WHERE id = NEW.container_type_id;
        IF v_type_name IS NOT NULL THEN
            NEW.container_type := v_type_name;
        END IF;
    ELSIF NEW.container_type IS NOT NULL THEN
        -- Only text provided: try to resolve ID
        -- Check name match (case insensitive)
        SELECT id INTO v_type_id FROM public.container_types 
        WHERE LOWER(name) = LOWER(TRIM(NEW.container_type)) 
           OR LOWER(code) = LOWER(TRIM(NEW.container_type));
        
        IF v_type_id IS NOT NULL THEN
            NEW.container_type_id := v_type_id;
            -- Also normalize the text name to official name
            SELECT name INTO v_type_name FROM public.container_types WHERE id = v_type_id;
            NEW.container_type := v_type_name;
        END IF;
    END IF;

    -- Sync Container Size
    IF NEW.container_size_id IS NOT NULL THEN
        -- ID provided: force text to match master data
        SELECT name INTO v_size_name FROM public.container_sizes WHERE id = NEW.container_size_id;
        IF v_size_name IS NOT NULL THEN
            NEW.container_size := v_size_name;
        END IF;
    ELSIF NEW.container_size IS NOT NULL THEN
        -- Only text provided: try to resolve ID
        SELECT id INTO v_size_id FROM public.container_sizes 
        WHERE LOWER(name) = LOWER(TRIM(NEW.container_size)) 
           OR LOWER(iso_code) = LOWER(TRIM(NEW.container_size));
           
        IF v_size_id IS NOT NULL THEN
            NEW.container_size_id := v_size_id;
             -- Also normalize the text name to official name
            SELECT name INTO v_size_name FROM public.container_sizes WHERE id = v_size_id;
            NEW.container_size := v_size_name;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Apply Triggers to shipment_cargo_configurations
DROP TRIGGER IF EXISTS trg_sync_container_cols_cargo_config ON public.shipment_cargo_configurations;
CREATE TRIGGER trg_sync_container_cols_cargo_config
BEFORE INSERT OR UPDATE ON public.shipment_cargo_configurations
FOR EACH ROW EXECUTE FUNCTION public.sync_shipment_container_columns();

-- 3. Apply Triggers to shipment_containers
DROP TRIGGER IF EXISTS trg_sync_container_cols_containers ON public.shipment_containers;
CREATE TRIGGER trg_sync_container_cols_containers
BEFORE INSERT OR UPDATE ON public.shipment_containers
FOR EACH ROW EXECUTE FUNCTION public.sync_shipment_container_columns();

COMMIT;
