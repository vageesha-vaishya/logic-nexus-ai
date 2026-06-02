-- LLM Gateway — seed amro.defect.photo_read prompt.
-- First production caller of the §9.4 multi-modal (vision) path.
-- Used by AmroNonScheduledTaskPanel's "Read defect from photo" button
-- to extract a structured defect description from a maintenance photo.

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'amro.defect.photo_read';
  IF v_count > 0 THEN
    RAISE NOTICE 'amro.defect.photo_read already exists; skipping';
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'amro.defect.photo_read',
    'amro',
    'defect.photo_read',
    E'You are a senior aircraft maintenance engineer reviewing a photo of\na suspected defect. The photo is attached. Use ATA-100 vocabulary when\nyou can identify the system; otherwise describe the visible defect\nplainly. Be specific about location, severity, and what the technician\nshould inspect next.\n\nContext from the technician:\n  - aircraft:        {{aircraft_id}}\n  - task_source:     {{task_source}}\n  - notes:           {{notes}}\n\nRespond with valid JSON only:\n{\n  "defect_description": "<= 400 chars; what is visible in the photo",\n  "initial_assessment": "<= 300 chars; severity + recommended next step",\n  "ata_chapter":        "<NN-NN ATA-100 code> | null if not identifiable",\n  "fault_code":         "<short MEL/CDL/manufacturer code> | null if unknown",\n  "severity":           "advisory" | "minor" | "major" | "critical",\n  "confidence":         0.0-1.0\n}',
    'Read a defect photo on a non-scheduled AMRO task and extract structured defect fields (description, assessment, ATA chapter, severity).',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'aircraft_id', jsonb_build_object('required', true),
        'task_source', jsonb_build_object('required', true)
      ),
      'tags', jsonb_build_array('amro','defect','vision','photo')
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('aircraft_id','task_source'),
      'properties', jsonb_build_object(
        'aircraft_id', jsonb_build_object('type','string','maxLength',64),
        'task_source', jsonb_build_object('type','string','maxLength',64),
        'notes',       jsonb_build_object('type','string','maxLength',2000)
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('defect_description','initial_assessment','severity','confidence'),
      'properties', jsonb_build_object(
        'defect_description', jsonb_build_object('type','string','maxLength',400),
        'initial_assessment', jsonb_build_object('type','string','maxLength',300),
        'ata_chapter',        jsonb_build_object('type',jsonb_build_array('string','null'),'pattern','^[0-9]{2}-[0-9]{2}$'),
        'fault_code',         jsonb_build_object('type',jsonb_build_array('string','null'),'maxLength',32),
        'severity',           jsonb_build_object('enum', jsonb_build_array('advisory','minor','major','critical')),
        'confidence',         jsonb_build_object('type','number','minimum',0,'maximum',1)
      )
    ),
    'chat-balanced',   -- default_capability (need vision-capable model)
    0.2,               -- default_temperature
    600,               -- default_max_tokens
    0,                 -- cache_ttl_seconds: photos are unique, never cache
    'standard',        -- safety_class
    'git',
    NULL,
    true               -- promote_active
  );

  -- The vision + json_mode requirement is supplied by the caller via
  -- the invoke request's required_capabilities field (the prompt-row
  -- schema doesn't track that). The edge function for this prompt
  -- always sends required_capabilities=['vision','json_mode'].

  RAISE NOTICE 'seeded amro.defect.photo_read';
END $$;
