-- Migration: Auto-populate Hierarchy Columns for Compliance Screenings
-- Description: Adds a trigger to automatically set tenant_id and franchise_id from performed_by user.

-- Function to populate hierarchy fields
CREATE OR REPLACE FUNCTION public.populate_compliance_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_franchise_id UUID;
BEGIN
    -- Default performed_by to current user if not set
    IF NEW.performed_by IS NULL THEN
        NEW.performed_by := auth.uid();
    END IF;

    -- Only populate if performed_by is set (which it should be)
    IF NEW.performed_by IS NOT NULL THEN
        -- Get tenant and franchise from user_roles
        SELECT tenant_id, franchise_id 
        INTO v_tenant_id, v_franchise_id
        FROM public.user_roles
        WHERE user_id = NEW.performed_by
        LIMIT 1;

        -- Set tenant_id if not provided
        IF NEW.tenant_id IS NULL THEN
            NEW.tenant_id := v_tenant_id;
        END IF;

        -- Set franchise_id if not provided
        IF NEW.franchise_id IS NULL THEN
            NEW.franchise_id := v_franchise_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger definition
DROP TRIGGER IF EXISTS tr_compliance_screenings_hierarchy ON public.compliance_screenings;

CREATE TRIGGER tr_compliance_screenings_hierarchy
    BEFORE INSERT ON public.compliance_screenings
    FOR EACH ROW
    EXECUTE FUNCTION public.populate_compliance_hierarchy();
