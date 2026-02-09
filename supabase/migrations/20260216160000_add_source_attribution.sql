
-- Add source_attribution column to quotation_version_options
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotation_version_options' AND column_name = 'source_attribution') THEN
        ALTER TABLE quotation_version_options ADD COLUMN source_attribution text;
    END IF;
END $$;

COMMENT ON COLUMN quotation_version_options.source_attribution IS 'Indicates the specific attribution of the source (e.g., "manual", "AI Smart Engine").';
