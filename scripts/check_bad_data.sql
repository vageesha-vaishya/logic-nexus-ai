-- Check quote_legs for bad data
SELECT id, origin_location, destination_location
FROM quote_legs
WHERE 
  origin_location ILIKE '%undefined%' OR 
  destination_location ILIKE '%undefined%' OR
  origin_location IS NULL OR
  destination_location IS NULL
LIMIT 20;

-- Check ports_locations for bad data or duplicates
SELECT id, location_name, location_code, city, country
FROM ports_locations
WHERE 
  location_name ILIKE '%undefined%' OR
  location_name IS NULL OR
  city ILIKE '%undefined%' OR
  country ILIKE '%undefined%'
LIMIT 20;

-- Check for Dehra Dun specifically
SELECT id, location_name, location_code, location_type, city, country
FROM ports_locations
WHERE location_name ILIKE '%Dehra Dun%';
