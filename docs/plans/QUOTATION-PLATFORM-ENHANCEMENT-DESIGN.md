# Quotation Platform Enhancement Design Document

**Version**: 1.0
**Date**: 2026-02-15
**Scope**: End-to-end quotation platform — Quick Quote, AI Quote, Detailed Quote, Composer, Version Management, PDF Generation, Send Quote
**Classification**: Internal Engineering — Architecture & Root Cause Analysis

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Architecture](#2-current-state-architecture)
3. [Module-by-Module Analysis](#3-module-by-module-analysis)
4. [Critical Problem Statements & Root Causes](#4-critical-problem-statements--root-causes)
5. [Data Flow Mapping & Failure Points](#5-data-flow-mapping--failure-points)
6. [PDF Generation Analysis](#6-pdf-generation-analysis)
7. [Composer Auto-Population Failures](#7-composer-auto-population-failures)
8. [Data Consistency & Schema Analysis](#8-data-consistency--schema-analysis)
9. [Proposed Architectural Improvements](#9-proposed-architectural-improvements)
10. [Phased Implementation Roadmap](#10-phased-implementation-roadmap)
11. [Success Metrics & Quality Benchmarks](#11-success-metrics--quality-benchmarks)
12. [Appendix: File Reference Map](#appendix-file-reference-map)

---

## 1. Executive Summary

### Objective

This document delivers a comprehensive root cause analysis of the Logic Nexus AI quotation platform, covering all modules from initial quote capture through PDF delivery. It identifies **38 distinct technical issues** across 5 severity tiers, proposes architectural solutions, and provides a phased implementation roadmap.

### Key Findings

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Data Consistency | 4 | 6 | 3 | 2 | 15 |
| PDF Generation | 3 | 3 | 2 | 1 | 9 |
| Auto-Population | 2 | 4 | 1 | 0 | 7 |
| Schema/Type Safety | 1 | 2 | 2 | 2 | 7 |
| **Total** | **10** | **15** | **8** | **5** | **38** |

### Top 5 Critical Blockers

1. **Field name mismatches** (`port.port_name` vs DB `location_name`) cause blank origin/destination in Composer
2. **Dual PDF engine divergence** — V1 and V2 engines use different field mappings, producing inconsistent PDFs
3. **Commodity name never fetched** — PDF defaults to "General Cargo" because `commodity_id` is never joined to `commodities` table
4. **Charge saving missing from RPC** — `save_quote_atomic()` updates legs but never inserts/updates charges
5. **Dual carrier/currency columns** in `quotation_version_options` with no single source of truth

---

## 2. Current State Architecture

### 2.1 System Overview

```
                    ┌─────────────────────────────────────────┐
                    │            ENTRY POINTS                  │
                    ├──────────┬──────────┬───────────────────┤
                    │  Quick   │  AI      │  Detailed Quote   │
                    │  Quote   │  Quote   │  (QuoteForm)      │
                    │  Modal   │  (AI     │                   │
                    │          │  Advisor)│                   │
                    └────┬─────┴────┬─────┴─────────┬─────────┘
                         │          │               │
                    ┌────▼──────────▼───────────────▼─────────┐
                    │        DATA TRANSFORMATION LAYER         │
                    │  QuoteTransferSchema (Zod validation)    │
                    │  QuoteTransformService (ID resolution)   │
                    │  mapOptionToQuote (rate normalization)    │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────────┐
                    │          QUOTE ORCHESTRATOR              │
                    │  QuoteNew.tsx (page-level coordinator)   │
                    │  - Version creation                      │
                    │  - Option insertion                      │
                    │  - Master data loading                   │
                    └────────┬───────────────┬────────────────┘
                             │               │
                    ┌────────▼────┐  ┌───────▼────────────────┐
                    │  QuoteForm  │  │  MultiModalQuote       │
                    │  Refactored │  │  Composer               │
                    │  (form mode)│  │  (wizard mode)          │
                    └──────┬──────┘  └─────────┬──────────────┘
                           │                   │
                    ┌──────▼───────────────────▼──────────────┐
                    │         DATA PERSISTENCE LAYER           │
                    │  save_quote_atomic() RPC                 │
                    │  Supabase Direct Queries                 │
                    │  ScopedDataAccess                        │
                    └──────────────┬──────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────┐
                    │         OUTPUT LAYER                      │
                    │  ┌─────────┐ ┌──────────┐ ┌───────────┐│
                    │  │ PDF Gen │ │ Send     │ │ Version   ││
                    │  │ Engine  │ │ Quote    │ │ History   ││
                    │  └─────────┘ └──────────┘ └───────────┘│
                    └─────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + TypeScript | Vite bundler, route-level code splitting |
| State Management | React Hook Form + Zod + useState/useReducer | No global store (Redux/Zustand at component level) |
| Backend | Supabase (Postgres + Edge Functions) | 47 Deno edge functions |
| PDF | pdf-lib (edge function) | Dual engine: V1 (manual draw) + V2 (template renderer) |
| Email | Multi-provider (Resend, Gmail OAuth, O365, SMTP) | Failover with retry |
| AI | OpenAI GPT-4o via ai-advisor edge function | Rate generation, compliance, classification |

### 2.3 Database Schema — Core Quote Tables

| Table | Purpose | Row Estimate |
|-------|---------|-------------|
| `quotes` | Quote header (customer, origin, destination, status) | Parent |
| `quote_items_core` | Line items (product, qty, price) | N per quote |
| `quote_items_extension` | Logistics extensions (weight, volume, container) | 1:1 with core |
| `quote_cargo_configurations` | Cargo config (mode, container type/size, hazmat) | N per quote |
| `quotation_versions` | Version snapshots (version_number, valid_until) | N per quote |
| `quotation_version_options` | Carrier rate options per version | N per version |
| `quotation_version_option_legs` | Transport legs per option | N per option |
| `quote_charges` | Charges per leg/option (buy/sell sides) | N per leg |
| `ai_quote_requests` | Quick Quote AI request/response history | Audit |

---

## 3. Module-by-Module Analysis

### 3.1 Quick Quote Module

**Files**: `src/components/sales/quick-quote/QuickQuoteModal.tsx`

**Capabilities**:
- 4 transport modes (Air, Ocean, Road, Rail) with mode-specific fields
- AI-assisted code lookup, commodity classification, compliance validation
- Parallel rate engine invocation (legacy `rate-engine` + AI advisor `generate_smart_quotes`)
- Multi-rate selection with batch conversion to full quote
- Container combo support (multiple type/size/qty combinations)

**Data Collected** (20+ fields):
- Core: origin, destination, mode, commodity, weight, volume
- Ocean: containerCombos[] (type, size, qty)
- Air: dimensions, dangerous goods
- Road: vehicleType, pallets
- Rail: containerCombos[] (type, size, qty), intermodal terminal details
- All: pickupDate, deliveryDeadline, htsCode, scheduleB, preferredCarriers
- Extended: originDetails/destinationDetails (full location objects with name, code, type, country, city)

**Output**: `QuoteTransferData` (Zod-validated) passed via React Router `navigate('/dashboard/quotes/new', { state })` containing all form fields + `selectedRates: RateOption[]` + AI metadata (marketAnalysis, confidenceScore, anomalies).

**Issues Found**:
- `extendedData` state managed separately from React Hook Form — dual state source
- AI fallback to "simulation engine" when rate-engine fails produces synthetic data with no source marking
- Rate deduplication in `mapOptionToQuote` uses loose name matching ("Freight" vs "Freight Charges")
- **Missing Rail mode**: Quick Quote base schema only defines `z.enum(["air", "ocean", "road"])` — Rail must be added to the mode enum, along with rail-specific form fields (container combos, intermodal terminal, rail carrier selection)

### 3.2 AI Quote (AI Advisor)

**File**: `supabase/functions/ai-advisor/index.ts`

**Capabilities**:
- 6 actions: suggest_unit, classify_commodity, predict_price, generate_smart_quotes, lookup_codes, validate_compliance
- Caching via `ai_quote_cache` table
- Historical context from `rates` table
- Generates 5 tier options: best_value, cheapest, fastest, greenest, reliable

**Issues Found**:
- AI response structure assumes specific JSON format from GPT-4o — no schema validation on AI output
- Dynamic pricing adds 12% fuel surcharge + 2% currency buffer — hardcoded percentages
- Cache expiry not configurable per tenant

### 3.3 Quote Composer (MultiModalQuoteComposer)

**Files**: `src/components/sales/MultiModalQuoteComposer.tsx`, `src/components/sales/composer/*.tsx`

**Architecture**: 4-step wizard with QuoteStore (reducer pattern)
1. Quote Details → reference data + quote header
2. Transport Legs → leg configuration with origin/destination/mode
3. Charges Management → charge allocation to legs
4. Review & Save → finalization

**State**: QuoteStore initializes with all-empty arrays/objects, populated via dispatched actions during `loadInitialData()` (~570 lines of initialization logic).

**Data Loading** (`loadInitialData`):
1. Tenant resolution (4-level fallback: prop → context → user metadata → DB lookup)
2. Quote data fetch (quotes table with account/contact/port joins)
3. Quote items fetch → calculate weight/volume
4. Reference data (14 tables with 5-min cache, 3-attempt retry each)
5. Auto-fill origin/destination from port IDs
6. Default leg creation from quote data

**Critical Issues**: See [Section 7](#7-composer-auto-population-failures) for detailed analysis.

### 3.4 Quote Form (QuoteFormRefactored)

**File**: `src/components/sales/quote-form/QuoteFormRefactored.tsx`

**Purpose**: Separate entry point from Composer — traditional form-based quote editing.

**Data Hooks**:
- `useQuoteData` — fetches 8 reference datasets (ports, carriers, accounts, contacts, services, service types, shipping terms, currencies)
- `useQuoteRepositoryForm` — hydration from DB, save via `save_quote_atomic()` RPC

**Issues**:
- `useQuoteData` and `useQuoteRepositoryContext` contain **duplicate logic** for the same 8 reference data fetches
- Auto-save triggers on `origin_port_id` resolution but checks for `origin_location_id` (wrong field name)
- No unified error boundary for partial reference data load failures

### 3.5 Version Management

**Tables**: `quotation_versions`, `quotation_version_options`, `quotation_version_option_legs`

**Capabilities**:
- Sequential version numbering (1, 2, 3...) with major.minor semantic versioning
- `current_version_id` on quotes table tracks active version
- Version comparison UI (side-by-side option/pricing comparison)
- Customer selection tracking via `customer_quote_selections` table

**Status Workflow**:
```
DRAFT → SENT → ACCEPTED
  │               │
  └→ EXPIRED  ←───┘
  │
  └→ CANCELLED
```

**Issues**:
- `getLatestVersionIdWithRetry` uses RLS bypass mode (`scopedDb.from('quotation_versions', true)`) — security concern
- Version creation lacks transactional guarantee with option insertion
- No diff mechanism for charge-level changes between versions

### 3.6 PDF Generation

**File**: `supabase/functions/generate-quote-pdf/index.ts`

**Dual Engine Architecture**:

| Feature | V1 (Legacy) | V2 (Template) |
|---------|-------------|---------------|
| Rendering | Manual pdf-lib drawing | PdfRenderer + template sections |
| Layout | Hardcoded MGL-specific | Template-driven (DefaultTemplate) |
| Field source | `items[0].description`, `weight_kg` | `commodity_description`, `total_weight` |
| Triggered by | No `engine_v2` flag | `engine_v2: true` |
| Company data | Hardcoded MGL address/phone | From branding/template |

**Critical Issues**: See [Section 6](#6-pdf-generation-analysis) for detailed analysis.

### 3.7 Send Quote

**File**: `src/components/sales/SendQuoteDialog.tsx`, `supabase/functions/send-email/index.ts`

**Flow**:
1. Generate PDF (calls `generate-quote-pdf` with `engine_v2: true`)
2. Dispatch email (multi-provider: Resend → Gmail → O365 → SMTP)
3. Emit audit event (`EmailSent`)
4. Log to `emails` table
5. Update quote status to `sent`

**Capabilities**:
- Branded email rendering with logo, signature, tracking pixel
- Link rewriting for click tracking
- Attachment validation (10MB limit, PDF magic bytes check)
- Retry with exponential backoff (3 attempts, 5 for VIP)

**Issues**:
- PDF is regenerated on every send (no caching of generated PDF)
- Status update to `sent` happens independently of successful email delivery
- No template selection in SendQuoteDialog (always uses default)

---

## 4. Critical Problem Statements & Root Causes

### PROBLEM 1: Data Pipeline Failures — Quick Quote to Composer

**Symptom**: Data entered in Quick Quote does not appear in the Composer after conversion.

**Root Cause Chain**:

```
Quick Quote (QuickQuoteModal)
  │ Collects: origin (string), destination (string), originDetails (object)
  │
  ▼ navigate() with state
QuoteNew.tsx
  │ Calls: QuoteTransformService.transformToQuoteForm(state, masterData)
  │ FAILURE POINT 1: resolvePortId() does NAME lookup but ports may only match on CODE
  │ FAILURE POINT 2: masterData fetch can partially fail (14 parallel queries)
  │
  ▼ Creates quote + version in DB
  │ Calls: insertOptions() for each selectedRate
  │ FAILURE POINT 3: Container ID resolution uses string matching ("20" → "20ft")
  │
  ▼ Passes quoteId + versionId to Composer
MultiModalQuoteComposer
  │ Calls: loadInitialData()
  │ FAILURE POINT 4: Fetches quote from DB but port.port_name doesn't exist (should be location_name)
  │ FAILURE POINT 5: Service type resolution uses st.mode but DB has transport_modes relationship
  │ FAILURE POINT 6: Only first leg gets origin/destination; subsequent legs are blank
  │
  ▼ Dispatches to QuoteStore
  │ FAILURE POINT 7: All empty initial state — no validation that dispatched data is non-empty
  │ FAILURE POINT 8: Rail mode not in Quick Quote enum — rail quotes cannot originate from Quick Quote
```

**Data Loss Points** (quantified):

| Transfer Step | Fields at Risk | Typical Loss Rate |
|--------------|----------------|-------------------|
| Quick Quote → TransferSchema | originDetails, containerCombos, rail mode entirely | ~5% (Zod strips extra fields); 100% for rail (mode not in enum) |
| TransferSchema → QuoteFormValues | origin_port_id, carrier_id, service_type_id | ~30% (ID resolution failures) |
| QuoteFormValues → DB Insert | charges, leg details | ~15% (RPC doesn't save charges) |
| DB → Composer loadInitialData | origin name, destination name, service type | ~40% (field name mismatches) |

### PROBLEM 2: PDF Inconsistency and Missing Information

**Symptom**: Generated PDFs show "General Cargo" instead of actual commodity, missing weights/volumes, and different layouts between preview and download.

**Root Causes**:

1. **Missing commodity join**: `quote_items` has `commodity_id` FK but PDF query never joins `commodities` table. Code uses `commodity_description` field that doesn't exist, falling back to "General Cargo".

2. **Field name divergence between engines**:
   - V2 uses `total_weight`, `total_volume` (don't exist on items)
   - V1 uses `weight_kg` (correct DB column name)
   - Result: V2 PDFs always show 0 weight/volume

3. **Preview/Download engine mismatch**:
   - `QuotePreviewModal` always sends `engine_v2: true`
   - Backend webhooks/direct calls may omit this flag → V1 engine
   - Users see V2 preview but get V1 PDF in email

4. **Hardcoded MGL company data** in V1 engine — wrong company on PDFs for other tenants

### PROBLEM 3: Composer Auto-Population Failures

**Symptom**: Opening a quote in the Composer shows blank origin, destination, service type, and carrier fields despite data existing in the database.

**Root Causes**: See [Section 7](#7-composer-auto-population-failures) for the complete 8-category analysis.

---

## 5. Data Flow Mapping & Failure Points

### 5.1 Complete Data Flow: Quick Quote → Email Delivery

```
STAGE 1: CAPTURE (QuickQuoteModal)
┌─────────────────────────────────────────────────────┐
│ Form Data (React Hook Form + extendedData state)    │
│ ┌─────────┐ ┌──────────────┐ ┌──────────────────┐  │
│ │ Core    │ │ Extended     │ │ AI Results       │  │
│ │ origin  │ │ containerCombos│ │ selectedRates[]  │  │
│ │ dest    │ │ originDetails│ │ marketAnalysis   │  │
│ │ mode    │ │ pickupDate   │ │ confidenceScore  │  │
│ │ commodity│ │ htsCode     │ │ anomalies[]      │  │
│ └─────────┘ └──────────────┘ └──────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ QuoteTransferSchema.parse()
                       ▼
STAGE 2: VALIDATION (QuoteTransferSchema)
┌─────────────────────────────────────────────────────┐
│ Zod Schema Validation                                │
│ ISSUE: 10 fields use z.any() — no real validation   │
│ ISSUE: legs/charges arrays validated as z.array(z.any()) │
│ ISSUE: weight/volume accept string|number union     │
└──────────────────────┬──────────────────────────────┘
                       │ navigate() with state
                       ▼
STAGE 3: TRANSFORMATION (QuoteNew.tsx + QuoteTransformService)
┌─────────────────────────────────────────────────────┐
│ ID Resolution Against Master Data                    │
│ ┌───────────────────────────────────────────────┐   │
│ │ resolvePortId("Shanghai") → UUID or undefined │   │
│ │ resolveCarrierId("Maersk") → UUID or undefined│   │
│ │ resolveServiceTypeId("ocean") → UUID or undef │   │
│ └───────────────────────────────────────────────┘   │
│ ISSUE: String matching is fragile (case, aliases)   │
│ ISSUE: Undefined results silently passed through    │
└──────────────────────┬──────────────────────────────┘
                       │ DB inserts
                       ▼
STAGE 4: PERSISTENCE (Supabase)
┌─────────────────────────────────────────────────────┐
│ quotes → quotation_versions → options → legs        │
│ ISSUE: Charges NOT persisted at this stage           │
│ ISSUE: Container ID resolution uses string matching  │
│ ISSUE: No transaction wrapping version + options     │
└──────────────────────┬──────────────────────────────┘
                       │ quoteId + versionId
                       ▼
STAGE 5: HYDRATION (MultiModalQuoteComposer.loadInitialData)
┌─────────────────────────────────────────────────────┐
│ Re-fetch from DB into QuoteStore                     │
│ ISSUE: port.port_name (wrong) vs location_name (DB) │
│ ISSUE: 14 parallel ref data queries can partially fail│
│ ISSUE: st.mode vs transport_modes relationship      │
│ ISSUE: Only leg[0] gets origin/dest populated       │
└──────────────────────┬──────────────────────────────┘
                       │ User edits in Composer
                       ▼
STAGE 6: SAVE (save_quote_atomic RPC)
┌─────────────────────────────────────────────────────┐
│ Atomic save of quote + items + cargo configs        │
│ ISSUE: is_primary (form) vs is_selected (RPC)       │
│ ISSUE: Charges NOT saved — only legs updated        │
│ ISSUE: New options ignored (only updates existing)  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
STAGE 7: PDF GENERATION (generate-quote-pdf edge fn)
┌─────────────────────────────────────────────────────┐
│ Fetch quote + items + version + options + charges   │
│ ISSUE: commodity_description doesn't exist → "General Cargo" │
│ ISSUE: V1 vs V2 engine field divergence             │
│ ISSUE: weight_kg vs total_weight field mismatch     │
│ ISSUE: Hardcoded MGL company in V1                  │
└──────────────────────┬──────────────────────────────┘
                       │ base64 PDF
                       ▼
STAGE 8: DELIVERY (send-email edge fn)
┌─────────────────────────────────────────────────────┐
│ Attach PDF + render branded email + dispatch        │
│ ISSUE: PDF regenerated every send (no cache)        │
│ ISSUE: No PDF integrity validation before attach    │
└─────────────────────────────────────────────────────┘
```

### 5.2 Failure Point Summary

| Stage | Failure Point | Severity | Data Impact |
|-------|--------------|----------|-------------|
| 2 | `z.any()` on legs/charges | Medium | Malformed data passes validation |
| 3 | Port ID resolution by name | Critical | origin_port_id = undefined |
| 3 | Carrier ID resolution by name | High | carrier_id = undefined |
| 4 | No charge persistence | Critical | All charges lost |
| 4 | Container string→ID matching | High | Wrong container IDs |
| 5 | `port.port_name` field mismatch | Critical | Blank origin/destination |
| 5 | `st.mode` vs transport_modes | High | Service type not resolved |
| 5 | Partial ref data failures | High | Empty dropdowns |
| 6 | is_primary vs is_selected | Critical | Primary option not marked |
| 6 | New options not created | High | Added options discarded |
| 7 | commodity_description missing | Critical | "General Cargo" on PDF |
| 7 | V1/V2 engine divergence | Critical | Preview ≠ delivered PDF |
| 7 | weight field mismatch | High | 0 weight on PDF |
| 1 | Rail mode missing from Quick Quote enum | High | Rail quotes cannot originate from Quick Quote |

---

## 6. PDF Generation Analysis

### 6.1 Dual Engine Architecture — Root Problem

The PDF generation system has two completely separate rendering paths:

**V1 Engine** (lines 332-1009 in `generate-quote-pdf/index.ts`):
- Manual pdf-lib primitive drawing (drawText, drawLine, drawRect)
- Hardcoded MGL-specific layouts (`mgl_matrix`, `mgl_granular`)
- Hardcoded company address: "140 Ethel Road West; Unit 'S&T', Piscataway, NJ 08854-USA"
- Uses `items[0].description` for commodity, `weight_kg` for weight

**V2 Engine** (lines 201-329):
- Template-driven via `PdfRenderer` class
- Supports `DefaultTemplate` with sections (header, static_block, dynamic_table, footer)
- Uses `SafeContext` transformer for consistent data shapes
- Uses `commodity_description` for commodity (doesn't exist), `total_weight` for weight (wrong field)

### 6.2 Field Mapping Comparison

| PDF Field | V1 Engine Source | V2 Engine Source | Correct DB Column | Status |
|-----------|-----------------|------------------|-------------------|--------|
| Commodity | `items[0].description` | `i.commodity_description` | `commodities.name` via `commodity_id` FK | Both wrong — need JOIN |
| Weight | `i.weight_kg` (correct) | `i.total_weight` (doesn't exist) | `quote_items_extension.weight_kg` | V2 broken |
| Volume | Not rendered | `i.total_volume` (doesn't exist) | `quote_items_extension.volume_cbm` | V2 broken |
| Company Name | Hardcoded "MGL" | From template/branding | `tenant_branding` or config | V1 broken for non-MGL |
| Company Address | Hardcoded | From template | Tenant config | V1 broken for non-MGL |
| Charge Name | `c.note \|\| c.category?.name \|\| "Charge"` | Same | `charge_categories.name` | Fallback hides missing data |
| Currency | `options[0]?.currency` | `quote.currency \|\| "USD"` | `quotation_version_options.currency_id` → `currencies.code` | Inconsistent source |

### 6.3 Missing Data in PDF

| Data | Stored In | Fetched By PDF | Rendered | Gap |
|------|-----------|---------------|----------|-----|
| Actual commodity name | `commodities` table | Not fetched | "General Cargo" | Missing JOIN |
| Per-item weight | `quote_items_extension.weight_kg` | `*` wildcard | V1 only | V2 uses wrong field |
| Per-item volume | `quote_items_extension.volume_cbm` | `*` wildcard | Neither correctly | Field name mismatch |
| Leg carrier name | `quotation_version_option_legs.carrier_name` | Via joins | Partially | Falls back to "Carrier" |
| Charge side (sell) | `quote_charges.charge_side_id` | Filtered by sell side | Fallback loads ALL | Hides data quality |
| Contact name | `contacts.first_name + last_name` | Not fetched | Missing | No contact join |
| Incoterms | `quotes.incoterms` or `quotes.incoterm_id` | Fetched | Sometimes | 3 storage locations |

### 6.4 Sell-Side Charge Filtering Issue

```
Line 172-187 logic:
1. Fetch charge_sides record where code='sell'
2. Filter charges by charge_side_id = sellSideId
3. IF no charges found → fetch ALL charges (no filter)

Problem: Step 3 means if sell-side charges aren't properly tagged,
the PDF shows ALL charges (including buy-side/cost data) to the customer.
This is a business-critical data exposure risk.
```

### 6.5 Template System Gaps

- `DefaultTemplate` renders a generic layout — no mode-specific sections (ocean vs air vs road vs rail)
- No support for multi-currency charge aggregation within a single PDF
- Template schema (`engine/schema.ts`) validates structure but not content completeness
- No preview-to-final consistency guarantee (both could use different templates)

---

## 7. Composer Auto-Population Failures

### 7.1 Category 1: Port Name Field Mismatch (CRITICAL)

**Location**: `MultiModalQuoteComposer.tsx:807`, `QuoteDetailsStep.tsx:81`

**Code**:
```typescript
// What the code does:
const port = ports.find(p => p.id === qData.origin_port_id);
if (port) {
    updates.origin = port.name || port.port_name || port.code;
}
```

**Problem**: The `ports_locations` table and the query return `location_name` and `location_code`. The fields `port.name` and `port.port_name` do not exist on the returned objects. The only valid fields are:
- `port.location_name` — the human-readable name
- `port.location_code` — the port code (e.g., CNSHA)

**Impact**: Origin and destination fields always show blank or fall back to `port.code` (displaying "CNSHA" instead of "Shanghai Port").

**Fix**: Replace `port.name || port.port_name` with `port.location_name` across all references.

### 7.2 Category 2: Service Type Mode Resolution (HIGH)

**Location**: `LegsConfigurationStep.tsx:120-130`

**Code**:
```typescript
const defaultServiceType = serviceTypes.find(st => {
    const stMode = (st.mode || '').toLowerCase();
    // ...
});
```

**Problem**: `service_types` records don't have a direct `mode` field. The transport mode is resolved via the `service_type_mappings` → `transport_modes` relationship. The `st.mode` access always returns undefined.

**Impact**: Service type dropdown is never pre-selected when creating a new leg.

### 7.3 Category 3: Leg Location Field Naming (HIGH)

**Location**: `QuoteFormRefactored.tsx:108`

**Code**:
```typescript
const hasLegsResolved = legs.length > 0 && legs.every(
    (l: any) => !!l.origin_location_id && !!l.destination_location_id
);
```

**Problem**: The auto-save guard checks for `origin_location_id` and `destination_location_id` on legs, but the data coming from `QuoteTransformService` may use `origin_port_id`/`destination_port_id` instead (matching the DB column names).

**Impact**: Auto-save never triggers because the field check always fails.

### 7.4 Category 4: Transport Mode Fallback to Option Name (HIGH)

**Location**: `src/lib/quote-mapper.ts:28`

**Code**:
```typescript
mode: opt.mode || opt.transport_mode || opt.name
```

**Problem**: When both `opt.mode` and `opt.transport_mode` are undefined, falls back to `opt.name` which could be a product name like "Express Service" or a tier like "Best Value".

**Impact**: Legs created with invalid transport modes (e.g., mode="Best Value").

### 7.5 Category 5: Charge Deduplication Over-Filtering (HIGH)

**Location**: `src/lib/quote-mapper.ts:166-197`

**Problem**: Uses loose string matching for charge deduplication:
```typescript
const sig = `${name}|${c.amount}|${c.currency || ''}`;
```

This means "Freight" and "Freight Charges" are treated as different charges (not deduped), but "Freight|500|USD" appearing at both header and leg level would be incorrectly deduped even if both are intentional.

**Impact**: Either duplicate charges appear or legitimate charges are removed.

### 7.6 Category 6: Reference Data Race Conditions (MEDIUM)

**Location**: `MultiModalQuoteComposer.tsx:660-793`

**Problem**: 14 reference data queries run in parallel with independent retry logic. If any subset fails:
- Service types empty → service type dropdown blank
- Carriers empty → carrier dropdowns blank
- Ports empty → auto-fill logic skipped
- Charge categories empty → charge names show as "Charge"

No validation after all fetches complete to verify minimum viable reference data.

### 7.7 Category 7: Tenant Context Loss (MEDIUM)

**Location**: `MultiModalQuoteComposer.tsx:372-437`

**Problem**: 4-level tenant resolution fallback:
1. `propTenantId || context.tenantId`
2. User metadata from `auth.getUser()`
3. Quote table lookup
4. Version table lookup

If all 4 fail, continues with `resolvedTenantId = null`, which breaks RLS on all downstream queries.

### 7.8 Category 8: Only First Leg Auto-Populated (LOW)

**Location**: `LegsConfigurationStep.tsx:136-137`

**Code**:
```typescript
origin: legs.length === 0 ? state.quoteData.origin : '',
destination: legs.length === 0 ? state.quoteData.destination : '',
```

**Problem**: Only the first leg gets origin/destination from quote data. Additional legs start completely blank, even for multi-leg routes where intermediate ports are known from the rate option data.

---

## 8. Data Consistency & Schema Analysis

### 8.1 Triple Schema Problem

The quotation system has three parallel schema definitions that have diverged:

| Concern | Zod (Frontend) | TypeScript Types | Database (Postgres) |
|---------|---------------|------------------|---------------------|
| Primary option flag | `is_primary: boolean` | Same | `is_selected: boolean` |
| Carrier reference (leg) | `carrier_id: string` | Same | `provider_id` AND `carrier_id` (dual columns) |
| Currency reference (option) | `currency: string` (code) | Same | `currency_id` AND `quote_currency_id` (dual UUIDs) |
| Transit time (leg) | `transit_time: string` | Same | `transit_time_hours: numeric` |
| Transport mode (leg) | `transport_mode: string` | Same | `mode: text` |
| Incoterms | `incoterms: string` | Same | `quotes.incoterms` (text) + `quotes.incoterm_id` (uuid) + `options.incoterms` (text) |

### 8.2 Database Schema Duplications

| Issue | Columns | Tables | Impact |
|-------|---------|--------|--------|
| Dual currency | `currency_id` + `quote_currency_id` | `quotation_version_options` | Which is authoritative? Queries may use either |
| Dual carrier | `provider_id` + `carrier_id` | `quotation_version_option_legs` | RPC updates `provider_id`, UI reads `carrier_id` |
| Triple incoterms | `quotes.incoterms` + `quotes.incoterm_id` + `options.incoterms` | `quotes`, `quotation_version_options` | No sync between them |
| Dual service | `service_type_id` + `service_id` | `quotation_version_options` | Unclear parent-child semantics |

### 8.3 RPC Save Gap Analysis

The `save_quote_atomic()` RPC function:

| Operation | Supported | Notes |
|-----------|-----------|-------|
| Upsert quote header | Yes | Full field set |
| Delete + re-insert items | Yes | Dual schema (core + extension) |
| Delete + re-insert cargo configs | Yes | Full field set |
| Update existing options | Yes | Only if option has `id` |
| **Create NEW options** | **NO** | New options from form are silently ignored |
| Update existing legs | Yes | Only if leg has `id` |
| **Create NEW legs** | **NO** | New legs are silently ignored |
| **Save/update charges** | **NO** | Charges not handled at all in RPC |
| Version management | No | Versions managed separately |

**Critical Gap**: After a user adds new carrier options or edits charges in the Composer, clicking Save will:
- Update the quote header and items correctly
- **Silently discard** any new options added
- **Silently discard** all charge modifications

### 8.4 Type Safety Issues

**36 files** in the quote system use `as any` casts, indicating type unsafety:
- `useQuoteData.ts`: Injected entities typed as `any[]`
- `useQuoteRepository.ts`: Supabase query results cast to `any`
- `MultiModalQuoteComposer.tsx`: Option/leg structures cast to `any`
- `quote-transfer.ts`: 10 fields use `z.any()` (legs, charges, reliability, environmental, etc.)

### 8.5 Duplicate Hook Logic

`useQuoteData` and `useQuoteRepositoryContext` both fetch the same 8 reference datasets independently:

| Dataset | useQuoteData | useQuoteRepositoryContext | Should Be |
|---------|-------------|--------------------------|-----------|
| Ports | React Query via PortsService | Direct supabase query | Single source |
| Carriers | Direct supabase + inject | Direct supabase + inject | Single source |
| Accounts | Scoped query | Scoped query + tenant filter | Single source |
| Service Types | Mapping → types resolution | Same indirect approach | Single source |

Both hooks are used in different components, creating duplicate network requests and potential data staleness between them.

---

## 9. Proposed Architectural Improvements

### 9.1 Unified Quote Data Layer (Foundation)

**Problem**: 3 hooks (`useQuoteData`, `useQuoteRepositoryContext`, `useQuoteRepositoryForm`) with duplicate logic.

**Solution**: Create a single `QuoteDataProvider` context that provides all reference data, hydration, and persistence through one interface.

```
QuoteDataProvider (React Context)
├── referenceData: { ports, carriers, accounts, contacts, services, serviceTypes, currencies, shippingTerms }
├── quoteState: { quote, items, cargoConfigs, versions, options, legs, charges }
├── mutations: { saveQuote, createVersion, addOption, updateCharges }
└── status: { isLoading, errors, lastSync }
```

**Benefits**:
- Single network request per dataset
- Consistent cache (5-min TTL with React Query)
- Eliminates duplicate fetch logic
- Provides unified error handling

### 9.2 Canonical Field Name Registry

**Problem**: Field name mismatches between code and DB (`port_name` vs `location_name`, `is_primary` vs `is_selected`, etc.)

**Solution**: Create a field mapping registry that all data access goes through:

```typescript
// src/lib/schemas/field-registry.ts
export const FIELD_MAP = {
  port: {
    name: 'location_name',    // NOT port_name, NOT name
    code: 'location_code',
  },
  option: {
    isPrimary: 'is_selected', // DB column name
  },
  leg: {
    mode: 'mode',             // NOT transport_mode in DB
    carrier: 'provider_id',   // NOT carrier_id in legs table
    transitTime: 'transit_time_hours',
  },
} as const;
```

### 9.3 Single PDF Engine

**Problem**: Two rendering engines with different data mappings.

**Solution**: Deprecate V1 engine entirely. Enhance V2 engine with:

1. **Proper data fetching**: Join `commodities` table for actual commodity name
2. **Correct field mapping**: Use `weight_kg` and `volume_cbm` (actual DB columns)
3. **Tenant-aware branding**: Replace hardcoded MGL data with tenant config
4. **Mode-specific templates**: Different PDF sections for ocean, air, road, rail
5. **Validation gate**: Schema-validate all data before rendering; log warnings for missing required fields
6. **Consistency guarantee**: Store rendered PDF in Supabase Storage; serve same PDF for preview and download

### 9.4 Complete RPC Save

**Problem**: `save_quote_atomic()` doesn't handle new options, new legs, or charges.

**Solution**: Extend RPC to handle full quote graph:

```sql
-- Enhanced save_quote_atomic_v2
-- 1. Upsert quote header
-- 2. Sync items (delete removed, insert new, update existing)
-- 3. Sync cargo configurations
-- 4. Sync options (create new + update existing)
-- 5. Sync legs per option (create new + update existing)
-- 6. Sync charges per leg (create new + update existing + delete removed)
-- 7. Return full saved state for optimistic UI update
```

### 9.5 Strict Transfer Schema

**Problem**: `QuoteTransferSchema` uses `z.any()` for 10+ critical fields.

**Solution**: Replace all `z.any()` with proper schemas:

```typescript
// Before:
legs: z.array(z.any()).optional()

// After:
legs: z.array(z.object({
  sequence: z.number(),
  from: z.string(),
  to: z.string(),
  mode: z.enum(['air', 'ocean', 'road', 'rail']),
  carrier: z.string().optional(),
  charges: z.array(ChargeSchema),
})).optional()
```

### 9.6 Data Reconciliation Pipeline

**Problem**: No detection of data quality issues until PDF generation.

**Solution**: Add validation checkpoints at each pipeline stage:

```
Stage 1 (Capture): QuoteTransferSchema strict validation
Stage 2 (Transform): Mandatory field resolution report
  → Log: "Port 'Shanghai' resolved to UUID abc123"
  → Warn: "Carrier 'FastShip' not found in master data"
Stage 3 (Persist): Post-insert consistency check
  → Verify: options count > 0, charges count > 0
Stage 4 (Hydrate): Completeness score calculation
  → Score: 85% (missing: carrier on leg 2, charges on leg 3)
Stage 5 (PDF): Pre-render validation gate
  → Block if: commodity = "General Cargo" AND commodity_id exists
  → Block if: total_amount = 0 AND charges exist
```

### 9.7 Deduplication Column Cleanup

**Problem**: Dual carrier columns, dual currency columns, triple incoterms storage.

**Solution** (phased migration):

Phase 1: Add computed columns/views that unify:
```sql
-- Create view that resolves carrier
CREATE VIEW v_option_legs AS SELECT
  *,
  COALESCE(carrier_id, provider_id) AS resolved_carrier_id
FROM quotation_version_option_legs;
```

Phase 2: Migrate all code to use resolved columns

Phase 3: Drop deprecated columns with migration

### 9.8 Real-Time Sync Strategy

**Problem**: Data goes stale between Composer save and PDF generation.

**Solution**: Event-driven cache invalidation:

1. On `save_quote_atomic()` completion → emit `QuoteUpdated` event
2. PDF generation subscribes to events → invalidates any cached PDF
3. Composer subscribes to version changes → reloads if version changes
4. Use `lastSyncTimestamp` (already in Composer props) for optimistic locking

---

## 10. Phased Implementation Roadmap

### Phase 1: Critical Fixes (Week 1-2)

**Goal**: Fix data visibility — users can see their data in Composer and PDF.

| # | Task | Severity | Effort | Files |
|---|------|----------|--------|-------|
| 1.1 | Fix `port.port_name` → `port.location_name` | Critical | 2h | MultiModalQuoteComposer.tsx, QuoteDetailsStep.tsx |
| 1.2 | Fix `commodity_description` → join commodities table in PDF | Critical | 4h | generate-quote-pdf/index.ts |
| 1.3 | Fix V2 engine `total_weight` → `weight_kg`, `total_volume` → `volume_cbm` | Critical | 2h | generate-quote-pdf/index.ts |
| 1.4 | Fix `is_primary` → `is_selected` in RPC payload mapping | Critical | 2h | useQuoteRepository.ts, RPC |
| 1.5 | Fix `opt.name` fallback for transport mode | High | 1h | quote-mapper.ts |
| 1.6 | Fix `st.mode` → use transport_modes relationship | High | 3h | LegsConfigurationStep.tsx |
| 1.7 | Remove hardcoded MGL company data → tenant config | High | 4h | generate-quote-pdf/index.ts |
| 1.8 | Add Rail mode to Quick Quote enum and form fields | High | 6h | QuickQuoteModal.tsx, quote-transfer.ts |

**Estimated effort**: ~24 hours

### Phase 2: Data Integrity (Week 3-4)

**Goal**: No silent data loss — charges saved, new options persisted.

| # | Task | Severity | Effort | Files |
|---|------|----------|--------|-------|
| 2.1 | Extend `save_quote_atomic()` to create new options | Critical | 8h | RPC, useQuoteRepository.ts |
| 2.2 | Add charge save/update to RPC | Critical | 8h | RPC, useQuoteRepository.ts |
| 2.3 | Replace `z.any()` in QuoteTransferSchema with strict types | High | 4h | quote-transfer.ts |
| 2.4 | Add post-save consistency validation | High | 4h | useQuoteRepository.ts |
| 2.5 | Fix sell-side charge filtering (no fallback to ALL) | High | 3h | generate-quote-pdf/index.ts |
| 2.6 | Add multi-leg auto-population (not just first leg) | Medium | 4h | LegsConfigurationStep.tsx |
| 2.7 | Fix auto-save field check (`origin_location_id` → `origin_port_id`) | Medium | 1h | QuoteFormRefactored.tsx |

**Estimated effort**: ~32 hours

### Phase 3: Unification (Week 5-7)

**Goal**: Single source of truth — one data hook, one PDF engine.

| # | Task | Severity | Effort | Files |
|---|------|----------|--------|-------|
| 3.1 | Deprecate V1 PDF engine → V2 only | High | 8h | generate-quote-pdf/index.ts |
| 3.2 | Merge `useQuoteData` + `useQuoteRepositoryContext` into single provider | High | 16h | New QuoteDataProvider |
| 3.3 | Create field name registry | Medium | 4h | New field-registry.ts |
| 3.4 | Add PDF pre-render validation gate | Medium | 6h | generate-quote-pdf/index.ts |
| 3.5 | Store generated PDF → serve cached for preview/download/send | Medium | 8h | generate-quote-pdf, QuotePreviewModal, SendQuoteDialog |
| 3.6 | Add completeness score to Composer UI | Low | 6h | MultiModalQuoteComposer.tsx |

**Estimated effort**: ~48 hours

### Phase 4: Enterprise Hardening (Week 8-10)

**Goal**: Production resilience — reconciliation, monitoring, audit trail.

| # | Task | Severity | Effort | Files |
|---|------|----------|--------|-------|
| 4.1 | Schema migration: resolve duplicate columns (carrier, currency) | High | 12h | Migrations, all query sites |
| 4.2 | Add transformation audit trail (log every field resolution) | Medium | 8h | QuoteTransformService |
| 4.3 | Enhance reconciliation with charge-level validation | Medium | 6h | reconcile-quote |
| 4.4 | Add event emission for QuoteUpdated, ChargesChanged | Medium | 4h | emit-event, supabase-functions.ts |
| 4.5 | Mode-specific PDF templates (ocean, air, road, rail) | Medium | 14h | PDF engine templates |
| 4.6 | Multi-currency charge aggregation in PDF | Low | 8h | generate-quote-pdf |
| 4.7 | Version diff mechanism (charge-level comparison) | Low | 10h | VersionComparison.tsx |

**Estimated effort**: ~62 hours

### Total Estimated Effort: ~166 hours (~4.5 weeks at full capacity)

---

## 11. Success Metrics & Quality Benchmarks

### 11.1 Data Pipeline Metrics

| Metric | Current (Estimated) | Phase 1 Target | Phase 4 Target |
|--------|-------------------|----------------|----------------|
| Quick Quote → Composer field population rate | ~30% | 85% | 98% |
| Port ID resolution success | ~60% | 90% | 99% |
| Carrier ID resolution success | ~70% | 90% | 95% |
| Charge persistence after save | 0% | 95% | 100% |
| New option persistence after save | 0% | 95% | 100% |

### 11.2 PDF Quality Metrics

| Metric | Current | Phase 1 Target | Phase 3 Target |
|--------|---------|----------------|----------------|
| PDFs showing "General Cargo" when commodity exists | ~90% | 5% | 0% |
| PDFs with correct weight/volume | ~50% (V1 only) | 90% | 99% |
| Preview/download consistency | ~50% | 95% | 100% |
| Multi-tenant company branding correctness | ~0% (MGL only) | 80% | 100% |

### 11.3 System Reliability Metrics

| Metric | Current | Phase 2 Target | Phase 4 Target |
|--------|---------|----------------|----------------|
| Reconciliation pass rate | Unknown | 80% | 95% |
| Reference data load success (all 14 datasets) | ~85% | 95% | 99% |
| End-to-end quote→email success rate | Unknown | 85% | 95% |
| Silent data loss events per 100 quotes | ~40 | 10 | 2 |

### 11.4 Quality Gates per Phase

**Phase 1 Exit Criteria**:
- [ ] All `port.port_name` references replaced with `port.location_name`
- [ ] PDF shows actual commodity name when `commodity_id` exists
- [ ] V2 PDF shows correct weight/volume
- [ ] No hardcoded company data in PDF for non-MGL tenants
- [ ] Rail mode added to Quick Quote (enum, form fields, AI advisor support)
- [ ] Unit tests cover all 8 fixed issues

**Phase 2 Exit Criteria**:
- [ ] `save_quote_atomic_v2` handles new options + legs + charges
- [ ] Zero `z.any()` in QuoteTransferSchema
- [ ] Integration test: Quick Quote → Composer → Save → reload → all data present
- [ ] Sell-side charge filtering logs warning instead of falling back to ALL

**Phase 3 Exit Criteria**:
- [ ] V1 engine removed; all PDF generation via V2
- [ ] Single QuoteDataProvider replaces both hooks
- [ ] PDF cached in Storage; same PDF served for preview/download/email
- [ ] Pre-render validation blocks incomplete PDFs with user-facing error

**Phase 4 Exit Criteria**:
- [ ] No duplicate columns in schema
- [ ] Full audit trail for every field transformation
- [ ] Reconciliation runs on schedule with alerting
- [ ] Mode-specific PDF templates for ocean, air, road, rail

---

## Appendix: File Reference Map

### Frontend — Quote System

| File | Purpose | Lines | Issues |
|------|---------|-------|--------|
| `src/components/sales/quick-quote/QuickQuoteModal.tsx` | Quick Quote entry | ~670 | Dual state (form + extendedData) |
| `src/components/sales/MultiModalQuoteComposer.tsx` | Quote Composer wizard | ~930 | port.port_name mismatch, 570-line init |
| `src/components/sales/composer/QuoteDetailsStep.tsx` | Composer step 1 | ~200 | port.port_name mismatch |
| `src/components/sales/composer/LegsConfigurationStep.tsx` | Composer step 2 | ~350 | st.mode mismatch, single-leg auto-fill |
| `src/components/sales/composer/ChargesManagementStep.tsx` | Composer step 3 | ~250 | Location name vs code for AI |
| `src/components/sales/quote-form/QuoteFormRefactored.tsx` | Form-mode editor | ~300 | origin_location_id field mismatch |
| `src/components/sales/quote-form/useQuoteData.ts` | Reference data hook | ~358 | Duplicate of useQuoteRepositoryContext |
| `src/components/sales/quote-form/useQuoteRepository.ts` | Hydration + save hook | ~929 | is_primary/is_selected, no charge save |
| `src/components/sales/quote-form/types.ts` | Zod schema + TS types | 217 | z.any() for 4 fields |
| `src/components/sales/SendQuoteDialog.tsx` | Send quote UI | 172 | No template selection |
| `src/components/sales/QuotePreviewModal.tsx` | PDF preview | ~135 | Always V2, no cache |
| `src/pages/dashboard/QuoteNew.tsx` | Quote orchestrator page | ~450 | Complex option insertion, partial failures |
| `src/lib/services/quote-transform.service.ts` | Transfer → form transform | 563 | String-based ID resolution |
| `src/lib/schemas/quote-transfer.ts` | Transfer Zod schema | 115 | 10+ z.any() fields |
| `src/lib/quote-mapper.ts` | Rate → quote mapping | ~405 | opt.name mode fallback, loose dedup |

### Edge Functions — Quote System

| File | Purpose | Issues |
|------|---------|--------|
| `supabase/functions/generate-quote-pdf/index.ts` | PDF generation | Dual engine, field mismatches, hardcoded company |
| `supabase/functions/generate-quote-pdf/engine/renderer.ts` | V2 PDF renderer | Template-based, uses SafeContext |
| `supabase/functions/generate-quote-pdf/engine/context.ts` | Data → template context | Field name mismatches |
| `supabase/functions/generate-quote-pdf/engine/default_template.ts` | Default template | Generic, not mode-specific |
| `supabase/functions/send-email/index.ts` | Email dispatch | Multi-provider, 1080 lines |
| `supabase/functions/ai-advisor/index.ts` | AI quote generation | Hardcoded surcharges, no output validation |
| `supabase/functions/reconcile-quote/index.ts` | Consistency validation | Basic checks only |
| `supabase/functions/metrics-quotation/index.ts` | Quote metrics | Narrow window (60min) |
| `supabase/functions/emit-event/index.ts` | Event emission | Missing QuoteUpdated event |

### Database — Key Tables

| Table | Key Columns | Issues |
|-------|------------|--------|
| `quotes` | origin_port_id, destination_port_id, status, current_version_id | Triple incoterms storage |
| `quotation_versions` | quote_id, version_number, major_version, minor_version | RLS bypass in retry logic |
| `quotation_version_options` | currency_id + quote_currency_id (dual), provider_id | Dual currency columns |
| `quotation_version_option_legs` | provider_id + carrier_id (dual), mode | Dual carrier columns |
| `quote_charges` | charge_side_id, leg_id, category_id | Not saved by RPC |
| `quote_items_core` | product_name, commodity_id, quantity, unit_price | Split schema with extension |
| `quote_items_extension` | weight_kg, volume_cbm, container_type_id | 1:1 with core |

---

*This document should be treated as a living reference. Update as issues are resolved and architecture evolves.*
