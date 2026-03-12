CREATE OR REPLACE FUNCTION public.delete_quotes_cascade_detailed(
  p_quote_ids uuid[],
  p_reason text DEFAULT NULL,
  p_force_hard_delete boolean DEFAULT false,
  p_atomic boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_tenant_id uuid;
  v_is_platform_admin boolean;
  v_is_tenant_admin boolean;
  v_quote_id uuid;
  v_quote_row record;
  v_results jsonb := '[]'::jsonb;
  v_requested_count integer := 0;
  v_hard_deleted_count integer := 0;
  v_soft_deleted_count integer := 0;
  v_failed_count integer := 0;
  v_inventory_released_count integer := 0;
  v_approvals_cancelled_count integer := 0;
  v_cache_cleaned boolean := false;
  v_should_soft_delete boolean;
  v_has_booking boolean;
  v_failure_entry jsonb;
  v_reason text;
  v_impacted_tenants uuid[] := '{}'::uuid[];
  v_tenant_id uuid;
  v_tenant_stats jsonb;
  v_stats jsonb := '[]'::jsonb;
  v_tmp_count integer := 0;
  v_serial_has_reserved_quote_col boolean := false;
  v_serial_has_reserved_at_col boolean := false;
  v_table_name text;
BEGIN
  v_user_id := auth.uid();
  v_user_tenant_id := get_user_tenant_id(v_user_id);
  v_is_platform_admin := is_platform_admin(v_user_id);
  v_is_tenant_admin := has_role(v_user_id, 'tenant_admin');
  v_reason := NULLIF(trim(COALESCE(p_reason, '')), '');

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Authentication required',
      'atomic_rolled_back', p_atomic,
      'summary', jsonb_build_object(
        'requested', 0,
        'processed', 0,
        'hard_deleted', 0,
        'soft_deleted', 0,
        'failed', 0,
        'inventory_released', 0,
        'approvals_cancelled', 0
      ),
      'results', '[]'::jsonb,
      'stats', '[]'::jsonb
    );
  END IF;

  IF NOT (v_is_platform_admin OR v_is_tenant_admin) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Insufficient permissions for quote deletion',
      'atomic_rolled_back', p_atomic,
      'summary', jsonb_build_object(
        'requested', 0,
        'processed', 0,
        'hard_deleted', 0,
        'soft_deleted', 0,
        'failed', 0,
        'inventory_released', 0,
        'approvals_cancelled', 0
      ),
      'results', '[]'::jsonb,
      'stats', '[]'::jsonb
    );
  END IF;

  FOR v_quote_id IN
    SELECT DISTINCT qid
    FROM unnest(COALESCE(p_quote_ids, '{}'::uuid[])) AS qid
    WHERE qid IS NOT NULL
  LOOP
    v_requested_count := v_requested_count + 1;
  END LOOP;

  IF v_requested_count = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'message', 'No quotes selected',
      'atomic_rolled_back', false,
      'summary', jsonb_build_object(
        'requested', 0,
        'processed', 0,
        'hard_deleted', 0,
        'soft_deleted', 0,
        'failed', 0,
        'inventory_released', 0,
        'approvals_cancelled', 0
      ),
      'results', '[]'::jsonb,
      'stats', '[]'::jsonb
    );
  END IF;

  IF p_atomic THEN
    FOR v_quote_id IN
      SELECT DISTINCT qid
      FROM unnest(COALESCE(p_quote_ids, '{}'::uuid[])) AS qid
      WHERE qid IS NOT NULL
    LOOP
      SELECT id, tenant_id, quote_number, status
      INTO v_quote_row
      FROM public.quotes
      WHERE id = v_quote_id;

      IF v_quote_row.id IS NULL THEN
        v_failure_entry := jsonb_build_object(
          'quote_id', v_quote_id,
          'success', false,
          'action', 'none',
          'error', 'Quote not found'
        );
        v_results := v_results || jsonb_build_array(v_failure_entry);
        v_failed_count := v_failed_count + 1;
        CONTINUE;
      END IF;

      IF NOT v_is_platform_admin AND v_quote_row.tenant_id IS DISTINCT FROM v_user_tenant_id THEN
        v_failure_entry := jsonb_build_object(
          'quote_id', v_quote_id,
          'quote_number', v_quote_row.quote_number,
          'success', false,
          'action', 'none',
          'error', 'Quote is outside user tenant scope'
        );
        v_results := v_results || jsonb_build_array(v_failure_entry);
        v_failed_count := v_failed_count + 1;
        CONTINUE;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
        SELECT EXISTS (
          SELECT 1 FROM public.bookings b WHERE b.quote_id = v_quote_id LIMIT 1
        )
        INTO v_has_booking;
      ELSE
        v_has_booking := false;
      END IF;

      IF p_force_hard_delete AND v_has_booking THEN
        v_failure_entry := jsonb_build_object(
          'quote_id', v_quote_id,
          'quote_number', v_quote_row.quote_number,
          'success', false,
          'action', 'none',
          'error', 'Quote has booking references and cannot be hard-deleted'
        );
        v_results := v_results || jsonb_build_array(v_failure_entry);
        v_failed_count := v_failed_count + 1;
      END IF;
    END LOOP;

    IF v_failed_count > 0 THEN
      IF to_regclass('public.quote_audit_logs') IS NOT NULL THEN
        INSERT INTO public.quote_audit_logs (
          user_id,
          action,
          payload,
          result_summary,
          created_at
        ) VALUES (
          v_user_id,
          'quotes.delete.atomic_rejected',
          jsonb_build_object(
            'reason', v_reason,
            'requested_quote_ids', p_quote_ids,
            'force_hard_delete', p_force_hard_delete,
            'atomic', p_atomic
          ),
          jsonb_build_object(
            'ok', false,
            'failed', v_failed_count,
            'results', v_results
          ),
          now()
        );
      END IF;

      RETURN jsonb_build_object(
        'ok', false,
        'message', 'Deletion aborted due to pre-validation failures',
        'atomic_rolled_back', true,
        'summary', jsonb_build_object(
          'requested', v_requested_count,
          'processed', 0,
          'hard_deleted', 0,
          'soft_deleted', 0,
          'failed', v_failed_count,
          'inventory_released', 0,
          'approvals_cancelled', 0
        ),
        'results', v_results,
        'stats', '[]'::jsonb
      );
    END IF;

    v_results := '[]'::jsonb;
    v_failed_count := 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'serial_numbers'
      AND column_name = 'reserved_for_quote_id'
  ) THEN
    v_serial_has_reserved_quote_col := true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'serial_numbers'
      AND column_name = 'reservation_expires_at'
  ) THEN
    v_serial_has_reserved_at_col := true;
  END IF;

  FOR v_quote_id IN
    SELECT DISTINCT qid
    FROM unnest(COALESCE(p_quote_ids, '{}'::uuid[])) AS qid
    WHERE qid IS NOT NULL
  LOOP
    SELECT id, tenant_id, quote_number, status
    INTO v_quote_row
    FROM public.quotes
    WHERE id = v_quote_id
    FOR UPDATE;

    IF v_quote_row.id IS NULL THEN
      v_failure_entry := jsonb_build_object(
        'quote_id', v_quote_id,
        'success', false,
        'action', 'none',
        'error', 'Quote not found'
      );
      v_results := v_results || jsonb_build_array(v_failure_entry);
      v_failed_count := v_failed_count + 1;
      CONTINUE;
    END IF;

    IF NOT v_is_platform_admin AND v_quote_row.tenant_id IS DISTINCT FROM v_user_tenant_id THEN
      v_failure_entry := jsonb_build_object(
        'quote_id', v_quote_id,
        'quote_number', v_quote_row.quote_number,
        'success', false,
        'action', 'none',
        'error', 'Quote is outside user tenant scope'
      );
      v_results := v_results || jsonb_build_array(v_failure_entry);
      v_failed_count := v_failed_count + 1;
      CONTINUE;
    END IF;

    IF array_position(v_impacted_tenants, v_quote_row.tenant_id) IS NULL THEN
      v_impacted_tenants := array_append(v_impacted_tenants, v_quote_row.tenant_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
      SELECT EXISTS (
        SELECT 1 FROM public.bookings b WHERE b.quote_id = v_quote_id LIMIT 1
      )
      INTO v_has_booking;
    ELSE
      v_has_booking := false;
    END IF;

    v_should_soft_delete := (NOT p_force_hard_delete) AND (
      v_has_booking OR COALESCE(v_quote_row.status::text, '') IN ('approved', 'sent', 'customer_reviewing', 'accepted')
    );

    IF v_should_soft_delete THEN
      UPDATE public.quotes
      SET
        rejected_at = COALESCE(rejected_at, now()),
        updated_at = now()
      WHERE id = v_quote_id;

      IF to_regclass('public.quote_approvals') IS NOT NULL THEN
        UPDATE public.quote_approvals
        SET
          status = 'cancelled',
          approval_notes = COALESCE(approval_notes, '') || CASE WHEN COALESCE(approval_notes, '') = '' THEN '' ELSE ' | ' END || 'Cancelled during quote soft-delete',
          updated_at = now()
        WHERE quote_id = v_quote_id
          AND status = 'pending';
        GET DIAGNOSTICS v_tmp_count = ROW_COUNT;
        v_approvals_cancelled_count := v_approvals_cancelled_count + COALESCE(v_tmp_count, 0);
      END IF;

      IF to_regclass('public.quote_shares') IS NOT NULL THEN
        UPDATE public.quote_shares
        SET
          is_active = false
        WHERE quote_id = v_quote_id
          AND is_active = true;
      END IF;

      v_soft_deleted_count := v_soft_deleted_count + 1;

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'quote_id', v_quote_id,
          'quote_number', v_quote_row.quote_number,
          'success', true,
          'action', 'soft_deleted',
          'status_before', v_quote_row.status::text,
          'status_after', v_quote_row.status::text,
          'reason', COALESCE(v_reason, 'Soft-deleted by rule')
        )
      );
    ELSE
      UPDATE public.opportunities
      SET primary_quote_id = NULL
      WHERE primary_quote_id = v_quote_id;

      IF to_regclass('public.quote_charges') IS NOT NULL THEN
        DELETE FROM public.quote_charges
        WHERE quote_option_id IN (
          SELECT qvo.id
          FROM public.quotation_version_options qvo
          JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
          WHERE qv.quote_id = v_quote_id
        );
      END IF;

      IF to_regclass('public.quotation_version_option_legs') IS NOT NULL THEN
        DELETE FROM public.quotation_version_option_legs
        WHERE quotation_version_option_id IN (
          SELECT qvo.id
          FROM public.quotation_version_options qvo
          JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
          WHERE qv.quote_id = v_quote_id
        );
      END IF;

      IF to_regclass('public.quote_legs') IS NOT NULL THEN
        DELETE FROM public.quote_legs
        WHERE quote_option_id IN (
          SELECT qvo.id
          FROM public.quotation_version_options qvo
          JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
          WHERE qv.quote_id = v_quote_id
        );
      END IF;

      IF to_regclass('public.quotation_version_options') IS NOT NULL THEN
        DELETE FROM public.quotation_version_options
        WHERE quotation_version_id IN (
          SELECT id FROM public.quotation_versions WHERE quote_id = v_quote_id
        );
      END IF;

      IF to_regclass('public.quotation_versions') IS NOT NULL THEN
        DELETE FROM public.quotation_versions
        WHERE quote_id = v_quote_id;
      END IF;

      FOREACH v_table_name IN ARRAY ARRAY[
        'quote_items',
        'quote_items_core',
        'customer_selections',
        'quote_events',
        'quote_comments',
        'quote_documents',
        'quote_email_history',
        'quote_access_logs',
        'quote_shares',
        'quote_approvals',
        'quote_contacts_screening',
        'portal_tokens',
        'compliance_checks',
        'documents',
        'quote_audits'
      ]
      LOOP
        IF to_regclass('public.' || v_table_name) IS NOT NULL THEN
          EXECUTE format('DELETE FROM public.%I WHERE quote_id = $1', v_table_name) USING v_quote_id;
        END IF;
      END LOOP;

      DELETE FROM public.quotes
      WHERE id = v_quote_id;

      v_hard_deleted_count := v_hard_deleted_count + 1;

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'quote_id', v_quote_id,
          'quote_number', v_quote_row.quote_number,
          'success', true,
          'action', 'hard_deleted',
          'status_before', v_quote_row.status::text,
          'reason', COALESCE(v_reason, 'Hard-deleted by rule')
        )
      );
    END IF;

    IF to_regclass('public.inventory_reservations') IS NOT NULL THEN
      DELETE FROM public.inventory_reservations
      WHERE quote_id = v_quote_id;
      GET DIAGNOSTICS v_tmp_count = ROW_COUNT;
      v_inventory_released_count := v_inventory_released_count + COALESCE(v_tmp_count, 0);
    END IF;

    IF to_regclass('public.serial_number_reservations') IS NOT NULL THEN
      DELETE FROM public.serial_number_reservations
      WHERE quote_id = v_quote_id;
      GET DIAGNOSTICS v_tmp_count = ROW_COUNT;
      v_inventory_released_count := v_inventory_released_count + COALESCE(v_tmp_count, 0);
    END IF;

    IF v_serial_has_reserved_quote_col THEN
      IF v_serial_has_reserved_at_col THEN
        UPDATE public.serial_numbers
        SET
          reserved_for_quote_id = NULL,
          reservation_expires_at = NULL
        WHERE reserved_for_quote_id = v_quote_id;
      ELSE
        UPDATE public.serial_numbers
        SET
          reserved_for_quote_id = NULL
        WHERE reserved_for_quote_id = v_quote_id;
      END IF;
      GET DIAGNOSTICS v_tmp_count = ROW_COUNT;
      v_inventory_released_count := v_inventory_released_count + COALESCE(v_tmp_count, 0);
    END IF;

    IF to_regclass('public.quote_audit_logs') IS NOT NULL THEN
      INSERT INTO public.quote_audit_logs (
        user_id,
        action,
        payload,
        result_summary,
        created_at
      ) VALUES (
        v_user_id,
        'quotes.delete',
        jsonb_build_object(
          'quote_id', v_quote_id,
          'quote_number', v_quote_row.quote_number,
          'tenant_id', v_quote_row.tenant_id,
          'reason', v_reason,
          'force_hard_delete', p_force_hard_delete,
          'atomic', p_atomic
        ),
        (v_results -> (jsonb_array_length(v_results) - 1)),
        now()
      );
    END IF;
  END LOOP;

  IF to_regclass('public.ai_quote_cache') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'clean_expired_ai_cache'
    ) THEN
      PERFORM public.clean_expired_ai_cache();
      v_cache_cleaned := true;
    END IF;
  END IF;

  FOREACH v_tenant_id IN ARRAY v_impacted_tenants LOOP
    SELECT COALESCE(jsonb_object_agg(s.status, s.count), '{}'::jsonb)
    INTO v_tenant_stats
    FROM (
      SELECT status, COUNT(*)::int AS count
      FROM public.quotes
      WHERE tenant_id = v_tenant_id
      GROUP BY status
    ) s;

    v_stats := v_stats || jsonb_build_array(
      jsonb_build_object(
        'tenant_id', v_tenant_id,
        'status_counts', COALESCE(v_tenant_stats, '{}'::jsonb)
      )
    );
  END LOOP;

  PERFORM pg_notify(
    'quote_stats_refresh',
    jsonb_build_object(
      'tenant_ids', v_impacted_tenants,
      'requested', v_requested_count,
      'hard_deleted', v_hard_deleted_count,
      'soft_deleted', v_soft_deleted_count
    )::text
  );

  RETURN jsonb_build_object(
    'ok', v_failed_count = 0,
    'message', CASE WHEN v_failed_count = 0 THEN 'Quotes processed successfully' ELSE 'Some quotes failed to process' END,
    'atomic_rolled_back', false,
    'summary', jsonb_build_object(
      'requested', v_requested_count,
      'processed', v_hard_deleted_count + v_soft_deleted_count,
      'hard_deleted', v_hard_deleted_count,
      'soft_deleted', v_soft_deleted_count,
      'failed', v_failed_count,
      'inventory_released', v_inventory_released_count,
      'approvals_cancelled', v_approvals_cancelled_count,
      'cache_cleaned', v_cache_cleaned
    ),
    'results', v_results,
    'stats', v_stats
  );
END;
$$;
