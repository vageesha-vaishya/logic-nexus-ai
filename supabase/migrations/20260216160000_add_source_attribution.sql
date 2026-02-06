
-- Add source_attribution column to quotation_version_options
ALTER TABLE quotation_version_options
ADD COLUMN source_attribution text;

COMMENT ON COLUMN quotation_version_options.source_attribution IS 'Indicates the specific attribution of the source (e.g., "manual", "AI Smart Engine").';
