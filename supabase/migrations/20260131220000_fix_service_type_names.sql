
BEGIN;

-- Fix names for standardized types to match the canonical "Gold Standard"
UPDATE service_types SET name = 'Ocean Freight' WHERE code = 'ocean_freight';
UPDATE service_types SET name = 'Air Freight' WHERE code = 'air_freight';
UPDATE service_types SET name = 'Road Freight' WHERE code = 'road_freight';
UPDATE service_types SET name = 'Rail Freight' WHERE code = 'rail_freight';

-- Disable (soft delete) incomplete/legacy types that have no category or mode
-- This cleans up the UI without destroying potential historical data references
UPDATE service_types 
SET is_active = false 
WHERE (category_id IS NULL OR mode_id IS NULL)
  AND code NOT IN ('ocean_freight', 'air_freight', 'road_freight', 'rail_freight', 
                   'procurement_agent', 'quality_inspection', 'cargo_insurance', 'import_clearance');

COMMIT;
