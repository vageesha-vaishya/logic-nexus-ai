
-- Migration to make leg_id nullable in quote_charges table
-- This allows for "Global" or "Combined" charges that are associated with an option 
-- but not a specific leg (e.g. Documentation fees, Customs clearance that applies to the whole shipment)

ALTER TABLE quote_charges ALTER COLUMN leg_id DROP NOT NULL;
