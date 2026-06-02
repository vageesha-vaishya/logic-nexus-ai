-- LLM Gateway P4.2 — seed the first real prompt.
-- compliance.screening.hit_reasoning is the prompt registered as the
-- first wave's demo (per design doc §7.2 first-wave list). Wiring it
-- into the compliance officer UI is the next slice; this migration
-- just makes the prompt resolvable so /v1/invoke calls succeed.
--
-- Idempotent: re-applies skip via the ON CONFLICT in upsert_prompt_version
-- (well — actually upsert always creates a new version. So this migration
-- runs once. Re-running creates v2/v3/etc which is fine; the active
-- version stays the most-recently-promoted one).
--
-- DO block guards re-apply: only inserts if no version exists for the key.

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions WHERE prompt_key = 'compliance.screening.hit_reasoning';
  IF v_count > 0 THEN
    RAISE NOTICE 'compliance.screening.hit_reasoning already registered (% version(s)); skipping seed', v_count;
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'compliance.screening.hit_reasoning',
    'compliance',
    'screening.hit_reasoning',
    $body$
You are a sanctions-compliance officer reviewing a denied-party screening hit.

The screening engine flagged the following party against restricted-party
lists. Decide whether each hit is a true positive or false positive, and
explain your reasoning concisely. Respond with valid JSON matching the
schema below.

Party under review:
  - name:    {{party.name}}
  - country: {{party.country}}
  - aliases: {{party.aliases}}

Hits returned ({{hits | json}}):

Respond with JSON:
{
  "verdict":    "true_positive" | "false_positive" | "uncertain",
  "confidence": 0.0-1.0,
  "reasoning":  "<= 500 chars, plain text"
}
$body$,
    'Explain why a denied-party screening hit matched. Used by the compliance officer UI.',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'party',  jsonb_build_object('required', jsonb_build_array('name','country')),
        'hits',   jsonb_build_object('type', 'array')
      ),
      'tags',   jsonb_build_array('compliance','screening','advisory')
    ),
    -- input_schema
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('party','hits'),
      'properties', jsonb_build_object(
        'party', jsonb_build_object('type','object','required', jsonb_build_array('name','country')),
        'hits',  jsonb_build_object('type','array')
      )
    ),
    -- output_schema (JSON Schema for the structured response)
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('verdict','confidence','reasoning'),
      'properties', jsonb_build_object(
        'verdict',    jsonb_build_object('enum', jsonb_build_array('true_positive','false_positive','uncertain')),
        'confidence', jsonb_build_object('type','number','minimum',0,'maximum',1),
        'reasoning',  jsonb_build_object('type','string','maxLength',500)
      )
    ),
    'reasoning-high',  -- default_capability
    0.0,               -- default_temperature: deterministic for compliance work
    800,               -- default_max_tokens
    0,                 -- cache_ttl_seconds: no caching for compliance decisions
    'restricted',      -- safety_class
    'git',
    NULL,
    true               -- promote_active
  );

  RAISE NOTICE 'seeded compliance.screening.hit_reasoning';
END $$;
