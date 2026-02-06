-- Add vessel and port information to shipments table
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS vessel_name TEXT,
ADD COLUMN IF NOT EXISTS voyage_number TEXT,
ADD COLUMN IF NOT EXISTS port_of_loading TEXT,
ADD COLUMN IF NOT EXISTS port_of_discharge TEXT,
ADD COLUMN IF NOT EXISTS place_of_receipt TEXT,
ADD COLUMN IF NOT EXISTS place_of_delivery TEXT;
