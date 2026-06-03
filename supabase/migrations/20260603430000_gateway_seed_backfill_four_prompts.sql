-- LLM Gateway — backfill seed migrations for 4 LLM features whose
-- Edge Functions were shipped today (2026-06-03) WITHOUT matching
-- gateway.upsert_prompt_version calls. Without these, every
-- /v1/invoke against those prompt_keys returns prompt-not-found.
--
-- Features:
--   1. logistics.customs.doc_extract  (commit 7cbbf38e)
--   2. amro.directive.applicability   (commit 6c9359f9)
--   3. amro.aog.triage                (commit ad6cb541-area)
--   4. amro.compliance.doc_ocr        (commit eb35b...)
--
-- Source-of-truth prompts + schemas live under
-- packages/llm-prompts/src/<module>/<feature>/v1.{prompt.md,schema.json,fixtures.jsonl}.
-- These seeds embed the prompt body + minimal schema so /v1/invoke can resolve.
--
-- Each block is guarded by an existence check so re-running is a no-op.
-- Each prompt body is dollar-quoted ($prompt$...$prompt$) inside the outer
-- DO block, which itself is tagged ($block$...$block$) to keep nesting clean.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. logistics.customs.doc_extract
-- ─────────────────────────────────────────────────────────────────────────
DO $block$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'logistics.customs.doc_extract';
  IF v_count > 0 THEN
    RAISE NOTICE 'logistics.customs.doc_extract already exists; skipping';
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'logistics.customs.doc_extract',
    'logistics',
    'customs.doc_extract',
    $prompt$You are a customs / freight-document extraction assistant for a multi-tenant logistics platform. The user has uploaded a scanned page or PDF of a customs / international-shipping document. Extract structured fields the platform can attach to the matching shipment and pass through to customs / accounting downstream.

INPUT:
- shipment_context: shipment_id, booking_reference, origin_country (ISO-3166-1 alpha-2), destination_country, mode (ocean_fcl|ocean_lcl|air|road|rail|multimodal), incoterm_hint, currency_hint (ISO-4217), notes_from_uploader. All fields nullable.
- attachments: ONE image or PDF page via the gateway's multi-modal slot.

OUTPUT (JSON, matching v1.schema.json):
- doc_type: bill_of_lading|air_waybill|commercial_invoice|packing_list|certificate_of_origin|customs_declaration|phytosanitary_certificate|insurance_certificate|other_freight_doc|unknown
- doc_number, issuer{name,address_country}
- parties: shipper, consignee, notify_party — each with name/address/country/tax_id
- route: port_of_loading, port_of_discharge, place_of_receipt, place_of_delivery, vessel_or_flight, departure_date, estimated_arrival_date
- incoterm (EXW..DDP), currency (ISO-4217)
- totals: invoice_value, freight, insurance (money objects); total_packages, gross_weight, net_weight, volume (value+unit)
- line_items: [{line_no, description, hs_code, quantity{value,unit}, unit_price{amount,currency}, total_price{amount,currency}, country_of_origin}]
- matches_shipment_context: {booking_ref_match, country_pair_match, incoterm_match, match_rationale}
- extracted_text_excerpts, warnings, confidence

DECISION RULES:
1. doc_type identification first; if combined, choose dominant role + warn.
2. ISO codes: countries ISO-3166-1 alpha-2, currencies ISO-4217. Infer from shipment_context when symbol-only, else null+warn.
3. Dates: prefer ISO. Note source format if ambiguous.
4. HS codes: extract verbatim; preserve digit count.
5. line_items: extract every line; cap quantities at printed value.
6. matches_shipment_context: null when shipment_context field absent.
7. Parties: illegible → null + warning.
8. confidence ≥ 0.9 only when doc_type recognised, doc_number legible, totals coherent ≤1%, booking_ref_match=true.
9. PII: no personal contacts in excerpts. Company info OK.
10. Never invent fields. Null + warning preferred over guessing.

