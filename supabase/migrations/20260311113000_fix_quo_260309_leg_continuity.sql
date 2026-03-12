DO $$
DECLARE
  v_quote_id uuid;
  v_quote_tenant_id uuid;
  v_version_id uuid;
  v_has_is_selected boolean := false;
  v_has_is_active boolean := false;
BEGIN
  SELECT id, tenant_id
  INTO v_quote_id, v_quote_tenant_id
  FROM public.quotes
  WHERE quote_number = 'QUO-260309-00001'
  LIMIT 1;

  IF v_quote_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotation_versions'
      AND column_name = 'is_selected'
  )
  INTO v_has_is_selected;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotation_versions'
      AND column_name = 'is_active'
  )
  INTO v_has_is_active;

  IF v_has_is_selected THEN
    EXECUTE
      'SELECT id
       FROM public.quotation_versions
       WHERE quote_id = $1 AND is_selected = true
       ORDER BY created_at DESC, id DESC
       LIMIT 1'
    INTO v_version_id
    USING v_quote_id;
  ELSIF v_has_is_active THEN
    EXECUTE
      'SELECT id
       FROM public.quotation_versions
       WHERE quote_id = $1 AND is_active = true
       ORDER BY created_at DESC, id DESC
       LIMIT 1'
    INTO v_version_id
    USING v_quote_id;
  ELSE
    SELECT id
    INTO v_version_id
    FROM public.quotation_versions
    WHERE quote_id = v_quote_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
  END IF;

  IF v_version_id IS NULL THEN
    RETURN;
  END IF;

  WITH target_quote AS (
    SELECT q.id AS quote_id
    FROM public.quotes q
    WHERE q.id = v_quote_id
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
    JOIN target_quote tq ON tq.quote_id = v_quote_id
    WHERE qvo.quotation_version_id = v_version_id
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
    v_quote_tenant_id,
    tq.quote_id,
    v_version_id,
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
  CROSS JOIN target_quote tq;
END $$;
