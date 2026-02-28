CREATE OR REPLACE FUNCTION public.delete_quote_option_safe(
  p_option_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_tenant_id uuid;
  v_quote_id uuid;
  v_tenant_id uuid;
  v_version_id uuid;
  v_was_selected boolean;
  v_reselected_option_id uuid;
BEGIN
  v_user_id := auth.uid();
  v_user_tenant_id := get_user_tenant_id(v_user_id);

  SELECT
    q.id,
    q.tenant_id,
    qv.id,
    COALESCE(qvo.is_selected, false)
  INTO
    v_quote_id,
    v_tenant_id,
    v_version_id,
    v_was_selected
  FROM quotation_version_options qvo
  JOIN quotation_versions qv ON qv.id = qvo.quotation_version_id
  JOIN quotes q ON q.id = qv.quote_id
  WHERE qvo.id = p_option_id;

  IF v_quote_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Option not found'
    );
  END IF;

  IF v_user_tenant_id IS NULL OR v_tenant_id <> v_user_tenant_id THEN
    IF NOT is_platform_admin(v_user_id) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Not authorized'
      );
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.quote_id = v_quote_id
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Cannot delete options for a booked quote'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM customer_selections cs
    WHERE cs.quotation_version_option_id = p_option_id
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Cannot delete an option already selected by the customer'
    );
  END IF;

  DELETE FROM quote_charges
  WHERE quote_option_id = p_option_id;

  DELETE FROM quotation_version_option_legs
  WHERE quotation_version_option_id = p_option_id;

  DELETE FROM quotation_version_options
  WHERE id = p_option_id;

  INSERT INTO quotation_audit_log (
    tenant_id,
    quote_id,
    quotation_version_id,
    quotation_version_option_id,
    action,
    entity_type,
    entity_id,
    user_id,
    changes,
    metadata
  ) VALUES (
    v_tenant_id,
    v_quote_id,
    v_version_id,
    NULL,
    'DELETED',
    'quotation_version_option',
    p_option_id,
    v_user_id,
    NULL,
    jsonb_build_object('reason', p_reason)
  );

  IF v_was_selected THEN
    SELECT qvo.id
    INTO v_reselected_option_id
    FROM quotation_version_options qvo
    WHERE qvo.quotation_version_id = v_version_id
    ORDER BY COALESCE(qvo.rank_score, 0) DESC, COALESCE(qvo.total_amount, 0) ASC
    LIMIT 1;

    IF v_reselected_option_id IS NOT NULL THEN
      UPDATE quotation_version_options
      SET is_selected = false
      WHERE quotation_version_id = v_version_id;

      UPDATE quotation_version_options
      SET is_selected = true
      WHERE id = v_reselected_option_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_option_id', p_option_id,
    'reselected_option_id', v_reselected_option_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_quote_option_safe(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_quote_option_safe(uuid, text) TO authenticated;

