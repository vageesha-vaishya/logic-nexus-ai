
-- Fix search_locations to include city and country in search
CREATE OR REPLACE FUNCTION public.search_locations(search_text text, limit_count integer DEFAULT 10)
 RETURNS TABLE(id uuid, location_name text, location_code text, location_type text, country text, city text, rank real)
 LANGUAGE plpgsql
 SECURITY INVOKER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        pl.id,
        pl.location_name,
        pl.location_code,
        pl.location_type,
        pl.country,
        pl.city,
        ts_rank(to_tsvector('english', 
            coalesce(pl.location_name, '') || ' ' || 
            coalesce(pl.location_code, '') || ' ' || 
            coalesce(pl.city, '') || ' ' || 
            coalesce(pl.country, '')
        ), plainto_tsquery('english', search_text)) as rank
    FROM
        ports_locations pl
    WHERE
        pl.location_name ILIKE '%' || search_text || '%'
        OR pl.location_code ILIKE '%' || search_text || '%'
        OR pl.city ILIKE '%' || search_text || '%'
        OR pl.country ILIKE '%' || search_text || '%'
    ORDER BY
        rank DESC, pl.location_name ASC
    LIMIT limit_count;
END;
$function$;
