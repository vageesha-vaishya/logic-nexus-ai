# Unified Quote Composer Logic Fixes (March 6, 2026)

## Scope
This patch addresses four production issues in the Quotation / Unified Composer flow:

1. Duplicate global charge entries and incorrect global aggregation.
2. False route continuity warnings in Finalize Quote route configuration.
3. Missing AI-generated route field population (mode/carrier/origin/destination/dates).
4. Fragile option comparison behavior with sparse/incomplete option payloads.

## Backward Compatibility
- Existing API contracts and payload shapes are preserved.
- Existing data fields (`leg_id`, `legId`, buy/sell shapes, global charges) remain supported.
- Fixes are additive/defensive and avoid schema changes.

## Implementation Details

### 1) Global Charge Calculation and De-duplication
Files:
- `src/hooks/useChargesManager.ts`
- `src/components/sales/unified-composer/UnifiedQuoteComposer.tsx`

Changes:
- Added deterministic charge signatures for duplicate detection.
- Deduplicated charge ingestion in `initCharges` across leg/global sources.
- Preserved leg assignment by honoring `leg_id` / `legId` for option-level charges.
- Improved charge normalization for buy/sell payload variants.
- Added payload-level dedupe in `flattenOptionCharges` to avoid duplicate save serialization.
- Strengthened load-time charge grouping and dedupe in reconstructed options.

### 2) Route Configuration Gap Warning Fix
Files:
- `src/components/sales/composer/routeContinuity.ts` (new)
- `src/components/sales/composer/LegManager.tsx`

Changes:
- Added normalized continuity utility with placeholder awareness.
- Continuity check now prioritizes location IDs when available.
- String comparison now normalizes punctuation/case/spacing.
- Placeholder tokens (`Origin`, `Destination`, `TBD`) no longer trigger false warnings.

### 3) AI-Generated Route Field Population Fix
Files:
- `src/lib/quote-mapper.ts`
- `src/hooks/useRateFetching.ts`

Changes:
- Extended leg mapping to support AI shape fields (`from`, `to`, `type`, `etd`, `eta`, alternate naming variants).
- Added robust mode normalization per leg.
- Added leg type normalization (`pickup`, `transport/main`, `delivery`, etc.).
- Added safer carrier/name/transit fallbacks in AI option conversion.
- Ensured AI options always provide usable `mode`, `transport_mode`, and normalized legs array.

### 4) Option Comparison Module Hardening
Files:
- `src/components/sales/shared/QuoteComparisonView.tsx`

Changes:
- Introduced resilient total-cost derivation when `price`/`total_amount` is missing.
- Added safe transit parsing with graceful `N/A` fallback.
- Added comparative rows:
  - Cost Delta vs Cheapest
  - Transit Delta vs Fastest
  - Mode Coverage
- Prevented failures on partial/incompatible option structures.

## Tests Added/Updated
- `src/hooks/__tests__/useChargesManager.test.ts`
  - duplicate suppression
  - leg-id charge assignment correctness
- `src/components/sales/composer/__tests__/routeContinuity.test.ts` (new)
  - continuity algorithm and placeholder/id edge cases
- `src/lib/__tests__/quote-mapper.test.ts`
  - AI route leg field mapping
  - duplicate global charge removal
- `src/components/sales/shared/__tests__/QuoteComparisonView.test.tsx`
  - sparse option comparison robustness

## Operational Notes
- No migration required.
- No environment variable changes required.
- Existing save/load behavior remains intact with stricter de-duplication guards.
