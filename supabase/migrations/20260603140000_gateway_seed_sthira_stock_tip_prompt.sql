-- LLM Gateway — seed sthira.tip.screenshot_extract prompt.
-- Second production caller of the §9.4 multi-modal/vision path, this
-- time on Sthira mobile. User screenshots a stock tip (WhatsApp,
-- broker app, news, chart) and the gateway extracts ticker + claim
-- and assesses fit against their risk profile.
--
-- Explicitly informational. The output schema does NOT carry an
-- "execute trade" verdict — matches the Audience Option-A policy:
--   "LLM never executes trades autonomously."

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'sthira.tip.screenshot_extract';
  IF v_count > 0 THEN
    RAISE NOTICE 'sthira.tip.screenshot_extract already exists; skipping';
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'sthira.tip.screenshot_extract',
    'sthira',
    'tip.screenshot_extract',
    E'You are Sthira, a calm Indian retail-investment companion. The user\nsnapped a screenshot of a stock tip / message / chart and wants to know\nif it is worth a closer look — given THEIR risk profile, not generic\nadvice. The screenshot is attached.\n\nUser context:\n  - experience_level: {{experience_level}}\n  - risk_tag:         {{risk_tag}}\n  - goals_summary:    {{goals_summary}}\n\nWhat you must do:\n  1. Read the screenshot. Extract the tickers (NSE/BSE symbols if visible) and\n     the central claim (e.g. "buy XYZ for 2x in 3 months", "stop-loss at 240").\n  2. Judge whether the claim fits the user''s risk_tag. Be honest, not preachy.\n  3. Recommend ONE next step the user can do themselves — never execute a trade.\n\nRespond with valid JSON only:\n{\n  "tickers":     ["<TICKER>", …],   // [] if nothing extractable\n  "claim":       "<= 240 chars; the central claim in plain English",\n  "tip_source":  "whatsapp" | "news_article" | "broker_app" | "social_media" | "chart" | "other",\n  "fit_verdict": "fits"          // claim looks compatible with user''s risk_tag\n                | "stretch"      // workable but more aggressive than profile\n                | "off_profile"  // genuinely outside what suits this user\n                | "unreadable",  // screenshot too unclear to judge\n  "explanation": "<= 320 chars; why you reached fit_verdict, in plain language",\n  "suggested_action": "<= 120 chars; ONE concrete next step (e.g. \\"read company filings on screener.in\\", \\"skip — too risky for your goals\\"). Never \\"buy\\" or \\"sell\\".",\n  "confidence":  0.0-1.0\n}',
    'Read a screenshot of a stock tip the user came across and assess fit against their risk profile. Informational only — never recommends trade execution.',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'experience_level', jsonb_build_object('required', true),
        'risk_tag', jsonb_build_object('required', true)
      ),
      'tags', jsonb_build_array('sthira','retail','vision','tip-triage')
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('experience_level','risk_tag'),
      'properties', jsonb_build_object(
        'experience_level', jsonb_build_object('type','string','maxLength',32),
        'risk_tag',         jsonb_build_object('type','string','maxLength',32),
        'goals_summary',    jsonb_build_object('type','string','maxLength',400)
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('tickers','claim','tip_source','fit_verdict','explanation','suggested_action','confidence'),
      'properties', jsonb_build_object(
        'tickers',          jsonb_build_object('type','array','items',jsonb_build_object('type','string','maxLength',16),'maxItems',8),
        'claim',            jsonb_build_object('type','string','maxLength',240),
        'tip_source',       jsonb_build_object('enum', jsonb_build_array('whatsapp','news_article','broker_app','social_media','chart','other')),
        'fit_verdict',      jsonb_build_object('enum', jsonb_build_array('fits','stretch','off_profile','unreadable')),
        'explanation',      jsonb_build_object('type','string','maxLength',320),
        'suggested_action', jsonb_build_object('type','string','maxLength',120),
        'confidence',       jsonb_build_object('type','number','minimum',0,'maximum',1)
      )
    ),
    'chat-balanced',
    0.3,
    700,
    0,
    'standard',
    'git',
    NULL,
    true
  );

  RAISE NOTICE 'seeded sthira.tip.screenshot_extract';
END $$;
