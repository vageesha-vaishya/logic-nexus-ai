-- Seed work packages for Deccan tenant / Deccan Test franchise.
-- Uses existing aircraft records for the tenant.

DO $$
DECLARE
  v_tenant_id uuid := 'e42ec6fd-6b88-4721-befe-4443d9743120';
  v_franchise_id uuid;
  v_aircraft_id uuid;
  v_aircraft_id2 uuid;
BEGIN
  -- Resolve or create Deccan Test Franchise
  SELECT f.id INTO v_franchise_id
  FROM public.franchises f
  WHERE f.tenant_id = v_tenant_id
    AND (lower(f.name) = 'deccan test franchise' OR lower(coalesce(f.code, '')) IN ('deccan-test-franchise', 'deccan_test_franchise', 'deccan-test', 'deccan'))
  ORDER BY f.created_at ASC
  LIMIT 1;

  IF v_franchise_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'code') THEN
      INSERT INTO public.franchises (tenant_id, name, code, address, is_active)
      VALUES (v_tenant_id, 'Deccan Test Franchise', 'DECCAN-TEST-FRANCHISE', '{}'::jsonb, true)
      RETURNING id INTO v_franchise_id;
    ELSE
      INSERT INTO public.franchises (tenant_id, name, address, is_active)
      VALUES (v_tenant_id, 'Deccan Test Franchise', '{}'::jsonb, true)
      RETURNING id INTO v_franchise_id;
    END IF;
  END IF;

  -- Resolve two aircraft for the tenant
  SELECT a.id INTO v_aircraft_id
  FROM public.aircraft a
  WHERE a.tenant_id = v_tenant_id
  ORDER BY a.created_at ASC
  LIMIT 1;

  -- If second aircraft is same as first, try to find a different one
  SELECT a.id INTO v_aircraft_id2
  FROM public.aircraft a
  WHERE a.tenant_id = v_tenant_id
    AND a.id != COALESCE(v_aircraft_id, '00000000-0000-0000-0000-000000000000')
  ORDER BY a.created_at DESC
  LIMIT 1;

  -- Fallback: if only one aircraft exists, use it for both
  IF v_aircraft_id2 IS NULL THEN
    v_aircraft_id2 := v_aircraft_id;
  END IF;

  IF v_aircraft_id IS NULL THEN
    RAISE EXCEPTION 'No aircraft found for Deccan tenant %', v_tenant_id;
  END IF;

  -- Seed work packages
  INSERT INTO public.work_orders (
    tenant_id, franchise_id, aircraft_id,
    work_order_number, work_order_number, title, description,
    work_type, maintenance_type, priority,
    source, planned_start_date, planned_end_date,
    estimated_labor_hours, estimated_cost,
    status, assigned_to, notes
  ) VALUES
    -- 1: Line maintenance (scheduled)
    (v_tenant_id, v_franchise_id, v_aircraft_id,
     'WP-20260411-SEED01', 'WP-20260411-SEED01',
     'A-Check Inspection',
     'Scheduled A-Check per manufacturer schedule',
     'line', 'line', 2,
     'schedule_due', now() + interval '3 days', now() + interval '5 days',
     40.0, 15000.00,
     'scheduled', NULL, 'Requires hangar space'),

    -- 2: Base maintenance (in progress)
    (v_tenant_id, v_franchise_id, v_aircraft_id,
     'WP-20260411-SEED02', 'WP-20260411-SEED02',
     'Engine Overhaul - CFM56',
     'Complete engine overhaul per MPD task',
     'overhaul', 'base', 1,
     'campaign', now() - interval '2 days', now() + interval '10 days',
     120.0, 85000.00,
     'in_progress', NULL, 'Critical path item'),

    -- 3: Component inspection (planning)
    (v_tenant_id, v_franchise_id, v_aircraft_id2,
     'WP-20260411-SEED03', 'WP-20260411-SEED03',
     'Landing Gear Inspection',
     '6-month landing gear inspection',
     'inspection', 'component', 3,
     'schedule_due', now() + interval '7 days', now() + interval '8 days',
     16.0, 8500.00,
     'planning', NULL, ''),

    -- 4: Repair (on hold)
    (v_tenant_id, v_franchise_id, v_aircraft_id2,
     'WP-20260411-SEED04', 'WP-20260411-SEED04',
     'APU Repair',
     'APU fault - EGT exceedance investigation',
     'repair', 'base', 1,
     'defect', now() - interval '5 days', now() + interval '15 days',
     60.0, 45000.00,
     'on_hold', NULL, 'Awaiting parts delivery'),

    -- 5: Upgrade (approved)
    (v_tenant_id, v_franchise_id, v_aircraft_id,
     'WP-20260411-SEED05', 'WP-20260411-SEED05',
     'WiFi System Upgrade',
     'Install next-gen WiFi system per SB',
     'upgrade', 'modification', 4,
     'campaign', now() + interval '14 days', now() + interval '16 days',
     24.0, 35000.00,
     'approved', NULL, 'Parts on order'),

    -- 6: Completed line maintenance
    (v_tenant_id, v_franchise_id, v_aircraft_id2,
     'WP-20260411-SEED06', 'WP-20260411-SEED06',
     'Pre-Flight Inspection',
     'Routine pre-flight inspection',
     'line', 'line', 5,
     'schedule_due', now() - interval '1 day', now() - interval '1 day',
     2.0, 500.00,
     'completed', NULL, 'Completed without findings'),

    -- 7: Cancelled work order
    (v_tenant_id, v_franchise_id, v_aircraft_id,
     'WP-20260411-SEED07', 'WP-20260411-SEED07',
     'Cabin Refurbishment - Deferred',
     'Cabin interior refurbishment - deferred to next C-Check',
     'repair', 'base', 3,
     'defect', now() + interval '30 days', now() + interval '35 days',
     200.0, 150000.00,
     'cancelled', NULL, 'Deferred to next C-Check window'),

    -- 8: Closed work order
    (v_tenant_id, v_franchise_id, v_aircraft_id2,
     'WP-20260411-SEED08', 'WP-20260411-SEED08',
     'Annual Airworthiness Review',
     'ARC renewal - all ADs/SBs reviewed',
     'inspection', 'line', 2,
     'schedule_due', now() - interval '10 days', now() - interval '7 days',
     80.0, 25000.00,
     'closed', NULL, 'ARC renewed, valid until 2027-04-11')
  ;

  -- Seed tasks for the in-progress engine overhaul (SEED02)
  INSERT INTO public.tasks (
    tenant_id, franchise_id, work_order_id,
    task_number, title, description,
    task_category, estimated_duration_hours, complexity_level,
    sequence_order, status, progress_percentage, notes
  )
  SELECT
    v_tenant_id, v_franchise_id, wp.id,
    v.task_number, v.title, v.description,
    v.task_category, v.estimated_duration_hours, v.complexity_level,
    v.sequence_order, v.status, v.progress_percentage, v.notes
  FROM public.work_orders wp
  CROSS JOIN (VALUES
    ('T-001', 'Engine Removal', 'Remove engine from pylon', 'mechanical', 8.0, 3, 1, 'completed', 100, 'Completed successfully'),
    ('T-002', 'Engine Strip Down', 'Disassemble engine modules', 'mechanical', 12.0, 3, 2, 'completed', 100, ''),
    ('T-003', 'Borescope Inspection', 'Inspect HPT blades and vanes', 'inspection', 4.0, 2, 3, 'in_progress', 60, 'Awaiting NDT results'),
    ('T-004', 'Module Replacement', 'Replace HPT module', 'mechanical', 6.0, 3, 4, 'pending', 0, 'Parts received'),
    ('T-005', 'Engine Build-Up', 'Reassemble engine', 'mechanical', 16.0, 3, 5, 'pending', 0, ''),
    ('T-006', 'Engine Installation', 'Install engine on pylon', 'mechanical', 8.0, 3, 6, 'pending', 0, ''),
    ('T-007', 'Engine Run-Up', 'Engine test run', 'test', 4.0, 3, 7, 'pending', 0, '')
  ) AS v(task_number, title, description, task_category, estimated_duration_hours, complexity_level, sequence_order, status, progress_percentage, notes)
  WHERE wp.work_order_number = 'WP-20260411-SEED02';

  -- Seed materials for SEED02
  INSERT INTO public.work_order_materials (
    tenant_id, franchise_id, work_order_id,
    part_number, description, manufacturer,
    action, quantity, unit_cost, total_cost,
    status, supplier_name, is_critical
  )
  SELECT
    v_tenant_id, v_franchise_id, wp.id,
    v.part_number, v.description, v.manufacturer,
    v.action, v.quantity, v.unit_cost, v.total_cost,
    v.status, v.supplier_name, v.is_critical
  FROM public.work_orders wp
  CROSS JOIN (VALUES
    ('HPT-BLADE-001', 'HPT Blade Set', 'CFM International', 'install', 4, 12500.00, 50000.00, 'received', 'CFM Direct', true),
    ('SEAL-KIT-CFM56', 'Seal Kit CFM56-5B', 'Safran', 'install', 2, 3500.00, 7000.00, 'received', 'Safran Supply', true),
    ('OIL-FILTER-001', 'Oil Filter Element', 'Parker Hannifin', 'install', 4, 450.00, 1800.00, 'ordered', 'Aviation Parts Co', false),
    ('BEARING-ASSY-003', 'Bearing Assembly', 'SKF Aerospace', 'install', 2, 8500.00, 17000.00, 'pending', 'SKF Direct', true)
  ) AS v(part_number, description, manufacturer, action, quantity, unit_cost, total_cost, status, supplier_name, is_critical)
  WHERE wp.work_order_number = 'WP-20260411-SEED02';

  -- Maintenance events are audit entries generated during actual operations.
  -- They require valid user UUIDs for performed_by/approved_by, so we skip
  -- seeding them here. They will be created naturally when users interact with
  -- work packages through the UI.

  RAISE NOTICE 'Work packages seeded for Deccan tenant, Deccan Test Franchise';
END $$;
