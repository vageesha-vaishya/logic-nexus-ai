# MGL Main Template: Multi-Rate Quotation Architecture

## 1) Template Architecture

The MGL Main Template implementation is built around modular blocks:

- `MGL Rate Option Engine`
  - Validates leg continuity and mode transitions.
  - Computes per-equipment totals and grand totals for each carrier option.
  - Generates four standalone rate options for scenario-based quoting.
- `Charge Matrix Model`
  - Row-oriented charge definitions (`Ocean Freight`, `Trucking`, surcharges, fees).
  - Column-oriented equipment profiles (`Standard-20`, `Open Top-40`, `Flat Rack-40`, `Platform-20`, `High Cube-45`).
- `Transport Leg Model`
  - Supports multi-leg, multi-modal journeys (`air`, `ocean`, `road`, `rail`).
  - Ordered sequence with route continuity checks.
  - Validates NYC origin and Dehra Dun Airport destination scope.
- `Scenario Constraints`
  - Container profile validation for `20'`, `40'`, `40'HC`, `45'`.
  - Commodity handling compatibility validation across container types.
- `Compatibility Layer`
  - Maps MGL options to legacy `RateOption`/`quote-breakdown` structures.
  - Supports backward consumption by existing quotation views and services.

Code modules:

- `src/services/quotation/mgl/types.ts`
- `src/services/quotation/mgl/engine.ts`
- `src/services/quotation/mgl/compatibility.ts`
- `src/services/quotation/MglMainTemplateService.ts`
- `src/components/sales/templates/MglMainTemplateBuilder.tsx`

## 2) Database Schema

Migration: `supabase/migrations/20260307153000_main_template_multi_rate_foundation.sql`

New tables:

- `templates`
- `rate_options`
- `rate_option_legs`
- `rate_charge_rows`
- `rate_charge_cells`
- `rate_option_history`
- `quotation_audit_logs`

Views:

- `rate_matrix_view` (flattened read model)
- `quotation_version_options_compat` (legacy integration)

Features:

- RLS enabled with tenant-scoped policies.
- History tracking via immutable revision snapshots.
- Audit trail for create/update/delete operations.
- Indexes optimized for quote/version option access patterns.

## 3) API Specification

Edge Function: `mgl-quotation-api`

### Actions

- `upsert_template`
- `list_templates`
- `upsert_rate_option`
- `get_rate_option`
- `delete_rate_option`
- `list_rate_history`
- `calculate_only`

### Request Envelope

```json
{
  "action": "upsert_rate_option",
  "tenantId": "<uuid>",
  "payload": { "...": "..." }
}
```

### Response Envelope

```json
{
  "data": { "...": "..." }
}
```

Validation errors return:

```json
{
  "error": "Validation failed",
  "issues": ["..."]
}
```

## 4) UI Configuration

Component: `MglMainTemplateBuilder`

Supports:

- Carrier, transit time, and frequency metadata.
- Dynamic row creation/removal for charge matrix.
- Dynamic per-equipment value editing.
- Real-time matrix totals computation.
- Save to backend through `MglMainTemplateService`.

## 5) Business Rules

- Minimum one transport leg required.
- Legs must be sequential and route-continuous.
- Negative charges are rejected.
- Totals are computed per equipment column and aggregated for analytics/reporting.
- Standalone mode requires exactly four rate options with ordinals `1..4`.
- Route scope validation enforces New York City origin and Dehra Dun Airport destination.
- Commodity and container compatibility rules reject invalid pairings.

## 6) Capability Gap Analysis for NYC → Dehra Dun Scenario

Original MGL limitations before enhancement:

- No first-class commodity field to enforce handling policies.
- No container type and size validation for advanced equipment combinations.
- No explicit route scope guard for NYC-to-Dehra-Dun specific workflows.
- No deterministic generator for four required standalone rate options.

Enhancements implemented:

- Added `containerType`, `containerSize`, and `commodityType` to `MglRateOption`.
- Added `MglScenarioConfig` for standalone scenario-driven generation.
- Added engine-level rules:
  - `CONTAINER_UNSUPPORTED`
  - `CONTAINER_COMMODITY_INCOMPATIBLE`
  - `ROUTE_OUT_OF_SCOPE`
  - `INVALID_OPTION_SET`
  - `MISSING_REQUIRED_FIELD`
- Added `generateStandaloneMglRateOptions` and `validateStandaloneOptionSet`.
- Added service wrappers in `MglMainTemplateService` for standalone option generation/validation.
- Expanded builder UI to capture container, commodity, and route fields and to save all four standalone options.

## 7) Backward Compatibility

- `compatibility.ts` provides mappings between MGL and legacy rate models.
- View `quotation_version_options_compat` enables downstream systems to consume MGL data without immediate refactor.
- New fields are additive and optional, preserving existing API payload compatibility.

## 8) Test Coverage

- Unit: `tests/unit/mgl/mgl-engine.test.ts`
- Integration: `tests/integration/mgl/multimodal-scenario.test.ts`
- Regression: `tests/unit/mgl/mgl-compatibility.regression.test.ts`
- Additional validations covered:
  - Four-option standalone generation.
  - Commodity/container compatibility.
  - NYC-to-Dehra-Dun route scope checks.

## 9) Migration Guidelines

1. Run DB migration.
2. Deploy `mgl-quotation-api` edge function.
3. Gradually route MGL customers/templates to new API.
4. Keep legacy quotation APIs active while using compatibility view.
5. After downstream migration completion, remove compatibility dependencies.
