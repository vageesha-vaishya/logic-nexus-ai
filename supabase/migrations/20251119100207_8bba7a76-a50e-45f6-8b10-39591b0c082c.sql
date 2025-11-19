-- Phase 1: Critical Database Schema Fixes for Quotation Module

-- Step 1: Drop conflicting foreign key constraint on quote_charges.leg_id
-- This constraint was pointing to quote_legs which is deprecated
ALTER TABLE quote_charges DROP CONSTRAINT IF EXISTS fk_quote_charges_leg;

-- Step 2: Add mode column to quotation_version_option_legs if it doesn't exist
-- This allows storing the transport mode (air, sea, road, rail) directly on the leg
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_version_option_legs' 
        AND column_name = 'mode'
    ) THEN
        ALTER TABLE quotation_version_option_legs ADD COLUMN mode TEXT;
    END IF;
END $$;

-- Step 3: Rename leg_order to sort_order for consistency
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_version_option_legs' 
        AND column_name = 'leg_order'
    ) THEN
        ALTER TABLE quotation_version_option_legs RENAME COLUMN leg_order TO sort_order;
    END IF;
END $$;

-- Step 4: Add is_active flag to quotation_versions for version management
ALTER TABLE quotation_versions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Step 5: Create index to ensure only one active version per quote
DROP INDEX IF EXISTS idx_active_version_per_quote;
CREATE UNIQUE INDEX idx_active_version_per_quote 
ON quotation_versions(quote_id) 
WHERE is_active = true;

-- Step 6: Add missing audit fields
ALTER TABLE quotation_version_options ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE quotation_version_option_legs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 7: Add trigger for updated_at on quotation_version_option_legs
DROP TRIGGER IF EXISTS update_quotation_version_option_legs_updated_at ON quotation_version_option_legs;
CREATE TRIGGER update_quotation_version_option_legs_updated_at 
BEFORE UPDATE ON quotation_version_option_legs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_quote_charges_leg_id ON quote_charges(leg_id);
CREATE INDEX IF NOT EXISTS idx_quote_charges_quote_option_id ON quote_charges(quote_option_id);
CREATE INDEX IF NOT EXISTS idx_quotation_version_option_legs_option_id ON quotation_version_option_legs(quotation_version_option_id);