This drives an automated logistics-document-evidence chain. Mis-extraction has customs/accounting consequences.$prompt$,
    'Extract structured fields from an uploaded customs / freight document (BL, AWB, commercial invoice, packing list, certificate of origin, etc) into a schema the platform can attach to a shipment and pass to customs/accounting.',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'shipment_context', jsonb_build_object('required', true),
        'attachments',      jsonb_build_object('required', true)
      ),
      'tags', jsonb_build_array('logistics','customs','vision','doc-extract')
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('shipment_context'),
      'properties', jsonb_build_object(
        'shipment_context', jsonb_build_object('type','object')
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array(
        'doc_type','doc_number','issuer','parties','route','incoterm',
        'currency','totals','line_items','matches_shipment_context',
        'extracted_text_excerpts','warnings','confidence'
      )
    ),
    'chat-balanced',
    0.0,
    2200,
    0,
    'compliance_advisory',
    'git',
    NULL,
    true
  );

  RAISE NOTICE 'seeded logistics.customs.doc_extract';
END $block$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. amro.directive.applicability
-- ─────────────────────────────────────────────────────────────────────────
DO $block$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'amro.directive.applicability';
  IF v_count > 0 THEN
    RAISE NOTICE 'amro.directive.applicability already exists; skipping';
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'amro.directive.applicability',
    'amro',
    'directive.applicability',
    $prompt$You are an aviation maintenance airworthiness assistant evaluating whether a regulatory directive (Airworthiness Directive / Service Bulletin / Type Certificate Data Sheet revision) applies to a specific aircraft.

INPUT:
- directive: { issuing_authority (FAA|EASA|CAAC|SACAA|OTHER), directive_id, kind (AD|SB|TCDS|OTHER), title, effective_date (ISO), applies_to (free text from source), compliance_action, relevant_ata_chapters: string[] }
- aircraft: { manufacturer, model, serial_number, registration, engines: [{manufacturer,model,serial_number?}], configurations: string[], hours_since_new, cycles_since_new }

OUTPUT (JSON):
{
  "applies": true|false,
  "confidence": 0.0..1.0,
  "reasoning": "<short paragraph cite-driven explanation>",
  "matched_criteria": ["model serial-number range", ...],
  "unmatched_criteria": ["serial outside listed range", ...],
  "ata_chapters_touched": ["32","27-50"],
  "recommended_followup": "<one short sentence>"
}

DECISION RULES:
1. Every mandatory criterion in applies_to must MATCH. One unmet → applies=false.
2. Serial range: inside → match.
3. "All aircraft of model X" → any model X matches.
4. confidence ≥ 0.9 only when every mandatory criterion has explicit positive evidence. Missing/ambiguous → 0.6-0.8 + surface in unmatched_criteria.
5. Ambiguous applies_to referencing unlisted SBs/options → applies=true, confidence 0.5-0.7, recommended_followup="human review needed".
6. Never invent serials/manufacturers/variants not present in inputs.
7. ata_chapters_touched echoes relevant_ata_chapters when applies=true; empty when applies=false.

This drives a HUMAN-IN-THE-LOOP triage queue. False negatives have safety implications. Bias toward applies=true + lower confidence over applies=false + high confidence when inputs are incomplete.$prompt$,
    'Evaluate whether a regulatory directive (AD / SB / TCDS) applies to a specific aircraft. Drives the human-in-the-loop triage queue.',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'directive', jsonb_build_object('required', true),
        'aircraft',  jsonb_build_object('required', true)
      ),
      'tags', jsonb_build_array('amro','directive','airworthiness','regulatory-advisory')
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('directive','aircraft'),
      'properties', jsonb_build_object(
        'directive', jsonb_build_object('type','object'),
        'aircraft',  jsonb_build_object('type','object')
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array(
        'applies','confidence','reasoning',
        'matched_criteria','unmatched_criteria',
        'ata_chapters_touched','recommended_followup'
      )
    ),
    'chat-balanced',
    0.0,
    800,
    86400,
    'regulatory_advisory',
    'git',
    NULL,
    true
  );

  RAISE NOTICE 'seeded amro.directive.applicability';
