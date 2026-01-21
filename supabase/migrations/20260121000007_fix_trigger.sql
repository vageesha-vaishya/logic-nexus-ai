
-- Fix trigger logic to use UPDATE/INSERT pattern instead of ON CONFLICT
-- This resolves potential issues with unique constraint resolution in some contexts

CREATE OR REPLACE FUNCTION public.update_container_inventory_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_status public.container_status;
BEGIN
    -- Cast status explicitly
    v_status := NEW.status::public.container_status;

    -- Try UPDATE first
    UPDATE public.container_tracking
    SET 
        quantity = quantity + NEW.quantity_change,
        recorded_at = NOW()
    WHERE 
        tenant_id = NEW.tenant_id
        AND size_id = NEW.size_id
        AND location_name = NEW.location_name
        AND status = v_status;

    -- If no row updated, INSERT
    IF NOT FOUND THEN
        INSERT INTO public.container_tracking (
            tenant_id, 
            size_id, 
            location_name, 
            status, 
            quantity, 
            teu_total, 
            recorded_at
        )
        VALUES (
            NEW.tenant_id, 
            NEW.size_id, 
            NEW.location_name, 
            v_status,
            NEW.quantity_change,
            0, -- TEU calc trigger will handle this
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
