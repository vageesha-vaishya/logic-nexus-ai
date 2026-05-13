BEGIN;

DO $$
DECLARE
  t RECORD;
  tenant_key text;
  selected_franchise_id uuid;
  policy_key_value text;
  policy_snapshot_id uuid;
  tenant_query text;
  has_tenant_domain_assignments boolean;
  has_subscription_status boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tenant_domain_assignments'
  )
  INTO has_tenant_domain_assignments;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_domain_assignments'
      AND column_name = 'subscription_status'
  )
  INTO has_subscription_status;

  IF has_tenant_domain_assignments THEN
    tenant_query := '
      SELECT DISTINCT t.id
      FROM public.tenants t
      JOIN public.tenant_domain_assignments tda
        ON tda.tenant_id = t.id
       AND tda.is_active = true
      JOIN public.platform_domains pd
        ON pd.id = tda.domain_id
       AND pd.code = ''amro''
       AND pd.is_active = true';
    IF has_subscription_status THEN
      tenant_query := tenant_query || '
       AND COALESCE(tda.subscription_status, ''active'') IN (''active'', ''trialing'', ''grace_period'')';
    END IF;
  ELSE
    tenant_query := 'SELECT id FROM public.tenants';
  END IF;

  FOR t IN EXECUTE tenant_query LOOP
    tenant_key := upper(substring(replace(t.id::text, '-', '') from 1 for 6));
    SELECT f.id
    INTO selected_franchise_id
    FROM public.franchises f
    WHERE f.tenant_id = t.id
    ORDER BY f.created_at ASC NULLS LAST, f.id ASC
    LIMIT 1;

    policy_key_value := format('AMRO-SEED-%s-POLICY-V1', tenant_key);

    INSERT INTO public.policy_snapshots (
      tenant_id,
      franchise_id,
      policy_type,
      version,
      policy_key,
      rules_json,
      effective_at,
      checksum
    )
    SELECT
      t.id,
      selected_franchise_id,
      'regulatory_compliance',
      1,
      policy_key_value,
      jsonb_build_object(
        'authority_profiles', jsonb_build_array('FAA', 'EASA', 'CAAC'),
        'release_gate_rules', jsonb_build_array(
          jsonb_build_object('code', 'AIRWORTHINESS_SIGNOFF', 'required', true),
          jsonb_build_object('code', 'MANDATORY_AD_NOT_OVERDUE', 'required', true)
        ),
        'shift_capacity_threshold_pct', 85
      ),
      now() - interval '30 days',
      md5(format('%s:%s:%s', t.id::text, COALESCE(selected_franchise_id::text, ''), policy_key_value))
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.policy_snapshots ps
      WHERE ps.tenant_id = t.id
        AND COALESCE(ps.franchise_id, '00000000-0000-0000-0000-000000000000'::uuid) =
            COALESCE(selected_franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND ps.policy_key = policy_key_value
    );

    SELECT ps.id
    INTO policy_snapshot_id
    FROM public.policy_snapshots ps
    WHERE ps.tenant_id = t.id
      AND COALESCE(ps.franchise_id, '00000000-0000-0000-0000-000000000000'::uuid) =
          COALESCE(selected_franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND ps.policy_key = policy_key_value
    ORDER BY ps.version DESC, ps.created_at DESC
    LIMIT 1;

    INSERT INTO public.regulator_profiles (
      tenant_id,
      franchise_id,
      regulator_code,
      regulator_name,
      jurisdiction,
      policy_version,
      effective_from,
      effective_to,
      is_active,
      metadata
    )
    SELECT
      t.id,
      selected_franchise_id,
      rp.regulator_code,
      rp.regulator_name,
      rp.jurisdiction,
      rp.policy_version,
      rp.effective_from,
      rp.effective_to,
      rp.is_active,
      rp.metadata
    FROM (
      VALUES
        (
          'FAA',
          'Federal Aviation Administration',
          'US',
          '2026.1',
          (CURRENT_DATE - 120),
          NULL::date,
          true,
          jsonb_build_object('authority_scope', 'airworthiness', 'priority', 'high', 'source', 'amro_seed_pack')
        ),
        (
          'EASA',
          'European Union Aviation Safety Agency',
          'EU',
          '2026.2',
          (CURRENT_DATE - 90),
          NULL::date,
          true,
          jsonb_build_object('authority_scope', 'continuing_airworthiness', 'priority', 'high', 'source', 'amro_seed_pack')
        ),
        (
          'DGCA',
          'Directorate General of Civil Aviation',
          'IN',
          '2025.4',
          (CURRENT_DATE - 240),
          (CURRENT_DATE - 1),
          false,
          jsonb_build_object('authority_scope', 'historical_policy', 'priority', 'medium', 'source', 'amro_seed_pack')
        ),
        (
          'CAAC',
          'Civil Aviation Administration of China',
          'CN',
          '2026.1',
          (CURRENT_DATE - 60),
          NULL::date,
          true,
          jsonb_build_object('authority_scope', 'airworthiness', 'priority', 'high', 'source', 'amro_seed_pack')
        )
    ) AS rp(regulator_code, regulator_name, jurisdiction, policy_version, effective_from, effective_to, is_active, metadata)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.regulator_profiles existing
      WHERE existing.tenant_id = t.id
        AND COALESCE(existing.franchise_id, '00000000-0000-0000-0000-000000000000'::uuid) =
            COALESCE(selected_franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND existing.regulator_code = rp.regulator_code
        AND existing.policy_version = rp.policy_version
        AND existing.deleted_at IS NULL
    );

    INSERT INTO public.shift_calendars (
      tenant_id,
      franchise_id,
      station_code,
      shift_name,
      shift_start_time,
      shift_end_time,
      capacity,
      effective_from,
      effective_to,
      is_active
    )
    SELECT
      t.id,
      selected_franchise_id,
      sc.station_code,
      sc.shift_name,
      sc.shift_start_time,
      sc.shift_end_time,
      sc.capacity,
      sc.effective_from,
      sc.effective_to,
      sc.is_active
    FROM (
      VALUES
        ('DXB', 'DAY_A', '06:00:00'::time, '14:00:00'::time, 6, (CURRENT_DATE - 180), NULL::date, true),
        ('DXB', 'SWING_B', '14:00:00'::time, '22:00:00'::time, 5, (CURRENT_DATE - 180), NULL::date, true),
        ('DXB', 'NIGHT_C', '22:00:00'::time, '06:00:00'::time, 4, (CURRENT_DATE - 180), NULL::date, true),
        ('LHR', 'WEEKEND_RECOVERY', '08:00:00'::time, '20:00:00'::time, 2, (CURRENT_DATE - 60), (CURRENT_DATE + 180), true),
        ('SIN', 'LEGACY_LINE', '07:00:00'::time, '15:00:00'::time, 3, (CURRENT_DATE - 600), (CURRENT_DATE - 30), false)
    ) AS sc(station_code, shift_name, shift_start_time, shift_end_time, capacity, effective_from, effective_to, is_active)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.shift_calendars existing
      WHERE existing.tenant_id = t.id
        AND COALESCE(existing.franchise_id, '00000000-0000-0000-0000-000000000000'::uuid) =
            COALESCE(selected_franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND existing.station_code = sc.station_code
        AND existing.shift_name = sc.shift_name
        AND existing.effective_from = sc.effective_from
        AND existing.deleted_at IS NULL
    );

    INSERT INTO public.work_order_templates (
      tenant_id,
      franchise_id,
      template_code,
      version,
      active,
      template_name,
      maintenance_type,
      scope_json,
      tasks_json,
      policy_snapshot_id
    )
    SELECT
      t.id,
      selected_franchise_id,
      wpt.template_code,
      wpt.version,
      wpt.active,
      wpt.template_name,
      wpt.maintenance_type::public.maintenance_type,
      wpt.scope_json,
      wpt.tasks_json,
      policy_snapshot_id
    FROM (
      VALUES
        (
          'TMP-A320-LINE-48H',
          1,
          true,
          'A320 48H Transit Check',
          'line',
          jsonb_build_array(
            jsonb_build_object('phase', 'pre_docking', 'estimated_minutes', 45, 'station_scope', 'gate'),
            jsonb_build_object('phase', 'inspection', 'estimated_minutes', 120, 'regulators', jsonb_build_array('FAA', 'EASA')),
            jsonb_build_object('phase', 'close_out', 'estimated_minutes', 35, 'requires_authority_signoff', true)
          ),
          jsonb_build_array(
            jsonb_build_object('task_code', 'LINE-001', 'title', 'Exterior Walkaround', 'skill_codes', jsonb_build_array('LIC-B1'), 'critical', true),
            jsonb_build_object('task_code', 'LINE-014', 'title', 'Brake Wear Inspection', 'skill_codes', jsonb_build_array('LIC-B1', 'NDT-L1'), 'critical', true),
            jsonb_build_object('task_code', 'LINE-099', 'title', 'Tech Log Reconciliation', 'skill_codes', jsonb_build_array('QA-INSPECTOR'), 'critical', false)
          )
        ),
        (
          'TMP-HEAVY-CHECK-PLANNING',
          2,
          true,
          'Base Heavy Check Planning Pack',
          'base',
          jsonb_build_array(
            jsonb_build_object('phase', 'slotting', 'estimated_minutes', 90, 'depends_on', jsonb_build_array('manpower_forecast', 'dock_availability')),
            jsonb_build_object('phase', 'material_readiness', 'estimated_minutes', 240, 'requires_procurement_sync', true)
          ),
          jsonb_build_array(
            jsonb_build_object('task_code', 'BASE-010', 'title', 'Structural Inspection Program', 'skill_codes', jsonb_build_array('STRUCT-L2'), 'critical', true),
            jsonb_build_object('task_code', 'BASE-121', 'title', 'Cabin Systems Functional Tests', 'skill_codes', jsonb_build_array('AVIONICS-L2'), 'critical', false)
          )
        ),
        (
          'TMP-AOG-MIN-DISP',
          3,
          false,
          'AOG Minimum Dispatch Recovery',
          'line',
          jsonb_build_array(
            jsonb_build_object('phase', 'triage', 'estimated_minutes', 20, 'priority', 'critical'),
            jsonb_build_object('phase', 'dispatch_release', 'estimated_minutes', 30, 'requires_dual_signoff', true)
          ),
          jsonb_build_array(
            jsonb_build_object('task_code', 'AOG-001', 'title', 'Defect Isolation', 'skill_codes', jsonb_build_array('LIC-B1'), 'critical', true),
            jsonb_build_object('task_code', 'AOG-007', 'title', 'Release to Service', 'skill_codes', jsonb_build_array('CERT-RELEASE'), 'critical', true)
          )
        )
    ) AS wpt(template_code, version, active, template_name, maintenance_type, scope_json, tasks_json)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.work_order_templates existing
      WHERE existing.tenant_id = t.id
        AND COALESCE(existing.franchise_id, '00000000-0000-0000-0000-000000000000'::uuid) =
            COALESCE(selected_franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND existing.template_code = wpt.template_code
        AND existing.version = wpt.version
        AND existing.deleted_at IS NULL
    );
  END LOOP;
END;
$$;

COMMIT;
