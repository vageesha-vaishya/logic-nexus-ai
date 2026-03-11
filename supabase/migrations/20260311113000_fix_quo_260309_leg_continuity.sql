DO $$
DECLARE
  v_quote_id uuid;
BEGIN
  SELECT id
  INTO v_quote_id
  FROM public.quotes
  WHERE quote_number = 'QUO-260309-00001'
  LIMIT 1;

  IF v_quote_id IS NULL THEN
    RETURN;
  END IF;

  WITH target_quote AS (
    SELECT q.id AS quote_id, q.tenant_id
    FROM public.quotes q
    WHERE q.id = v_quote_id
  ),
  target_version AS (
    SELECT qv.id AS quotation_version_id
    FROM public.quotation_versions qv
    JOIN target_quote tq ON tq.quote_id = qv.quote_id
    WHERE qv.is_selected = true
    ORDER BY qv.version_no DESC
    LIMIT 1
  ),
  option_legs AS (
    SELECT
      l.id,
      l.quotation_version_option_id,
      l.sort_order,
      l.origin_location,
      l.destination_location,
      l.origin_location_id,
      l.destination_location_id,
      lag(l.destination_location) OVER (
        PARTITION BY l.quotation_version_option_id
        ORDER BY l.sort_order, l.created_at, l.id
      ) AS prev_destination_location,
      lag(l.destination_location_id) OVER (
        PARTITION BY l.quotation_version_option_id
        ORDER BY l.sort_order, l.created_at, l.id
      ) AS prev_destination_location_id
    FROM public.quotation_version_option_legs l
    JOIN public.quotation_version_options qvo ON qvo.id = l.quotation_version_option_id
    JOIN target_version tv ON tv.quotation_version_id = qvo.quotation_version_id
  ),
  mismatches AS (
    SELECT
      ol.id,
      ol.quotation_version_option_id,
      ol.origin_location AS old_origin_location,
      ol.origin_location_id AS old_origin_location_id,
      ol.prev_destination_location AS new_origin_location,
      ol.prev_destination_location_id AS new_origin_location_id
    FROM option_legs ol
    WHERE upper(coalesce(ol.prev_destination_location, '')) = 'DED'
      AND upper(coalesce(ol.origin_location, '')) = 'PANYNJ'
      AND ol.sort_order > 1
  ),
  updated AS (
    UPDATE public.quotation_version_option_legs l
    SET
      origin_location = m.new_origin_location,
      origin_location_id = m.new_origin_location_id,
      updated_at = now()
    FROM mismatches m
    WHERE l.id = m.id
      AND (
        coalesce(l.origin_location, '') IS DISTINCT FROM coalesce(m.new_origin_location, '')
        OR l.origin_location_id IS DISTINCT FROM m.new_origin_location_id
      )
    RETURNING
      l.id,
      l.quotation_version_option_id,
      m.old_origin_location,
      m.new_origin_location,
      m.old_origin_location_id,
      m.new_origin_location_id
  )
  INSERT INTO public.quotation_audit_log (
    tenant_id,
    quote_id,
    quotation_version_id,
    quotation_version_option_id,
    entity_type,
    entity_id,
    action,
    changes,
    metadata,
    user_id
  )
  SELECT
    tq.tenant_id,
    tq.quote_id,
    tv.quotation_version_id,
    u.quotation_version_option_id,
    'quotation_version_option_leg',
    u.id,
    'LEG_ROUTE_CONTINUITY_CORRECTION',
    jsonb_build_object(
      'field', 'origin_location',
      'before', jsonb_build_object(
        'origin_location', u.old_origin_location,
        'origin_location_id', u.old_origin_location_id
      ),
      'after', jsonb_build_object(
        'origin_location', u.new_origin_location,
        'origin_location_id', u.new_origin_location_id
      )
    ),
    jsonb_build_object(
      'reason', 'Fix leg continuity mismatch DED -> PANYNJ in selected quotation version',
      'quote_number', 'QUO-260309-00001',
      'correction_strategy', 'set_subsequent_leg_origin_to_previous_leg_destination'
    ),
    null
  FROM updated u
  CROSS JOIN target_quote tq
  CROSS JOIN target_version tv;
END $$;
