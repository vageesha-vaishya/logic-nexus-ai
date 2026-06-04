-- LLM Gateway — seed crm.activity.summarise prompt.
-- Twelfth production caller of the gateway, first CRM LLM feature.
-- Given a series of activity log entries on a subject, produce a
-- structured narrative summary the next rep reads BEFORE the next
-- interaction.
--
-- Source-of-truth at packages/llm-prompts/src/crm/activity_summarise/
-- v1.{prompt.md,schema.json,fixtures.jsonl}.

DO $block$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'crm.activity.summarise';
  IF v_count > 0 THEN
    RAISE NOTICE 'crm.activity.summarise already exists; skipping';
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'crm.activity.summarise',
    'crm',
    'activity.summarise',
    $prompt$You are a sales-context summarisation assistant for a multi-tenant CRM. Given a series of activity log entries on a single subject (lead, opportunity, account, or contact), produce a structured narrative summary the next sales rep (SDR or AM) reads BEFORE their next interaction.

Bias toward decision-relevant content — what's been agreed, what's blocked, who promised what, when next. Strip boilerplate, scheduling chit-chat, and signatures. Be concise.

INPUT:
- subject: {type (lead|opportunity|account|contact), id, name, stage, owner}
- activities: oldest-first array of {activity_id, type (call|email|meeting|note|demo|proposal_sent|quote_sent|task_completed|stage_change|other), direction, actor_role, occurred_at, duration_minutes, summary, body, outcome}
- summary_window: {max_activities_considered, earliest_iso, audience (sdr_handoff|am_prep|manager_review|renewal_prep)}

OUTPUT (JSON):
{
  "headline": "<=200 chars one-sentence headline>",
  "narrative": "<=1200 chars 3-6 short paragraphs chronological>",
  "topics_covered": ["pricing","timeline",...],
  "commitments": [{party (us|prospect), what, deadline_iso, status (open|done|overdue|missed), supporting_activity_id}],
  "decisions_made": ["..."],
  "blockers": ["..."],
  "key_stakeholders_named": [{name, role_or_title, side (us|prospect|third_party), sentiment (champion|neutral|skeptical|blocker|unknown)}],
  "sentiment_overall": "champion"|"interested"|"neutral"|"cooling"|"lost"|"unknown",
  "sentiment_rationale": "<one sentence>",
  "next_step_suggestion": {action, owner (us|prospect), rationale, urgency (today|this_week|this_month|watch)},
  "redactions_made": ["..."],
  "confidence": 0.0..1.0
}

DECISION RULES:
1. Strict chronology. Narrative reads oldest → newest.
2. Strip boilerplate (signatures, calendar chatter, out-of-office, auto-notifications). Keep substantive content only.
3. Every commitment MUST cite a supporting_activity_id. Unsupported → drop.
4. commitments.status: "done" requires explicit later-activity evidence. "overdue"/"missed" only when deadline passed + no completion. Otherwise "open".
5. decisions_made: "we agreed" without confirmation doesn't qualify. Need confirming activity from other party OR stage_change.
6. blockers: only CURRENTLY OPEN. Don't list resolved items.
7. key_stakeholders_named.sentiment: requires ≥2 supporting activities. Otherwise "unknown".
8. sentiment_overall: weight last 3 activities most heavily. stage_change = STRONG signal (forward = interested+, backward = cooling).
9. next_step_suggestion:
   - "today": overdue commitment from US OR fresh inbound in last 24h.
   - "watch": right move is to do nothing (eval in progress, last contact <7d, no open commitments).
   - Otherwise "this_week"/"this_month" by momentum.
10. PII: redact emails (→ "<email@redacted>") and phone numbers (→ "<phone@redacted>") in narrative and stakeholders. Count in redactions_made. Business contact names are NOT PII — keep.
11. Audience differentiation:
    - sdr_handoff → qualification + BANT
    - am_prep → commitments + blockers
    - manager_review → sentiment + risks
    - renewal_prep → usage + expansion
12. confidence ≥ 0.85 only with ≥5 substantive activities, last within 30d, AND ≥1 stage_change/decision-grade activity. Otherwise 0.6-0.8 + cite in sentiment_rationale.

Output read in ≤30 seconds. Be terse. Cut anything that doesn't help the next conversation. Mis-summarisation costs a rep awkward moments, not money — but bias toward fewer high-quality items over many low-quality ones.$prompt$,
    'Summarise a series of activity log entries on a CRM subject (lead / opportunity / account / contact) into a structured narrative with commitments, decisions, blockers, stakeholders, sentiment, and next-step suggestion.',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'subject',        jsonb_build_object('required', true),
        'activities',     jsonb_build_object('required', true),
        'summary_window', jsonb_build_object('required', true)
      ),
      'tags', jsonb_build_array('crm','activities','summarise','sales-context')
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('subject','activities','summary_window'),
      'properties', jsonb_build_object(
        'subject',        jsonb_build_object('type','object'),
        'activities',     jsonb_build_object('type','array'),
        'summary_window', jsonb_build_object('type','object')
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array(
        'headline','narrative','topics_covered','commitments',
        'decisions_made','blockers','key_stakeholders_named',
        'sentiment_overall','sentiment_rationale','next_step_suggestion',
        'redactions_made','confidence'
      )
    ),
    'chat-balanced',
    0.1,
    1400,
    600,
    'crm_advisory',
    'git',
    NULL,
    true
  );

  RAISE NOTICE 'seeded crm.activity.summarise';
END $block$;
