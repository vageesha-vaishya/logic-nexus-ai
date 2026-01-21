# Manual Database Migration Required

Due to connectivity issues with the remote database from the local environment, the following SQL scripts need to be executed manually in your Supabase SQL Editor to complete the Quick Quote and Container Analytics enhancements.

## Instructions

1.  Log in to your Supabase Dashboard.
2.  Navigate to the **SQL Editor**.
3.  Create a new query for each of the following sections and run them in order.

### 1. Fix Quote Fetch & Schema (`20260121000001_fix_quote_fetch_error.sql`)

This script aligns the `quotes` table with the application schema (renaming `customer_id` to `account_id`) and ensures all foreign keys are present.

```sql
-- Fix "FAILED TO FETCH QUOTE ERROR" by ensuring quotes table has correct columns and foreign keys
-- Specifically targeting account_id (vs customer_id), missing franchise_id FK, and service_type_id

DO $$
BEGIN

  -- 1. Handle account_id / customer_id discrepancy
  -- If customer_id exists but account_id does not, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'customer_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.quotes RENAME COLUMN customer_id TO account_id;
  END IF;

  -- If account_id still doesn't exist (neither did customer_id), add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;

  -- 2. Ensure account_id has Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'account_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
      ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_account_id_fkey
      FOREIGN KEY (account_id)
      REFERENCES public.accounts(id)
      ON DELETE SET NULL;
  END IF;

  -- 3. Ensure franchise_id has Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'franchise_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_franchise_id_fkey
    FOREIGN KEY (franchise_id)
    REFERENCES public.franchises(id)
    ON DELETE SET NULL;
  END IF;

  -- 4. Ensure service_type_id exists and has Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN service_type_id UUID REFERENCES public.service_types(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'service_type_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_service_type_id_fkey
    FOREIGN KEY (service_type_id)
    REFERENCES public.service_types(id)
    ON DELETE SET NULL;
  END IF;

  -- 5. Ensure opportunity_id has Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'opportunity_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_opportunity_id_fkey
    FOREIGN KEY (opportunity_id)
    REFERENCES public.opportunities(id)
    ON DELETE SET NULL;
  END IF;

END $$;
```

### 2. Fix Container Inventory Trigger (`20260121000007_fix_trigger.sql`)

This script resolves "no unique constraint matching" errors when updating container inventory.

```sql
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
```

### 3. Extend Quotes for Multimodal (`20260121000008_extend_quotes_multimodal.sql`)

Adds necessary fields for the new Quick Quote AI features.

```sql
-- Extend quotes table to support multi-modal specific data
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS origin_code TEXT, -- Store raw code (e.g., USLAX)
  ADD COLUMN IF NOT EXISTS destination_code TEXT, -- Store raw code (e.g., CNSHA)
  ADD COLUMN IF NOT EXISTS transport_mode TEXT, -- air, ocean, road (denormalized for easy access)
  ADD COLUMN IF NOT EXISTS cargo_details JSONB DEFAULT '{}', -- HTS, Schedule B, Commodity Class
  ADD COLUMN IF NOT EXISTS unit_details JSONB DEFAULT '{}', -- Container Type, Dims, Weight, Special Handling
  ADD COLUMN IF NOT EXISTS compliance_checks JSONB DEFAULT '{}'; -- AI Validation results

-- Create indexes for JSONB fields to support searching if needed later
CREATE INDEX IF NOT EXISTS idx_quotes_transport_mode ON public.quotes(transport_mode);
CREATE INDEX IF NOT EXISTS idx_quotes_cargo_details ON public.quotes USING GIN (cargo_details);

-- Update rate_calculations to store more details if needed
ALTER TABLE public.rate_calculations
  ADD COLUMN IF NOT EXISTS input_parameters JSONB; -- Store what was sent to rate engine
```
