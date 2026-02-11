-- Add columns to extension table
ALTER TABLE "logistics"."quote_items_extension"
ADD COLUMN IF NOT EXISTS "container_type_id" uuid REFERENCES "public"."container_types"("id"),
ADD COLUMN IF NOT EXISTS "container_size_id" uuid REFERENCES "public"."container_sizes"("id");

-- Drop view to recreate
DROP VIEW IF EXISTS "public"."quote_items";

-- Recreate view with joins
CREATE OR REPLACE VIEW "public"."quote_items" AS
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
    l.package_category_id,
    l.package_size_id,
    l.cargo_type_id,
    l.weight_kg,
    l.volume_cbm,
    l.special_instructions,
    l.service_type_id,
    l.container_type_id,
    l.container_size_id,
    ct.name as container_type,
    cs.name as container_size
FROM "public"."quote_items_core" c
LEFT JOIN "logistics"."quote_items_extension" l ON c.id = l.quote_item_id
LEFT JOIN "public"."container_types" ct ON l.container_type_id = ct.id
LEFT JOIN "public"."container_sizes" cs ON l.container_size_id = cs.id;

-- Update Insert Function
CREATE OR REPLACE FUNCTION public.quote_items_insert_func()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into Core
    INSERT INTO public.quote_items_core (
        id, quote_id, line_number, product_name, description, quantity, unit_price,
        discount_percent, discount_amount, tax_percent, tax_amount, line_total, created_at, updated_at
    ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()), NEW.quote_id, NEW.line_number, NEW.product_name, NEW.description, NEW.quantity, NEW.unit_price,
        NEW.discount_percent, NEW.discount_amount, NEW.tax_percent, NEW.tax_amount, NEW.line_total, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
    ) RETURNING id INTO NEW.id;

    -- Insert into Extension (Logistics)
    INSERT INTO logistics.quote_items_extension (
        quote_item_id, package_category_id, package_size_id, cargo_type_id,
        weight_kg, volume_cbm, special_instructions, service_type_id,
        container_type_id, container_size_id
    ) VALUES (
        NEW.id, NEW.package_category_id, NEW.package_size_id, NEW.cargo_type_id,
        NEW.weight_kg, NEW.volume_cbm, NEW.special_instructions, NEW.service_type_id,
        NEW.container_type_id, NEW.container_size_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update Update Function
CREATE OR REPLACE FUNCTION public.quote_items_update_func()
RETURNS TRIGGER AS $$
BEGIN
    -- Update Core
    UPDATE public.quote_items_core
    SET
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

    -- Update Extension (Upsert)
    INSERT INTO logistics.quote_items_extension (
        quote_item_id, package_category_id, package_size_id, cargo_type_id,
        weight_kg, volume_cbm, special_instructions, service_type_id,
        container_type_id, container_size_id
    ) VALUES (
        OLD.id, NEW.package_category_id, NEW.package_size_id, NEW.cargo_type_id,
        NEW.weight_kg, NEW.volume_cbm, NEW.special_instructions, NEW.service_type_id,
        NEW.container_type_id, NEW.container_size_id
    )
    ON CONFLICT (quote_item_id) DO UPDATE SET
        package_category_id = EXCLUDED.package_category_id,
        package_size_id = EXCLUDED.package_size_id,
        cargo_type_id = EXCLUDED.cargo_type_id,
        weight_kg = EXCLUDED.weight_kg,
        volume_cbm = EXCLUDED.volume_cbm,
        special_instructions = EXCLUDED.special_instructions,
        service_type_id = EXCLUDED.service_type_id,
        container_type_id = EXCLUDED.container_type_id,
        container_size_id = EXCLUDED.container_size_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
