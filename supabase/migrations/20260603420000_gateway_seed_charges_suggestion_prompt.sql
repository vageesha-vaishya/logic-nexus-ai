-- LLM Gateway — seed logistics.charges.suggestion prompt.
-- Tenth production caller of the gateway, second logistics LLM feature.
-- Given a shipment + carrier + optional historical-rate hints, propose
-- a complete operator-reviewable charge spine with magnitudes,
-- rationale, and incoterm-driven payable_by allocation.
--
-- Non-modal: structured JSON only, no image/PDF attachments.
-- Source-of-truth prompt body lives at
-- packages/llm-prompts/src/logistics/charges_suggestion/v1.prompt.md
-- and v1.schema.json. This seed replicates them into gateway.prompt_versions
-- so /v1/invoke can resolve PROMPT_KEY='logistics.charges.suggestion'.

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'logistics.charges.suggestion';
  IF v_count > 0 THEN
    RAISE NOTICE 'logistics.charges.suggestion already exists; skipping';
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'logistics.charges.suggestion',
    'logistics',
    'charges.suggestion',
    E'You are a freight charges advisor for a multi-tenant logistics platform. Given a shipment record + carrier + optional historical-rate hints, propose a complete set of charge lines an operator can attach to the shipment invoice (or use as a basis for a customer quote).\n\nYour output is ADVISORY — the operator reviews and edits before the invoice is committed. Bias toward completeness over precision.\n\nINPUT:\n- shipment.mode: ocean_fcl | ocean_lcl | air | road | rail | multimodal | courier\n- shipment.origin.country / shipment.destination.country (ISO-3166-1 alpha-2)\n- shipment.packages.{total_pieces,total_weight_kg,total_volume_m3,chargeable_weight_kg}\n- shipment.containers (ocean only): [{type, count}]\n- shipment.hazmat.is_hazmat / un_numbers / imdg_class\n- shipment.temp_controlled.required / range_celsius\n- shipment.incoterm (EXW..DDP)\n- shipment.currency (ISO-4217) — this is the invoice currency\n- shipment.declared_value.{amount,currency}\n- shipment.line_items: lightweight, used for restricted-cargo detection\n- shipment.service_terms.{door_pickup,door_delivery,customs_clearance}\n- carrier.{name,type,service_level}\n- tariff_hints.lane_avg_charges (anchors for freight/fuel magnitudes)\n- tariff_hints.fuel_surcharge_pct\n\nDECISION RULES:\n1. output.currency MUST equal shipment.currency. Every charge line currency MUST equal shipment.currency. Cross-currency lines belong in separate quotes.\n2. Mode-driven charge spine:\n   - ocean_fcl: freight (per_container), THC origin, THC destination, documentation, ISPS, customs_filing per service_terms\n   - ocean_lcl: freight (W/M), handling origin+destination, documentation, ISPS, CFS\n   - air: freight (per_kg chargeable_weight), fuel_surcharge, security_surcharge (always), AWB documentation, handling\n   - road: freight (per_shipment), pickup, delivery, documentation\n   - rail: freight, terminal handling each end, documentation\n   - courier: one bundled freight charge; break out fuel/remote-area/duties only if explicit\n3. Hazmat: shipment.hazmat.is_hazmat=true → ALWAYS add hazmat_surcharge + risk_flag noting carrier acceptance verification. Magnitudes: ~25-50% uplift ocean, 100-200% air.\n4. Temperature control: temp_controlled.required=true → add temperature_control line + reefer risk_flag.\n5. Incoterm-driven payable_by:\n   - EXW: ALL → consignee\n   - FCA/FOB/FAS: origin → shipper; freight + destination → consignee\n   - CFR/CPT: origin + freight → shipper; destination → consignee\n   - CIF/CIP: origin + freight + insurance → shipper; destination → consignee\n   - DAP/DPU: origin + freight + dest delivery → shipper; import duties → consignee\n   - DDP: ALL → shipper, including duties_taxes_pass_through\n   - Unsure → "per_incoterm" + rationale.\n6. Insurance line only if incoterm in {CIF,CIP} OR declared_value.amount>0 + opted in. Guideline 0.3–0.5% of declared_value; warn if declared_value missing.\n7. customs_filing_origin for EXW/FCA exports; customs_filing_destination for everything except DDP-self-clear. Defer to service_terms.customs_clearance when set.\n8. demurrage_risk_reserve / detention_risk_reserve: ONLY if lane known-congested OR operator concern; otherwise omit + risk_flag.\n9. tariff_hints.lane_avg_charges anchor freight/fuel magnitudes. If hints conflict with spine, prefer hints + warn about no-hint charges.\n10. Cap suggested_charges at 18 lines.\n11. total_estimate.amount MUST equal arithmetic sum of all charge amounts (within 0.01).\n12. incoterm_split.shipper_pays + consignee_pays MUST equal total_estimate.amount (within 0.01).\n13. confidence ≥ 0.85 only when: mode set, incoterm set, weights present, tariff_hints supplied at least one anchor, every charge has basis+basis_qty.\n14. Do not invent carrier-specific surcharges unless they appear in tariff_hints. Stick to industry-standard codes.\n15. PII: redact personal names in line_items to "<redacted>" and warn.\n\nRespond with valid JSON matching v1.schema.json. Never include text outside the JSON. Mis-suggested charges cost a clean draft, not money — bias toward completeness.',
    'Given a shipment + carrier + tariff hints, propose a complete charge spine for the invoice with magnitudes, rationale, risk flags, and incoterm-driven payable_by allocation. Advisory only — operator reviews before commit.',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'shipment', jsonb_build_object('required', true),
        'carrier',  jsonb_build_object('required', true),
        'tariff_hints', jsonb_build_object('required', false)
      ),
      'tags', jsonb_build_array('logistics','charges','invoice','pricing-advisory')
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('shipment','carrier'),
      'properties', jsonb_build_object(
        'shipment',     jsonb_build_object('type','object'),
        'carrier',      jsonb_build_object('type','object'),
        'tariff_hints', jsonb_build_object('type', jsonb_build_array('object','null')))
      ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array(
        'currency','suggested_charges','total_estimate','incoterm_split',
        'risk_flags','warnings','confidence'
      ),
      'properties', jsonb_build_object(
        'currency',           jsonb_build_object('type','string','pattern','^[A-Z]{3}$'),
        'suggested_charges',  jsonb_build_object('type','array','maxItems',18),
        'total_estimate',     jsonb_build_object('type','object'),
        'incoterm_split',     jsonb_build_object('type','object'),
        'risk_flags',         jsonb_build_object('type','array','maxItems',12),
        'warnings',           jsonb_build_object('type','array','maxItems',12),
        'confidence',         jsonb_build_object('type','number','minimum',0,'maximum',1)
      )
    ),
    'chat-balanced',
    0.0,
    2400,
    0,
    'pricing_advisory',
    'git',
    NULL,
    true
  );

  RAISE NOTICE 'seeded logistics.charges.suggestion';
END $$;
