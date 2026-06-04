-- LLM Gateway — seed finance.invoice.line_classify prompt.
-- Eleventh production caller of the gateway, first finance LLM feature.
-- Given draft invoice lines + tenant chart of accounts + tax rules,
-- classify each line into a GL account with tax treatment. Drives
-- auto-posting to the ledger; operator reviews before commit.
--
-- Source-of-truth at packages/llm-prompts/src/finance/invoice_line_classify/
-- v1.{prompt.md,schema.json,fixtures.jsonl}.

DO $block$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'finance.invoice.line_classify';
  IF v_count > 0 THEN
    RAISE NOTICE 'finance.invoice.line_classify already exists; skipping';
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'finance.invoice.line_classify',
    'finance',
    'invoice.line_classify',
    $prompt$You are an accounting auto-routing assistant for a multi-tenant logistics + freight platform. Given the line items of a draft invoice (or vendor bill), classify each line into the correct General Ledger account using the tenant's chart of accounts and applicable tax rules. Your output drives auto-posting to the ledger; the operator reviews before commit.

INPUT:
- invoice_lines: [{line_id, charge_code (freight|fuel_surcharge|thc_origin|thc_destination|documentation|customs_filing_origin|customs_filing_destination|insurance|hazmat_surcharge|demurrage|detention|duties_taxes_pass_through|vendor_pass_through|other), description, amount, currency (ISO-4217), is_pass_through (bool|null), vendor_ref, service_country_origin (ISO-3166), service_country_destination}]
- chart_of_accounts: [{code, name, type (revenue|cost_of_sales|expense|pass_through_liability|tax_payable|tax_receivable|other), tags?}]
- tax_rules: {jurisdiction (ISO-3166-1 alpha-2), tax_label (GST|VAT|Sales Tax|Service Tax|None), default_rate_pct, reverse_charge_applicable_codes: string[], zero_rated_charges: string[]}

OUTPUT (JSON):
{
  "classifications": [{line_id, gl_account_code, gl_account_name, gl_account_type, is_pass_through, applies_tax, tax_code, tax_rate_pct, tax_treatment (standard|zero_rated|exempt|reverse_charge|out_of_scope), rationale, confidence}],
  "unclassified_lines": [{line_id, reason}],
  "warnings": [],
  "confidence": 0.0..1.0
}

DECISION RULES:
1. EVERY input line MUST appear in EXACTLY ONE of classifications or unclassified_lines. Counts must sum to input length.
2. Account matching: exact charge_code → tags match preferred. Fall back to type-based (e.g. freight → first revenue account tagged "freight"). No match → unclassified_lines.
3. Pass-through detection:
   - is_pass_through=true on input → pass_through_liability account; operator overrides chart matching.
   - is_pass_through=null + charge_code in {duties_taxes_pass_through,vendor_pass_through} → infer pass-through.
   - Otherwise is_pass_through=false.
4. Tax treatment:
   - Charge in tax_rules.zero_rated_charges → zero_rated, applies_tax=true, rate=0.
   - Charge in tax_rules.reverse_charge_applicable_codes → reverse_charge, applies_tax=false, rate=null.
   - service_country_origin OR destination outside tax_rules.jurisdiction AND foreign leg → out_of_scope.
   - is_pass_through=true → out_of_scope.
   - Otherwise → standard with default_rate_pct.
5. Per-line confidence ≥ 0.9 only with: exact charge_code match in chart, tax_rules cover the case, no pass-through ambiguity. Otherwise 0.6-0.8 + cite gap in rationale.
6. Top-level confidence = min(per-line) AND structural-coherence check.
7. warnings: duplicate identical charges, suspicious amounts vs siblings, currency mismatches across lines.
8. NEVER invent a GL account code not in chart_of_accounts. No match → unclassified_lines.
9. NEVER guess tax_rate_pct. Only use default_rate_pct or 0. Unsure → tax_code=null + rate=null + out_of_scope + warning.
10. PII: redact personal names to "<redacted>" and warn.

This drives an auto-posting flow. Mis-classification creates ledger corrections, not financial loss. Bias toward unclassified_lines over confident wrong answer when inputs are incomplete.$prompt$,
    'Given draft invoice/vendor-bill lines + tenant chart of accounts + tax rules, classify each line into a GL account with tax treatment. Drives auto-posting to ledger.',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'invoice_lines',     jsonb_build_object('required', true),
        'chart_of_accounts', jsonb_build_object('required', true),
        'tax_rules',         jsonb_build_object('required', true)
      ),
      'tags', jsonb_build_array('finance','invoice','accounting','gl-mapping','accounting-advisory')
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('invoice_lines','chart_of_accounts','tax_rules'),
      'properties', jsonb_build_object(
        'invoice_lines',     jsonb_build_object('type','array'),
        'chart_of_accounts', jsonb_build_object('type','array'),
        'tax_rules',         jsonb_build_object('type','object')
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array(
        'classifications','unclassified_lines','warnings','confidence'
      )
    ),
    'chat-balanced',
    0.0,
    1800,
    3600,
    'accounting_advisory',
    'git',
    NULL,
    true
  );

  RAISE NOTICE 'seeded finance.invoice.line_classify';
END $block$;
