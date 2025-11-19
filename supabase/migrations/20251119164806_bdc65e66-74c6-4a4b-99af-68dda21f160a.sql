-- Add margin_percentage column to quotation_version_options table
ALTER TABLE quotation_version_options 
ADD COLUMN IF NOT EXISTS margin_percentage numeric;

-- Add comment to explain the column
COMMENT ON COLUMN quotation_version_options.margin_percentage IS 'Calculated margin as a percentage of buy cost';

-- Update existing records to calculate margin_percentage based on buy_subtotal and margin_amount
UPDATE quotation_version_options
SET margin_percentage = CASE 
  WHEN buy_subtotal > 0 THEN (margin_amount / buy_subtotal) * 100
  ELSE 0
END
WHERE margin_percentage IS NULL;