-- Normalize and deduplicate service_types entries, and enforce normalized uniqueness
BEGIN;

-- 2) Merge duplicates: keep one per normalized name, prefer oldest id; aggregate flags/descriptions
WITH agg AS (
  SELECT 
    lower(trim(name)) AS norm_name,
    MIN(id::text)::uuid AS keep_id,
    BOOL_OR(COALESCE(is_active, true)) AS any_active,
    (ARRAY_REMOVE(ARRAY_AGG(description), NULL))[1] AS any_desc
  FROM public.service_types
  GROUP BY lower(trim(name))
),
to_update AS (
  SELECT st.id, st.name, st.is_active, st.description, a.any_active, a.any_desc
  FROM public.service_types st
  JOIN agg a ON st.id = a.keep_id
)
UPDATE public.service_types st
SET 
  is_active = COALESCE(u.any_active, st.is_active),
  description = COALESCE(u.any_desc, st.description)
FROM to_update u
WHERE st.id = u.id;

-- 3) Delete duplicates, keeping the chosen keep_id
WITH keep AS (
  SELECT lower(trim(name)) AS norm_name, MIN(id::text)::uuid AS keep_id
  FROM public.service_types
  GROUP BY lower(trim(name))
)
DELETE FROM public.service_types st
USING keep k
WHERE lower(trim(st.name)) = k.norm_name
  AND st.id <> k.keep_id;

-- 1) Normalize names to trimmed lower-case for consistent uniqueness
UPDATE public.service_types
SET name = lower(trim(name));

-- 4) Enforce uniqueness on normalized name to prevent reoccurrence (case/space-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_service_types_norm_name
  ON public.service_types ((lower(trim(name))));

COMMIT;
