-- Fix duplicate service types by keeping the oldest record (by created_at)
-- Note: service_type_mappings uses TEXT for service_type, not UUID foreign key,
-- so no updates needed there - just delete duplicates

WITH ranked_duplicates AS (
  SELECT 
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id::text ASC) as rn
  FROM service_types
)
DELETE FROM service_types
WHERE id IN (
  SELECT id FROM ranked_duplicates WHERE rn > 1
);