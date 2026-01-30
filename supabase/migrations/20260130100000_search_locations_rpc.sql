-- Create a function to search for locations (ports and cities) with fuzzy matching and ranking
CREATE OR REPLACE FUNCTION search_locations(search_text text, limit_count int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  name text,
  code text,
  type text,
  country_name text,
  city_name text,
  score int
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH combined_results AS (
    -- Search Ports/Locations
    SELECT
      p.id,
      p.location_name as name,
      p.location_code as code,
      p.location_type as type,
      p.country as country_name,
      p.city as city_name,
      CASE
        WHEN lower(p.location_code) = lower(search_text) THEN 100
        WHEN lower(p.location_name) = lower(search_text) THEN 90
        WHEN lower(p.location_name) LIKE lower(search_text) || '%' THEN 80
        WHEN lower(p.location_code) LIKE lower(search_text) || '%' THEN 80
        WHEN lower(p.city) LIKE lower(search_text) || '%' THEN 70
        ELSE 60
      END as match_score
    FROM ports_locations p
    WHERE p.is_active = true
      AND (
        p.location_name ILIKE '%' || search_text || '%'
        OR p.location_code ILIKE '%' || search_text || '%'
        OR p.city ILIKE '%' || search_text || '%'
      )

    UNION ALL

    -- Search Cities
    SELECT
      c.id,
      c.name,
      c.code_national as code,
      'city' as type,
      co.name as country_name,
      c.name as city_name,
      CASE
        WHEN lower(c.code_national) = lower(search_text) THEN 100
        WHEN lower(c.name) = lower(search_text) THEN 90
        WHEN lower(c.name) LIKE lower(search_text) || '%' THEN 80
        ELSE 60
      END as match_score
    FROM cities c
    LEFT JOIN countries co ON c.country_id = co.id
    WHERE c.is_active = true
      AND (
        c.name ILIKE '%' || search_text || '%'
        OR (c.code_national IS NOT NULL AND c.code_national ILIKE '%' || search_text || '%')
      )
  )
  SELECT
    cr.id,
    cr.name,
    cr.code,
    cr.type,
    cr.country_name,
    cr.city_name,
    cr.match_score
  FROM combined_results cr
  ORDER BY cr.match_score DESC, cr.name ASC
  LIMIT limit_count;
END;
$$;
