# 1.0 Quotation Module Gap Analysis

## 1.1 Scope
This document analyzes the Quotation Module from quote capture to PDF output and identifies functional and data-integrity gaps between:
- 1.1.1 Unified Quotation Composer
- 1.1.2 Legacy Quote Form + Repository save model
- 1.1.3 PDF generation pipeline using `MGL-Main-Template`

## 1.2 Source of Truth Reviewed
- 1.2.1 `src/components/sales/unified-composer/schema.ts`
- 1.2.2 `src/components/sales/quote-form/types.ts`
- 1.2.3 `src/components/sales/quote-form/useQuoteRepository.ts`
- 1.2.4 `src/lib/quote-mapper.ts`
- 1.2.5 `src/services/QuoteOptionService.ts`
- 1.2.6 `supabase/functions/generate-quote-pdf/index.ts`
- 1.2.7 `supabase/functions/generate-quote-pdf/engine/context.ts`
- 1.2.8 `supabase/functions/generate-quote-pdf/engine/renderer.ts`
- 1.2.9 `supabase/functions/generate-quote-pdf/engine/matrix-helper.ts`
- 1.2.10 `supabase/functions/generate-quote-pdf/engine/mgl-loader.ts`

## 1.3 End-to-End Data Flow
1.3.1 User captures quote data in Unified Composer or Legacy Quote Form.
1.3.2 Save path builds RPC payload and calls `save_quote_atomic`.
1.3.3 Quote version/options/legs/charges are persisted.
1.3.4 PDF function loads quote + latest version + options + sell-side charges.
1.3.5 Template selection attempts explicit template, then `MGL-Main-Template`, then multimodal template, then default fallback.
1.3.6 Safe context normalizes objects.
1.3.7 Renderer groups options and aggregates charges into matrix rows for PDF.

## 1.4 Field Inventory and Mapping Gaps
### 1.4.1 Unified Composer Coverage
- 1.4.1.1 Supports standalone guest entities, detailed addresses, container combos, paired buy/sell charge model, and workflow fields.
- 1.4.1.2 Uses `charges[]` with explicit `buy` and `sell` blocks per row.

### 1.4.2 Legacy Quote Form Coverage
- 1.4.2.1 Supports items, cargo configurations, options, legs, and flattened charge entries.
- 1.4.2.2 Includes quote-level fields like `tax_percent`, `shipping_amount`, `terms_conditions`.

### 1.4.3 Primary Gaps
1.4.3.1 **Charge Shape Drift**
- 1.4.3.1.1 Composer uses paired buy/sell nested structure.
- 1.4.3.1.2 Legacy + PDF consumption largely rely on flattened charge rows.
- 1.4.3.1.3 Risk: financial intent can be lost if pairing assumptions break.

1.4.3.2 **Cargo Dual-Model Drift**
- 1.4.3.2.1 Composer captures `containerCombos` and `cargo_details`.
- 1.4.3.2.2 Legacy save path persists `items` and `cargo_configurations`.
- 1.4.3.2.3 Risk: inconsistent equipment display if both sources diverge.

1.4.3.3 **Transit Representation Drift**
- 1.4.3.3.1 Some paths persist/consume days strings (`"25 days"`), others use hours.
- 1.4.3.3.2 Legacy repository converts days to hours for DB.
- 1.4.3.3.3 Risk: non-uniform display and ranking consistency.

1.4.3.4 **Tax Modeling Drift**
- 1.4.3.4.1 Quote-level tax fields exist.
- 1.4.3.4.2 PDF matrix renders option/charge rows.
- 1.4.3.4.3 Risk: tax omitted in PDF when not materialized as explicit charge rows.

## 1.5 Template Selection and Rendering Behavior
### 1.5.1 Template Resolution Priority
1.5.1.1 Request `templateId`
1.5.1.2 `quote.template_id`
1.5.1.3 Preferred default: `MGL-Main-Template` (tenant-specific first)
1.5.1.4 Multi-modal heuristic template
1.5.1.5 Hardcoded default template

### 1.5.2 MGL Option Substitution Behavior
- 1.5.2.1 If normal option set is sparse or low-diversity, pipeline probes MGL source tables and may replace render set with synthetic MGL options.
- 1.5.2.2 This improves resilience but can simplify semantics and hide source inconsistencies.

## 1.6 Financial and Transformation Rules
### 1.6.1 Core Formula Rules
- 1.6.1.1 Default target margin: `15%` when no explicit financials exist.
- 1.6.1.2 Sell-based model:
  - 1.6.1.2.1 `marginAmount = sellPrice * marginPercent`
  - 1.6.1.2.2 `buyPrice = sellPrice - marginAmount`
- 1.6.1.3 Legacy item line computation:
  - 1.6.1.3.1 `discountAmount = qty * unitPrice * discountPercent / 100`
  - 1.6.1.3.2 `lineTotal = (qty * unitPrice) - discountAmount`

