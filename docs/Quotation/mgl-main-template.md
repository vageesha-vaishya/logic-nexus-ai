# MGL Main Template: Multi-Rate Quotation Architecture

## 1) Template Architecture

The MGL Main Template implementation is built around modular blocks:

- `MGL Rate Option Engine`
  - Validates leg continuity and mode transitions.
  - Computes per-equipment totals and grand totals for each carrier option.
- `Charge Matrix Model`
  - Row-oriented charge definitions (`Ocean Freight`, `Trucking`, surcharges, fees).
  - Column-oriented equipment profiles (`Standard-20`, `Open Top-40`, `Flat Rack-40`, `Platform-20`, `High Cube-45`).
- `Transport Leg Model`
  - Supports multi-leg, multi-modal journeys (`air`, `ocean`, `road`, `rail`).
  - Ordered sequence with route continuity checks.
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

Migration: `supabase/migrations/20260307153000_mgl_main_template_multi_rate_foundation.sql`

New tables:

- `mgl_templates`
- `mgl_rate_options`
- `mgl_rate_option_legs`
- `mgl_rate_charge_rows`
- `mgl_rate_charge_cells`
- `mgl_rate_option_history`
- `mgl_quotation_audit_logs`

Views:

- `mgl_rate_matrix_view` (flattened read model)
- `quotation_version_options_mgl_compat` (legacy integration)

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

## 6) Backward Compatibility

- `compatibility.ts` provides mappings between MGL and legacy rate models.
- View `quotation_version_options_mgl_compat` enables downstream systems to consume MGL data without immediate refactor.

## 7) Test Coverage

- Unit: `tests/unit/mgl/mgl-engine.test.ts`
- Integration: `tests/integration/mgl/multimodal-scenario.test.ts`
- Regression: `tests/unit/mgl/mgl-compatibility.regression.test.ts`

## 8) Migration Guidelines

1. Run DB migration.
2. Deploy `mgl-quotation-api` edge function.
3. Gradually route MGL customers/templates to new API.
4. Keep legacy quotation APIs active while using compatibility view.
5. After downstream migration completion, remove compatibility dependencies.
