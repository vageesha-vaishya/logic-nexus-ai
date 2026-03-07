DO $$
DECLARE
  v_names text[] := ARRAY[
    'MGL Standard Granular',
    'MGL FCL Quote',
    'MGL Granular Quote',
    'MGL-Main-Template'
  ];
  v_tenant uuid;
BEGIN
  SELECT id INTO v_tenant
  FROM public.tenants
  WHERE name ILIKE '%Miami Global Lines%'
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE NOTICE 'Tenant not found for Miami Global Lines';
    RETURN;
  END IF;

  UPDATE public.quote_templates qt
  SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          CASE
            WHEN jsonb_typeof(qt.content) = 'object' THEN qt.content
            ELSE '{}'::jsonb
          END,
          '{config}',
          COALESCE(qt.content->'config', '{}'::jsonb),
          true
        ),
        '{config,margins}',
        COALESCE(
          CASE
            WHEN jsonb_typeof(qt.content->'config'->'margins') = 'object' THEN qt.content->'config'->'margins'
            ELSE NULL
          END,
          '{"top":40,"bottom":40,"left":40,"right":40}'::jsonb
        ),
        true
      ),
      '{config,page_size}',
      COALESCE(qt.content->'config'->'page_size', '"A4"'::jsonb),
      true
    ),
    '{config,default_locale}',
    COALESCE(qt.content->'config'->'default_locale', '"en-US"'::jsonb),
    true
  )
  WHERE COALESCE(qt.template_name, qt.name) = ANY (v_names)
    AND qt.tenant_id = v_tenant;
END $$;
