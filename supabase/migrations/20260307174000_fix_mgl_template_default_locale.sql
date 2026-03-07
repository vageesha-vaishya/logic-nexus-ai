DO $$
DECLARE
  v_names text[] := ARRAY[
    'MGL Standard Granular',
    'MGL FCL Quote',
    'MGL Granular Quote',
    'MGL-Main-Template'
  ];
BEGIN
  UPDATE public.quote_templates qt
  SET content = jsonb_set(
    jsonb_set(
      jsonb_set(
        CASE
          WHEN jsonb_typeof(qt.content) = 'object' THEN qt.content
          ELSE '{}'::jsonb
        END,
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
  WHERE COALESCE(qt.template_name, qt.name) = ANY (v_names);
END $$;