END $block$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. amro.aog.triage
-- ─────────────────────────────────────────────────────────────────────────
DO $block$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'amro.aog.triage';
  IF v_count > 0 THEN
    RAISE NOTICE 'amro.aog.triage already exists; skipping';
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'amro.aog.triage',
    'amro',
    'aog.triage',
    $prompt$You are an AOG (Aircraft on Ground) triage assistant for an aviation MRO operations team. An aircraft is grounded; the operations controller needs a structured triage plan within seconds.

INPUT:
- alert: { alert_id, reported_at (ISO), airport_iata, airport_local_time, reporter_role (flight_crew|maintenance|ground_ops), defect_summary, ata_chapter_code, severity_signal, related_warnings: string[], mel_eligible: bool|null }
- aircraft: { manufacturer, model, serial_number, registration, hours_since_new, cycles_since_new, current_mel_deferrals: string[] }
- fleet_context: { same_type_aircraft_nearby: [{registration,airport_iata,status,distance_nm}], tools_at_airport: string[], parts_at_airport: [{part_number,qty_available}], station_capability (self_handle|vendor_required|vendor_unavailable), sla_recovery_hours }

OUTPUT (JSON):
{
  "priority": "P1_AOG_CRITICAL"|"P2_AOG_URGENT"|"P3_AOG_PLANNED"|"P4_DEFER_MEL",
  "priority_rationale": "<short paragraph>",
  "estimated_recovery_hours": number,
  "blocks_revenue_service": bool,
  "recommended_actions": [{action, owner_role (ops_controller|maintenance_lead|stores|procurement|vendor_coordinator), deadline_hours_from_now, blocking}],
  "parts_to_preorder": [{part_number, qty, rationale, available_at_airport}],
  "escalation_chain": ["role 1", "role 2"],
  "alternate_recovery_options": ["..."],
  "mel_recommendation": {consider_mel, mel_category (A|B|C|D|null), rationale},
  "safety_flags": ["..."],
  "confidence": 0.0..1.0
}

DECISION RULES:
1. P1_AOG_CRITICAL: blocks revenue AND no nearby same-type AND station_capability != self_handle. Hours/days recovery.
2. P2_AOG_URGENT: revenue impact ≤6h but partial mitigations (MEL/nearby/self-handle).
3. P3_AOG_PLANNED: grounded but not blocking next rotation (overnight base or MEL).
4. P4_DEFER_MEL: only when mel_eligible=true AND defect not flight-critical.
5. recommended_actions ordered ASC by deadline. Each MUST have owner_role.
6. parts_to_preorder: prefer NOT at this airport (procurement lead time). Mark available_at_airport for stores pre-pull.
7. escalation_chain: ≥2 entries, oldest=immediate owner, newest=highest authority. Max 5.
8. mel_recommendation.consider_mel=true only when alert.mel_eligible=true AND defect not engines/flight controls/gear/primary avionics.
9. safety_flags: surface ANY recurring/trending indicator, even speculative.
10. confidence ≥ 0.9 only with specific defect_summary, ata matches warnings, fleet_context fully populated. Otherwise 0.6-0.8 + call out in priority_rationale.

TIME-CRITICAL. Be precise, brief in each field, bias toward action.$prompt$,
    'AOG (Aircraft on Ground) triage: given a grounding alert + aircraft + fleet/station context, produce a structured time-critical triage plan with priority, actions, parts to preorder, escalation chain, and MEL recommendation.',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'alert',         jsonb_build_object('required', true),
        'aircraft',      jsonb_build_object('required', true),
        'fleet_context', jsonb_build_object('required', true)
      ),
      'tags', jsonb_build_array('amro','aog','operational-advisory','time-critical')
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('alert','aircraft','fleet_context'),
      'properties', jsonb_build_object(
        'alert',         jsonb_build_object('type','object'),
        'aircraft',      jsonb_build_object('type','object'),
        'fleet_context', jsonb_build_object('type','object')
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array(
        'priority','priority_rationale','estimated_recovery_hours',
        'blocks_revenue_service','recommended_actions','parts_to_preorder',
        'escalation_chain','alternate_recovery_options',
        'mel_recommendation','safety_flags','confidence'
      )
    ),
    'chat-balanced',
    0.2,
    1500,
    0,
    'operational_advisory',
    'git',
    NULL,
    true
  );

  RAISE NOTICE 'seeded amro.aog.triage';
