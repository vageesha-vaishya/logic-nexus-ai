-- Migration to add attributes JSONB column to quote_items_extension
-- Part of Phase 3.3 Data Migration

BEGIN;

-- 1. Add attributes column to extension table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_items_extension') THEN
        ALTER TABLE quote_items_extension 
        ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Update View to include attributes
DROP VIEW IF EXISTS quote_items;

CREATE VIEW quote_items AS
SELECT
    c.id,
    c.quote_id,
    c.line_number,
    c.product_name,
    c.description,
    c.quantity,
    c.unit_price,
    c.discount_percent,
    c.created_at,
    c.updated_at,
    e.package_category_id,
    e.package_size_id,
    e.attributes
FROM quote_items_core c
LEFT JOIN quote_items_extension e ON c.id = e.id;

-- 3. Update Trigger Function to handle attributes
CREATE OR REPLACE FUNCTION fn_quote_items_view_handler()
RETURNS TRIGGER AS $$
DECLARE
    new_id UUID;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO quote_items_core (
            id, quote_id, line_number, product_name, description, quantity, unit_price, discount_percent
        ) VALUES (
            COALESCE(NEW.id, gen_random_uuid()),
            NEW.quote_id,
            NEW.line_number,
            NEW.product_name,
            NEW.description,
            NEW.quantity,
            NEW.unit_price,
            NEW.discount_percent
        ) RETURNING id INTO new_id;

        -- Ensure NEW.id matches the generated one if it was null
        NEW.id := new_id;

        INSERT INTO quote_items_extension (
            id, package_category_id, package_size_id, attributes
        ) VALUES (
            new_id,
            NEW.package_category_id,
            NEW.package_size_id,
            COALESCE(NEW.attributes, '{}'::jsonb)
        );
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE quote_items_core SET
            line_number = NEW.line_number,
            product_name = NEW.product_name,
            description = NEW.description,
            quantity = NEW.quantity,
            unit_price = NEW.unit_price,
            discount_percent = NEW.discount_percent,
            updated_at = NOW()
        WHERE id = OLD.id;

        INSERT INTO quote_items_extension (id, package_category_id, package_size_id, attributes)
        VALUES (OLD.id, NEW.package_category_id, NEW.package_size_id, COALESCE(NEW.attributes, '{}'::jsonb))
        ON CONFLICT (id) DO UPDATE SET
            package_category_id = NEW.package_category_id,
            package_size_id = NEW.package_size_id,
            attributes = COALESCE(NEW.attributes, quote_items_extension.attributes);
        
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM quote_items_core WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-attach Trigger
DROP TRIGGER IF EXISTS tr_quote_items_view_handler ON quote_items;
CREATE TRIGGER tr_quote_items_view_handler
    INSTEAD OF INSERT OR UPDATE OR DELETE ON quote_items
    FOR EACH ROW EXECUTE FUNCTION fn_quote_items_view_handler();

COMMIT;
