ALTER TABLE quotation_version_options 
ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES carriers(id);