END $block$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. amro.compliance.doc_ocr
-- ─────────────────────────────────────────────────────────────────────────
DO $block$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'amro.compliance.doc_ocr';
  IF v_count > 0 THEN
    RAISE NOTICE 'amro.compliance.doc_ocr already exists; skipping';
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'amro.compliance.doc_ocr',
    'amro',
    'compliance.doc_ocr',
    $prompt$You are a compliance-document extraction assistant for an aviation MRO. The user has uploaded a scanned page or PDF of a compliance document (Form 8130-3 / EASA Form 1 / CAAC AAC-038 / SACAA card / Authorised Release Certificate / signed AD sign-off / SB completion). Extract structured fields the platform can validate against an in-flight work-order.

INPUT:
- document_context: { work_order_id, work_order_package_number (e.g. "WO-2026-04-1284"), directive_id (e.g. "AD 2025-12-05"), aircraft_registration, issuing_authority_hint (FAA|EASA|CAAC|SACAA|null), notes_from_uploader }
- attachments: ONE image or PDF page via gateway's multi-modal slot.

OUTPUT (JSON):
{
  "doc_type": "form_8130-3"|"easa_form_1"|"caac_aac_038"|"sacaa_card"|"ad_signoff"|"sb_completion"|"ferry_permit"|"other_release_cert"|"unknown",
  "issuing_authority": "FAA"|"EASA"|"CAAC"|"SACAA"|"OTHER"|null,
  "issuing_organisation": "<name>",
  "approval_number": "<cert number>",
  "serial_or_lot": {type: serial|lot|batch|none, value},
  "part_number", "part_description",
  "quantity": {value, unit: EA|FT|GAL|KG|L|OTHER|null},
  "work_performed_codes": ["NEW"|"OH"|"INSP"|"TEST"|"REPAIRED"|...],
  "authorised_signature": {present, signatory_name, signatory_role, signature_date},
  "applicable_to_aircraft": {registration_extracted, matches_context (bool|null), match_rationale},
  "expires_on",
  "extracted_text_excerpts": ["..."],
  "warnings": ["..."],
  "confidence": 0.0..1.0
}

DECISION RULES:
1. doc_type identification first; recognise even if other fields unclear.
2. Numbers verbatim. Illegible digit → drop whole numeric to null + warn.
3. Dates: prefer ISO. Note source format if ambiguous.
4. applicable_to_aircraft.matches_context: extracted vs document_context.aircraft_registration. Exact match → true. Mismatch → false. Either missing → null + warn.
5. authorised_signature.present: visible signature mark required. Printed-name-only → present=false.
6. extracted_text_excerpts: 3-5 verbatim quotes that drove extractions.
7. confidence ≥ 0.9 only when doc_type recognised, approval_number legible, signature present, aircraft matches_context=true.
8. Never invent fields. Null + warning preferred.
9. PII: redact emails/phones from excerpts.

This drives an automated work-order-compliance-evidence chain. Misextraction has regulatory consequences. Bias toward null + warning over guessing.$prompt$,
    'OCR a compliance document (Form 8130-3 / EASA Form 1 / SACAA card / AD sign-off / SB completion) into structured fields the platform can validate against an in-flight work-order.',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'document_context', jsonb_build_object('required', true),
        'attachments',      jsonb_build_object('required', true)
      ),
      'tags', jsonb_build_array('amro','compliance','vision','doc-ocr','regulatory-advisory')
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('document_context'),
      'properties', jsonb_build_object(
        'document_context', jsonb_build_object('type','object')
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array(
        'doc_type','issuing_authority','issuing_organisation',
        'approval_number','serial_or_lot','part_number','part_description',
        'quantity','work_performed_codes','authorised_signature',
        'applicable_to_aircraft','expires_on',
        'extracted_text_excerpts','warnings','confidence'
      )
    ),
    'chat-balanced',
    0.0,
    2000,
    0,
    'regulatory_advisory',
    'git',
    NULL,
    true
  );

  RAISE NOTICE 'seeded amro.compliance.doc_ocr';
END $block$;
