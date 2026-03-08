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
    e.package_category_id,
    e.package_size_id,
    e.cargo_type_id,
    e.weight_kg,
    e.volume_cbm,
    e.special_instructions,
    e.service_type_id
FROM "public"."quote_items_core" c
LEFT JOIN "logistics"."quote_items_extension" e ON c.id = e.quote_item_id;

-- 7. Create Trigger to Handle Inserts into View
CREATE OR REPLACE FUNCTION public.fn_quote_items_view_handler()
RETURNS TRIGGER AS $$
DECLARE
    new_id UUID;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        new_id := COALESCE(NEW.id, gen_random_uuid());
        
        -- Insert into Core
        INSERT INTO "public"."quote_items_core" (
            id, quote_id, line_number, product_name, description, quantity, unit_price,
            discount_percent, discount_amount, tax_percent, tax_amount, line_total, created_at, updated_at
        ) VALUES (
            new_id, NEW.quote_id, NEW.line_number, NEW.product_name, NEW.description, NEW.quantity, NEW.unit_price,
            NEW.discount_percent, NEW.discount_amount, NEW.tax_percent, NEW.tax_amount, NEW.line_total, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
        );

        -- Insert into Extension
        INSERT INTO "logistics"."quote_items_extension" (
            quote_item_id, package_category_id, package_size_id, cargo_type_id,
            weight_kg, volume_cbm, special_instructions, service_type_id
        ) VALUES (
            new_id, NEW.package_category_id, NEW.package_size_id, NEW.cargo_type_id,
            NEW.weight_kg, NEW.volume_cbm, NEW.special_instructions, NEW.service_type_id
        );
        
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Update Core
        UPDATE "public"."quote_items_core"
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

        -- Update Extension
        UPDATE "logistics"."quote_items_extension"
        SET
            package_category_id = NEW.package_category_id,
            package_size_id = NEW.package_size_id,
            cargo_type_id = NEW.cargo_type_id,
            weight_kg = NEW.weight_kg,
            volume_cbm = NEW.volume_cbm,
            special_instructions = NEW.special_instructions,
            service_type_id = NEW.service_type_id
        WHERE quote_item_id = OLD.id;
        
        IF NOT FOUND THEN
             INSERT INTO "logistics"."quote_items_extension" (
                quote_item_id, package_category_id, package_size_id, cargo_type_id,
                weight_kg, volume_cbm, special_instructions, service_type_id
            ) VALUES (
                OLD.id, NEW.package_category_id, NEW.package_size_id, NEW.cargo_type_id,
                NEW.weight_kg, NEW.volume_cbm, NEW.special_instructions, NEW.service_type_id
            );
        END IF;

        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM "public"."quote_items_core" WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quote_items_view_handler
INSTEAD OF INSERT OR UPDATE OR DELETE ON "public"."quote_items"
FOR EACH ROW EXECUTE FUNCTION public.fn_quote_items_view_handler();
