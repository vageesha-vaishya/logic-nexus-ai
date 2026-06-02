-- LLM Gateway — seed remaining first-wave prompts per design §7.2.
-- compliance.screening.hit_reasoning was seeded in P4.2; this migration
-- adds the next two so future callsite slices (sales lead scoring,
-- comms inbound classification) only need the edge function + UI glue.

DO $$
DECLARE v_count int;
BEGIN
  -- ── comms.inbound.classify ──────────────────────────────────────
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'comms.inbound.classify';
  IF v_count = 0 THEN
    PERFORM gateway.upsert_prompt_version(
      'comms.inbound.classify',
      'comms',
      'inbound.classify',
      E'You are a B2B customer-service triage agent. Classify the inbound\nmessage by intent and urgency so the inbox UI can route it.\n\nMessage:\n  - from:    {{message.from}}\n  - subject: {{message.subject}}\n  - body:    {{message.body}}\n\nRespond with valid JSON:\n{\n  "intent":   "quote_request" | "shipment_status" | "complaint" | "billing_question" | "spam" | "other",\n  "urgency":  "low" | "medium" | "high" | "urgent",\n  "language": "<ISO-639-1 code>",\n  "confidence": 0.0-1.0,\n  "summary":  "<= 200 chars one-line summary"\n}',
      'Classify an inbound email/message by intent + urgency so the comms inbox can route it.',
      '{}'::jsonb,
      jsonb_build_object(
        'inputs', jsonb_build_object(
          'message', jsonb_build_object('required', jsonb_build_array('from','subject','body'))
        ),
        'tags', jsonb_build_array('comms','triage','classification')
      ),
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('message'),
        'properties', jsonb_build_object(
          'message', jsonb_build_object(
            'type', 'object',
            'required', jsonb_build_array('from','subject','body'),
            'properties', jsonb_build_object(
              'from', jsonb_build_object('type','string'),
              'subject', jsonb_build_object('type','string'),
              'body', jsonb_build_object('type','string','maxLength', 16000)
            )
          )
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('intent','urgency','language','confidence','summary'),
        'properties', jsonb_build_object(
          'intent', jsonb_build_object('enum', jsonb_build_array(
            'quote_request','shipment_status','complaint','billing_question','spam','other')),
          'urgency', jsonb_build_object('enum', jsonb_build_array('low','medium','high','urgent')),
          'language', jsonb_build_object('type','string','pattern','^[a-z]{2}$'),
          'confidence', jsonb_build_object('type','number','minimum',0,'maximum',1),
          'summary', jsonb_build_object('type','string','maxLength',200)
        )
      ),
      'chat-fast',        -- default_capability (cheap + fast for high-volume triage)
      0.0,                -- default_temperature (deterministic classification)
      400,                -- default_max_tokens
      300,                -- cache_ttl_seconds: identical message/from/subject can hit cache
      'standard',         -- safety_class
      'git',
      NULL,
      true                -- promote_active
    );
    RAISE NOTICE 'seeded comms.inbound.classify';
  ELSE
    RAISE NOTICE 'comms.inbound.classify already exists; skipping';
  END IF;

  -- ── sales.lead.score_evaluation ─────────────────────────────────
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'sales.lead.score_evaluation';
  IF v_count = 0 THEN
    PERFORM gateway.upsert_prompt_version(
      'sales.lead.score_evaluation',
      'sales',
      'lead.score_evaluation',
      E'You are a logistics-industry sales-development rep. Given the lead\nand its activity history, predict whether it will close in the next\n90 days and explain your reasoning. The current rule-based score is\nprovided for reference; your judgment can differ.\n\nLead:\n  - company:        {{lead.company_name}}\n  - title:          {{lead.title}}\n  - industry:       {{lead.industry}}\n  - estimated_value: ${{lead.estimated_value}}\n  - source:         {{lead.source}}\n  - rule_score:     {{lead.rule_score}}/100\n\nRecent activity ({{activity_count}} entries):\n{{activities}}\n\nRespond with JSON:\n{\n  "ai_score":   1-10,\n  "confidence": 0.0-1.0,\n  "stage_fit":  "discovery" | "qualified" | "proposal" | "negotiation" | "closed_won_likely" | "closed_lost_likely",\n  "reasoning":  "<= 400 chars; cite specific signals",\n  "next_action": "<= 80 chars; the single highest-leverage next move"\n}',
      'Score a sales lead 1-10 with stage_fit + next_action recommendation. Used by LeadScoringCard.',
      '{}'::jsonb,
      jsonb_build_object(
        'inputs', jsonb_build_object(
          'lead', jsonb_build_object('required', jsonb_build_array('company_name'))
        ),
        'tags', jsonb_build_array('sales','lead_scoring','advisory')
      ),
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('lead'),
        'properties', jsonb_build_object(
          'lead', jsonb_build_object(
            'type', 'object',
            'required', jsonb_build_array('company_name'),
            'properties', jsonb_build_object(
              'company_name', jsonb_build_object('type','string'),
              'title', jsonb_build_object('type','string'),
              'industry', jsonb_build_object('type','string'),
              'estimated_value', jsonb_build_object('type','number'),
              'source', jsonb_build_object('type','string'),
              'rule_score', jsonb_build_object('type','number','minimum',0,'maximum',100)
            )
          ),
          'activity_count', jsonb_build_object('type','integer'),
          'activities', jsonb_build_object('type','array')
        )
      ),
      jsonb_build_object(
        'type', 'object',
        'required', jsonb_build_array('ai_score','confidence','stage_fit','reasoning','next_action'),
        'properties', jsonb_build_object(
          'ai_score', jsonb_build_object('type','integer','minimum',1,'maximum',10),
          'confidence', jsonb_build_object('type','number','minimum',0,'maximum',1),
          'stage_fit', jsonb_build_object('enum', jsonb_build_array(
            'discovery','qualified','proposal','negotiation','closed_won_likely','closed_lost_likely')),
          'reasoning', jsonb_build_object('type','string','maxLength',400),
          'next_action', jsonb_build_object('type','string','maxLength',80)
        )
      ),
      'reasoning-medium', -- default_capability
      0.2,                -- default_temperature (slight creativity for next-action recs)
      600,                -- default_max_tokens
      1800,               -- cache_ttl_seconds: 30 min (re-score after activity changes)
      'standard',         -- safety_class
      'git',
      NULL,
      true
    );
    RAISE NOTICE 'seeded sales.lead.score_evaluation';
  ELSE
    RAISE NOTICE 'sales.lead.score_evaluation already exists; skipping';
  END IF;
END $$;
