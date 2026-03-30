BEGIN;

UPDATE public.aircraft AS a
SET
  engine_install_history = COALESCE(
    NULLIF(a.engine_install_history, '[]'::jsonb),
    jsonb_build_array(
      jsonb_build_object(
        'engine_serial_number', COALESCE(NULLIF(a.serial_number, ''), format('ENG-%s', substring(replace(a.id::text, '-', '') from 1 for 8))),
        'engine_position', 'A',
        'installed_at', to_char(COALESCE(a.created_at, now())::date, 'YYYY-MM-DD'),
        'removed_at', NULL
      )
    )
  ),
  thrust_rating_change_log = COALESCE(
    NULLIF(a.thrust_rating_change_log, '[]'::jsonb),
    jsonb_build_array(
      jsonb_build_object(
        'engine_serial_number', COALESCE(NULLIF(a.serial_number, ''), format('ENG-%s', substring(replace(a.id::text, '-', '') from 1 for 8))),
        'rated_thrust', CASE WHEN a.aircraft_type ILIKE '%wide%' THEN 69000 ELSE 27400 END,
        'derate_mode', 'CLB1',
        'authority_basis', 'SEED-BASELINE',
        'effective_from', to_char(COALESCE(a.created_at, now())::date, 'YYYY-MM-DD')
      )
    )
  ),
  on_wing_lifecycle_records = COALESCE(
    NULLIF(a.on_wing_lifecycle_records, '[]'::jsonb),
    jsonb_build_array(
      jsonb_build_object(
        'engine_serial_number', COALESCE(NULLIF(a.serial_number, ''), format('ENG-%s', substring(replace(a.id::text, '-', '') from 1 for 8))),
        'event_type', 'install',
        'event_at', to_char(COALESCE(a.created_at, now())::date, 'YYYY-MM-DD'),
        'event_status', 'completed',
        'flight_hours_at_event', COALESCE(a.current_flight_hours, 0),
        'cycles_at_event', COALESCE(a.current_cycles, 0)
      )
    )
  ),
  updated_at = now()
WHERE
  a.deleted_at IS NULL
  AND (
    a.engine_install_history = '[]'::jsonb
    OR a.thrust_rating_change_log = '[]'::jsonb
    OR a.on_wing_lifecycle_records = '[]'::jsonb
  );

COMMIT;