### 1.6.2 Charge Aggregation Rules in Matrix
- 1.6.2.1 Charges aggregated by description key and container type.
- 1.6.2.2 Totals rendered with 2-decimal precision.
- 1.6.2.3 Risk: same description across different basis/unit contexts can collapse into one row.

### 1.6.3 Formatting Rules Observed in PDF
- 1.6.3.1 Numeric rendering: `toFixed(2)` for rates/amounts/totals.
- 1.6.3.2 Currency displayed as code in matrix (`Curr`).
- 1.6.3.3 Text truncation:
  - 1.6.3.3.1 Container headers truncated for long values.
  - 1.6.3.3.2 Charge description and notes truncated with ellipsis.
- 1.6.3.4 Dynamic column width:
  - 1.6.3.4.1 Fixed static columns + remaining width split across container columns.

## 1.7 Gap Matrix
| Gap ID | Area | Severity | Root Cause | Impact | Recommended Fix |
|---|---|---|---|---|---|
| G1 | Currency conversion in PDF pipeline | High | No explicit FX normalization stage | Mixed-currency totals can be misleading | Add conversion stage before safe context build; persist conversion metadata |
| G2 | Charge aggregation key collision | High | Matrix aggregation keyed mainly by description | Distinct charges may merge | Extend key with category, basis, unit, currency, and leg scope |
| G3 | Tax visibility inconsistency | High | Quote-level tax fields not guaranteed as charge rows | Tax can disappear in rendered breakup | Materialize tax/duties as explicit charges at save/version stage |
| G4 | Cargo model split | Medium | Dual sources (`cargo_details` vs `items/cargo_configurations`) | Equipment mismatch in PDF | Define strict precedence and reconciliation rule |
| G5 | Transit normalization inconsistency | Medium | Mixed string/hours representations | Inconsistent UI/PDF values | Canonicalize transit to hours in persistence and render from canonical value |
| G6 | Option substitution opacity (MGL fallback) | Medium | Heuristic replacement logic | Users may not know source of shown rates | Add render metadata and audit indicator for substituted option sets |

## 1.8 Data Integrity Risks
- 1.8.1 Data loss risk when charge pairing or leg association is incomplete.
- 1.8.2 Data corruption risk from aggregated rows collapsing semantically distinct charges.
- 1.8.3 Misrepresentation risk from rendering non-converted mixed currency values.
- 1.8.4 Compliance/reporting risk if tax/duty lines are omitted in final customer PDF.

## 1.9 Enhancement Plan Before Implementation
### 1.9.1 Requirement 1.0 - FX Normalization
- **1.9.1.1 Title:** FX Normalization in PDF Context
- **1.9.1.2 Gap Description:** Monetary values can be rendered across multiple source currencies without explicit conversion to a single quote display currency.
- **1.9.1.3 Proposed Solution:** Convert all monetary rows to quote display currency in PDF context and preserve original currency plus conversion-rate metadata in the context payload.
- **1.9.1.4 Responsible Stakeholder:** Backend Engineer (PDF Pipeline) with Finance Product Owner sign-off.
- **1.9.1.5 Estimated Effort (person-days):** 3.0
- **1.9.1.6 Target Completion Date:** 2026-03-17
- **1.9.1.7 Acceptance Criteria:**
  - 1.9.1.7.1 Every rendered monetary value includes a normalized display-currency amount.
  - 1.9.1.7.2 Original currency and conversion-rate metadata remain available for audit.
  - 1.9.1.7.3 Mixed-currency test quote renders deterministic totals in one currency.

### 1.9.2 Requirement 2.0 - Charge-Key Hardening
- **1.9.2.1 Title:** Composite Charge Aggregation Key
- **1.9.2.2 Gap Description:** Description-only aggregation can merge semantically different rows, causing data corruption in matrix output.
- **1.9.2.3 Proposed Solution:** Replace description-only key with `description + category + basis + unit + currency + leg_id` in matrix aggregation and rendering paths.
- **1.9.2.4 Responsible Stakeholder:** Backend Engineer (PDF Renderer) with QA Engineer validation.
- **1.9.2.5 Estimated Effort (person-days):** 2.5
- **1.9.2.6 Target Completion Date:** 2026-03-20
- **1.9.2.7 Acceptance Criteria:**
  - 1.9.2.7.1 Same-description charges with different basis/unit/currency never collapse.
  - 1.9.2.7.2 Row counts in output match expected fixture data.
  - 1.9.2.7.3 Existing single-currency/simple cases remain unchanged.

### 1.9.3 Requirement 3.0 - Tax Materialization
- **1.9.3.1 Title:** Explicit Tax and Duty Charge Materialization
- **1.9.3.2 Gap Description:** Quote-level tax fields are not consistently converted into option/charge rows consumed by PDF matrix rendering.
- **1.9.3.3 Proposed Solution:** Materialize quote-level taxes/duties as explicit charge rows during quote save/version assembly and include in option context totals.
- **1.9.3.4 Responsible Stakeholder:** Backend Engineer (Quote Persistence) with Finance Analyst review.
- **1.9.3.5 Estimated Effort (person-days):** 2.0
- **1.9.3.6 Target Completion Date:** 2026-03-24
- **1.9.3.7 Acceptance Criteria:**
  - 1.9.3.7.1 Quotes containing `tax_percent` or duty context render visible tax rows in PDF.
  - 1.9.3.7.2 Option totals reconcile to charge totals including tax rows.
  - 1.9.3.7.3 Legacy quote save scenarios pass without regression.

