-- ==============================================================================
-- SOS-Nexus Schema Split: quote_items -> Core + Extension
-- Phase: 0 (Stabilization)
-- Description: Splits quote_items into core (public) and extension (logistics)
--              and creates a view for backward compatibility.
-- ==============================================================================

-- 1. Create Logistics Schema
CREATE SCHEMA IF NOT EXISTS "logistics";

-- Grant usage on new schema
GRANT USAGE ON SCHEMA "logistics" TO "postgres";
GRANT USAGE ON SCHEMA "logistics" TO "anon";
GRANT USAGE ON SCHEMA "logistics" TO "authenticated";
GRANT USAGE ON SCHEMA "logistics" TO "service_role";

-- 2. Rename Legacy Table (Idempotent)
DO $$
BEGIN
    -- Only rename if it's a real table, not a view
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'quote_items'
    ) THEN
        ALTER TABLE "public"."quote_items" RENAME TO "quote_items_legacy";
    END IF;
END $$;

-- 3. Create Core Table
CREATE TABLE IF NOT EXISTS "public"."quote_items_core" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "quote_id" "uuid" NOT NULL,
    "line_number" integer NOT NULL,
    "product_name" "text" NOT NULL,
    "description" "text",
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(15,2) DEFAULT 0 NOT NULL,
    "discount_percent" numeric(5,2) DEFAULT 0,
    "discount_amount" numeric(15,2) DEFAULT 0,
    "tax_percent" numeric(5,2) DEFAULT 0,
    "tax_amount" numeric(15,2) DEFAULT 0,
    "line_total" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- 4. Create Extension Table
CREATE TABLE IF NOT EXISTS "logistics"."quote_items_extension" (
    "quote_item_id" "uuid" NOT NULL PRIMARY KEY,
    "package_category_id" "uuid",
    "package_size_id" "uuid",
    "cargo_type_id" "uuid",
    "weight_kg" numeric,
    "volume_cbm" numeric,
    "special_instructions" "text",
    "service_type_id" "uuid",
    CONSTRAINT fk_quote_item FOREIGN KEY ("quote_item_id") REFERENCES "public"."quote_items_core"("id") ON DELETE CASCADE
);

-- 5. Data Migration (Idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quote_items_legacy') THEN
        -- Insert into Core
        INSERT INTO "public"."quote_items_core" (
            id, quote_id, line_number, product_name, description, quantity, unit_price,
            discount_percent, discount_amount, tax_percent, tax_amount, line_total, created_at, updated_at
        )
        SELECT
            id, quote_id, line_number, product_name, description, quantity, unit_price,
            discount_percent, discount_amount, tax_percent, tax_amount, line_total, created_at, updated_at
        FROM "public"."quote_items_legacy"
        WHERE id NOT IN (SELECT id FROM "public"."quote_items_core");

        -- Insert into Extension
        INSERT INTO "logistics"."quote_items_extension" (
            quote_item_id, package_category_id, package_size_id, cargo_type_id,
            weight_kg, volume_cbm, special_instructions, service_type_id
        )
        SELECT
            id, package_category_id, package_size_id, cargo_type_id,
            weight_kg, volume_cbm, special_instructions, service_type_id
        FROM "public"."quote_items_legacy"
        WHERE id NOT IN (SELECT quote_item_id FROM "logistics"."quote_items_extension");
    END IF;
END $$;

-- 6. Create View for Backward Compatibility
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
    l.service_type_id
FROM "public"."quote_items_core" c
LEFT JOIN "logistics"."quote_items_extension" l ON c.id = l.quote_item_id;

-- 7. Create Updatable View Triggers

-- Trigger Function: INSERT
DROP FUNCTION IF EXISTS public.quote_items_insert_func();
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
        weight_kg, volume_cbm, special_instructions, service_type_id
    ) VALUES (
        NEW.id, NEW.package_category_id, NEW.package_size_id, NEW.cargo_type_id,
        NEW.weight_kg, NEW.volume_cbm, NEW.special_instructions, NEW.service_type_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: INSERT
DROP TRIGGER IF EXISTS quote_items_insert_trigger ON public.quote_items;
CREATE TRIGGER quote_items_insert_trigger
INSTEAD OF INSERT ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.quote_items_insert_func();

-- Trigger Function: UPDATE
DROP FUNCTION IF EXISTS public.quote_items_update_func();
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
        weight_kg, volume_cbm, special_instructions, service_type_id
    ) VALUES (
        OLD.id, NEW.package_category_id, NEW.package_size_id, NEW.cargo_type_id,
        NEW.weight_kg, NEW.volume_cbm, NEW.special_instructions, NEW.service_type_id
    )
    ON CONFLICT (quote_item_id) DO UPDATE SET
        package_category_id = EXCLUDED.package_category_id,
        package_size_id = EXCLUDED.package_size_id,
        cargo_type_id = EXCLUDED.cargo_type_id,
        weight_kg = EXCLUDED.weight_kg,
        volume_cbm = EXCLUDED.volume_cbm,
        special_instructions = EXCLUDED.special_instructions,
        service_type_id = EXCLUDED.service_type_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: UPDATE
DROP TRIGGER IF EXISTS quote_items_update_trigger ON public.quote_items;
CREATE TRIGGER quote_items_update_trigger
INSTEAD OF UPDATE ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.quote_items_update_func();

-- Trigger Function: DELETE
DROP FUNCTION IF EXISTS public.quote_items_delete_func();
CREATE OR REPLACE FUNCTION public.quote_items_delete_func()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.quote_items_core WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger: DELETE
DROP TRIGGER IF EXISTS quote_items_delete_trigger ON public.quote_items;
CREATE TRIGGER quote_items_delete_trigger
INSTEAD OF DELETE ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.quote_items_delete_func();

-- 8. Enable RLS and Add Policies

-- Core Table
ALTER TABLE public.quote_items_core ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotency)
DROP POLICY IF EXISTS "Platform admins can manage all quote items core" ON public.quote_items_core;
CREATE POLICY "Platform admins can manage all quote items core" ON public.quote_items_core FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can manage items for accessible quotes core" ON public.quote_items_core;
CREATE POLICY "Users can manage items for accessible quotes core" ON public.quote_items_core FOR ALL
TO authenticated
USING (
    quote_id IN (
        SELECT id FROM public.quotes
        WHERE franchise_id = public.get_user_franchise_id(auth.uid())
        OR owner_id = auth.uid()
    )
);

-- Extension Table
ALTER TABLE logistics.quote_items_extension ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can manage all quote items ext" ON logistics.quote_items_extension;
CREATE POLICY "Platform admins can manage all quote items ext" ON logistics.quote_items_extension FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can manage items for accessible quotes ext" ON logistics.quote_items_extension;
CREATE POLICY "Users can manage items for accessible quotes ext" ON logistics.quote_items_extension FOR ALL
TO authenticated
USING (
    quote_item_id IN (
        SELECT id FROM public.quote_items_core
    )
);

-- 9. Grants
GRANT USAGE ON SCHEMA "logistics" TO "authenticated";
GRANT USAGE ON SCHEMA "logistics" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "logistics" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "logistics" TO "service_role";

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
