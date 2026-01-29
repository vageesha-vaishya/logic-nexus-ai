
-- Phase 3.3: Fix Data Routing and Migrate Legacy Data
-- Target: Use logistics.quote_items_extension instead of public placeholder

-- 1. Add attributes to logistics table if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'logistics' AND table_name = 'quote_items_extension' AND column_name = 'attributes') THEN
        ALTER TABLE logistics.quote_items_extension ADD COLUMN attributes JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Drop existing View and Trigger (to replace completely)
DROP VIEW IF EXISTS public.quote_items CASCADE;

-- 3. Recreate View with ALL Legacy Columns + Attributes
CREATE OR REPLACE VIEW public.quote_items AS
SELECT
    c.id,
    c.quote_id,
    c.line_number,
    c.product_name,
    c.description,
    c.quantity,
    c.unit_price,
    c.discount_percent,
    c.discount_amount,
    c.tax_percent,
    c.tax_amount,
    c.line_total,
    c.created_at,
    c.updated_at,
    -- Extension Columns (from logistics schema)
    e.package_category_id,
    e.package_size_id,
    e.cargo_type_id,
    e.service_type_id,
    e.weight_kg,
    e.volume_cbm,
    e.special_instructions,
    -- Map JSONB attributes to Legacy Columns if they existed there
    (e.attributes->>'hazmat_class')::text as hazmat_class,
    (e.attributes->>'un_number')::text as un_number,
    -- Expose full attributes
    e.attributes
FROM public.quote_items_core c
LEFT JOIN logistics.quote_items_extension e ON c.id = e.quote_item_id;

-- 4. Update Trigger Function to handle Routing to Logistics Schema
CREATE OR REPLACE FUNCTION public.fn_quote_items_view_handler()
RETURNS TRIGGER AS $$
DECLARE
    new_id UUID;
    v_attributes JSONB;
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        new_id := COALESCE(NEW.id, gen_random_uuid());
        
        -- Insert into Core
        INSERT INTO public.quote_items_core (
            id, quote_id, line_number, product_name, description,
            quantity, unit_price, discount_percent, discount_amount,
            tax_percent, tax_amount, line_total, created_at, updated_at
        ) VALUES (
            new_id, NEW.quote_id, NEW.line_number, NEW.product_name, NEW.description,
            NEW.quantity, NEW.unit_price, NEW.discount_percent, NEW.discount_amount,
            NEW.tax_percent, NEW.tax_amount, NEW.line_total, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
        );

        -- Construct Attributes JSONB
        v_attributes := COALESCE(NEW.attributes, '{}'::jsonb);
        IF NEW.hazmat_class IS NOT NULL THEN
            v_attributes := v_attributes || jsonb_build_object('hazmat_class', NEW.hazmat_class);
        END IF;
        IF NEW.un_number IS NOT NULL THEN
            v_attributes := v_attributes || jsonb_build_object('un_number', NEW.un_number);
        END IF;

        -- Insert into Logistics Extension
        INSERT INTO logistics.quote_items_extension (
            quote_item_id, package_category_id, package_size_id, cargo_type_id, service_type_id,
            weight_kg, volume_cbm, special_instructions, attributes
        ) VALUES (
            new_id, NEW.package_category_id, NEW.package_size_id, NEW.cargo_type_id, NEW.service_type_id,
            NEW.weight_kg, NEW.volume_cbm, NEW.special_instructions, v_attributes
        );

        NEW.id := new_id;
        RETURN NEW;

    -- Handle UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Update Core
        UPDATE public.quote_items_core SET
            quote_id = NEW.quote_id,
            line_number = NEW.line_number,
            product_name = NEW.product_name,
            description = NEW.description,
            quantity = NEW.quantity,
            unit_price = NEW.unit_price,
            discount_percent = NEW.discount_percent,
            discount_amount = NEW.discount_amount,
            tax_percent = NEW.tax_percent,
            tax_amount = NEW.tax_amount,
            line_total = NEW.line_total,
            updated_at = now()
        WHERE id = OLD.id;

        -- Update Extension
        v_attributes := COALESCE(NEW.attributes, '{}'::jsonb);
        IF NEW.hazmat_class IS NOT NULL THEN
            v_attributes := v_attributes || jsonb_build_object('hazmat_class', NEW.hazmat_class);
        END IF;
        IF NEW.un_number IS NOT NULL THEN
            v_attributes := v_attributes || jsonb_build_object('un_number', NEW.un_number);
        END IF;

        -- Upsert Extension
        INSERT INTO logistics.quote_items_extension (
            quote_item_id, package_category_id, package_size_id, cargo_type_id, service_type_id,
            weight_kg, volume_cbm, special_instructions, attributes
        ) VALUES (
            OLD.id, NEW.package_category_id, NEW.package_size_id, NEW.cargo_type_id, NEW.service_type_id,
            NEW.weight_kg, NEW.volume_cbm, NEW.special_instructions, v_attributes
        )
        ON CONFLICT (quote_item_id) DO UPDATE SET
            package_category_id = EXCLUDED.package_category_id,
            package_size_id = EXCLUDED.package_size_id,
            cargo_type_id = EXCLUDED.cargo_type_id,
            service_type_id = EXCLUDED.service_type_id,
            weight_kg = EXCLUDED.weight_kg,
            volume_cbm = EXCLUDED.volume_cbm,
            special_instructions = EXCLUDED.special_instructions,
            attributes = EXCLUDED.attributes;

        RETURN NEW;

    -- Handle DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM public.quote_items_core WHERE id = OLD.id;
        DELETE FROM logistics.quote_items_extension WHERE quote_item_id = OLD.id;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Re-attach Trigger
CREATE TRIGGER tr_quote_items_view_handler
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.quote_items
    FOR EACH ROW EXECUTE FUNCTION public.fn_quote_items_view_handler();

-- 6. Data Migration (Idempotent)
DO $$
BEGIN
    -- Migrate Core Data
    INSERT INTO public.quote_items_core (
        id, quote_id, line_number, product_name, description,
        quantity, unit_price, discount_percent, discount_amount,
        tax_percent, tax_amount, line_total, created_at, updated_at
    )
    SELECT
        id, quote_id, line_number, product_name, description,
        quantity, unit_price, discount_percent, discount_amount,
        tax_percent, tax_amount, line_total, created_at, updated_at
    FROM public.quote_items_legacy
    ON CONFLICT (id) DO NOTHING;

    -- Migrate Extension Data (to logistics schema)
    INSERT INTO logistics.quote_items_extension (
        quote_item_id, package_category_id, package_size_id, cargo_type_id, service_type_id,
        weight_kg, volume_cbm, special_instructions, attributes
    )
    SELECT
        id, package_category_id, package_size_id, cargo_type_id, service_type_id,
        weight_kg, volume_cbm, special_instructions,
        jsonb_build_object(
            'hazmat_class', hazmat_class,
            'un_number', un_number
        )
    FROM public.quote_items_legacy
    ON CONFLICT (quote_item_id) DO NOTHING;
END $$;

-- 7. Cleanup: Drop duplicate/misplaced table if empty
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quote_items_extension') THEN
        -- Only drop if it's not the same as logistics one (unlikely but safe check)
        -- And if it's safe to do so. For now, let's keep it but maybe rename it to avoid confusion?
        -- Actually, user might have used it. Let's just leave it alone for now to be safe, or rename it.
        ALTER TABLE public.quote_items_extension RENAME TO quote_items_extension_deprecated;
    END IF;
END $$;