### 1.9.4 Requirement 4.0 - Canonical Transit Model
- **1.9.4.1 Title:** Canonical Transit Hours Standardization
- **1.9.4.2 Gap Description:** Transit values are represented in mixed string/day/hour forms, creating inconsistency across save, ranking, and PDF display paths.
- **1.9.4.3 Proposed Solution:** Persist transit in canonical hours and render day labels from canonical hours for user-facing displays.
- **1.9.4.4 Responsible Stakeholder:** Backend Engineer (Quotation Data Model) with Frontend Engineer alignment.
- **1.9.4.5 Estimated Effort (person-days):** 1.5
- **1.9.4.6 Target Completion Date:** 2026-03-26
- **1.9.4.7 Acceptance Criteria:**
  - 1.9.4.7.1 Transit parsing supports day/hour/mixed input consistently.
  - 1.9.4.7.2 Stored canonical transit field is always populated for valid inputs.
  - 1.9.4.7.3 UI and PDF show consistent transit values for the same option.

### 1.9.5 Requirement 5.0 - Cargo Source Precedence
- **1.9.5.1 Title:** Cargo Data Precedence and Reconciliation
- **1.9.5.2 Gap Description:** Cargo information can diverge across `cargo_details`, `items`, and `cargo_configurations`, leading to equipment mismatches in output.
- **1.9.5.3 Proposed Solution:** Enforce precedence order `cargo_configurations` primary, `items` fallback, and `cargo_details` metadata-only, with reconciliation checks on save.
- **1.9.5.4 Responsible Stakeholder:** Backend Engineer (Quote Save Pipeline) with Product Manager approval.
- **1.9.5.5 Estimated Effort (person-days):** 2.0
- **1.9.5.6 Target Completion Date:** 2026-03-31
- **1.9.5.7 Acceptance Criteria:**
  - 1.9.5.7.1 Equipment type/size/qty in PDF matches precedence source.
  - 1.9.5.7.2 Conflicts are logged as reconciliation warnings.
  - 1.9.5.7.3 Existing quote hydration remains backward compatible.

### 1.9.6 Requirement 6.0 - Render Audit Metadata
- **1.9.6.1 Title:** PDF Render Audit and Source Transparency
- **1.9.6.2 Gap Description:** MGL substitution and template fallback behavior are not sufficiently visible for operators and QA audit trails.
- **1.9.6.3 Proposed Solution:** Add render metadata flags for option-source substitution and template fallback selection in generation logs and response metadata.
- **1.9.6.4 Responsible Stakeholder:** Backend Engineer (Edge Function Logging) with QA Lead validation.
- **1.9.6.5 Estimated Effort (person-days):** 1.5
- **1.9.6.6 Target Completion Date:** 2026-04-02
- **1.9.6.7 Acceptance Criteria:**
  - 1.9.6.7.1 Logs indicate whether MGL substitution occurred.
  - 1.9.6.7.2 Logs indicate final template selected and fallback reason.
  - 1.9.6.7.3 QA can trace one PDF output to source options and template path.

## 1.10 Test and Regression Strategy
### 1.10.1 Mandatory Scenarios
1.10.1.1 Multi-modal quote with 3+ legs and mixed leg/global charges.
1.10.1.2 Mixed-currency options rendered in one quote.
1.10.1.3 Incoterm-sensitive quote with tax/duty fields.
1.10.1.4 FCL/LCL/breakbulk/temperature-controlled/hazmat combinations.
1.10.1.5 Overlapping charge descriptions with different basis/unit.
1.10.1.6 MGL fallback activation and non-activation paths.

### 1.10.2 Assertions
- 1.10.2.1 Sum of rendered charges equals option grand total in selected display currency.
- 1.10.2.2 Buy-side charges never appear in customer-facing PDF.
- 1.10.2.3 Transit is displayed consistently across options and legs.
- 1.10.2.4 Tax lines present when quote includes tax context.
- 1.10.2.5 Template resolution is deterministic and logged.

## 1.11 Execution Checklist
1.11.1 Implement FX normalization stage in PDF context builder.
1.11.2 Implement composite aggregation key in matrix helper/renderer.
1.11.3 Materialize tax into explicit charge rows during quote save/version assembly.
1.11.4 Add integrity assertions for total reconciliation.
1.11.5 Add regression tests for all mandatory scenarios.
1.11.6 Roll out behind feature flag and compare before/after generated PDFs.

## 1.12 Implementation Priority
1.12.1 FX normalization
1.12.2 Charge-key hardening
1.12.3 Tax materialization
1.12.4 Transit and cargo canonicalization
1.12.5 Render audit metadata and rollout controls
