# Preferred Carrier Centralization & Rail Mode Integration

## Goals
- Eliminate duplicate preferred carrier entries across Sales modules
- Centralize preferred carrier selection via vendors
- Add Railways mode across Quotation, Fulfillment, Invoicing/Billing, AES, and Financials
- Maintain audit trails, RLS compatibility, multi‑modal support, and robust validation

## Root Cause Analysis (Duplicates)
- Duplicates originate from multiple carrier rows with identical names differentiated by tenant or legacy imports
- UI lists consume raw carriers without normalization or deduplication
- Multi‑modal flows amplify duplicates when filtering per mode without distinct selection

## Chosen Architecture
- Canonical carriers in `carriers` table with functional unique index on lower(name)+type+tenant
- Vendor‑centric preference mapping via `vendor_preferred_carriers`
- Mode mapping enforces `transport_mode` in ('ocean','air','road','rail')
- RPC `get_preferred_carriers_for_vendor` to serve scoped carrier lists with mode filtering

## Schema Changes
- Add `rail` to `transport_modes`; add `rail_freight` in `service_types`
- Create `vendor_preferred_carriers` with unique(vendor_id, carrier_id, transport_mode)
- Add audit trigger: `audit_row_change` on `vendor_preferred_carriers`
- Dedupe carriers and enforce unique index:
  - `ux_carriers_name_type_tenant` on (lower(carrier_name), carrier_type, coalesce(tenant_id,'global'))

## API/RPC
- `get_preferred_carriers_for_vendor(vendor_id, mode, tenant_id)` returns distinct active carriers
- Continue existing direct `carriers` fetch for default lists; overlay vendor preferences when provided

## UI Updates
- Quick Quote: memoized mode‑filtered carriers; deduping by normalized name; supports rail mode
- Create Detailed Quotation Composer: deduped carriers, option dialog mode‑filtered; rail mode supported
- Shipment Detail: carrier_id join renders selected preferred carrier; rail type flows through RPC conversion

## Validation & Error Handling
- Input validation for transport_mode values and UUIDs
- Fallback handling when vendor preferences absent or empty
- Defensive string normalization against UI echo errors

## Testing Scenarios
- Sales: Preferred carrier dropdowns dedupe by name across all modes
- Vendor mapping: mode‑specific preferences resolve correctly; audit entries recorded
- Quote→Shipment conversion persists carrier_id; Shipment Detail renders name
- Billing/Invoice: selected carrier present in charge attribution and summaries
- AES Submission: mode rail supported in validations and payloads

## Migration & Rollback
- Migrations:
  - `20260205130000_preferred_carriers_and_rail.sql`
  - `20260205130500_dedupe_carriers.sql`
- Rollback plan:
  - Drop `vendor_preferred_carriers` and its trigger
  - Remove unique index `ux_carriers_name_type_tenant`
  - Optionally delete `rail` and `rail_freight` records if reverting
  - Reimport carriers from last clean snapshot

## Data Integrity & Auditing
- Unique index prevents future duplicates
- `audit_row_change` captures INSERT/UPDATE/DELETE on mapping table
- Mode‑filtered selections ensure consistent downstream calculations

## Multi‑Modal Support
- Rail joins existing mode map for components and RPCs
- Composer legs and Quick Quote schemas accept `rail`
- Financials and pricing services continue to operate on normalized carriers
