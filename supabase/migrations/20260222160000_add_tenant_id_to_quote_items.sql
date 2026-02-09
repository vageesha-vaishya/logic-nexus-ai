-- Migration: Add tenant_id to quote_items_core and logistics.quote_items_extension
-- Description: Adds tenant_id column to support RLS and scoped access, updates View and Trigger.

BEGIN;

-- 1. Add tenant_id to public.quote_items_core
ALTER TABLE public.quote_items_core
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 2. Add tenant_id to logistics.quote_items_extension
ALTER TABLE logistics.quote_items_extension
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 3. Backfill tenant_id from parent quotes
UPDATE public.quote_items_core c
SET tenant_id = q.tenant_id
FROM public.quotes q
WHERE c.quote_id = q.id
AND c.tenant_id IS NULL;

-- Backfill extension from core
UPDATE logistics.quote_items_extension e
SET tenant_id = c.tenant_id
FROM public.quote_items_core c
WHERE e.quote_item_id = c.id
AND e.tenant_id IS NULL;

-- 4. Drop existing View (CASCADE to drop trigger)
DROP VIEW IF EXISTS public.quote_items CASCADE;

-- 5. Recreate View with tenant_id
CREATE OR REPLACE VIEW public.quote_items AS
SELECT
    c.id,
    c.quote_id,
    c.tenant_id, -- New
    c.line_number,
    c.product_name,
    c.description,
    c.commodity_id,
    c.aes_hts_id,
    c.quantity,
    c.unit_price,
    c.discount_percent,
    c.discount_amount,
    c.tax_percent,
    c.tax_amount,
    c.line_total,
    c.created_at,
    c.updated_at,
    -- Extension Columns
    e.package_category_id,
    e.package_size_id,
    e.cargo_type_id,
    e.service_type_id,
    e.weight_kg,
    e.volume_cbm,
    e.special_instructions,
    e.type,
    e.container_type_id,
    e.container_size_id,
    -- Map JSONB attributes
    (e.attributes->>'hazmat_class')::text as hazmat_class,
    (e.attributes->>'un_number')::text as un_number,
    e.attributes
FROM public.quote_items_core c
LEFT JOIN logistics.quote_items_extension e ON c.id = e.quote_item_id;

-- 6. Update Trigger Function
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
            id, quote_id, tenant_id, line_number, product_name, description,
            commodity_id, aes_hts_id,
            quantity, unit_price, discount_percent, discount_amount,
            tax_percent, tax_amount, line_total, created_at, updated_at
        ) VALUES (
            new_id, NEW.quote_id, NEW.tenant_id, NEW.line_number, NEW.product_name, NEW.description,
            NEW.commodity_id, NEW.aes_hts_id,
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
            quote_item_id, tenant_id, package_category_id, package_size_id, cargo_type_id, service_type_id,
            weight_kg, volume_cbm, special_instructions, attributes,
            type, container_type_id, container_size_id
        ) VALUES (
            new_id, NEW.tenant_id, NEW.package_category_id, NEW.package_size_id, NEW.cargo_type_id, NEW.service_type_id,
            NEW.weight_kg, NEW.volume_cbm, NEW.special_instructions, v_attributes,
            NEW.type, NEW.container_type_id, NEW.container_size_id
        );

        NEW.id := new_id;
        RETURN NEW;

    -- Handle UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Update Core
        UPDATE public.quote_items_core SET
            quote_id = NEW.quote_id,
            tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id),
            line_number = NEW.line_number,
            product_name = NEW.product_name,
            description = NEW.description,
            commodity_id = NEW.commodity_id,
            aes_hts_id = NEW.aes_hts_id,
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
            quote_item_id, tenant_id, package_category_id, package_size_id, cargo_type_id, service_type_id,
            weight_kg, volume_cbm, special_instructions, attributes,
            type, container_type_id, container_size_id
        ) VALUES (
            OLD.id, COALESCE(NEW.tenant_id, OLD.tenant_id), NEW.package_category_id, NEW.package_size_id, NEW.cargo_type_id, NEW.service_type_id,
            NEW.weight_kg, NEW.volume_cbm, NEW.special_instructions, v_attributes,
            NEW.type, NEW.container_type_id, NEW.container_size_id
        )
        ON CONFLICT (quote_item_id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            package_category_id = EXCLUDED.package_category_id,
            package_size_id = EXCLUDED.package_size_id,
            cargo_type_id = EXCLUDED.cargo_type_id,
            service_type_id = EXCLUDED.service_type_id,
            weight_kg = EXCLUDED.weight_kg,
            volume_cbm = EXCLUDED.volume_cbm,
            special_instructions = EXCLUDED.special_instructions,
            attributes = EXCLUDED.attributes,
            type = EXCLUDED.type,
            container_type_id = EXCLUDED.container_type_id,
            container_size_id = EXCLUDED.container_size_id;

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

-- 7. Re-attach Trigger
CREATE TRIGGER tr_quote_items_view_handler
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.quote_items
    FOR EACH ROW EXECUTE FUNCTION public.fn_quote_items_view_handler();

-- 8. Optimize RLS Policies (Optional but recommended)
-- Update policies to use direct tenant_id check instead of JOIN
DROP POLICY IF EXISTS "Users can view quote items for accessible quotes" ON public.quote_items_core;
DROP POLICY IF EXISTS "Users can manage quote items for accessible quotes" ON public.quote_items_core;
DROP POLICY IF EXISTS "Users can view quote item extensions" ON logistics.quote_items_extension;
DROP POLICY IF EXISTS "Users can manage quote item extensions" ON logistics.quote_items_extension;

CREATE POLICY "Users can view quote items for accessible quotes"
ON public.quote_items_core FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items_core.quote_id
    AND (q.franchise_id = get_user_franchise_id(auth.uid()) OR q.owner_id = auth.uid())
  )
);

CREATE POLICY "Users can manage quote items for accessible quotes"
ON public.quote_items_core FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items_core.quote_id
    AND (q.franchise_id = get_user_franchise_id(auth.uid()) OR q.owner_id = auth.uid())
  )
);

CREATE POLICY "Users can view quote item extensions"
ON logistics.quote_items_extension FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.quote_items_core c
    JOIN public.quotes q ON q.id = c.quote_id
    WHERE c.id = quote_items_extension.quote_item_id
    AND (q.franchise_id = get_user_franchise_id(auth.uid()) OR q.owner_id = auth.uid())
  )
);

CREATE POLICY "Users can manage quote item extensions"
ON logistics.quote_items_extension FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.quote_items_core c
    JOIN public.quotes q ON q.id = c.quote_id
    WHERE c.id = quote_items_extension.quote_item_id
    AND (q.franchise_id = get_user_franchise_id(auth.uid()) OR q.owner_id = auth.uid())
  )
);

COMMIT;
