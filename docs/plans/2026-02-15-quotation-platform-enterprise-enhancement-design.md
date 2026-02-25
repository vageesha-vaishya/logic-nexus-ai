# Quotation Platform Enterprise Enhancement Design

**Version**: 2.3
**Date**: 2026-02-17 (revised)
**Classification**: Internal Engineering
**Supersedes**: QUOTATION-PLATFORM-ENHANCEMENT-DESIGN.md v1.0
**Scope**: End-to-end quotation platform data consistency, enterprise hardening, and competitive positioning

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Phase-Wise Implementation Plan](#2-phase-wise-implementation-plan)
3. [Technical Architecture](#3-technical-architecture)
4. [Database Schema Optimization](#4-database-schema-optimization)
5. [API Enhancement Specifications](#5-api-enhancement-specifications)
6. [Real-Time Synchronization Protocols](#6-real-time-synchronization-protocols)
7. [Data Validation Frameworks](#7-data-validation-frameworks)
8. [Performance Benchmarking Criteria](#8-performance-benchmarking-criteria)
9. [Security and Compliance Requirements](#9-security-and-compliance-requirements)
10. [Testing Strategies](#10-testing-strategies)
11. [Rollback Procedures and Disaster Recovery](#11-rollback-procedures-and-disaster-recovery)
12. [Resource Allocation Plans](#12-resource-allocation-plans)
13. [Risk Assessment Matrix](#13-risk-assessment-matrix)
14. [Success Metrics and KPIs](#14-success-metrics-and-kpis)
15. [Post-Implementation Monitoring](#15-post-implementation-monitoring)
16. [Appendix C: v2.1 Review Findings](#appendix-c-v21-review-findings-2026-02-15)
17. [Appendix D: Transport Mode, Carrier & Parameter Analysis](#appendix-d-transport-mode-carrier--parameter-analysis)
18. [Appendix E: Mode-Based Carrier Selection — Implementation Design](#appendix-e-mode-based-carrier-selection--implementation-design)

---

## 1. Executive Summary

### 1.1 Current State Assessment

The Logic Nexus AI quotation platform supports multi-modal freight quoting (air, ocean, road, rail) across a 3-tier multi-tenant hierarchy (Super Admin > Tenant > Franchise). The platform comprises ~55 quote-related files spanning React components, Supabase edge functions, and 489 database migrations.

**What works well:**
- Event sourcing foundation with `trace_id` and `idempotency_key` across audit logs
- Atomic RPC (`save_quote_atomic`) for quote header, items, and cargo configurations
- RLS coverage on 145 tables (132 with full CRUD policies)
- Multi-provider email delivery with retry and failover
- AI-assisted rate generation via GPT-4o with 5-tier options

**Critical data consistency challenges (67 issues identified):**

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Data Consistency | 4 | 6 | 3 | 2 | 15 |
| PDF Generation | 3 | 3 | 2 | 1 | 9 |
| Auto-Population | 2 | 4 | 1 | 0 | 7 |
| Schema/Type Safety | 1 | 2 | 2 | 2 | 7 |
| Infrastructure Gaps | 0 | 3 | 5 | 2 | 10 |
| Security (Newly Identified) | 1 | 2 | 2 | 0 | 5 |
| Data Flow Edge Cases | 0 | 2 | 6 | 6 | 14 |
| **Total** | **11** | **22** | **21** | **13** | **67** |

*Note: v2.0 identified 38 issues. v2.1 review identified 29 additional gaps (see Appendix C). v2.2 added comprehensive transport mode, carrier, and parameter analysis with 10 additional gaps (see Appendix D). v2.3 added detailed implementation design for mode-based carrier selection with dynamic filtering (see Appendix E).*

### 1.2 Top 5 Data Consistency Blockers

1. **Field name mismatches** — Code references `port.port_name` / `port.name` but DB column is `location_name`. Result: blank origin/destination in Composer.
2. **Dual PDF engine divergence** — V1 and V2 engines use different field mappings (`weight_kg` vs `total_weight`), producing inconsistent PDFs.
3. **Missing commodity join** — PDF query never joins `commodities` table; defaults to "General Cargo" for every quote.
4. **RPC save gap** — `save_quote_atomic()` does not persist new options, new legs, or any charges. Silent data loss on every save.
5. **Schema triple-divergence** — Zod frontend (`is_primary`), TypeScript types, and Postgres (`is_selected`) disagree on column names for 6+ fields.
6. **Unguarded `rates[0]` access** — `QuoteTransformService` accesses `rates[0]` without checking array length. When `rates` is empty, `primaryRate` is `undefined`, cascading through `resolveCarrierId()` and `generateQuoteItems()`, producing blank fields.
7. **Non-atomic charge persistence** — Charges are saved via manual INSERT/DELETE in `MultiModalQuoteComposer.tsx`, separate from `save_quote_atomic()`. If RPC succeeds but charge save fails (or vice versa), data becomes inconsistent. Current charge persistence is ~30%, not 0%.
8. **No feature flag infrastructure** — Document proposes feature flags for Phase 3-6 rollback, but zero feature flag system exists in codebase.
9. **Hardcoded secrets in send-email** — `send-email/index.ts` contains a fallback Resend API key literal and hardcoded sender domain `notifications@soslogistics.pro`.
10. **AI Advisor hardcoded surcharges** — `ai-advisor/index.ts:456` injects a 12% fuel surcharge (`fuelSurchargeRate = 0.12`) into every AI-generated quote with no market basis.

### 1.3 Enhancement Strategy

This document proposes a **6-phase enhancement roadmap** targeting enterprise-grade data consistency:

| Phase | Focus | Duration | Key Outcome |
|-------|-------|----------|-------------|
| 1 | Critical Fixes | Weeks 1-2 | Data visible in Composer and PDF; secrets removed |
| 2 | Data Integrity + Infra | Weeks 3-5 | Zero silent data loss; feature flag infrastructure |
| 3 | Unification | Weeks 6-8 | Single source of truth everywhere |
| 4 | Enterprise Hardening | Weeks 9-11 | Production resilience + audit trail + state machine |
| 5 | API & Integration | Weeks 12-14 | Versioned API, real-time sync |
| 6 | Competitive Edge | Weeks 15-18 | Advanced features, observability, approval UI |

**Total estimated effort**: ~367 engineering hours (~9 weeks at full capacity, 1 senior engineer)

*v2.1 revision added ~87 hours across all phases from 29 newly identified gaps.*

### 1.4 Competitive Positioning

Current freight-tech platforms (Freightos, Flexport, Xeneta) offer real-time rate consistency, version-controlled quotes with full audit trails, and PDF fidelity guarantees. This enhancement closes those gaps and differentiates with:
- Event-sourced quote lifecycle (already partially built)
- Multi-modal charge bifurcation (unique to our platform)
- AI-driven rate confidence scoring with anomaly detection
- Tenant-isolated data with franchise-level granularity

---

## 2. Phase-Wise Implementation Plan

### Phase 1: Critical Fixes (Weeks 1-2)

**Goal**: Users can see their data in the Composer and PDF — no more blank fields or "General Cargo."

**Quality Gate**: All 12 tasks pass unit tests; manual QA confirms field population rate > 85%.

| # | Task | Severity | Effort | Files Affected | Deliverable |
|---|------|----------|--------|----------------|-------------|
| 1.1 | Fix `port.port_name` / `port.name` → `port.location_name` | Critical | 2h | `MultiModalQuoteComposer.tsx:807`, `QuoteDetailsStep.tsx:81` | Origin/destination populate correctly |
| 1.2 | Join `commodities` table in PDF query; use `commodities.name` | Critical | 4h | `generate-quote-pdf/index.ts:172-250` | Actual commodity name on PDF |
| 1.3 | Fix V2 engine: `total_weight` → `weight_kg`, `total_volume` → `volume_cbm` | Critical | 2h | `generate-quote-pdf/engine/context.ts` | Correct weight/volume on PDF |
| 1.4 | Fix `is_primary` → `is_selected` in RPC payload mapping | Critical | 2h | `useQuoteRepository.ts`, `save_quote_atomic` RPC | Primary option correctly marked |
| 1.5 | Fix `opt.name` fallback for transport mode → validate against enum | High | 1h | `quote-mapper.ts:28` | No "Best Value" as transport mode |
| 1.6 | Fix `st.mode` → resolve via `service_type_mappings` → `transport_modes` | High | 3h | `LegsConfigurationStep.tsx:120-130` | Service type pre-selected |
| 1.7 | Replace hardcoded MGL company data → tenant branding config | High | 4h | `generate-quote-pdf/index.ts` V1 engine | Correct company on all tenant PDFs |
| 1.8 | Add Rail mode to Quick Quote (`z.enum` + form fields + AI advisor) | High | 6h | `QuickQuoteModal.tsx`, `quote-transfer.ts:54` | Rail quotes from Quick Quote |
| 1.9 | Guard `rates[0]` access in `QuoteTransformService` — validate `rates` is non-empty before accessing `primaryRate` | Critical | 2h | `quote-transform.service.ts:117` | No more blank fields from empty rates |
| 1.10 | Include `notes` and `terms_conditions` in PDF SafeContext and template | High | 3h | `generate-quote-pdf/engine/context.ts:82-128`, `default_template.ts` | Notes/terms visible on PDF |
| 1.11 | Remove hardcoded Resend API key fallback from `send-email` | Critical | 1h | `send-email/index.ts:47` | No secrets in code |
| 1.12 | Add page-level React Error Boundary around Quotes page and QuickQuoteModal | Medium | 2h | `QuoteNew.tsx`, `QuickQuoteModal.tsx` | Graceful crash recovery |

**Effort**: ~32 hours
**Milestone**: `v1.1.0-field-fixes`
**Approval**: Engineering lead sign-off after CI green + QA pass

### Phase 2: Data Integrity (Weeks 3-4)

**Goal**: Zero silent data loss — charges saved, new options persisted, strict validation.

**Quality Gate**: Integration test covers Quick Quote → Composer → Save → Reload → all data present.

| # | Task | Severity | Effort | Files Affected | Deliverable |
|---|------|----------|--------|----------------|-------------|
| 2.1 | Extend `save_quote_atomic` → create new options (INSERT when `id` is NULL) | Critical | 8h | `save_quote_atomic` RPC, `useQuoteRepository.ts` | New options persisted |
| 2.2 | Add charge persistence to RPC (INSERT/UPDATE/DELETE `quote_charges`) | Critical | 8h | `save_quote_atomic` RPC, `useQuoteRepository.ts` | Charges survive save |
| 2.3 | Replace all 8 `z.any()` in `QuoteTransferSchema` with strict types (lines 16, 22-24, 28-29, 76-77) | High | 4h | `quote-transfer.ts` | Malformed data rejected at entry |
| 2.4 | Post-save consistency validation (verify options > 0, charges > 0) | High | 4h | `useQuoteRepository.ts` | User warned on incomplete save |
| 2.5 | Fix sell-side charge filtering — log warning instead of fallback to ALL | High | 3h | `generate-quote-pdf/index.ts:172-187` | No buy-side data on customer PDF |
| 2.6 | Multi-leg auto-population from rate option data | Medium | 4h | `LegsConfigurationStep.tsx:136-137` | Intermediate ports pre-filled |
| 2.7 | Fix auto-save guard: `origin_location_id` → `origin_port_id` | Medium | 1h | `QuoteFormRefactored.tsx:108` | Auto-save triggers correctly |
| 2.8 | Centralize transit time parsing — unified `parseTransitTime()` handling "25 days", "48h", bare numbers, "1d 12h" | High | 3h | `QuoteOptionService.ts:144-156`, new `src/lib/transit-time.ts` | No more unit ambiguity |
| 2.9 | Add container type+size cross-validation (prevent invalid combos like 40HC with "loose" type) | Medium | 2h | `QuoteOptionService.ts:106-107`, `QuoteTransferSchema` | No nonsensical container configs |
| 2.10 | Make charge save atomic — move charge INSERT/UPDATE/DELETE into `save_quote_atomic` RPC | Critical | 6h | `save_quote_atomic` RPC, `MultiModalQuoteComposer.tsx` charge mutations | Charges transactional with quote save |
| 2.11 | Implement feature flag infrastructure (DB-backed `feature_flags` table + `useFeatureFlags()` hook) | High | 8h | New migration, new `src/hooks/useFeatureFlags.ts`, new `_shared/feature-flags.ts` | Prerequisite for Phase 3-6 rollback |

**Effort**: ~51 hours
**Milestone**: `v1.2.0-data-integrity`
**Approval**: Integration test suite green + engineering review

### Phase 3: Unification (Weeks 5-7)

**Goal**: Single source of truth — one data hook, one PDF engine, one field naming convention.

**Quality Gate**: V1 engine fully removed; single `QuoteDataProvider` replaces both hooks; PDF cached and consistent.

| # | Task | Severity | Effort | Files Affected | Deliverable |
|---|------|----------|--------|----------------|-------------|
| 3.1 | Deprecate V1 PDF engine → V2 only with enhanced data fetching | High | 8h | `generate-quote-pdf/index.ts` (remove lines 332-1009) | Single rendering path |
| 3.2 | Create `QuoteDataProvider` context merging `useQuoteData` + `useQuoteRepositoryContext` | High | 16h | New `QuoteDataProvider.tsx`, deprecate 2 hooks | Single reference data source |
| 3.3 | Create canonical field name registry (`FIELD_MAP`) | Medium | 4h | New `src/lib/schemas/field-registry.ts` | No more field name mismatches |
| 3.4 | PDF pre-render validation gate (block if commodity missing, amount = 0) | Medium | 6h | `generate-quote-pdf/engine/context.ts` | No incomplete PDFs sent |
| 3.5 | Store generated PDF in Supabase Storage; serve cached for preview/download/send | Medium | 8h | `generate-quote-pdf`, `QuotePreviewModal`, `SendQuoteDialog` | Same PDF everywhere |
| 3.6 | Add completeness score indicator to Composer UI | Low | 6h | `MultiModalQuoteComposer.tsx` | Users see data quality |
| 3.7 | Unify `DocumentPreview.tsx` with PDF V2 engine (3rd render path) — use same template for browser preview and PDF | Medium | 8h | `DocumentPreview.tsx`, `generate-quote-pdf/engine/` | No divergence between preview and PDF |
| 3.8 | Make email sender address configurable per tenant (remove hardcoded `notifications@soslogistics.pro`) | Medium | 3h | `send-email/index.ts`, tenant config | Multi-tenant email branding |

**Effort**: ~59 hours
**Milestone**: `v2.0.0-unified`
**Approval**: Architecture review + full regression test

### Phase 4: Enterprise Hardening (Weeks 8-10)

**Goal**: Production resilience — schema cleanup, audit trail, reconciliation with auto-repair.

**Quality Gate**: No duplicate columns; full audit trail for all quote mutations; reconciliation auto-repairs common issues.

| # | Task | Severity | Effort | Files Affected | Deliverable |
|---|------|----------|--------|----------------|-------------|
| 4.1 | Schema migration: unify dual carrier columns (`provider_id` + `carrier_id` → single `carrier_id`) | High | 12h | Migration + all query sites | Single carrier reference |
| 4.2 | Schema migration: unify dual currency columns (`currency_id` + `quote_currency_id` → single `currency_id`) | High | 8h | Migration + all query sites | Single currency reference |
| 4.3 | Schema migration: unify triple incoterms (`quotes.incoterms` + `incoterm_id` + `options.incoterms` → single `incoterm_id` FK) | Medium | 6h | Migration + all query sites | Single incoterms source |
| 4.4 | Expand `emit-event` to support `QuoteEdited`, `ChargeSaved`, `VersionCreated`, `ApprovalRequested` | Medium | 4h | `emit-event/index.ts` | Complete audit trail |
| 4.5 | Upgrade `reconcile-quote` with auto-repair (regenerate missing PDF, re-resolve undefined IDs) | Medium | 8h | `reconcile-quote/index.ts` | Self-healing system |
| 4.6 | Add transformation audit trail (log every field resolution in `QuoteTransformService`) | Medium | 6h | `quote-transform.service.ts` | Full traceability |
| 4.7 | Mode-specific PDF templates (ocean, air, road, rail sections) | Medium | 14h | `generate-quote-pdf/engine/default_template.ts` | Professional mode-specific PDFs |
| 4.8 | Version diff mechanism (charge-level comparison between versions — current UI has side-by-side but no actual diff logic) | Low | 10h | New `VersionDiff` component, `QuotationVersionHistory.tsx` | Version comparison |
| 4.9 | Add quote status transition enforcement — DB trigger to prevent invalid transitions (e.g., `accepted` → `draft`) | Medium | 4h | New migration with trigger function | Valid state machine |
| 4.10 | Add `CHECK` constraints: `weight_kg >= 0`, `volume_cbm >= 0` on `quote_items_extension` | Medium | 2h | New migration | No negative weights/volumes |
| 4.11 | Add scheduled auto-expiry — extend `scheduled-reconcile` to set status=`expired` when `valid_until < NOW()` | Medium | 3h | `scheduled-reconcile/index.ts` or new function | Quotes auto-expire |
| 4.12 | Replace hardcoded 12% fuel surcharge in AI Advisor with configurable per-tenant surcharge rates | Medium | 4h | `ai-advisor/index.ts:456`, new `surcharge_config` table or tenant setting | Market-based surcharges |
| 4.13 | Add AI Advisor output validation — validate GPT response against schema before injecting into quotes | High | 4h | `ai-advisor/index.ts:453-505` | No corrupt AI data in quotes |

**Effort**: ~85 hours
**Milestone**: `v2.1.0-enterprise`
**Approval**: Security review + schema migration dry-run on staging

### Phase 5: API & Integration (Weeks 11-13)

**Goal**: Versioned API surface, real-time synchronization, external integration readiness.

**Quality Gate**: API v1 stable with backward compatibility; real-time sync with < 2s propagation delay.

| # | Task | Severity | Effort | Files Affected | Deliverable |
|---|------|----------|--------|----------------|-------------|
| 5.1 | Create versioned API layer (`/v1/quotes`, `/v1/quotes/:id/versions`) | High | 12h | New edge functions | Stable external API |
| 5.2 | Implement optimistic locking with `updated_at` version vectors | High | 8h | `save_quote_atomic` RPC, frontend hooks | Concurrent edit protection |
| 5.3 | Add Supabase Realtime subscriptions for quote/version/charge changes | Medium | 8h | `QuoteDataProvider`, new Realtime hooks | Live collaboration |
| 5.4 | Implement conflict resolution protocol (last-writer-wins with merge for non-overlapping fields) | Medium | 10h | New `ConflictResolver` service | No lost concurrent edits |
| 5.5 | Rate limiting on quote API endpoints (100 req/min per tenant) | Medium | 4h | Edge function middleware | Abuse protection |
| 5.6 | Webhook registration for external systems (ERP, TMS) | Low | 8h | New `quote-webhooks` edge function | Integration capability |

**Effort**: ~50 hours
**Milestone**: `v2.2.0-api`
**Approval**: API design review + load test pass

### Phase 6: Competitive Edge (Weeks 14-16)

**Goal**: Observability, advanced features, and differentiation.

**Quality Gate**: Full observability dashboard; multi-currency aggregation; circuit breaker for PDF.

| # | Task | Severity | Effort | Files Affected | Deliverable |
|---|------|----------|--------|----------------|-------------|
| 6.1 | Circuit breaker for PDF generation with fallback to text-only quote | Medium | 6h | `generate-quote-pdf`, `SendQuoteDialog` | Resilient PDF pipeline |
| 6.2 | Multi-currency charge aggregation in PDF (show charges in original + converted). **Note**: Zero FX infrastructure exists currently — requires building exchange rate service from scratch, not just PDF formatting | Medium | 16h | `generate-quote-pdf`, new `FxService`, new `exchange_rates` table | Multi-currency support |
| 6.3 | Distributed tracing integration (connect `trace_id` to OpenTelemetry-compatible backend) | Medium | 12h | `emit-event`, `_shared/logger.ts`, frontend telemetry | End-to-end trace visibility |
| 6.4 | Quote analytics dashboard (conversion rate, avg margin, quote-to-close time) | Low | 14h | New `QuoteAnalyticsDashboard` page | Business intelligence |
| 6.5 | Soft delete with restore capability for quotes | Low | 8h | Migration + `QuoteDataProvider` | Data recovery |
| 6.6 | Template marketplace (tenant-specific PDF/email templates) | Low | 10h | New template management UI + edge function | Customization |
| 6.7 | Quote clone/duplicate feature — duplicate existing quote to new customer or as new version | Low | 8h | `QuotesList.tsx`, new `clone-quote` RPC | Faster quote creation |
| 6.8 | Server-side quote filtering/pagination (current client-side filtering has 1000-row limit) | Medium | 8h | `Quotes.tsx`, new `list-quotes` edge function or RPC | Scalable quote listing |
| 6.9 | Approval workflow UI (DB tables exist from `enterprise_quote_architecture` migration but zero UI) | Low | 16h | New approval components, `QuoteDataProvider` integration | Approval workflows functional |

**Effort**: ~90 hours
**Milestone**: `v3.0.0-competitive`
**Approval**: Product review + full regression + performance benchmark pass

### Summary Timeline

```
Week 1-2    ████████  Phase 1: Critical Fixes (32h)
Week 3-5    ████████████  Phase 2: Data Integrity + Feature Flags (51h)
Week 6-8    ████████████  Phase 3: Unification (59h)
Week 9-11   ████████████████  Phase 4: Enterprise Hardening (85h)
Week 12-14  ██████████  Phase 5: API & Integration (50h)
Week 15-18  ██████████████  Phase 6: Competitive Edge (90h)
            ─────────────────────────────────────────────
            Total: ~367 hours across 18 weeks
```

*Note: v2.1 added ~87 hours across all phases from 29 newly identified gaps. Phase 2 expanded by 1 week to accommodate feature flag infrastructure (prerequisite for later phase rollbacks).*

---

## 3. Technical Architecture

### 3.1 Current Architecture (As-Is)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐               │
│  │ Quick    │    │ AI       │    │ Detailed Quote   │               │
│  │ Quote    │    │ Quote    │    │ (QuoteForm)      │               │
│  │ Modal    │    │ (Advisor)│    │                  │               │
│  └────┬─────┘    └────┬─────┘    └────────┬─────────┘               │
│       │               │                   │                          │
│  ┌────▼───────────────▼───────────────────▼──────────────────┐      │
│  │          VALIDATION (QuoteTransferSchema - Zod)            │      │
│  │  PROBLEM: 8 fields use z.any() — no real validation        │      │
│  └────────────────────────┬──────────────────────────────────┘      │
│                           │                                          │
│  ┌────────────────────────▼──────────────────────────────────┐      │
│  │       TRANSFORMATION (QuoteTransformService)               │      │
│  │  PROBLEM: String-based ID resolution, silent undefined     │      │
│  │  PROBLEM: rates[0] unguarded — blank fields if empty       │      │
│  └────────────────────────┬──────────────────────────────────┘      │
│                           │                                          │
│  ┌────────────────────────▼──────────────────────────────────┐      │
│  │       ORCHESTRATION (QuoteNew.tsx)                         │      │
│  │  3 hooks: useQuoteData + useQuoteRepositoryContext         │      │
│  │           + useQuoteRepositoryForm (DUPLICATE LOGIC)       │      │
│  └──────────┬─────────────────────────┬──────────────────────┘      │
│             │                         │                              │
│  ┌──────────▼──────┐  ┌──────────────▼───────────────────────┐     │
│  │ QuoteForm       │  │ MultiModalQuoteComposer              │     │
│  │ (form mode)     │  │ (wizard mode - 4 steps)              │     │
│  │                 │  │ PROBLEM: port.port_name mismatch     │     │
│  └────────┬────────┘  └──────────────┬───────────────────────┘     │
│           │                          │                               │
│  ┌────────▼──────────────────────────▼───────────────────────┐     │
│  │        PERSISTENCE (save_quote_atomic RPC)                 │     │
│  │  PROBLEM: No new options, no new legs, no charges          │     │
│  └────────────────────────┬──────────────────────────────────┘     │
│                           │                                          │
│  ┌────────────────────────▼──────────────────────────────────┐     │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐              │     │
│  │  │ PDF Gen  │  │ Send     │  │ Version    │              │     │
│  │  │ (DUAL    │  │ Quote    │  │ History    │              │     │
│  │  │ ENGINE!) │  │          │  │            │              │     │
│  │  └──────────┘  └──────────┘  └────────────┘              │     │
│  └───────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Target Architecture (To-Be — Post Phase 4)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐               │
│  │ Quick    │    │ AI       │    │ Detailed Quote   │               │
│  │ Quote    │    │ Quote    │    │ (QuoteForm)      │               │
│  │ Modal    │    │ (Advisor)│    │ + Rail Support   │               │
│  └────┬─────┘    └────┬─────┘    └────────┬─────────┘               │
│       │               │                   │                          │
│  ┌────▼───────────────▼───────────────────▼──────────────────┐      │
│  │     STRICT VALIDATION (QuoteTransferSchema v2)             │      │
│  │     - All fields typed (zero z.any())                      │      │
│  │     - Legs: z.object with mode enum + charge sub-schema    │      │
│  │     - Completeness score computed at entry                 │      │
│  └────────────────────────┬──────────────────────────────────┘      │
│                           │                                          │
│  ┌────────────────────────▼──────────────────────────────────┐      │
│  │     TRANSFORMATION (QuoteTransformService v2)              │      │
│  │     - Uses FIELD_MAP registry (canonical field names)      │      │
│  │     - Audit trail: logs every resolution                   │      │
│  │     - Warnings surfaced to UI (not swallowed)              │      │
│  └────────────────────────┬──────────────────────────────────┘      │
│                           │                                          │
│  ┌────────────────────────▼──────────────────────────────────┐      │
│  │        QuoteDataProvider (UNIFIED CONTEXT)                 │      │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐   │      │
│  │  │ referenceData│  │ quoteState    │  │ mutations     │   │      │
│  │  │ (8 datasets, │  │ (quote,items, │  │ (save,create, │   │      │
│  │  │  cached,     │  │  versions,    │  │  update,      │   │      │
│  │  │  deduplicated│  │  options,legs,│  │  addOption,   │   │      │
│  │  │  )           │  │  charges)     │  │  updateCharge)│   │      │
│  │  └──────────────┘  └───────────────┘  └──────────────┘   │      │
│  └──────────┬─────────────────────────┬──────────────────────┘      │
│             │                         │                              │
│  ┌──────────▼──────┐  ┌──────────────▼───────────────────────┐     │
│  │ QuoteForm       │  │ MultiModalQuoteComposer              │     │
│  │ (form mode)     │  │ (wizard mode - 4 steps)              │     │
│  │ Uses provider   │  │ Uses same provider                   │     │
│  └────────┬────────┘  └──────────────┬───────────────────────┘     │
│           │                          │                               │
│  ┌────────▼──────────────────────────▼───────────────────────┐     │
│  │  PERSISTENCE (save_quote_atomic_v2 RPC)                    │     │
│  │  + New options CREATE   + New legs CREATE                  │     │
│  │  + Charges CRUD         + Optimistic locking               │     │
│  │  + Post-save validation + Event emission                   │     │
│  └────────────────────────┬──────────────────────────────────┘     │
│                           │                                          │
│  ┌────────────────────────▼──────────────────────────────────┐     │
│  │  ┌──────────────┐  ┌──────────┐  ┌────────────┐          │     │
│  │  │ PDF Gen V2   │  │ Send     │  │ Version    │          │     │
│  │  │ (SINGLE      │  │ Quote    │  │ History    │          │     │
│  │  │  ENGINE)     │  │ (cached  │  │ + Diff     │          │     │
│  │  │ + Validation │  │  PDF)    │  │            │          │     │
│  │  │ + Mode tmpl  │  │          │  │            │          │     │
│  │  └──────────────┘  └──────────┘  └────────────┘          │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │  EVENT BUS (emit-event)                                    │     │
│  │  QuoteCreated │ QuoteEdited │ ChargeSaved │ PdfGenerated  │     │
│  │  EmailSent │ VersionCreated │ ApprovalRequested            │     │
│  └────────┬────────────────┬─────────────────┬───────────────┘     │
│           │                │                 │                       │
│  ┌────────▼──┐  ┌──────────▼──┐  ┌──────────▼──────────────┐      │
│  │ Audit Log │  │ Reconciler  │  │ Metrics & Observability │      │
│  │ (audit_   │  │ (scheduled  │  │ (metrics-quotation)     │      │
│  │  logs)    │  │  + on-demand│  │                         │      │
│  │           │  │  + auto-fix)│  │                         │      │
│  └───────────┘  └─────────────┘  └─────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.3 Data Flow: Quote Lifecycle (Target State)

```
  USER INPUT                VALIDATION              PERSISTENCE            OUTPUT
  ─────────                 ──────────              ───────────            ──────

  Quick Quote ──┐
  AI Quote ─────┼──► TransferSchema ──► TransformService ──► save_quote_atomic_v2
  QuoteForm ────┘    (strict Zod)       (FIELD_MAP +          │
                     │                   audit trail)          ├──► emit QuoteCreated
                     │                   │                     ├──► reconcile-quote
                     ▼                   ▼                     │
                  Reject if           Log every                ▼
                  invalid             resolution          ┌──────────┐
                  (no z.any)          (warn on miss)      │ Supabase │
                                                          │ Postgres │
                                                          └────┬─────┘
                                                               │
                  ┌────────────────────────────────────────────┘
                  │
                  ▼
            ┌───────────┐     ┌──────────┐     ┌─────────────┐
            │ PDF Gen   │────►│ Storage  │────►│ Send Quote  │
            │ (V2 only) │     │ (cached) │     │ (same PDF)  │
            │ + validate│     └──────────┘     └──────┬──────┘
            │ + mode tpl│                             │
            └───────────┘                             ▼
                                               emit EmailSent
                                               update status
```

### 3.4 Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                     │
│                                                             │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ AI Rate │  │ Email    │  │ ERP/TMS  │  │ Compliance │  │
│  │ Engine  │  │ Providers│  │ Webhooks │  │ APIs       │  │
│  │ (GPT-4o)│  │ (Resend, │  │ (Phase 5)│  │ (HTS,AES) │  │
│  │         │  │  Gmail,  │  │          │  │            │  │
│  │         │  │  O365)   │  │          │  │            │  │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       │            │             │               │          │
│  ┌────▼────────────▼─────────────▼───────────────▼──────┐  │
│  │              EDGE FUNCTION LAYER                      │  │
│  │  47 Deno functions with shared auth/cors/logger       │  │
│  │  Rate limiting: 100 req/min/tenant (Phase 5)          │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │              SUPABASE (Postgres + Auth + Storage)      │  │
│  │  RLS: 145 tables │ RPC: save_quote_atomic_v2          │  │
│  │  Realtime: quote/version/charge subscriptions          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema Optimization

### 4.1 Current Schema Issues

**Duplicate columns requiring unification:**

| Issue | Current Columns | Table | Resolution |
|-------|----------------|-------|------------|
| Dual carrier | `provider_id` + `carrier_id` | `quotation_version_option_legs` | Keep `carrier_id`, drop `provider_id` |
| Dual currency | `currency_id` + `quote_currency_id` | `quotation_version_options` | Keep `currency_id`, drop `quote_currency_id` |
| Triple incoterms | `quotes.incoterms` + `quotes.incoterm_id` + `options.incoterms` | `quotes`, `quotation_version_options` | Keep `quotes.incoterm_id` FK only |
| Dual service | `service_type_id` + `service_id` | `quotation_version_options` | Clarify parent/child; keep both with defined semantics |

### 4.2 Normalization Strategy

**Phase 4 Migration Plan (3-step safe migration):**

**Step 1 — Add computed views (non-breaking):**
```sql
-- Unified carrier view
CREATE OR REPLACE VIEW v_option_legs_resolved AS
SELECT
  l.*,
  COALESCE(l.carrier_id, l.provider_id) AS resolved_carrier_id,
  COALESCE(c1.name, c2.name) AS resolved_carrier_name
FROM quotation_version_option_legs l
LEFT JOIN carriers c1 ON c1.id = l.carrier_id
LEFT JOIN carriers c2 ON c2.id = l.provider_id;

-- Unified currency view
CREATE OR REPLACE VIEW v_options_resolved AS
SELECT
  o.*,
  COALESCE(o.currency_id, o.quote_currency_id) AS resolved_currency_id,
  COALESCE(cur1.code, cur2.code, 'USD') AS resolved_currency_code
FROM quotation_version_options o
LEFT JOIN currencies cur1 ON cur1.id = o.currency_id
LEFT JOIN currencies cur2 ON cur2.id = o.quote_currency_id;
```

**Step 2 — Migrate all code to use resolved columns (via views or COALESCE).**

**Step 3 — Drop deprecated columns:**
```sql
-- Only after all code migrated and verified
ALTER TABLE quotation_version_option_legs DROP COLUMN provider_id;
ALTER TABLE quotation_version_options DROP COLUMN quote_currency_id;
ALTER TABLE quotes DROP COLUMN incoterms; -- keep incoterm_id FK
ALTER TABLE quotation_version_options DROP COLUMN incoterms; -- use quotes.incoterm_id
```

### 4.3 Indexing Improvements

**Current gaps identified:**

```sql
-- Quote lookup by tenant + status (common dashboard query)
CREATE INDEX CONCURRENTLY idx_quotes_tenant_status
  ON quotes (tenant_id, status)
  WHERE status != 'deleted';

-- Version lookup by quote (always filtered)
CREATE INDEX CONCURRENTLY idx_versions_quote_created
  ON quotation_versions (quote_id, created_at DESC);

-- Charge lookup by option + side (PDF generation critical path)
CREATE INDEX CONCURRENTLY idx_charges_option_side
  ON quote_charges (quote_option_id, charge_side_id);

-- Audit log lookup by action + time (reconciliation, metrics)
CREATE INDEX CONCURRENTLY idx_audit_action_time
  ON audit_logs (action, created_at DESC)
  WHERE action LIKE 'EVENT:%' OR action LIKE 'ALERT:%';

-- Port name lookup (ID resolution critical path)
CREATE INDEX CONCURRENTLY idx_ports_location_name_lower
  ON ports_locations (LOWER(location_name));

-- Carrier name lookup (ID resolution)
CREATE INDEX CONCURRENTLY idx_carriers_name_lower
  ON carriers (LOWER(name));
```

### 4.4 Schema Versioning

All schema changes follow this migration pattern:
1. **Forward migration** with `CREATE INDEX CONCURRENTLY` (non-locking)
2. **Rollback migration** with `DROP INDEX IF EXISTS`
3. **Data migration** as separate step (not mixed with DDL)
4. **Verification query** to confirm migration success

### 4.5 Extended RPC: `save_quote_atomic_v2`

```sql
-- Pseudocode for the enhanced RPC
CREATE OR REPLACE FUNCTION save_quote_atomic_v2(p_payload jsonb)
RETURNS jsonb  -- Returns full saved state (not just quote_id)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote_id uuid;
  v_result jsonb;
BEGIN
  -- 1. Upsert quote header (existing logic)
  -- 2. Sync items: delete removed, insert new, update existing
  -- 3. Sync cargo configurations
  -- 4. Sync options: UPDATE existing (by id), INSERT new (id IS NULL)
  -- 5. Sync legs per option: UPDATE existing, INSERT new
  -- 6. Sync charges: DELETE removed, INSERT new, UPDATE existing
  -- 7. Post-save validation:
  --    ASSERT (SELECT count(*) FROM quotation_version_options WHERE ...) > 0
  -- 8. Emit event (INSERT INTO audit_logs)
  -- 9. Return full saved state as JSON for optimistic UI update

  RETURN v_result;
END $$;
```

---

## 5. API Enhancement Specifications

### 5.1 Versioning Strategy

**Approach**: URL path versioning (`/v1/quotes/...`)

**Rationale**: Path versioning is explicit, cacheable, and works with Supabase edge function routing. Header versioning was rejected because it complicates debugging and CDN caching.

**Edge function structure:**
```
supabase/functions/
  api-v1-quotes/           # /v1/quotes (list, create)
  api-v1-quotes-detail/    # /v1/quotes/:id (get, update, delete)
  api-v1-quotes-versions/  # /v1/quotes/:id/versions (list, create)
  api-v1-quotes-pdf/       # /v1/quotes/:id/pdf (generate, get cached)
```

### 5.2 API Surface (Phase 5)

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/v1/quotes` | GET | List quotes (paginated, filtered by tenant scope) | User |
| `/v1/quotes` | POST | Create quote (validates via strict schema) | User |
| `/v1/quotes/:id` | GET | Get quote with current version, options, charges | User |
| `/v1/quotes/:id` | PUT | Update quote (full replace via `save_quote_atomic_v2`) | User |
| `/v1/quotes/:id` | PATCH | Partial update (specific fields only) | User |
| `/v1/quotes/:id/versions` | GET | List all versions for a quote | User |
| `/v1/quotes/:id/versions` | POST | Create new version (snapshot current state) | User |
| `/v1/quotes/:id/versions/:vid` | GET | Get specific version with options and charges | User |
| `/v1/quotes/:id/pdf` | POST | Generate PDF (returns cached if available) | User |
| `/v1/quotes/:id/pdf` | GET | Get cached PDF (404 if not generated) | User |
| `/v1/quotes/:id/send` | POST | Send quote via email | User |
| `/v1/quotes/:id/reconcile` | POST | Run consistency check | Admin |
| `/v1/quotes/metrics` | GET | Quote pipeline metrics | Admin |

### 5.3 Backward Compatibility

**Strategy**: Internal functions remain unchanged during Phase 5. The v1 API layer is a thin wrapper over existing edge functions and RPCs.

**Migration path**:
1. Phase 5: Deploy v1 API alongside existing direct edge function calls
2. Phase 6: Migrate frontend to use v1 API exclusively
3. Future: Deprecate direct edge function calls with 3-month notice

**Breaking change policy**: Any breaking change requires a v2 endpoint. v1 endpoints remain stable for 6 months after v2 launch.

### 5.4 Request/Response Standards

**Request format:**
```json
{
  "data": { /* resource fields */ },
  "meta": {
    "trace_id": "uuid-v4",
    "idempotency_key": "uuid-v4"
  }
}
```

**Response format:**
```json
{
  "data": { /* resource or array */ },
  "meta": {
    "trace_id": "uuid-v4",
    "timestamp": "ISO-8601",
    "version": "1.0"
  },
  "pagination": {
    "page": 1,
    "per_page": 25,
    "total": 142,
    "total_pages": 6
  }
}
```

**Error format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [
      { "field": "origin", "issue": "Port not found", "resolution": "Provide origin_port_id UUID" }
    ]
  },
  "meta": { "trace_id": "uuid-v4" }
}
```

---

## 6. Real-Time Synchronization Protocols

### 6.1 Current State

- `scheduled-reconcile` runs every 5 minutes, checks recently-updated quotes
- No real-time collaboration — multiple users editing the same quote see stale data
- PDF is regenerated on every send (no cache invalidation signal)
- `lastSyncTimestamp` exists in Composer props but is unused

### 6.2 Synchronization Architecture (Phase 5)

```
┌──────────────────────────────────────────────────────────┐
│                SUPABASE REALTIME                          │
│                                                          │
│  Channel: quote:{quoteId}                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Events:                                            │  │
│  │   quote:updated    — header fields changed         │  │
│  │   version:created  — new version snapshot          │  │
│  │   option:added     — new carrier option            │  │
│  │   charge:modified  — charge insert/update/delete   │  │
│  │   pdf:generated    — cached PDF available          │  │
│  │   status:changed   — draft → sent → accepted       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Subscriber: QuoteDataProvider                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ On event received:                                 │  │
│  │   1. Compare event.updated_at with local state     │  │
│  │   2. If remote is newer → merge non-conflicting    │  │
│  │   3. If conflict → apply resolution protocol       │  │
│  │   4. Invalidate React Query cache for affected key │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 6.3 Conflict Resolution Protocol

**Strategy**: Field-level last-writer-wins with conflict detection.

```
CONFLICT RESOLUTION ALGORITHM:

1. Each save includes `updated_at` timestamp from the local copy
2. RPC checks: IF db.updated_at > payload.updated_at THEN conflict detected
3. For non-overlapping field changes:
   - Merge both changes (field A from user 1, field B from user 2)
4. For overlapping field changes:
   - Last writer wins (most recent timestamp)
   - Loser's change logged to audit trail with CONFLICT:Overwritten event
   - UI notification: "Field X was updated by [user] — your change was superseded"
5. For structural changes (add/remove options or legs):
   - Append-only: both additions kept
   - Deletions require confirmation if item was modified by other user
```

**Optimistic locking implementation:**
```sql
-- In save_quote_atomic_v2:
UPDATE quotes SET ...
WHERE id = v_quote_id
  AND updated_at = (p_payload -> 'quote' ->> 'updated_at')::timestamptz;

IF NOT FOUND THEN
  -- Concurrent modification detected
  RAISE EXCEPTION 'CONFLICT: Quote was modified by another user at %',
    (SELECT updated_at FROM quotes WHERE id = v_quote_id);
END IF;
```

### 6.4 Cache Invalidation

| Event | Invalidates | Propagation |
|-------|-------------|-------------|
| `save_quote_atomic_v2` completes | React Query `quote:{id}`, `version:{id}` | Realtime broadcast |
| PDF generated | Supabase Storage cache key | Realtime `pdf:generated` event |
| Version created | React Query `versions:{quoteId}` | Realtime `version:created` event |
| Quote status changed | Dashboard query cache | Realtime `status:changed` event |

---

## 7. Data Validation Frameworks

### 7.1 Validation Pipeline (5 Stages)

```
Stage 1: ENTRY VALIDATION (QuoteTransferSchema v2)
  ├── All fields strictly typed (zero z.any())
  ├── Mode enum: z.enum(['air', 'ocean', 'road', 'rail'])
  ├── Legs: z.array(LegSchema) with required from/to/mode
  ├── Charges: z.array(ChargeSchema) with required amount/currency
  └── Output: Validated QuoteTransferData or ZodError with field paths

Stage 2: TRANSFORMATION VALIDATION (QuoteTransformService)
  ├── Rates array guard: MUST have rates.length > 0 before accessing rates[0]
  ├── Port resolution: MUST resolve to UUID (warn if fuzzy match, error if no match)
  ├── Carrier resolution: SHOULD resolve (warn if missing, allow null)
  ├── Service type: MUST resolve for mode-specific operations
  ├── Container: Validate type+size combination against master data (no 40HC with "loose")
  ├── Transit time: Normalize via TransitTimeSchema (reject ambiguous formats)
  └── Output: TransformationReport { resolved: [], warnings: [], errors: [] }

Stage 3: PERSISTENCE VALIDATION (save_quote_atomic_v2)
  ├── FK integrity: All UUIDs reference existing records
  ├── Business rules: options > 0, charges per option > 0
  ├── Financial validation: total = sum(charges) within tolerance (0.01)
  ├── Tenant scope: quote.tenant_id matches auth context
  └── Output: SaveResult { quote_id, warnings: [] } or error

Stage 4: PRE-RENDER VALIDATION (PDF generation)
  ├── Required data present: commodity != "General Cargo" when commodity_id exists
  ├── Weight/volume non-zero when items exist (reject negative values)
  ├── Company branding loaded for tenant (not hardcoded MGL)
  ├── Notes/terms_conditions included in SafeContext (currently missing)
  ├── Incoterms resolved (not conflicting between quotes.incoterms and shipping_term_id)
  ├── Sell-side charges filtered (NEVER show buy-side)
  └── Output: PDF binary or ValidationBlockError with missing fields

Stage 5: DELIVERY VALIDATION (send-email)
  ├── PDF integrity: file size > 0, starts with %PDF magic bytes
  ├── Recipient email format valid
  ├── Quote status allows sending (draft or re-send)
  └── Output: Email sent or DeliveryError
```

### 7.2 Strict Transfer Schema (Phase 2)

```typescript
// Replaces the current z.any() fields in quote-transfer.ts

// Transit time normalization (centralizes fragile parsing in QuoteOptionService.ts:144-156)
const TransitTimeSchema = z.union([
  z.string().regex(/^\d+\s*(days?|hours?|hrs?|d|h)$/i, "Format: '25 days' or '48 hours'"),
  z.number().int().min(0),
]).optional().transform((val) => {
  // Normalize to hours for consistent storage
  if (typeof val === 'number') return val;
  if (!val) return undefined;
  const num = parseFloat(val);
  if (isNaN(num)) return undefined;
  if (/day|d/i.test(val)) return Math.round(num * 24);
  return Math.round(num); // assume hours
});

const LegSchema = z.object({
  sequence: z.number().int().min(1),
  from: z.string().min(1, "Leg origin required"),
  to: z.string().min(1, "Leg destination required"),
  from_port_id: z.string().uuid().optional(),
  to_port_id: z.string().uuid().optional(),
  mode: z.enum(['air', 'ocean', 'road', 'rail']),
  carrier: z.string().optional(),
  carrier_id: z.string().uuid().optional(),
  transit_time: TransitTimeSchema,
  transit_time_hours: z.number().int().min(0).optional(),
  leg_type: z.enum(['origin', 'main', 'destination']).optional(),
  charges: z.array(z.lazy(() => ChargeSchema)).optional(),
});

const ChargeSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  category_id: z.string().uuid().optional(),
  amount: z.number().min(0),
  currency: z.string().min(3).max(3),
  charge_side: z.enum(['buy', 'sell']).optional(),
  is_included: z.boolean().optional(),
  note: z.string().optional(),
});

const ReliabilitySchema = z.object({
  score: z.number().min(0).max(100).optional(),
  on_time_percentage: z.number().optional(),
  data_source: z.string().optional(),
}).optional();

const EnvironmentalSchema = z.object({
  co2_kg: z.number().optional(),
  co2_per_teu: z.number().optional(),
  green_rating: z.string().optional(),
}).optional();
```

### 7.3 Field Name Registry (Phase 3)

```typescript
// src/lib/schemas/field-registry.ts
// Single source of truth for DB ↔ code field name mapping

export const FIELD_MAP = {
  port: {
    name: 'location_name',    // DB column; NOT port_name, NOT name
    code: 'location_code',    // DB column; NOT port_code
    id: 'id',
  },
  option: {
    isPrimary: 'is_selected', // DB column; NOT is_primary
    currency: 'currency_id',  // DB column; NOT quote_currency_id
  },
  leg: {
    mode: 'mode',             // DB column; NOT transport_mode
    carrier: 'carrier_id',    // Canonical; provider_id is deprecated
    transitTime: 'transit_time_hours', // DB column; NOT transit_time
  },
  charge: {
    side: 'charge_side_id',   // DB column
    option: 'quote_option_id', // FK to quotation_version_options
    category: 'category_id',  // FK to charge_categories
  },
  quote: {
    incoterms: 'incoterm_id', // Canonical; NOT quotes.incoterms text
  },
} as const;

// Helper: resolve a field name for a given entity
export function dbField<E extends keyof typeof FIELD_MAP>(
  entity: E,
  field: keyof typeof FIELD_MAP[E]
): string {
  return FIELD_MAP[entity][field];
}
```

### 7.4 Error Handling Procedures

| Error Type | Handling | User Impact |
|-----------|----------|-------------|
| Zod validation failure | Reject with field-level errors; show in form | Red inline errors |
| Port resolution failure | Warning badge on field; allow manual selection | Yellow warning indicator |
| Carrier resolution failure | Allow null; show "Carrier not set" label | Amber info badge |
| Save RPC error | Rollback; show retry dialog | Error toast with retry button |
| PDF validation block | Show missing fields list; block send until fixed | Modal: "Fix these issues before sending" |
| Charge side filter failure | Log ALERT; block PDF (never expose buy-side) | Error: "Contact support" |
| Concurrent modification | Show conflict dialog with merge/overwrite options | Modal with diff view |

---

## 8. Performance Benchmarking Criteria

### 8.1 Latency Targets

| Operation | Current (estimated) | Phase 2 Target | Phase 4 Target | Measurement |
|-----------|-------------------|----------------|----------------|-------------|
| Quick Quote → Composer load | ~4-8s | < 3s | < 2s | Time from navigate() to Composer fully rendered |
| Reference data load (14 datasets) | ~2-4s | < 1.5s | < 1s | Time until all dropdowns populated |
| `save_quote_atomic` RPC | ~500ms | < 800ms (more data) | < 600ms | RPC round-trip time |
| PDF generation | ~3-5s | < 3s | < 2s | Edge function execution time |
| Reconcile-quote (single) | ~2-3s | < 2s | < 1s | Edge function execution time |
| Send email (end-to-end) | ~5-10s | < 8s | < 5s | From button click to confirmation |

### 8.2 Throughput Targets

| Metric | Current | Phase 4 Target | Phase 6 Target |
|--------|---------|----------------|----------------|
| Concurrent quote edits per tenant | Unknown (likely 1-2) | 10 | 25 |
| Quotes created per minute (system-wide) | Unknown | 50 | 100 |
| PDF generations per minute | Unknown | 20 | 50 |
| Scheduled reconcile throughput | 200 quotes/5min | 500 quotes/5min | 1000 quotes/5min |

### 8.3 Data Consistency Metrics

| Metric | Current (estimated) | Phase 2 Target | Phase 4 Target |
|--------|-------------------|----------------|----------------|
| Quick Quote → Composer field population rate | ~30% | 85% | 98% |
| Charge persistence after save (atomic) | ~30% (non-atomic, via Composer manual ops) | 95% | 100% |
| New option persistence after save | 0% | 95% | 100% |
| PDF field accuracy rate | ~50% | 90% | 99% |
| Preview ↔ delivered PDF consistency | ~50% | 95% | 100% |
| Port ID resolution success | ~60% | 90% | 99% |
| Reconciliation pass rate | Unknown | 80% | 95% |
| Silent data loss events per 100 quotes | ~40 | 10 | < 2 |

### 8.4 Bundle & Frontend Performance

| Metric | Current | Target | Tool |
|--------|---------|--------|------|
| Quote module JS bundle size | Unmeasured | < 200KB gzipped | Vite build analysis |
| Composer initial render (LCP) | Unmeasured | < 1.5s | Lighthouse |
| Form input latency (INP) | Unmeasured | < 200ms | Web Vitals |
| Memory usage (Composer with 20 legs) | Unmeasured | < 100MB | Chrome DevTools |

### 8.5 Benchmarking Procedure

**Phase 2 baseline establishment:**
1. Instrument `window.__lnxTelemetry` (already partially exists) with:
   - `quote.load.duration` — Composer load time
   - `quote.save.duration` — save_quote_atomic round-trip
   - `quote.pdf.duration` — PDF generation time
   - `quote.fields.populated` — count of non-empty fields after load
2. Run 50-quote stress test: create quotes via Quick Quote → Composer → Save → PDF → Send
3. Record baseline metrics per operation
4. Repeat at end of each phase to measure improvement

---

## 9. Security and Compliance Requirements

### 9.1 Current Security Posture

| Control | Status | Details |
|---------|--------|---------|
| Authentication | Implemented | Supabase Auth with JWT; `requireAuth(req)` on 44/45 edge functions |
| Authorization (RLS) | Implemented | 145 tables with RLS; `ScopedDataAccess` app-level layer |
| CORS | Implemented | `getCorsHeaders(req)` origin allowlist (no wildcard) |
| Encryption at rest | Supabase default | Postgres TDE via Supabase infrastructure |
| Encryption in transit | Implemented | HTTPS enforced on all endpoints |
| Audit trail | Partial | 4 event types logged; editing/charge events missing |
| PII masking in logs | Implemented | `src/lib/logger.ts` with PII masking |
| Secret management | Needs work | Credentials were in `.env` in git history (MUST rotate) |
| Email secrets | **Exposed** | `send-email/index.ts:47` contains hardcoded Resend API key fallback; sender domain hardcoded to `soslogistics.pro` with fallback to Resend demo domain `onboarding@resend.dev` |
| AI Advisor pricing | Hardcoded | `ai-advisor/index.ts:456` injects 12% fuel surcharge into every quote with no market basis or tenant configuration |
| Quote status integrity | Missing | No DB constraint prevents invalid status transitions (e.g., `accepted` → `draft`) |
| Notes sanitization | Missing | `quotes.notes` stored as raw text; no XSS sanitization if rendered in HTML context |

### 9.2 Enhancement Requirements

**Phase 4 security enhancements:**

| # | Requirement | Implementation | Priority |
|---|------------|----------------|----------|
| 9.2.1 | Complete audit trail — all quote mutations logged | Expand `emit-event` to 8 event types | High |
| 9.2.2 | Buy-side charge protection — never expose cost data in customer-facing outputs | Pre-render validation gate blocks if sell-side filter fails | Critical |
| 9.2.3 | Credential rotation — rotate all keys that were in `.env` git history | New secrets via Supabase Dashboard; update all references | Critical |
| 9.2.4 | Quote data encryption — encrypt sensitive fields (pricing, margins) at rest | Postgres column-level encryption via `pgcrypto` | Medium |
| 9.2.5 | Rate limiting — prevent abuse of quote creation/PDF generation | Edge function middleware: 100 req/min/tenant | Medium |
| 9.2.6 | Data retention — quote data lifecycle (archive after 2 years, delete after 5) | Scheduled function with configurable retention policy | Low |
| 9.2.7 | Remove hardcoded Resend API key from `send-email/index.ts` (Phase 1) | Delete fallback literal; require env var; fail explicitly if missing | Critical |
| 9.2.8 | Remove hardcoded fuel surcharge from AI Advisor (Phase 4) | Replace `fuelSurchargeRate = 0.12` with tenant-configurable rate | Medium |
| 9.2.9 | Sanitize `quotes.notes` and `terms_conditions` before rendering in HTML/PDF | Apply HTML entity escaping or use safe rendering library | Medium |

### 9.3 Compliance Requirements

| Regulation | Applicability | Requirement | Implementation |
|-----------|---------------|-------------|----------------|
| SOC 2 Type II | SaaS platform | Audit trail, access controls, change management | Audit logs + RLS + version history |
| GDPR | EU customers | Data portability, right to deletion, consent | Soft delete + export API + consent tracking |
| CCPA | US/California | Data disclosure, opt-out of sale | Same as GDPR controls |
| Export Controls (EAR/ITAR) | Freight/logistics | HTS code validation, denied party screening | `validate_compliance` AI action + compliance_screenings table |
| SOX (if public) | Financial reporting | Pricing audit trail, segregation of duties | Quote approval workflows + pricing logs |

### 9.4 Data Classification

| Data Category | Classification | Encryption | Retention | Access |
|--------------|---------------|------------|-----------|--------|
| Quote pricing (sell-side) | Business Confidential | At rest + in transit | 5 years | User + Admin |
| Quote pricing (buy-side/cost) | Restricted | Column-level + in transit | 5 years | Admin only |
| Customer PII (name, email, address) | Personal | At rest + in transit | Per GDPR consent | Tenant scoped |
| AI-generated rates | Internal | In transit | 1 year (cache) | User + Admin |
| Audit logs | Compliance | At rest | 7 years | Admin + Compliance |

---

## 10. Testing Strategies

### 10.1 Current Test Coverage

- **Unit tests**: 339 total (293 passing, 46 failing/skipped)
- **E2E tests**: 1 (quotation framework with PDF validation)
- **Test framework**: Vitest (unit) + Playwright (e2e)
- **Mock setup**: `test/setup.ts` mocks `useAuth`, `useCRM`, `DomainContext`, `i18next`, `supabase`

### 10.2 Testing Pyramid

```
                    ┌───────────┐
                    │  E2E (5)  │    Playwright: Full quote lifecycle
                    ├───────────┤
                 ┌──┤Integration│    Vitest: Cross-module data flow
                 │  │  (25+)    │    Quote lifecycle, PDF pipeline
                 │  ├───────────┤
              ┌──┤  │  Unit     │    Vitest: Individual functions
              │  │  │  (400+)   │    Mappers, validators, formatters
              │  │  └───────────┘
              └──┘
```

### 10.3 Unit Test Additions (Per Phase)

**Phase 1 tests (12 new):**
- `port.location_name` resolves correctly (not `port_name`)
- Commodity name fetched via JOIN (not hardcoded)
- V2 engine uses `weight_kg` / `volume_cbm`
- `is_selected` mapping roundtrip
- Transport mode enum validation (reject "Best Value")
- Service type resolution via `transport_modes` relationship
- Tenant branding loaded for non-MGL tenants
- Rail mode in Quick Quote enum
- `rates[0]` guard: empty rates array returns default/error, not undefined cascade
- PDF SafeContext includes `notes` and `terms_conditions` fields
- `send-email` function fails explicitly when `RESEND_API_KEY` env var is missing (no fallback)
- Error boundary renders fallback UI when Composer child throws

**Phase 2 tests (16 new):**
- `save_quote_atomic_v2` creates new options
- `save_quote_atomic_v2` persists charges atomically (rollback if quote save fails)
- Strict Zod schema rejects `z.any()` payload shapes
- Post-save validation detects empty options/charges
- Sell-side filter never returns buy-side charges
- Multi-leg auto-population for 2, 3, 4-leg routes
- Auto-save trigger with correct field names
- Charge deduplication precision (no false positives)
- Financial balance validation (total = sum of charges)
- Transform audit trail captures all resolutions
- Transit time: "25 days" → 600h, "48 hours" → 48h, bare "25" → rejected or explicit unit
- Transit time: "1d 12h" → 36h (not 24h), "" → null (not 0)
- Container validation: reject 40HC size with "loose" type
- Container validation: accept valid combos (20GP + container, FCL + 40HC)
- Feature flag: `useFeatureFlags('QUOTE_UNIFIED_PROVIDER')` returns default when flag missing
- Feature flag: flag toggle propagates within 5 seconds

### 10.4 Integration Tests (Phase 2+)

```typescript
// test/integration/quote-lifecycle.test.ts

describe('Quote Lifecycle Integration', () => {
  it('Quick Quote → Composer: all fields populated', async () => {
    // 1. Create QuoteTransferData with all fields
    // 2. Run through QuoteTransformService
    // 3. Save via save_quote_atomic_v2
    // 4. Load in Composer (simulate loadInitialData)
    // 5. Assert: origin, destination, mode, carrier, charges all present
  });

  it('Save → Reload: zero data loss', async () => {
    // 1. Load quote with known state
    // 2. Add new option + new leg + new charges
    // 3. Save via save_quote_atomic_v2
    // 4. Reload from DB
    // 5. Assert: new option, leg, charges all present
  });

  it('PDF pipeline: commodity + weight + branding correct', async () => {
    // 1. Create quote with commodity_id and weight_kg
    // 2. Generate PDF via generate-quote-pdf (V2)
    // 3. Parse PDF text content
    // 4. Assert: actual commodity name, correct weight, tenant branding
  });

  it('Concurrent edit: conflict detected and resolved', async () => {
    // 1. Load quote state A
    // 2. Simulate user 1 saves field X
    // 3. Simulate user 2 saves field Y (from state A)
    // 4. Assert: both changes applied (non-overlapping merge)
  });

  it('Concurrent edit: same field conflict', async () => {
    // 1. Load quote state A
    // 2. Simulate user 1 saves origin = "Shanghai"
    // 3. Simulate user 2 saves origin = "Ningbo" (from state A)
    // 4. Assert: last writer wins, CONFLICT event logged
  });
});
```

### 10.5 Chaos Engineering (Phase 6)

**Failure scenarios to test:**

| Scenario | Injection Method | Expected Behavior |
|---------|------------------|-------------------|
| PDF generation timeout | Delay edge function response by 30s | Circuit breaker triggers; text-only fallback |
| Partial reference data failure | Mock 3 of 14 ref data queries to fail | Composer loads with warnings; affected dropdowns show "Unable to load" |
| RPC save failure mid-transaction | Kill Postgres connection during save | Full rollback; no partial data; error shown to user |
| Email provider down | Mock all providers returning 500 | Retry 3x; log failure; queue for retry; user notified |
| Supabase Realtime disconnect | Drop WebSocket connection | Reconnect with exponential backoff; show "Reconnecting..." badge |
| Concurrent heavy load | 50 simultaneous quote saves | All succeed or fail cleanly; no data corruption |

**Execution**: Run chaos tests in staging environment using a dedicated test tenant. Schedule monthly after Phase 6 deployment.

### 10.6 Regression Test Suite

**Pre-merge gate** (CI/CD — runs on every PR):
1. All unit tests pass (`vitest run`)
2. Type check passes (`tsc --noEmit`)
3. Lint passes (`eslint`)
4. Build succeeds (`vite build`)
5. Bundle size check (< 2MB total, < 200KB quote module)

**Pre-release gate** (manual trigger before deployment):
1. All integration tests pass
2. E2E tests pass (Playwright)
3. Performance benchmark within targets
4. Security scan (no new vulnerabilities)

---

## 11. Rollback Procedures and Disaster Recovery

### 11.1 Rollback Strategy Per Phase

**General principle**: Every phase deployment is reversible within 30 minutes. Database migrations include DOWN scripts. Feature flags gate new behavior.

> **PREREQUISITE (v2.1)**: Feature flag infrastructure must be built in Phase 2 (Task 2.11) before Phase 3. No feature flag system currently exists in the codebase. Rollback strategies for Phases 3-6 depend on this.

> **NOTE (v2.1)**: No DOWN migration files currently exist in `supabase/migrations/`. The rollback templates below are aspirational — implement them as part of each phase's migration work.

| Phase | Rollback Mechanism | Data Considerations | RTO |
|-------|-------------------|---------------------|-----|
| Phase 1 (Field Fixes) | Git revert; no schema changes | No data migration needed | 5 min |
| Phase 2 (Data Integrity) | Git revert + rollback RPC migration | New RPC is additive (old RPC still works) | 15 min |
| Phase 3 (Unification) | Feature flag `QUOTE_UNIFIED_PROVIDER=false` | V1 engine preserved but disabled | 5 min (flag toggle) |
| Phase 4 (Enterprise) | Rollback migrations (views → drop deprecated columns is 3-step) | Step 3 (column drops) is irreversible — only proceed after 2-week validation | 30 min |
| Phase 5 (API) | Remove v1 API edge functions; frontend never migrated until stable | API is additive; old direct calls still work | 10 min |
| Phase 6 (Competitive) | Feature flags per feature | All features are additive | 5 min (flag toggle) |

### 11.2 Database Rollback Procedures

**Schema migration rollback template:**
```sql
-- Every migration file includes a corresponding down migration

-- UP: 20260301_unify_carrier_columns.sql
ALTER TABLE quotation_version_option_legs ADD COLUMN resolved_carrier_id uuid
  GENERATED ALWAYS AS (COALESCE(carrier_id, provider_id)) STORED;

-- DOWN: 20260301_unify_carrier_columns_down.sql
ALTER TABLE quotation_version_option_legs DROP COLUMN IF EXISTS resolved_carrier_id;
```

**Critical rule**: Column drops (Phase 4 Step 3) require:
1. 2-week validation period on staging with production traffic mirror
2. Verify zero queries reference dropped columns (query log analysis)
3. DBA sign-off
4. Scheduled maintenance window with pre-approved rollback script

### 11.3 Disaster Recovery Plan

| Scenario | Detection | Response | Recovery |
|---------|-----------|----------|----------|
| Data corruption in quotes table | Reconciliation alerts spike | Pause writes; identify affected rows | Restore from Supabase point-in-time backup (< 1h) |
| RPC breaking change | CI integration tests fail | Block deployment | Git revert; redeploy previous version |
| PDF engine regression | PDF quality metrics drop | Enable V1 fallback flag | Toggle feature flag `PDF_ENGINE=v1` |
| Complete Supabase outage | Health check endpoint fails | Show maintenance page | Wait for Supabase recovery; no user-side action |
| Credential compromise | Suspicious audit log entries | Rotate all secrets immediately | Revoke old tokens; issue new via Supabase Dashboard |

### 11.4 Backup Strategy

| Data | Backup Method | Frequency | Retention |
|------|--------------|-----------|-----------|
| Postgres (all tables) | Supabase automated backups | Daily | 30 days |
| Point-in-time recovery | Supabase WAL archiving | Continuous | 7 days |
| Generated PDFs (Storage) | Supabase Storage replication | On write | Indefinite |
| Audit logs | Supabase backup + optional export to S3 | Daily | 7 years |
| Edge function code | Git repository | On push | Indefinite |

---

## 12. Resource Allocation Plans

### 12.1 Team Roles

| Role | Responsibility | Phases | Allocation |
|------|---------------|--------|------------|
| **Senior Full-Stack Engineer** (Lead) | Architecture decisions, RPC development, schema migrations, code review | All phases | 100% for 18 weeks |
| **Frontend Engineer** | React components, QuoteDataProvider, Composer fixes, UI validation, error boundaries | Phases 1-3, 6 | 75% for 14 weeks |
| **Backend/Edge Function Engineer** | Edge functions, PDF engine, API layer, event system, feature flags | Phases 2-5 | 75% for 12 weeks |
| **QA Engineer** | Test automation, integration tests, chaos engineering, regression | All phases | 50% for 18 weeks |
| **DBA / DevOps** | Schema migrations, indexing, backup verification, monitoring setup | Phases 4-6 | 25% for 10 weeks |
| **Product Owner** | Quality gate approvals, acceptance criteria, prioritization | All phases | 10% for 18 weeks |

### 12.2 Skill Requirements

| Skill | Required For | Minimum Level |
|-------|-------------|---------------|
| React + TypeScript | Frontend fixes, QuoteDataProvider | Senior |
| Supabase (Postgres, Edge Functions, Realtime) | RPC, migrations, sync | Senior |
| Zod schema design | Validation framework | Intermediate |
| PDF generation (pdf-lib) | Engine unification | Intermediate |
| SQL (PL/pgSQL) | RPC development, migrations | Senior |
| Vitest + Playwright | Test automation | Intermediate |
| Event-driven architecture | Emit-event, reconciliation | Intermediate |

### 12.3 Budget Estimate

| Category | Unit Cost | Quantity | Total |
|----------|----------|----------|-------|
| Senior Full-Stack Engineer | Market rate | 640h (16 weeks) | - |
| Frontend Engineer | Market rate | 360h (12 weeks × 75%) | - |
| Backend Engineer | Market rate | 360h (12 weeks × 75%) | - |
| QA Engineer | Market rate | 320h (16 weeks × 50%) | - |
| DBA / DevOps | Market rate | 80h (8 weeks × 25%) | - |
| **Total engineering hours** | | **1,760h** | |
| Supabase Pro plan (scaling) | $25/mo/project | 4 months | $100 |
| Staging environment | Supabase free tier | 4 months | $0 |
| Monitoring tools (if external) | Varies | 4 months | TBD |

*Note: Labor costs depend on team location and employment model. The 367h estimate in Section 2 assumes a single senior engineer executing all code changes. The team hours above include the full team for parallel execution, QA, and oversight.*

### 12.4 Phase Staffing Matrix

```
            Week 1-2  Week 3-5  Week 6-8  Week 9-11  Week 12-14  Week 15-18
Lead          ████      ████      ████       ████       ████        ████
Frontend      ████      ████      ████                              ████
Backend                 ████      ████       ████       ████
QA            ██        ████      ████       ████       ████        ████
DBA                                          ████       ██          ██
Product       █         █         █          █          █           █
```

---

## 13. Risk Assessment Matrix

### 13.1 Risk Register

| ID | Risk | Likelihood | Impact | Severity | Phase | Mitigation |
|----|------|-----------|--------|----------|-------|------------|
| R1 | Schema migration corrupts production data | Low | Critical | High | 4 | 3-step migration with views; dry-run on staging with prod data copy; DBA review |
| R2 | V1 PDF engine removal breaks tenants using V1-specific features | Medium | High | High | 3 | Feature flag `PDF_ENGINE`; 2-week parallel running; tenant-by-tenant migration |
| R3 | `save_quote_atomic_v2` introduces new bugs in save path | Medium | High | High | 2 | Keep v1 RPC; v2 is new function; integration tests cover all save paths |
| R4 | Reference data provider merge causes regression in existing flows | Medium | Medium | Medium | 3 | Feature flag `QUOTE_UNIFIED_PROVIDER`; gradual rollout; A/B test |
| R5 | Real-time sync causes race conditions with optimistic UI | Medium | Medium | Medium | 5 | Field-level conflict resolution; comprehensive integration tests |
| R6 | Performance regression from additional validation stages | Low | Medium | Low | 2 | Benchmark before/after; validation is < 10ms overhead; lazy validation for non-critical fields |
| R7 | Team member unavailable during critical phase | Medium | Medium | Medium | All | Document architecture decisions; pair programming on critical code |
| R8 | Supabase Realtime subscription limits exceeded | Low | Medium | Low | 5 | Monitor connection count; implement connection pooling per tenant |
| R9 | AI-generated rate data fails new strict validation | High | Low | Medium | 2 | Coerce AI output to schema; log validation failures for AI tuning |
| R10 | Concurrent edit conflicts frustrate users | Medium | Low | Low | 5 | Clear UI for conflict resolution; merge non-overlapping changes silently |
| R11 | Feature flag infrastructure delayed — blocks Phase 3-6 rollback capability | Medium | High | High | 2 | Prioritize Task 2.11 early in Phase 2; use simple DB-backed flags (not external service) |
| R12 | Transit time parsing produces wrong values for existing quotes during migration | Medium | Medium | Medium | 2 | Run migration with dry-run report first; log all format mismatches before auto-correcting |
| R13 | Hardcoded Resend API key exploited before removal | Low | Critical | High | 1 | Immediate action: check if key is live; rotate via Resend dashboard before Phase 1 starts |
| R14 | Client-side quote filtering breaks at scale (1000-row limit) | High | Medium | High | 6 | Task 6.8 adds server-side pagination; monitor quote count growth |

### 13.2 Severity Matrix

```
              │  Low Impact  │  Medium Impact  │  High Impact  │  Critical Impact
──────────────┼──────────────┼─────────────────┼───────────────┼─────────────────
High          │  R9          │  R14            │               │
Likelihood    │  Accept      │  Mitigate       │               │
──────────────┼──────────────┼─────────────────┼───────────────┼─────────────────
Medium        │  R10         │  R4, R5, R7, R12│  R2, R3, R11  │
Likelihood    │  Accept      │  Mitigate       │  Mitigate     │
──────────────┼──────────────┼─────────────────┼───────────────┼─────────────────
Low           │              │  R6, R8         │               │  R1, R13
Likelihood    │              │  Monitor        │               │  Prevent
```

### 13.3 Contingency Plans

| Risk ID | Trigger | Contingency Action | Owner |
|---------|---------|-------------------|-------|
| R1 | Migration fails on staging | Abort; fix migration script; re-test | DBA |
| R2 | Tenant reports broken PDF after V1 removal | Re-enable V1 via feature flag within 5 min | Lead |
| R3 | Integration test shows data loss with v2 RPC | Fall back to v1 RPC; debug v2 in isolation | Lead |
| R4 | Regression reported after provider merge | Disable unified provider via feature flag | Frontend |
| R7 | Team member out for > 1 week | Re-prioritize; shift non-critical tasks; bring in backup | Product Owner |
| R11 | Feature flag infra not ready by Phase 3 start | Delay Phase 3; use git branch deployments as interim rollback | Lead |
| R13 | Hardcoded Resend key found to be live | Rotate key immediately via Resend dashboard; update env var | Lead |
| R14 | Quote list performance degrades (>1000 quotes) | Implement temporary LIMIT increase; fast-track Task 6.8 | Backend |

---

## 14. Success Metrics and KPIs

### 14.1 Data Accuracy KPIs

| KPI | Baseline | Phase 1 | Phase 2 | Phase 4 | Phase 6 | Measurement |
|-----|----------|---------|---------|---------|---------|-------------|
| Field population rate (QQ → Composer) | ~30% | 85% | 90% | 98% | 99% | `quote.fields.populated` / total fields |
| Charge persistence rate (atomic) | ~30% (non-atomic) | ~30% | 95% | 100% | 100% | Charges in DB after atomic save / charges in form |
| PDF field accuracy | ~50% | 90% | 95% | 99% | 99.5% | Correct fields on PDF / total PDF fields |
| Reconciliation pass rate | Unknown | 60% | 80% | 95% | 98% | `scheduled-reconcile` pass / total checked |
| Silent data loss per 100 quotes | ~40 | 15 | 5 | < 2 | 0 | Audit log alerts / quote count |

### 14.2 System Availability KPIs

| KPI | Baseline | Phase 4 | Phase 6 | Measurement |
|-----|----------|---------|---------|-------------|
| Quote save success rate | Unknown | 99% | 99.9% | Successful saves / attempted saves |
| PDF generation success rate | Unknown | 95% | 99% | Generated PDFs / requested PDFs |
| Email delivery success rate | Unknown | 95% | 98% | Delivered / sent |
| API availability (v1 endpoints) | N/A | N/A | 99.9% | Uptime monitoring |
| Mean time to recovery (MTTR) | Unknown | < 30 min | < 15 min | Incident response time |

### 14.3 User Satisfaction KPIs

| KPI | Baseline | Phase 3 | Phase 6 | Measurement |
|-----|----------|---------|---------|-------------|
| Quote creation abandonment rate | Unknown | < 20% | < 10% | Quotes started but not saved / total started |
| PDF regeneration rate (user clicks "regenerate") | Unknown | < 15% | < 5% | Regeneration requests / total PDFs |
| Support tickets related to quotes | Unmeasured | Baseline - 30% | Baseline - 60% | Support ticket tracking |
| Time to create a quote (median) | Unmeasured | < 5 min | < 3 min | Telemetry: first interaction to save |

### 14.4 Quality Gates Summary

| Phase | Exit Criteria | Approver |
|-------|--------------|----------|
| Phase 1 | All 12 tasks pass unit tests; manual QA confirms > 85% population rate; CI green; no hardcoded secrets in code | Engineering Lead |
| Phase 2 | Integration test: QQ → Composer → Save → Reload → 100% data present; zero `z.any()` in schema; sell-side filter verified; feature flag infrastructure operational; charges saved atomically | Engineering Lead |
| Phase 3 | V1 engine removed; single provider active; PDF cached and consistent across preview/download/send; pre-render validation blocks incomplete PDFs | Engineering Lead + Architect |
| Phase 4 | No duplicate columns in schema; full audit trail (8 event types); reconciliation auto-repairs common issues; mode-specific PDFs render correctly; status transitions enforced; weight/volume constraints active; auto-expiry operational; AI surcharges configurable | Engineering Lead + Security |
| Phase 5 | v1 API endpoints stable; optimistic locking prevents data loss; real-time sync < 2s delay; rate limiting enforced | Engineering Lead + Product |
| Phase 6 | Circuit breaker active; chaos tests pass; performance benchmarks met; analytics dashboard operational | Full Team + Product |

---

## 15. Post-Implementation Monitoring

### 15.1 Automated Alerting System

**Alert channels**: Supabase Dashboard + Slack webhook (configurable per tenant)

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Reconciliation mismatch spike | > 10% discrepancy rate in 5-min window | Critical | Page on-call; investigate immediately |
| PDF generation failure | > 3 consecutive failures for same quote | High | Auto-retry with circuit breaker; alert if breaker opens |
| Save RPC error rate | > 5% error rate in 15-min window | High | Alert engineering; check Postgres connection pool |
| Silent data loss detected | Audit log `ALERT:DataLoss` event | Critical | Page on-call; halt affected quote pipeline |
| Charge side exposure | Buy-side charge detected in customer-facing output | Critical | Block PDF delivery; page security team |
| Slow reference data load | > 5s for any single dataset | Medium | Check Postgres indexes; investigate query plan |
| Realtime subscription failure | WebSocket reconnect > 3 times in 5 min | Medium | Check Supabase Realtime limits; alert DevOps |
| API rate limit breached | Tenant exceeds 100 req/min | Low | Log for review; no automatic action |

### 15.2 Monitoring Dashboard

**Metrics to display (via `metrics-quotation` edge function + frontend dashboard):**

```
┌──────────────────────────────────────────────────────────────┐
│  QUOTATION PLATFORM HEALTH DASHBOARD                         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Quotes/Day  │  │ Save Rate   │  │ PDF Gen Rate        │ │
│  │    42        │  │   99.2%     │  │   97.8%             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Reconcile   │  │ Avg Quote   │  │ Data Loss Events    │ │
│  │ Pass Rate   │  │ Create Time │  │ (last 24h)          │ │
│  │   96.1%     │  │   3m 22s    │  │   0                 │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Field Population Rate (7-day trend)                  │   │
│  │  ████████████████████████████████░░░  97.2%           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Recent Alerts                                        │   │
│  │  [none in last 24h]                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 15.3 Operational Runbook Updates

After each phase, update `docs/Runbooks/quotation-platform-runbook.md` with:
1. New edge functions and their health check endpoints
2. New feature flags and their toggle procedures
3. Updated rollback procedures
4. New alert conditions and response procedures
5. Schema change log

### 15.4 Maintenance Schedule

| Activity | Frequency | Owner | Duration |
|----------|-----------|-------|----------|
| Reconciliation review (check discrepancy trends) | Daily (automated) | QA | 15 min |
| Performance benchmark run | Weekly (Phase 2+) | QA | 30 min |
| Audit log review (compliance) | Monthly | Security | 1h |
| Schema health check (unused indexes, bloat) | Monthly | DBA | 1h |
| Chaos engineering drill | Monthly (Phase 6+) | Engineering | 2h |
| Dependency update review | Bi-weekly | Lead | 30 min |
| Feature flag cleanup (remove stale flags) | Per release | Lead | 15 min |

### 15.5 Continuous Improvement Feedback Loop

```
  MONITOR → DETECT → ANALYZE → FIX → VERIFY → MONITOR
     │         │        │        │       │         │
     │    Reconcile  Root cause  PR    Test     Benchmark
     │    alerts     from audit  with  suite    against
     │               trail       test  green    targets
     │                                          │
     └──────────────────────────────────────────┘
```

**Process:**
1. Scheduled-reconcile detects discrepancy
2. Alert fires with `ALERT:ReconcileMismatch` details
3. Engineer inspects audit trail for the affected quote (`trace_id`)
4. Root cause identified from transformation audit log
5. Fix applied with corresponding unit test
6. Benchmark re-run to verify improvement
7. KPI dashboard updated automatically

---

## Appendix A: File Reference Map

### Frontend — Quote System

| File | Purpose | Key Issues |
|------|---------|------------|
| `src/components/sales/quick-quote/QuickQuoteModal.tsx` | Quick Quote entry (~1085 lines) | Dual state (form + extendedData); no Rail mode; no page-level error boundary |
| `src/components/sales/MultiModalQuoteComposer.tsx` | Composer wizard (~930 lines) | `port.port_name` mismatch; 570-line init; non-atomic charge mutations |
| `src/components/sales/composer/QuoteDetailsStep.tsx` | Composer step 1 | `port.port_name` mismatch |
| `src/components/sales/composer/LegsConfigurationStep.tsx` | Composer step 2 | `st.mode` mismatch; single-leg auto-fill |
| `src/components/sales/composer/ChargesManagementStep.tsx` | Composer step 3 | Location name vs code for AI |
| `src/components/sales/composer/store/QuoteStore.tsx` | Reducer store | Action dispatch patterns |
| `src/components/sales/quote-form/QuoteFormRefactored.tsx` | Form-mode editor | `origin_location_id` field mismatch |
| `src/components/sales/quote-form/useQuoteData.ts` | Reference data hook | Duplicate of `useQuoteRepositoryContext` |
| `src/components/sales/quote-form/useQuoteRepository.ts` | Hydration + save hook (~929 lines) | `is_primary`/`is_selected`; no charge save |
| `src/components/sales/quote-form/types.ts` | Zod schema + TS types | `z.any()` for 4 fields |
| `src/components/sales/SendQuoteDialog.tsx` | Send quote UI | No template selection |
| `src/components/sales/QuotePreviewModal.tsx` | PDF preview | Always V2; no cache |
| `src/pages/dashboard/QuoteNew.tsx` | Quote orchestrator page | Complex option insertion |
| `src/lib/services/quote-transform.service.ts` | Transfer → form transform (563 lines) | String-based ID resolution |
| `src/lib/schemas/quote-transfer.ts` | Transfer Zod schema | 8 `z.any()` fields (lines 16, 22-24, 28-29, 76-77) |
| `src/lib/quote-mapper.ts` | Rate → quote mapping (405 lines) | `opt.name` mode fallback; loose dedup |
| `src/components/sales/composer/DocumentPreview.tsx` | Browser preview (3rd render path) | Uses `window.print()` + inline HTML; diverges from PDF engine; has `@media print` CSS. Not unified with V2 PDF engine |
| `src/components/sales/composer/ErrorBoundary.tsx` | Composer error boundary | Sub-component level only; not page-level |
| `src/components/sales/quote-form/QuoteErrorBoundary.tsx` | Quote form error boundary | Sub-component level only |
| `src/services/QuoteOptionService.ts` | Option/leg creation | `parseDurationToHours()` fragile; no container type validation |
| `src/services/pricing.service.ts` | Margin/financial calculations | Handles edge cases (0%, 100%, >100%) but no negative margin prevention |
| `src/pages/dashboard/Quotes.tsx` | Quote list page | Client-side filtering with 1000-row limit; bulk delete only; no server-side pagination |

### Edge Functions — Quote System

| File | Purpose | Key Issues |
|------|---------|------------|
| `supabase/functions/generate-quote-pdf/index.ts` | PDF generation | Dual engine; field mismatches; hardcoded company |
| `supabase/functions/generate-quote-pdf/engine/renderer.ts` | V2 PDF renderer | Template-based; uses SafeContext |
| `supabase/functions/generate-quote-pdf/engine/context.ts` | Data → template context | Field name mismatches |
| `supabase/functions/generate-quote-pdf/engine/default_template.ts` | Default template | Generic; not mode-specific |
| `supabase/functions/send-email/index.ts` | Email dispatch (1080 lines) | Multi-provider; retry logic; **hardcoded Resend API key fallback**; hardcoded sender domain; no template system |
| `supabase/functions/emit-event/index.ts` | Event emission (70 lines) | Only 4 event types |
| `supabase/functions/reconcile-quote/index.ts` | Consistency check (75 lines) | No auto-repair |
| `supabase/functions/scheduled-reconcile/index.ts` | Background reconciliation (58 lines) | 200 quote limit |
| `supabase/functions/metrics-quotation/index.ts` | Quote metrics (56 lines) | Narrow window (60 min) |
| `supabase/functions/calculate-quote-financials/index.ts` | Financial calculations | Basic (shipping + tax only) |
| `supabase/functions/ai-advisor/index.ts` | AI rate generation | Hardcoded surcharges; no output validation |

### Database — Key Migrations

| File | Purpose |
|------|---------|
| `supabase/migrations/20260224100000_update_save_quote_atomic.sql` | Current RPC (242 lines) |
| `supabase/migrations/20260201170001_enterprise_quote_architecture.sql` | Approval workflows |
| `supabase/migrations/20251109120000_quote_phase1_multimodal.sql` | Legs, margins, FX tables |
| `supabase/migrations/20260121130810_create_quote_audit_logs.sql` | Audit log table |

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Composer** | `MultiModalQuoteComposer` — 4-step wizard for editing quotes |
| **Quick Quote** | Modal for fast quote creation with AI-assisted rate lookup |
| **Option** | A carrier rate option within a quote version (`quotation_version_options`) |
| **Leg** | A transport segment within an option (`quotation_version_option_legs`) |
| **Charge** | A line-item cost within a leg (`quote_charges`) — has buy-side and sell-side |
| **RPC** | Postgres Remote Procedure Call via `supabase.rpc()` |
| **RLS** | Row-Level Security — Postgres policies controlling data access |
| **FIELD_MAP** | Canonical field name registry mapping code names to DB columns |
| **Reconciliation** | Automated consistency check comparing quote data across pipeline stages |
| **Completeness Score** | Percentage of expected fields populated (100% = fully formed quote) |
| **Circuit Breaker** | Pattern that stops calling a failing service after N failures |

---

## Appendix C: v2.1 Review Findings (2026-02-15)

This appendix documents all gaps, inaccuracies, and new issues identified during the v2.1 codebase audit.

### C.1 Newly Identified Gaps (22 items)

| # | Finding | Severity | Phase | Task Added |
|---|---------|----------|-------|------------|
| G1 | `rates[0]` unguarded access in `QuoteTransformService:117` — produces blank fields when rates array is empty | Critical | 1 | 1.9 |
| G2 | Hardcoded Resend API key fallback in `send-email/index.ts:47` | Critical | 1 | 1.11 |
| G3 | Non-atomic charge persistence — charges saved via manual ops in Composer, separate from RPC | Critical | 2 | 2.10 |
| G4 | No feature flag infrastructure exists — rollback strategies for Phase 3-6 are unbuildable | High | 2 | 2.11 |
| G5 | Transit time parsing is fragile — "25" ambiguous (hours? days?), "1d 12h" loses 12h | High | 2 | 2.8 |
| G6 | AI Advisor hardcoded 12% fuel surcharge injected into every quote | High | 4 | 4.12 |
| G7 | AI Advisor has no output validation — GPT response injected into quotes without schema check | High | 4 | 4.13 |
| G8 | Zero FX/currency conversion infrastructure — Task 6.2 underestimated at 8h | High | 6 | 6.2 (revised to 16h) |
| G9 | Client-side-only quote filtering with 1000-row hard limit | High | 6 | 6.8 |
| G10 | Notes and terms_conditions excluded from PDF SafeContext | Medium | 1 | 1.10 |
| G11 | No page-level React error boundaries (QuickQuoteModal, Quotes page unprotected) | Medium | 1 | 1.12 |
| G12 | Container type+size validation missing — invalid combos allowed | Medium | 2 | 2.9 |
| G13 | No quote status transition enforcement — `accepted` → `draft` allowed | Medium | 4 | 4.9 |
| G14 | Weight/volume allow negative values — no CHECK constraint | Medium | 4 | 4.10 |
| G15 | No automatic quote expiry — `valid_until` is informational only | Medium | 4 | 4.11 |
| G16 | `DocumentPreview.tsx` is a 3rd render path — diverges from PDF V2 engine | Medium | 3 | 3.7 |
| G17 | Email sender domain hardcoded to `soslogistics.pro` — not configurable per tenant | Medium | 3 | 3.8 |
| G18 | Approval workflow has DB tables but zero UI components | Low | 6 | 6.9 |
| G19 | No quote clone/duplicate feature | Low | 6 | 6.7 |
| G20 | Zero i18n in quote components — all strings hardcoded in English | Low | Future | — |
| G21 | Zero accessibility (aria-*, role, tabIndex) in QuickQuoteModal | Low | Future | — |
| G22 | No offline queue for failed saves | Low | Future | — |

### C.2 Corrections to v2.0 (7 items)

| # | v2.0 Claim | Reality | Correction |
|---|-----------|---------|------------|
| C1 | "10+ fields use z.any()" | Actual count: 8 `z.any()` fields | Fixed throughout document |
| C2 | "QuickQuoteModal ~670 lines" | Actually ~1085 lines | Fixed in Appendix A |
| C3 | "Charge persistence 0%" | ~30% via non-atomic Composer manual ops | Fixed in Sections 8.3, 14.1 |
| C4 | "47 Deno functions" (Sections 3.4, 9.1) | MEMORY.md says 45 total | Verify exact count and reconcile |
| C5 | Rollback via feature flags (Section 11) | No feature flag system exists | Added prerequisite note + Task 2.11 |
| C6 | DOWN migrations referenced (Section 11.2) | No DOWN migration files exist in `supabase/migrations/` | Added note that this is aspirational |
| C7 | Version diff as new feature (Task 4.8) | `QuotationVersionHistory.tsx` has side-by-side UI but no diff logic | Updated task description |

### C.3 Items Deferred (Not in 18-Week Scope)

These were identified but intentionally excluded from the phase plan:

| Item | Reason for Deferral |
|------|-------------------|
| i18n for quote components (G20) | Requires translation infrastructure + content creation; separate project |
| Accessibility audit (G21) | Full audit needed; should be a dedicated sprint post-Phase 6 |
| Offline queue for saves (G22) | Requires service worker + IndexedDB; architectural change beyond current scope |
| Bulk operations (status change, PDF, export) | Nice-to-have; not blocking enterprise readiness |
| Document attachment/upload for quotes | Requires Supabase Storage integration; separate feature request |
| Mobile-specific testing | Responsive classes exist; formal testing should follow Phase 6 |

### C.4 Audit Methodology

Three parallel codebase research agents analyzed:
1. **Quote system internals** — schema, transform service, RPC, AI advisor, charges, currency, approval workflow, email templates, version history
2. **Security and infrastructure** — multi-tenancy, feature flags, rate limiting, error boundaries, i18n, accessibility, mobile, offline, file upload, print, clone, search, bulk ops
3. **Data flow edge cases** — status transitions, quote numbering, soft delete, expiry, margins, container types, weight/volume, incoterms, transit time, notes

Total files analyzed: ~55 quote-related source files + 489 migrations

**v2.2 Audit** (2026-02-16): Four parallel research agents analyzed:
1. **Transport mode & location mappings** — enum definitions, ports_locations schema, service type mappings, geographic hierarchy, location search RPC, mode normalization
2. **Carrier & rate logic** — carriers table, carrier-service type mapping, rate engine, pricing service, charge bifurcation, AI advisor, margin/markup calculation, currency handling
3. **Mode-specific parameters** — container types/sizes (ocean), ULD types (air), vehicle specs (trucking), rail intermodal, cargo configurations, hazmat/reefer, incoterms, packaging
4. **CRM integration & extensibility** — plugin architecture, CRM hooks, lead-to-quote pipeline, quote-to-shipment conversion, document/invoice services

Total additional files analyzed: ~30 migrations + 15 source files + 3 edge functions

---

*This document is a living reference. Update as issues are resolved and architecture evolves. Version history tracked in git.*

*v2.0: 2026-02-15 — Initial release (38 issues)*
*v2.1: 2026-02-15 — Codebase audit added 29 findings; total effort revised to ~367h across 18 weeks*
*v2.2: 2026-02-16 — Appendix D added: Comprehensive transport mode, carrier, and parameter analysis*
*v2.3: 2026-02-16 — Appendix E added: Mode-based carrier selection implementation design with dynamic filtering*

---

## Appendix D: Transport Mode, Carrier & Parameter Analysis

*Added in v2.2. Comprehensive research covering the business logic governing transport mode mappings, carrier assignments, mode-specific parameters, rate calculation, CRM integration, and extensibility.*

### D.1 Transport Mode Definitions & Enum

**Enum**: `public.transport_mode` (Postgres)
- `ocean`, `air`, `inland_trucking`, `road`, `courier`, `movers_packers`, `rail`
- Rail added via `20260205131000_add_rail_to_enum.sql`

**Table**: `public.transport_modes`
```
id (uuid PK), code (text UNIQUE), name (text), icon_name (text), color (text),
display_order (int), is_active (boolean), created_at, updated_at
```

**Icon constraint** (from `20260214_transport_modes_constraints.sql`):
Valid icons: `Ship`, `Plane`, `Truck`, `Train`, `Package`, `Waves`, `Container`, `Navigation`, `Anchor`, `Bus`, `Network`

**Service Mode Seeds** (from `20260131000001_service_architecture_overhaul.sql`):

| Code | Name | Icon | Display Order |
|------|------|------|---------------|
| ocean | Ocean Freight | Ship | 10 |
| air | Air Freight | Plane | 20 |
| road | Road Transport | Truck | 30 |
| rail | Rail Transport | Train | 40 |
| courier | Courier Service | Package | 50 |
| movers_packers | Moving & Packing | Package | 60 |

**TypeScript Type** (`src/hooks/useTransportModes.ts`):
```typescript
export interface TransportMode {
  id: string;
  code: string;
  name: string;
  icon_name?: string | null;
}
```

**Shipment Type** (`src/domain/shipments/types.ts`):
```typescript
export type AppShipmentType =
  | "ocean" | "air" | "inland_trucking" | "rail" | "courier" | "movers_packers";
```

**Mode Normalization** (`LegsConfigurationStep.tsx:122-132`):
```typescript
const normalizeModeKey = (value: string) => {
  const v = (value || '').toLowerCase();
  if (v.includes('ocean') || v.includes('sea') || v.includes('maritime')) return 'ocean';
  if (v.includes('air')) return 'air';
  if (v.includes('rail')) return 'rail';
  if (v.includes('truck') || v.includes('road') || v.includes('inland')) return 'road';
  if (v.includes('courier') || v.includes('express') || v.includes('parcel')) return 'courier';
  if (v.includes('move') || v.includes('mover') || v.includes('packer')) return 'moving';
  return v;
};
```

### D.2 Geographic & Location Data Model

#### D.2.1 Ports & Locations

**Table**: `public.ports_locations`
```
id (uuid PK), tenant_id (uuid, NULLABLE for global),
location_name (text NOT NULL), location_code (text),
location_type (text CHECK: 'seaport','airport','inland_port','warehouse','terminal'),
country (text), city (text), state_province (text), postal_code (text),
coordinates (jsonb DEFAULT '{}'), facilities (jsonb DEFAULT '[]'),
operating_hours (text), customs_available (boolean DEFAULT false),
is_active (boolean DEFAULT true), notes (text), created_at, updated_at
```

**Enhanced Columns** (from `20260130120000_enhance_ports_locations_schema.sql`):
- `country_code` (text)
- `iata_code` (text, regex `^[A-Z]{3}$`)
- `icao_code` (text, regex `^[A-Z]{4}$`)
- `un_locode` (text, regex `^[A-Z]{2}[A-Z0-9]{3}$`)
- `region_name` (text)
- `country_id` (uuid FK to countries, optional)
- `city_id` (uuid FK to cities, optional)

**Global Ports**: `tenant_id` is nullable. Global entries (tenant_id IS NULL) are visible to all authenticated users via dedicated RLS policy. Tenant-specific ports are scoped normally.

**PortsService** (`src/services/PortsService.ts`): Uses raw client to bypass `ScopedDataAccess`, ensuring global port visibility.

#### D.2.2 Geographic Hierarchy

```
countries
    ↓ country_id FK
cities
    ↓ country_id FK, city_id FK
ports_locations (location_type: seaport | airport | inland_port | warehouse | terminal)
```

#### D.2.3 Trade Directions

**Table**: `public.trade_directions`
```
id (uuid PK), tenant_id (uuid NOT NULL), name (text), code (text),
is_active (boolean)
CHECK (code IN ('import', 'export', 'inland'))
```

#### D.2.4 Location Search RPC

**Function**: `search_locations(search_text, limit_count DEFAULT 10)`
- Exact code match: score 100
- Exact name match: score 90
- Code/name prefix match: score 80
- City match: score 70
- Default fallback: score 60
- Searches `ports_locations` (active only) by `location_name`, `location_code`, `city` using ILIKE

### D.3 Mode-to-Location Mapping Rules

**Current State**: No explicit hardcoded rules restrict which modes are available for which routes. The system uses implicit constraints:

1. **Service Type → Mode Binding**: `service_types.mode_id` FK to `transport_modes` creates implicit mode availability. A service type like `ocean_fcl` is bound to ocean mode.

2. **Location Type Constraint**: `ports_locations.location_type` CHECK restricts to `seaport`, `airport`, `inland_port`, `warehouse`, `terminal`. The UI does not currently enforce mode↔location_type matching (e.g., allowing an ocean leg to use an airport location).

3. **Service Type Mappings**: `service_type_mappings` table has a `conditions` JSONB field that can contain route/mode constraints, but this is currently unused (default `{}`).

**Recommended Enhancement** (not yet implemented):

| Transport Mode | Valid Origin Location Types | Valid Destination Location Types |
|---------------|---------------------------|--------------------------------|
| ocean | seaport, terminal | seaport, terminal |
| air | airport | airport |
| road | warehouse, inland_port, terminal, seaport, airport | warehouse, inland_port, terminal, seaport, airport |
| rail | inland_port, terminal | inland_port, terminal |
| courier | Any | Any |

**Gap**: No backend validation enforces mode↔location_type compatibility. This should be added to the validation pipeline (Stage 2: Transformation Validation) in Section 7.1.

### D.4 Service Types & Mappings

**Table**: `public.service_types`
```
id (uuid PK), name (text NOT NULL), description (text), is_active (boolean),
code (text NOT NULL), mode_id (uuid FK to transport_modes),
use_dimensional_weight (boolean DEFAULT false),
dim_divisor (numeric DEFAULT 6000, CHECK > 0),
created_at, updated_at
```

**Table**: `public.service_type_mappings`
```
id (uuid PK), service_id (uuid FK), service_type_id (uuid FK NOT NULL),
is_default (boolean), is_active (boolean), priority (int), conditions (jsonb DEFAULT '{}'),
tenant_id (uuid NOT NULL), created_at, updated_at
```

**Seeded Service Types** (from `20260201140000_seed_logistics_services.sql`):

| Code | Name | Mode |
|------|------|------|
| `ocean_fcl` | Ocean FCL | ocean |
| `ocean_lcl` | Ocean LCL | ocean |
| `air_express` | Air Express | air |
| `air_standard` | Air Standard | air |
| `road_ftl` | Road FTL | road |
| `road_ltl` | Road LTL | road |
| `rail_intermodal` | Rail Intermodal | rail |

**Table**: `public.services` (tenant-specific)
```
id, tenant_id, service_code, service_name, service_type (text e.g. "ocean_fcl"),
description, base_price (numeric), pricing_unit (text), transit_time_days (int),
is_active, metadata (jsonb)
```

### D.5 Carrier Architecture

#### D.5.1 Carriers Table

**Table**: `public.carriers`
```
id (uuid PK), tenant_id (uuid NOT NULL), franchise_id (uuid),
mode (transport_mode enum NOT NULL), name (text NOT NULL),
scac (text), iata (text), mc_dot (text),
created_at, updated_at
```

**Carrier Identification Codes**:
- `scac` — Standard Carrier Alpha Code (Ocean/Road)
- `iata` — International Air Transport Association code (Air)
- `mc_dot` — Motor Carrier / Department of Transportation number (Trucking)

#### D.5.2 Seeded Carriers

**Ocean** (mode: `ocean`): Maersk (MAEU), MSC (MSCU), CMA CGM (CMACGM), Hapag-Lloyd (HLCU), COSCO (COSU)

**Air** (mode: `air`): Lufthansa Cargo (LH), Emirates SkyCargo (EK), FedEx Express (FX), DHL Aviation (D0), Cathay Pacific Cargo (CX)

**Trucking** (mode: `inland_trucking`): J.B. Hunt (JBHT), XPO Logistics (XPO), Schneider (SNDR)

**Rail** (mode: `rail`): Union Pacific, CSX, BNSF

#### D.5.3 Carrier-Service Type Mapping

**Table**: `public.carrier_service_types`
```
id (uuid PK), tenant_id (uuid NOT NULL), carrier_id (uuid FK NOT NULL),
service_type (text NOT NULL), code_type (text: 'SCAC','IATA','MC_DOT'),
code_value (text), is_primary (boolean DEFAULT false), is_active (boolean DEFAULT true),
created_at, updated_at
UNIQUE(tenant_id, carrier_id, service_type)
```

Service types allowed: `'ocean', 'air', 'trucking', 'courier', 'moving', 'railway_transport'`

Global mappings supported via RLS policy allowing `tenant_id IS NULL` entries.

#### D.5.4 Preferred Carrier Assignment

**Table**: `public.vendor_preferred_carriers`
```
id (uuid PK), vendor_id (uuid FK), carrier_id (uuid FK), mode (text),
is_active (boolean DEFAULT true), tenant_id (uuid)
```

**RPC**: `get_vendor_preferred_carriers(p_vendor_id uuid, p_mode text)` retrieves preferred carriers per vendor and mode.

**Algorithm**: Carrier preference is vendor-specific. When generating quotes:
1. Check `vendor_preferred_carriers` for the vendor + mode combination
2. If preferred carriers exist, prioritize those in rate lookups
3. Fallback to all active carriers for the mode

**Gap**: No scoring/ranking algorithm beyond is_active. No route-based or cargo-type-based carrier preference exists. The AI Advisor generates 5 options but uses hardcoded mock knowledge, not actual carrier preference data.

#### D.5.5 Provider API Configuration

**Table**: `public.provider_api_configs`
```
id (uuid PK), tenant_id (uuid NOT NULL), carrier_id (uuid FK NOT NULL),
api_provider (text NOT NULL), api_version (text), base_url (text NOT NULL),
rate_endpoint (text), tracking_endpoint (text), label_endpoint (text),
auth_type (text NOT NULL), auth_config (jsonb NOT NULL DEFAULT '{}'),
rate_limit_per_minute (int DEFAULT 60), rate_limit_per_day (int),
supports_rate_shopping (boolean DEFAULT false)
```

Supports multi-carrier API integration for live rate queries, tracking, and label generation.

### D.6 Rate Calculation Architecture

#### D.6.1 Rate Engine (Edge Function)

**File**: `supabase/functions/rate-engine/index.ts`

**Rate Tiers**:
- `contract` — Account-specific negotiated rates
- `spot` — Market/general rates
- `market` — Alternative competitive rates

**Rate Resolution Flow**:
```
Query carrier_rates WHERE:
  origin_port_id = resolved_origin
  AND destination_port_id = resolved_destination
  AND mode = requested_mode
  AND status = 'active'
  AND (valid_to IS NULL OR valid_to >= today)
  AND (contract rates only if account_id matches)
```

**Price Calculation Per Mode**:
- **Ocean**: `price * containerQty` (per container basis)
- **Air/Road**: `price * weightKg` (per kg basis)

**Default Breakdown**:
- Base fare: 80% of price
- BAF (Bunker Adjustment Factor): 10%
- CAF (Currency Adjustment Factor): 5%
- THC (Terminal Handling Charge): 5%
- DOC (Documentation fee): fixed $50

#### D.6.2 Carrier Rates Table

**Table**: `public.carrier_rates` (enhanced via `20251012120000_carrier_rates_module.sql`)
```
carrier_id (uuid FK), origin_port_id (uuid FK), destination_port_id (uuid FK),
container_category_id (uuid FK), container_size_id (uuid FK),
service_name (text), scac_code (text), vessel_flight_no (text),
rate_reference_id (text), exchange_rate (numeric),
markup_amount (numeric DEFAULT 0), charges_subtotal (numeric DEFAULT 0),
total_amount (numeric DEFAULT 0),
etd (date), eta (date), sailing_frequency (text), cut_off_date (date),
payment_terms (text), free_time_days (int),
demurrage_rate (numeric), detention_rate (numeric),
status (text CHECK: 'active','expiring','expired','removed','selected'),
removed_reason (text), created_by (uuid), valid_to (date)
```

**Total Calculation Trigger**:
```
total_amount = base_rate + markup_amount + charges_subtotal
charges_subtotal = SUM(charge.amount * charge.quantity)
```

#### D.6.3 Pricing Service (Application Layer)

**File**: `src/services/pricing.service.ts`

**Two Pricing Models**:

1. **Cost-Plus Model** (`isCostBased = true`):
   ```
   Sell = Cost / (1 - Margin%)
   Margin Amount = Sell - Cost
   ```

2. **Sell-Based/Discount Model** (`isCostBased = false`):
   ```
   Margin Amount = Sell * (Margin% / 100)
   Buy = Sell - Margin Amount
   ```

**Key Methods**:
- `calculatePrice()` — RPC-first with client-side fallback (lines 174-264)
- `calculateFinancials()` — Calculates sell, buy, margin (lines 271-328)
- `calculatePriceWithRules()` — Applies dynamic margin rules (lines 109-140)
- `getMarginRules()` — Fetches from `margin_rules` table with 5-minute cache (lines 52-76)

**Margin Rules Application** (priority order):
- Percentage markup compounds on running price
- Fixed markup added linearly
- Edge cases handled: 0%, 100%, >100% margin; `.toFixed(2)` rounding

**Default Margin**: 15% of sell price (sell-based model) in `QuoteOptionService`

#### D.6.4 Charge Bifurcation Engine

**File**: `src/lib/charge-bifurcation.ts`

**Keyword-Based Rules** (priority order):

1. **High-Priority Transport Charges**:
   - THC, Terminal, Wharfage, BAF, Bunker, ISF, AMS, IMO, BL fee, Doc fee → `transport` leg, `ocean` mode
   - Air freight, FSC, Fuel surcharge, MYC, Screening, Security → `transport` leg, `air` mode
   - Rail freight → `transport` leg, `rail` mode

2. **Main Freight Keywords**:
   - Ocean/Sea/Freight/Base fare → `transport` leg, `ocean` mode

3. **Positional Keywords**:
   - Pickup, Origin, Export, Drayage origin, Pre-carriage → `pickup` leg, `road` mode
   - Delivery, Destination, Import, Drayage dest, On-carriage → `delivery` leg, `road` mode

4. **Mode-Specific**:
   - Trucking, Haulage, Road freight → `transport` leg, `road` mode
   - Customs, Duty, Tax, VAT → `delivery` leg, `road` mode

**Fallback Logic**:
- If no explicit `leg_id`, match by description keywords
- Positional fallback: first leg = pickup, last leg = delivery
- Unmatched charges → Global/Unassigned

#### D.6.5 AI Advisor Rate Generation

**File**: `supabase/functions/ai-advisor/index.ts`

**Smart Quote Generation Flow**:
1. **Cache Check** — Hash on route + mode + commodity + weight + volume
2. **Historical Context** — Query `rates` table for past averages
3. **GPT-4o System Prompt** requires 5 options: Best Value, Cheapest, Fastest, Greenest, Reliable
4. **Mode-Specific Rate Ranges** (from system prompt):
   - **Road**: $1.50-$4.00/km + fixed fees
   - **Air**: $2.50-$12.00/kg (chargeable weight)
   - **Ocean**: Market rates per TEU/FEU + BAF/CAF
   - **Rail**: Distance-based tariffs
5. **Leg-Level Pricing**: Every leg MUST have charges (granular breakdown: Pickup, Terminal Origin, Main Freight, Terminal Dest, Delivery)

**Dynamic Pricing** (post-AI response):
- Fuel surcharge: 12% of base (HARDCODED — see Task 4.12)
- Currency adjustment: 2% of base
- Injected into main leg charges
- Totals recalculated after injection

**AI Output Schema**:
```json
{
  "options": [{
    "id", "tier", "transport_mode", "carrier",
    "transit_time": { "total_days", "details" },
    "legs": [{
      "sequence", "from", "to", "mode", "carrier",
      "transit_time", "distance_km", "co2_kg",
      "border_crossing", "instructions",
      "charges": [{ "name", "amount", "currency", "unit" }]
    }],
    "price_breakdown": {
      "base_fare", "surcharges": { "baf", "caf", "peak_season", "fuel_road" },
      "fees": { "pickup", "thc_origin", "thc_dest", "docs", "customs" },
      "taxes", "currency", "total"
    },
    "reliability": { "score", "on_time_performance" },
    "environmental": { "co2_emissions", "rating" },
    "ai_explanation"
  }],
  "market_analysis", "confidence_score", "anomalies"
}
```

#### D.6.6 Standard Charge Types

**Charge Master** (from `20251012120000_carrier_rates_module.sql`):

| Code | Description | Applicable Modes |
|------|-------------|-----------------|
| OFT | Ocean Freight | Ocean |
| AFT | Air Freight | Air |
| THC | Terminal Handling Charge (Origin/Dest) | Ocean, Air |
| BAF | Bunker Adjustment Factor (Fuel surcharge) | Ocean |
| CAF | Currency Adjustment Factor | Ocean |
| DOC | Documentation | All |
| AMS | Automated Manifest System | Ocean (US) |
| ISF | Importer Security Filing | Ocean (US) |
| ISPS | International Ship & Port Security | Ocean |

**Charge Tables**:
- `carrier_rate_charges`: Per-rate charges (id, tenant_id, carrier_rate_id, charge_type, basis, quantity, amount, currency, notes)
- `quote_charges`: Per-quote charges with buy/sell side (charge_side_id, category_id, basis_id, quantity, unit, rate, amount, currency_id, min_amount, max_amount)

**Charge Sides**: `charge_sides` table — Buy (cost price) vs Sell (customer price)

### D.7 Mode-Specific Parameters

#### D.7.1 Ocean Freight Parameters

**Container Types** (`public.container_types`, seeded globally):

| Code | Name |
|------|------|
| `dry` | Standard Dry |
| `hc` | High Cube |
| `reefer` | Refrigerated |
| `open_top` | Open Top |
| `flat_rack` | Flat Rack (breakbulk) |
| `iso_tank` | ISO Tank (liquids) |

**Container Sizes** (`public.container_sizes`, seeded globally):

| Code | Name |
|------|------|
| `20_std` | 20' Standard dry container |
| `40_std` | 40' Standard dry container |
| `40_hc` | 40' High Cube dry container |
| `45_hc` | 45' High Cube dry container |
| `20_reefer` | 20' Refrigerated container |
| `40_reefer` | 40' Refrigerated container |

**Cargo Types**:
- FCL (Full Container Load)
- LCL (Less than Container Load)
- Breakbulk
- RoRo (Roll-on/Roll-off)

**Ocean-Specific Carrier Rate Fields**:
- `sailing_frequency`, `cut_off_date`, `free_time_days`, `demurrage_rate`, `detention_rate`
- `vessel_flight_no`, `etd`, `eta`

#### D.7.2 Air Freight Parameters

**ULD Types** (supported via `quote_cargo_configurations`):
- Container type: `ULD`
- Container sizes: `LD3`, `LD7`

**Service Types**: `air_express` (expedited), `air_standard` (standard)

**Dimensional Weight**:
- `service_types.use_dimensional_weight` (boolean)
- `service_types.dim_divisor` (numeric, default 6000, CHECK > 0)
- Standard formula: Chargeable weight = MAX(actual_weight_kg, L×W×H / dim_divisor)
- Currently calculated in application layer, not enforced in DB

**Air-Specific Rate Calculation**: `price * weightKg` (per kg, chargeable weight)

#### D.7.3 Road/Trucking Parameters

**Service Types**: `road_ftl` (Full Truck Load), `road_ltl` (Less than Truck Load)

**Vehicle Specification Support**:
- `vehicleType` field in QuickQuoteModal form state (default: `van`)
- `package_sizes.max_weight_kg` — capacity limit per vehicle type
- `package_sizes.length_ft`, `width_ft`, `height_ft` — dimensional constraints

**Carrier Identification**: `mc_dot` (Motor Carrier / DOT number)

**Road-Specific Rate Calculation**: `price * weightKg` (per kg basis) or distance-based ($1.50-$4.00/km for AI)

#### D.7.4 Rail Parameters

**Enum Addition**: `ALTER TYPE public.transport_mode ADD VALUE IF NOT EXISTS 'rail'` (2026-02-05)

**Service Type**: `rail_intermodal` — Containerized rail transport

**Rail Carriers**: Union Pacific, CSX, BNSF (seeded in carrier migration)

**Rail Cargo Configuration**:
- Uses container specifications (20ft, 40ft standard intermodal units)
- `transport_mode = 'rail'` in `quote_cargo_configurations`
- **Gap**: No wagon-specific table exists — rail uses ocean container abstractions

**Missing Rail-Specific Fields** (identified as gaps):
- No wagon capacity / tare weight columns
- No gauge type (standard/broad/narrow)
- No train scheduling/slot information
- No border crossing / customs transit fields specific to rail corridors

**Rail in Cargo Details**: `cargo_details.service_type` CHECK includes `'railway_transport'`

**Rail in UI**: `Train` icon imported in QuickQuoteModal; normalization via `normalizeModeKey()` handles `'rail'` keyword

### D.8 Cargo Configuration Model

#### D.8.1 Quote Cargo Configurations

**Table**: `public.quote_cargo_configurations` (from `20260215000000`)
```
id (uuid PK), quote_id (uuid FK), tenant_id (uuid),
transport_mode ('ocean','air','road','rail'),
cargo_type ('FCL','LCL','Breakbulk','RoRo'),
container_type ('Standard','High Cube','Open Top','Flat Rack','Reefer','Tank','ULD','Trailer'),
container_size ('20','40','45','LD3','LD7','53'),
quantity (int),
unit_weight_kg (numeric), unit_volume_cbm (numeric),
length_cm (numeric), width_cm (numeric), height_cm (numeric),
is_hazardous (boolean), hazmat_class (text), un_number (text),
is_temperature_controlled (boolean), temperature_min (numeric), temperature_max (numeric),
temperature_unit ('C' or 'F'),
package_category_id (uuid FK), package_size_id (uuid FK),
remarks (text)
```

#### D.8.2 Shipment Cargo Configurations (Mirror)

**Table**: `public.shipment_cargo_configurations` — Identical schema to quote version, used during execution tracking.

#### D.8.3 Dangerous Goods / Special Cargo

- `is_hazardous`, `hazmat_class` (e.g., "Class 3", "Class 8"), `un_number` (e.g., "UN1203")
- `cargo_types.requires_special_handling`, `cargo_types.hazmat_class`
- `is_temperature_controlled`, `temperature_min`, `temperature_max`, `temperature_unit`
- `compliance_screenings` table: screening_type `'HTS_VALIDATION', 'RPS', 'LICENSE_CHECK', 'OGA'`; status `'PASSED', 'WARNING', 'FAILED', 'PENDING'`

#### D.8.4 Packaging Types

**`package_categories`**: category_name (Pallet, Crate, Drum, Box), category_code, description, is_active

**`package_sizes`**: size_name, size_code, length_ft, width_ft, height_ft, max_weight_kg, description

### D.9 Multi-Modal Transport Combination Logic

#### D.9.1 Leg-Based Multi-Modal Architecture

The system supports multi-modal transport via ordered legs within each quote option.

**Quote Option Legs** (`public.quote_option_legs`):
```
id, tenant_id, quote_option_id, leg_order (int),
mode_id (uuid FK to transport_modes), service_id (uuid FK),
origin_location (text), destination_location (text),
origin_location_id (uuid FK to ports_locations),
destination_location_id (uuid FK to ports_locations),
provider_id (uuid FK to carriers), carrier_id (uuid FK),
planned_departure, planned_arrival,
service_type_id (uuid FK), container_type_id (uuid FK),
container_size_id (uuid FK), trade_direction_id (uuid FK),
leg_currency_id (uuid FK),
transport_mode (text), sequence_number (int),
transit_time (text), total_amount (numeric), currency (text DEFAULT 'USD')
```

**Quotation Version Option Legs** (alternate structure):
- Similar columns with `quotation_version_option_id` FK
- `leg_type` (text, e.g., 'transport')
- `transit_time_hours`, `co2_kg`, `voyage_number`

**Leg Type** (`src/components/sales/composer/store/types.ts`):
```typescript
export interface Leg {
  id: string;
  mode: string;
  serviceTypeId: string;
  origin: string;
  destination: string;
  charges: any[];
  legType?: 'transport' | 'service' | 'pickup' | 'delivery' | 'main';
  serviceOnlyCategory?: string;
  carrierName?: string;
  carrierId?: string;
}
```

#### D.9.2 Multi-Modal Routing Pattern

1. Legs ordered by `leg_order` / `sequence_number`
2. Each leg's destination = next leg's origin (geographic continuity)
3. Modal transitions supported (e.g., road → ocean → road)
4. Each leg has independent mode, carrier, charges, and transit time
5. Total transit = sum of leg transit times + any connection time

**Common Multi-Modal Patterns**:

| Pattern | Leg 1 | Leg 2 | Leg 3 | Example |
|---------|-------|-------|-------|---------|
| Door-to-Door (Ocean) | Road (pickup) | Ocean (main) | Road (delivery) | Factory → Port → Port → Warehouse |
| Door-to-Door (Air) | Road (pickup) | Air (main) | Road (delivery) | Warehouse → Airport → Airport → Customer |
| Rail Intermodal | Road (drayage) | Rail (main) | Road (delivery) | Depot → Rail Terminal → Rail Terminal → Distribution Center |
| Sea-Air | Road (pickup) | Ocean (to hub) | Air (to destination) | Origin → Transship Port → Destination Airport |

#### D.9.3 Charge Assignment to Legs

Charges are assigned to legs via the charge bifurcation engine (Section D.6.4). Each charge has:
- `leg_id` (FK to specific leg) or global (no leg assignment)
- `charge_side_id` (buy/sell)
- Leg-specific charges take priority over global charges in `QuoteOptionService.insertCharges()`

### D.10 Incoterms

**Table**: `public.incoterms`
```
id (uuid PK), tenant_id (uuid NOT NULL), incoterm_code (text NOT NULL),
incoterm_name (text NOT NULL), description (text), is_active (boolean),
created_at, updated_at
UNIQUE INDEX on (tenant_id, incoterm_code)
```

**Integration**:
- `quotes.incoterm_id` (uuid FK to incoterms) — canonical reference
- `quotes.incoterms` (text, legacy) — deprecated, to be removed in Phase 4 (Task 4.3)
- `shipments` inherit incoterm from quote during conversion

**Gap**: No mode-specific incoterm constraints. Incoterms apply globally across all modes (which is correct per ICC Incoterms 2020 rules).

### D.11 Currency & FX

**Table**: `public.currencies`
```
id (uuid PK), code (text UNIQUE), name (text), symbol (text),
is_active (boolean), created_at
```

**Current State**:
- `carrier_rates.exchange_rate` field exists (numeric)
- `quotation_version_options` has both `currency_id` and `quote_currency_id` (to be unified in Phase 4)
- `carrier_rate_charges.currency` (text field)
- Default currency: USD
- **No FX conversion infrastructure exists** — all prices single-currency per transaction
- `formatCurrency` in `src/lib/utils.ts` only formats display, never converts

**Gap**: Multi-currency quotes (e.g., EUR for origin drayage + USD for ocean) have no mechanism to convert, display, or aggregate across currencies. See Task 6.2 (revised to 16h).

### D.12 Quotation Version & Options Structure

#### D.12.1 Versions

**Table**: `public.quotation_versions`
```
id, tenant_id, quote_id (FK), version_number (int), major_version (int),
minor_version (int), change_reason (text), valid_until (timestamptz),
created_by (uuid FK to profiles), created_at
UNIQUE(quote_id, version_number)
```

#### D.12.2 Version Options

**Table**: `public.quotation_version_options`
```
id, tenant_id, quotation_version_id (FK), carrier_rate_id (FK),
franchise_id, carrier_id,
option_name (text), sort_order (int),
total_amount, total_sell, total_buy, margin_amount, margin_percentage,
transit_time, total_transit_days, valid_until,
reliability_score, ai_generated, ai_explanation, source, source_attribution,
container_size_id, container_type_id, total_co2_kg,
quote_currency_id, currency,
status ('active','removed','selected'),
created_at
```

#### D.12.3 Quote Option Service Flow

**File**: `src/services/QuoteOptionService.ts` — `addOptionToVersion()`

1. **Normalize Rate** → `mapOptionToQuote()`
2. **Calculate Financials** → `pricingService.calculateFinancials()` (default 15% margin, sell-based)
3. **Insert Option Header** → `quotation_version_options`
4. **Insert Legs** → resolve service_type_id, provider_id, location_ids per leg
5. **Insert Charges** → priority: leg-specific > global > price_breakdown > balancing charge
6. **Reconciliation** → recalculate totals from inserted charges; update option header; flag anomalies

### D.13 CRM Integration Points

#### D.13.1 CRM Context & Hooks

- **`useCRM()`** hook provides: `supabase` client, `context` (tenant/franchise scope), `scopedDb` (ScopedDataAccess instance), `preferences` (user settings)
- **`useAuth()`** hook provides: roles, permissions, profile
- All quote components consume CRM context for tenant scoping and data access

#### D.13.2 Plugin Architecture

**`src/services/plugins/PluginRegistry.ts`**: 8 registered plugins (Logistics = real implementation, 7 stubs)

The plugin system provides an extensibility framework where new logistics types can be registered as plugins. The Logistics plugin handles quote-related functionality.

#### D.13.3 Leads → Quotes Pipeline

The CRM manages leads via `src/pages/dashboard/Leads.tsx` (~715 lines). Lead scoring is rule-based (not AI/ML). Quotes can be created from leads via Quick Quote or the detailed quote form.

#### D.13.4 Quote → Shipment Conversion

`shipment_cargo_configurations` mirrors `quote_cargo_configurations` schema. The RPC in `20260216000000_shipment_cargo_configurations.sql` converts quote data to shipment data, inheriting incoterms, cargo configurations, and commercial terms.

#### D.13.5 Document & Invoice Services

- `DocumentService` and `InvoiceService` accept `scopedDb: ScopedDataAccess` parameter
- Quote PDFs generated via `generate-quote-pdf` edge function
- Email dispatch via `send-email` edge function with multi-provider support

### D.14 Extensibility Framework

#### D.14.1 Adding a New Transport Mode

**Steps to add a new mode** (e.g., "barge", "drone"):

1. **Enum**: `ALTER TYPE public.transport_mode ADD VALUE IF NOT EXISTS 'new_mode';`
2. **Transport Modes table**: INSERT new row with code, name, icon_name, display_order
3. **Service Types**: INSERT new service type(s) with `mode_id` FK (e.g., `barge_fcl`)
4. **Carriers**: Seed carriers with mode = `new_mode` and appropriate code fields
5. **Carrier Service Types**: Map carriers to new service types
6. **UI normalization**: Add keyword match in `normalizeModeKey()` function
7. **Charge Bifurcation**: Add keyword rules for the new mode in `charge-bifurcation.ts`
8. **AI Advisor**: Update system prompt with mode-specific rate ranges
9. **Rate Engine**: Add mode-specific price calculation logic

**Architecture supports this** because:
- Transport modes are DB-driven, not hardcoded enums in TypeScript
- Service types link to modes via FK
- Legs accept any valid mode
- Charge bifurcation uses keyword matching (extensible)

#### D.14.2 Adding Mode-Specific Parameters

The `quote_cargo_configurations` table's `container_type` and `container_size` fields accept free text, allowing new equipment types without schema changes. For structured validation, add CHECK constraints or reference tables.

**For new container/equipment types**:
1. INSERT into `container_types` (global, tenant_id = NULL)
2. INSERT into `container_sizes` (global)
3. Update UI dropdowns (they read from DB)

#### D.14.3 Adding New Charge Types

1. INSERT into charge master tables (charge_categories, charge_bases)
2. Add keyword rules in `charge-bifurcation.ts` if auto-assignment is needed
3. Charge types are referenced by ID, so no code changes needed for basic CRUD

#### D.14.4 Adding New Carrier API Integrations

1. INSERT into `provider_api_configs` with carrier_id, endpoints, auth config
2. Implement provider-specific adapter in rate engine
3. `supports_rate_shopping` flag enables live rate queries

### D.15 Identified Gaps & Recommendations

| # | Gap | Impact | Recommendation | Priority |
|---|-----|--------|----------------|----------|
| D1 | No mode↔location_type validation | Ocean leg can reference airport | Add validation in TransformService Stage 2 | Medium |
| D2 | No wagon-specific fields for rail | Rail uses container abstractions only | Add `wagon_capacity_tons`, `tare_weight_tons`, `gauge_type` to cargo config or new table | Low |
| D3 | No carrier scoring/ranking algorithm | Carrier preference is binary (preferred or not) | Build scoring based on: on-time %, price competitiveness, capacity, historical performance | Medium |
| D4 | AI Advisor uses mock knowledge base | Real carrier preferences not used in AI rate generation | Feed actual `carrier_rates` and `vendor_preferred_carriers` data to AI prompt | High |
| D5 | No dimensional weight enforcement | `dim_divisor` exists but no DB-level chargeable weight calculation | Add computed column or RPC for chargeable weight | Low |
| D6 | `cargo_details.service_type` CHECK doesn't match transport_mode enum | Uses `'railway_transport'` vs enum `'rail'` | Align via migration; add mapping | Low |
| D7 | `service_type_mappings.conditions` JSONB unused | No route-based service availability rules | Implement condition evaluation engine for mode+route restrictions | Medium |
| D8 | No multi-currency aggregation | Charges in different currencies can't be totaled | Build FX service (already Task 6.2, 16h) | High |
| D9 | Container type+size not validated against mode | Air cargo could have ocean container | Add cross-validation in cargo config save | Medium |
| D10 | No historical rate trend storage | Rate engine queries only active rates, no history | Add rate archival and trend analysis | Low |

### D.16 Testing Scenarios for Transport/Carrier Logic

#### D.16.1 Mode-Specific Validation Tests

```
1. Ocean FCL: 2x40HC containers, Maersk, Shanghai → Rotterdam, BAF+THC+DOC charges
2. Ocean LCL: 5 CBM loose cargo, CMA CGM, Mumbai → Hamburg
3. Air Express: 200kg chargeable weight, Emirates, Dubai → London, FSC+screening
4. Air Standard: ULD LD3, DHL, Frankfurt → New York
5. Road FTL: 20-ton truck, J.B. Hunt, Chicago → Dallas
6. Road LTL: 2 pallets (500kg), XPO, LA warehouse → SF warehouse
7. Rail Intermodal: 1x40' container, Union Pacific, LA → Chicago
8. Multi-Modal: Road pickup → Ocean main → Road delivery (door-to-door)
9. Sea-Air: Ocean leg + Air leg with different carriers and charge sets
10. Rail + Road: Rail main haul + road last-mile delivery
```

#### D.16.2 Carrier Assignment Tests

```
1. Preferred carrier exists for mode → should be prioritized
2. No preferred carrier → all active carriers for mode returned
3. Carrier with expired rates → should be excluded
4. Multi-tenant: Carrier assigned to Tenant A → not visible to Tenant B
5. Global carrier (tenant_id NULL) → visible to all tenants
```

#### D.16.3 Rate Calculation Tests

```
1. Cost-plus: cost=$1000, margin=20% → sell=$1250
2. Sell-based: sell=$1000, margin=15% → buy=$850, margin=$150
3. Zero margin → sell=cost (no division by zero)
4. 100% margin → sell=Infinity guard (handled in pricing.service.ts)
5. Contract rate priority over spot rate for same route
6. Rate expiry: expired rate excluded from results
7. Multi-leg total: sum of leg charges = option total
8. Charge bifurcation: THC assigned to transport leg, pickup fee to pickup leg
```

#### D.16.4 Performance Benchmarks

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Rate lookup (single route, single mode) | < 200ms | rate-engine edge function response |
| AI Advisor (5 options generation) | < 8s | ai-advisor edge function response |
| Carrier rates query (10 active rates) | < 100ms | Postgres query time |
| Port search (fuzzy, 10 results) | < 50ms | search_locations RPC |
| Charge bifurcation (20 charges) | < 10ms | Client-side computation |
| Full multi-modal quote save | < 1s | save_quote_atomic RPC |

---

## Appendix E: Mode-Based Carrier Selection — Implementation Design

*Added in v2.3. Detailed design for implementing a mode-of-transport-driven carrier selection feature with dynamic filtering, comprehensive carrier lists, validation rules, and integration with the existing quotation platform.*

### E.1 Current State Analysis

#### E.1.1 How Mode-Based Carrier Filtering Works Today

The platform currently implements carrier filtering by transport mode in **4 separate UI locations**, each with its own inline filtering logic:

| Location | File | Lines | Filtering Approach |
|----------|------|-------|--------------------|
| Leg Configuration | `LegsConfigurationStep.tsx` | 387-413 | `modeMap` dict → `carrier_type` match |
| Quote Leg Row | `QuoteLegRow.tsx` | 40-47 | String `includes()` checks per mode |
| Quote Logistics | `QuoteLogistics.tsx` | 68-89 | Service type name → carrier_type match |
| Option Creation Dialog | `MultiModalQuoteComposer.tsx` | 2773-2787 | Service type name → carrier_type match |

**Current `modeMap` (from LegsConfigurationStep.tsx:390-399)**:
```typescript
const modeMap: Record<string, string> = {
  'ocean': 'ocean',
  'sea': 'ocean',
  'air': 'air_cargo',
  'air_cargo': 'air_cargo',
  'road': 'trucking',
  'truck': 'trucking',
  'rail': 'rail',
  'train': 'rail'
};
```

#### E.1.2 Identified Problems

| # | Problem | Impact |
|---|---------|--------|
| E1 | **Duplicated filtering logic** — 4 components each implement their own mode→carrier_type mapping | Inconsistency risk; maintenance burden |
| E2 | **`carrier_type` vs `mode` mismatch** — DB stores `mode` as `transport_mode` enum, but carriers use `carrier_type` TEXT with different values (`air_cargo` vs `air`) | Silent filtering failures |
| E3 | **`carrier_service_types` table unused** — A properly normalized mapping table exists but is never queried for filtering | Wasted infrastructure |
| E4 | **No server-side filtering** — All filtering happens client-side after loading ALL carriers | Unnecessary data transfer; no DB-level enforcement |
| E5 | **Missing modes in filter maps** — `courier` and `movers_packers` not in `modeMap`; these carriers never appear in leg dropdowns | Users cannot select courier/mover carriers for legs |
| E6 | **No "All carriers" fallback** — If mode doesn't match any map entry, fallback `legMode` often returns empty results | Empty carrier dropdowns for unrecognized modes |
| E7 | **No carrier count indicator** — UI gives no feedback on how many carriers are available for a selected mode | User confusion when list appears empty |
| E8 | **No search/filter within carrier dropdown** — Large carrier lists (10+ per mode) are hard to navigate | Poor UX for ocean carriers (10 seeded, potentially 50+ in production) |

#### E.1.3 Current Carrier Reference Data

**Seeded Global Carriers by Mode** (from migrations `20251013000002`, `20260216210000`, `20260216200001`):

| Mode | carrier_type | Count | Carriers |
|------|-------------|-------|----------|
| **Ocean** | `ocean` | 10 | MSC, Maersk, CMA CGM, COSCO, Hapag-Lloyd, ONE, Evergreen, HMM, ZIM, Yang Ming |
| **Air** | `air_cargo` | 10 | FedEx Express, UPS Airlines, DHL Aviation, Qatar Airways Cargo, Emirates SkyCargo, Cathay Pacific Cargo, Lufthansa Cargo, Korean Air Cargo, Singapore Airlines Cargo, Cargolux |
| **Road/Trucking** | `trucking` | 8 | XPO Logistics, J.B. Hunt, Knight-Swift, Schneider, Werner, U.S. Xpress, Old Dominion, YRC Worldwide |
| **Rail** | `rail` | 3 | Union Pacific, CSX, BNSF |
| **Courier** | `courier` | 2 | UPS, FedEx |
| **Movers/Packers** | `movers_and_packers` | 5 | Allied Van Lines, North American Van Lines, Atlas Van Lines, United Van Lines, Mayflower Transit |

**Carrier Identification Codes**:

| Mode | Code Type | Field | Format | Example |
|------|-----------|-------|--------|---------|
| Ocean | SCAC | `carriers.scac` | 4-char alpha | MAEU, MSCU, CMACGM |
| Air | IATA | `carriers.iata` | 2-char alpha | LH, EK, FX |
| Road | MC/DOT | `carriers.mc_dot` | DOT-XXXXXX | DOT-264184 |
| Rail | — | (none) | — | No standard code field |
| Courier | SCAC | `carriers.scac` | 4-char alpha | DHLA, FDXG |

### E.2 Data Architecture Design

#### E.2.1 Canonical Mode-to-Carrier Type Mapping Table

**Problem**: The `carriers.carrier_type` TEXT field uses values that don't match `transport_modes.code`. This creates a translation layer that is duplicated across UI components.

**Solution**: Create a canonical mapping configuration that serves as the single source of truth.

**New Migration**: `20260217_mode_carrier_type_canonical_mapping.sql`

```sql
-- Canonical mapping: transport_mode.code → carrier_type values
-- This replaces all inline modeMap objects in the frontend
CREATE TABLE IF NOT EXISTS public.mode_carrier_type_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_mode_code TEXT NOT NULL REFERENCES public.transport_modes(code),
  carrier_type TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(transport_mode_code, carrier_type)
);

-- Seed canonical mappings
INSERT INTO public.mode_carrier_type_map (transport_mode_code, carrier_type, is_primary) VALUES
  ('ocean',           'ocean',              true),
  ('air',             'air_cargo',          true),
  ('road',            'trucking',           true),
  ('rail',            'rail',               true),
  ('courier',         'courier',            true),
  ('movers_packers',  'movers_and_packers', true),
  ('inland_trucking', 'trucking',           true)   -- alias
ON CONFLICT (transport_mode_code, carrier_type) DO NOTHING;

-- Enable RLS (read-only for all authenticated users)
ALTER TABLE public.mode_carrier_type_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read mode-carrier mappings"
ON public.mode_carrier_type_map FOR SELECT TO authenticated
USING (true);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_mcm_mode ON public.mode_carrier_type_map(transport_mode_code);
```

#### E.2.2 Server-Side Carrier Filtering RPC

**New RPC Function**: `get_carriers_by_mode(p_mode TEXT, p_tenant_id UUID DEFAULT NULL)`

```sql
CREATE OR REPLACE FUNCTION public.get_carriers_by_mode(
  p_mode TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  carrier_name TEXT,
  carrier_code TEXT,
  carrier_type TEXT,
  scac TEXT,
  iata TEXT,
  mc_dot TEXT,
  mode TEXT,
  is_preferred BOOLEAN,
  service_types TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_resolved_tenant_id UUID;
  v_carrier_types TEXT[];
BEGIN
  -- Resolve tenant from caller if not provided
  v_resolved_tenant_id := COALESCE(p_tenant_id, get_user_tenant_id(auth.uid()));

  -- Get all carrier_type values for this transport mode
  SELECT ARRAY_AGG(mcm.carrier_type)
  INTO v_carrier_types
  FROM public.mode_carrier_type_map mcm
  WHERE mcm.transport_mode_code = p_mode;

  -- If no mapping found, try direct match
  IF v_carrier_types IS NULL OR array_length(v_carrier_types, 1) IS NULL THEN
    v_carrier_types := ARRAY[p_mode];
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (c.carrier_name)
    c.id,
    c.carrier_name,
    c.carrier_code,
    c.carrier_type,
    c.scac,
    c.iata,
    c.mc_dot,
    c.mode,
    EXISTS(
      SELECT 1 FROM public.vendor_preferred_carriers vpc
      WHERE vpc.carrier_id = c.id
        AND vpc.mode = p_mode
        AND vpc.is_active = true
    ) AS is_preferred,
    ARRAY(
      SELECT cst.service_type
      FROM public.carrier_service_types cst
      WHERE cst.carrier_id = c.id AND cst.is_active = true
    ) AS service_types
  FROM public.carriers c
  WHERE c.is_active = true
    AND c.carrier_type = ANY(v_carrier_types)
    AND (
      c.tenant_id = v_resolved_tenant_id
      OR c.tenant_id IS NULL  -- global carriers
    )
  ORDER BY c.carrier_name, c.tenant_id NULLS LAST;
  -- tenant-specific carriers take priority over global ones (DISTINCT ON + ORDER BY)
END;
$$;
```

#### E.2.3 Comprehensive Carrier Data Model

**Enhanced `carriers` table view** (combining all existing columns):

```
public.carriers
├── id: UUID (PK)
├── tenant_id: UUID (NOT NULL, multi-tenant scoping)
├── franchise_id: UUID (nullable)
├── carrier_name: TEXT (NOT NULL)
├── carrier_code: TEXT (unique per tenant)
├── carrier_type: TEXT ('ocean'|'air_cargo'|'trucking'|'rail'|'courier'|'movers_and_packers')
├── mode: TEXT (transport_mode enum string; denormalized)
├── scac: TEXT (SCAC code for ocean/road)
├── scac_code: TEXT (synced duplicate — to be deprecated)
├── iata: TEXT (IATA code for air)
├── mc_dot: TEXT (MC/DOT for trucking)
├── contact_person: TEXT
├── contact_email: TEXT
├── contact_phone: TEXT
├── address: JSONB
├── website: TEXT
├── service_routes: JSONB (array of route objects)
├── rating: NUMERIC
├── is_active: BOOLEAN (default true)
├── notes: TEXT
├── created_at: TIMESTAMPTZ
└── updated_at: TIMESTAMPTZ
```

**Relationships**:
```
carriers (1) ──→ (N) carrier_service_types    [by carrier_id]
carriers (1) ──→ (N) vendor_preferred_carriers [by carrier_id]
carriers (1) ──→ (N) carrier_rates            [by carrier_id]
carriers (1) ──→ (N) provider_api_configs     [by carrier_id]
carriers (1) ──→ (N) quotation_version_option_legs [by provider_id/carrier_id]
transport_modes (1) ──→ (N) mode_carrier_type_map ──→ (N) carriers [via carrier_type]
```

#### E.2.4 Comprehensive Carrier List by Transport Mode

**Ocean Freight Carriers** (`carrier_type = 'ocean'`):

| # | Carrier Name | SCAC | Country | Alliance | Specialization |
|---|-------------|------|---------|----------|----------------|
| 1 | Maersk | MAEU | Denmark | 2M | Full range, digital-first |
| 2 | Mediterranean Shipping Company (MSC) | MSCU | Switzerland | 2M | Largest fleet globally |
| 3 | CMA CGM | CMACGM | France | Ocean Alliance | Europe-Asia, Africa |
| 4 | COSCO Shipping Lines | COSU | China | Ocean Alliance | Transpacific, Asia |
| 5 | Hapag-Lloyd | HLCU | Germany | THE Alliance | Premium, Americas |
| 6 | Ocean Network Express (ONE) | — | Japan | THE Alliance | Asia-Pacific |
| 7 | Evergreen Marine Corporation | EGLV | Taiwan | Ocean Alliance | Transpacific |
| 8 | HMM Co. Ltd. | — | South Korea | THE Alliance | Asia trades |
| 9 | ZIM Integrated Shipping Services | ZIMU | Israel | — (independent) | Niche/expedited |
| 10 | Yang Ming Marine Transport | YMLU | Taiwan | THE Alliance | Asia intra-regional |

**Air Freight Carriers** (`carrier_type = 'air_cargo'`):

| # | Carrier Name | IATA | Country | Network Strength |
|---|-------------|------|---------|-----------------|
| 1 | FedEx Express | FX | USA | Global express + cargo |
| 2 | UPS Airlines | 5X | USA | Americas, Europe hub |
| 3 | DHL Aviation | D0 | Germany | Global express network |
| 4 | Qatar Airways Cargo | QR | Qatar | Middle East hub, perishables |
| 5 | Emirates SkyCargo | EK | UAE | Dubai mega-hub, 6 continents |
| 6 | Cathay Pacific Cargo | CX | Hong Kong | Asia-Pacific, pharma |
| 7 | Lufthansa Cargo | LH | Germany | Europe hub, special cargo |
| 8 | Korean Air Cargo | KE | South Korea | Asia-Americas, e-commerce |
| 9 | Singapore Airlines Cargo | SQ | Singapore | SE Asia hub, time-sensitive |
| 10 | Cargolux | CV | Luxembourg | Europe-Asia charter, oversized |

**Road/Trucking Carriers** (`carrier_type = 'trucking'`):

| # | Carrier Name | MC/DOT | Country | Service Type |
|---|-------------|--------|---------|-------------|
| 1 | J.B. Hunt Transport Services | JBHT / DOT-223911 | USA | Intermodal, FTL |
| 2 | XPO Logistics | XPO / DOT-218683 | USA | LTL, last-mile |
| 3 | Knight-Swift Transportation | — | USA | FTL, dry van |
| 4 | Schneider National | SNDR / DOT-264184 | USA | FTL, intermodal |
| 5 | Werner Enterprises | — | USA | FTL, temperature-controlled |
| 6 | U.S. Xpress Enterprises | — | USA | FTL, dedicated |
| 7 | Old Dominion Freight Line | — / DOT-90849 | USA | LTL specialist |
| 8 | YRC Worldwide | — | USA | LTL, regional |
| 9 | R+L Carriers | — / DOT-437075 | USA | LTL, expedited |

**Rail Carriers** (`carrier_type = 'rail'`):

| # | Carrier Name | Country | Network | Specialization |
|---|-------------|---------|---------|----------------|
| 1 | Union Pacific | USA | Western US | Intermodal, bulk commodities |
| 2 | CSX | USA | Eastern US | Intermodal, chemicals |
| 3 | BNSF Railway | USA | Western US | Intermodal, coal, grain |

**Courier/Express Carriers** (`carrier_type = 'courier'`):

| # | Carrier Name | SCAC | Country | Service Type |
|---|-------------|------|---------|-------------|
| 1 | DHL Express | DHLA | Germany | Global express, same-day |
| 2 | FedEx Ground | FDXG | USA | Ground parcel, e-commerce |
| 3 | UPS | UPSN | USA | Ground + air, B2B/B2C |

**Movers & Packers** (`carrier_type = 'movers_and_packers'`):

| # | Carrier Name | Country | Specialization |
|---|-------------|---------|----------------|
| 1 | Allied Van Lines | USA | Household, corporate relocation |
| 2 | North American Van Lines | USA | Long-distance, international |
| 3 | Atlas Van Lines | USA | Agent network, specialized |
| 4 | United Van Lines | USA | Largest US mover |
| 5 | Mayflower Transit | USA | Military, government |

### E.3 API & RPC Endpoint Specifications

#### E.3.1 Primary Carrier Fetch API

**Endpoint**: Supabase RPC `get_carriers_by_mode`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `p_mode` | TEXT | Yes | Transport mode code: `ocean`, `air`, `road`, `rail`, `courier`, `movers_packers` |
| `p_tenant_id` | UUID | No | Override tenant (defaults to caller's tenant) |

**Response Schema**:
```typescript
interface CarrierByMode {
  id: string;              // UUID
  carrier_name: string;    // Display name
  carrier_code: string;    // Short code
  carrier_type: string;    // Category (ocean, air_cargo, etc.)
  scac: string | null;     // SCAC code
  iata: string | null;     // IATA code
  mc_dot: string | null;   // MC/DOT number
  mode: string;            // Transport mode
  is_preferred: boolean;   // Is vendor-preferred carrier
  service_types: string[]; // Linked service types
}
```

**Response Sorting**: Preferred carriers first, then alphabetical by `carrier_name`.

**Performance Target**: < 50ms for 50 carriers per mode.

#### E.3.2 Carrier Search API

**Endpoint**: Supabase RPC `search_carriers`

```sql
CREATE OR REPLACE FUNCTION public.search_carriers(
  p_query TEXT,
  p_mode TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  carrier_name TEXT,
  carrier_type TEXT,
  scac TEXT,
  iata TEXT,
  mc_dot TEXT,
  match_score INT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tenant_id UUID := get_user_tenant_id(auth.uid());
  v_carrier_types TEXT[];
  v_query TEXT := LOWER(TRIM(p_query));
BEGIN
  -- Resolve carrier types for mode (if provided)
  IF p_mode IS NOT NULL THEN
    SELECT ARRAY_AGG(mcm.carrier_type)
    INTO v_carrier_types
    FROM public.mode_carrier_type_map mcm
    WHERE mcm.transport_mode_code = p_mode;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.carrier_name,
    c.carrier_type,
    c.scac,
    c.iata,
    c.mc_dot,
    CASE
      WHEN LOWER(c.carrier_name) = v_query THEN 100
      WHEN LOWER(c.scac) = v_query OR LOWER(c.iata) = v_query THEN 95
      WHEN LOWER(c.carrier_code) = v_query THEN 90
      WHEN LOWER(c.carrier_name) LIKE v_query || '%' THEN 80
      WHEN LOWER(c.carrier_name) LIKE '%' || v_query || '%' THEN 70
      ELSE 60
    END AS match_score
  FROM public.carriers c
  WHERE c.is_active = true
    AND (c.tenant_id = v_tenant_id OR c.tenant_id IS NULL)
    AND (v_carrier_types IS NULL OR c.carrier_type = ANY(v_carrier_types))
    AND (
      LOWER(c.carrier_name) LIKE '%' || v_query || '%'
      OR LOWER(c.scac) = v_query
      OR LOWER(c.iata) = v_query
      OR LOWER(c.carrier_code) LIKE '%' || v_query || '%'
      OR LOWER(c.mc_dot) LIKE '%' || v_query || '%'
    )
  ORDER BY match_score DESC, c.carrier_name
  LIMIT p_limit;
END;
$$;
```

#### E.3.3 Bulk Carrier Data Endpoint (Initial Load)

**Endpoint**: Supabase RPC `get_all_carriers_grouped_by_mode`

```sql
CREATE OR REPLACE FUNCTION public.get_all_carriers_grouped_by_mode()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tenant_id UUID := get_user_tenant_id(auth.uid());
  v_result JSONB;
BEGIN
  SELECT jsonb_object_agg(
    mode_code,
    carriers_json
  ) INTO v_result
  FROM (
    SELECT
      mcm.transport_mode_code AS mode_code,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'carrier_name', c.carrier_name,
          'carrier_code', c.carrier_code,
          'carrier_type', c.carrier_type,
          'scac', c.scac,
          'iata', c.iata,
          'mc_dot', c.mc_dot
        ) ORDER BY c.carrier_name
      ) AS carriers_json
    FROM public.carriers c
    JOIN public.mode_carrier_type_map mcm ON c.carrier_type = mcm.carrier_type
    WHERE c.is_active = true
      AND (c.tenant_id = v_tenant_id OR c.tenant_id IS NULL)
    GROUP BY mcm.transport_mode_code
  ) grouped;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;
```

**Response shape**:
```json
{
  "ocean": [{ "id": "...", "carrier_name": "Maersk", "scac": "MAEU", ... }],
  "air": [{ "id": "...", "carrier_name": "Emirates SkyCargo", "iata": "EK", ... }],
  "road": [{ "id": "...", "carrier_name": "J.B. Hunt", "mc_dot": "DOT-223911", ... }],
  "rail": [{ "id": "...", "carrier_name": "Union Pacific", ... }],
  "courier": [...],
  "movers_packers": [...]
}
```

### E.4 Centralized Carrier Filtering Hook

#### E.4.1 New Hook: `useCarriersByMode`

**File**: `src/hooks/useCarriersByMode.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CarrierOption {
  id: string;
  carrier_name: string;
  carrier_code: string | null;
  carrier_type: string;
  scac: string | null;
  iata: string | null;
  mc_dot: string | null;
  mode: string | null;
  is_preferred: boolean;
  service_types: string[];
}

interface CarriersByModeMap {
  [modeCode: string]: CarrierOption[];
}

/**
 * Single source of truth for carrier data grouped by transport mode.
 * Replaces all inline carrier filtering across the quote platform.
 *
 * Usage:
 *   const { getCarriersForMode, isLoading } = useCarriersByMode();
 *   const oceanCarriers = getCarriersForMode('ocean');
 */
export function useCarriersByMode() {
  const { data: carrierMap = {}, isLoading, error } = useQuery<CarriersByModeMap>({
    queryKey: ['carriers_by_mode'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_all_carriers_grouped_by_mode');
      if (error) throw error;
      return (data as CarriersByModeMap) || {};
    },
    staleTime: 1000 * 60 * 30, // 30 minutes — carriers rarely change
    retry: 2,
  });

  /** Get carriers for a specific transport mode code */
  const getCarriersForMode = (modeCode: string): CarrierOption[] => {
    if (!modeCode) return [];
    const normalized = normalizeModeCode(modeCode);
    return carrierMap[normalized] || [];
  };

  /** Get all carriers across all modes (flat list) */
  const getAllCarriers = (): CarrierOption[] => {
    return Object.values(carrierMap).flat();
  };

  /** Check if carriers exist for a mode */
  const hasCarriersForMode = (modeCode: string): boolean => {
    return getCarriersForMode(modeCode).length > 0;
  };

  return {
    carrierMap,
    getCarriersForMode,
    getAllCarriers,
    hasCarriersForMode,
    isLoading,
    error,
  };
}

/**
 * Canonical mode code normalization — single definition for the entire app.
 * Replaces: normalizeModeKey(), normalizeTransportMode(), inline modeMap objects
 */
export function normalizeModeCode(value: string): string {
  const v = (value || '').toLowerCase().trim();
  if (v.includes('ocean') || v.includes('sea') || v.includes('maritime')) return 'ocean';
  if (v.includes('air')) return 'air';
  if (v.includes('rail') || v.includes('train') || v.includes('railway')) return 'rail';
  if (v.includes('truck') || v.includes('road') || v.includes('inland') || v.includes('ground'))
    return 'road';
  if (v.includes('courier') || v.includes('express') || v.includes('parcel')) return 'courier';
  if (v.includes('move') || v.includes('mover') || v.includes('packer')) return 'movers_packers';
  return v;
}
```

#### E.4.2 Migration Path for Existing Components

**Phase 1 — Add hook + RPC (non-breaking)**:
1. Create `mode_carrier_type_map` table + RPC functions
2. Create `useCarriersByMode` hook
3. Export `normalizeModeCode()` as canonical normalizer

**Phase 2 — Migrate components (4 files)**:

| Component | Current Filtering | New Approach |
|-----------|-------------------|-------------|
| `LegsConfigurationStep.tsx` | Inline `modeMap` filter (lines 387-413) | `getCarriersForMode(leg.mode)` |
| `QuoteLegRow.tsx` | Inline `includes()` checks (lines 40-47) | `getCarriersForMode(legMode)` |
| `QuoteLogistics.tsx` | Service type name parsing (lines 68-89) | `getCarriersForMode(selectedMode)` |
| `MultiModalQuoteComposer.tsx` | Service type parsing (lines 2773-2787) | `getCarriersForMode(newOptionData.mode)` |

**Phase 3 — Remove duplicated code**:
- Delete `normalizeModeKey()` from `LegsConfigurationStep.tsx`
- Delete `normalizeTransportMode()` from `quote-mapper.ts`
- Delete all inline `modeMap` objects
- Use `normalizeModeCode()` everywhere

### E.5 UI/UX Design — Carrier Selection Interface

#### E.5.1 Enhanced Carrier Dropdown Component

**New Component**: `src/components/sales/composer/CarrierSelect.tsx`

```typescript
interface CarrierSelectProps {
  /** Transport mode code to filter carriers */
  mode: string;
  /** Currently selected carrier ID */
  value: string | undefined;
  /** Callback when carrier is selected */
  onChange: (carrierId: string, carrierName: string) => void;
  /** Optional: show preferred carriers first */
  showPreferred?: boolean;
  /** Optional: allow clearing selection */
  clearable?: boolean;
  /** Optional: placeholder text */
  placeholder?: string;
  /** Optional: disabled state */
  disabled?: boolean;
}
```

**UI Requirements**:

1. **Grouped Display**: Show carriers in sections:
   - "Preferred Carriers" (if `showPreferred=true` and vendor has preferences)
   - "All {Mode} Carriers" (alphabetical)
   - Separator between groups

2. **Search/Filter**: Built-in text filter for carrier name, SCAC, IATA, or MC/DOT code
   - Minimum 8 carriers to show search field
   - Debounced at 200ms
   - Highlights matching text in results

3. **Carrier Info Display**: Each option shows:
   ```
   [Carrier Name]           [SCAC/IATA badge]
   ```

4. **Empty State**: When no carriers exist for a mode:
   ```
   No carriers available for [Mode Name].
   Contact your administrator to add carriers.
   ```

5. **Loading State**: Skeleton loader while carriers fetch

6. **Badge/Count**: Show carrier count next to mode selector:
   ```
   Ocean Freight (10 carriers)
   ```

#### E.5.2 Transport Mode Selector Enhancement

Update `TransportModeSelector.tsx` to show carrier availability:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Ship Ocean  │  │  Plane Air  │  │  Truck Road │  │  Train Rail │
│  10 carriers │  │  10 carriers│  │  8 carriers  │  │  3 carriers │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

When a mode has 0 carriers, show the card as disabled with tooltip: "No carriers configured for this mode".

#### E.5.3 Leg Configuration UX Flow

**Updated flow for LegsConfigurationStep**:

```
User selects transport mode (e.g., "Ocean")
    |
    +-> Auto-populate Service Type dropdown (filtered: ocean_fcl, ocean_lcl)
    |
    +-> Auto-populate Carrier dropdown (filtered: 10 ocean carriers)
    |       |
    |       +- Preferred carriers section (if vendor has preferences)
    |       +- -- separator --
    |       +- All ocean carriers (alphabetical)
    |
    +-> If activeOption has carrier_id, pre-select it
```

**Carrier change cascade**:
```
User changes leg mode (e.g., Ocean -> Air)
    |
    +-> Clear current carrier selection (carrierId = '', carrierName = '')
    |
    +-> Refresh carrier dropdown with air carriers
    |
    +-> Refresh service type dropdown with air service types
    |
    +-> Show toast: "Carrier cleared -- please select an air freight carrier"
```

#### E.5.4 Quick Quote Modal — Carrier Selection

**Updated QuickQuoteModalContent** carrier selection:

```
Step 1: Mode Selection (radio/card group)
    |
    +-> [ocean] [air] [road] [rail]
    |
Step 2: Route & Cargo Details
    |
Step 3: Carrier Preferences (optional, multi-select)
    |
    +-> "Preferred Carriers (optional)"
    |   +-------------------------------------------+
    |   | Search carriers by name or code...        |
    |   +-------------------------------------------+
    |   | [x] Maersk (MAEU)                         |
    |   | [ ] MSC (MSCU)                            |
    |   | [ ] CMA CGM (CMACGM)                     |
    |   | [ ] Hapag-Lloyd (HLCU)                    |
    |   | [ ] COSCO (COSU)                          |
    |   |   ... 5 more                              |
    |   +-------------------------------------------+
    |
    +-> Selected: [Maersk x] [CMA CGM x]
    |
Step 4: Generate Quotes (AI Advisor)
```

### E.6 Validation Rules

#### E.6.1 Carrier Selection Validation

| Rule | Scope | Enforcement Level | Error Message |
|------|-------|-------------------|---------------|
| **V1** Carrier must be active | All modes | DB (RPC filter) + UI | "Selected carrier is inactive or unavailable" |
| **V2** Carrier must match leg mode | Per leg | Client + Server | "Carrier {name} does not serve {mode} transport" |
| **V3** Carrier must be accessible to tenant | Multi-tenant | DB (RLS) | "Carrier not found" (silent -- RLS hides inaccessible) |
| **V4** At least 1 carrier per transport leg | Save validation | Client (pre-save) | "Leg {n}: Please select a carrier" -- **Warning only, not blocking** |
| **V5** Carrier code format valid | Per mode | DB CHECK + Client | "Invalid SCAC code format (expected 2-5 uppercase letters)" |
| **V6** No duplicate carriers across legs | Optional | Client (warning) | "Carrier {name} is already assigned to Leg {n}" -- **Warning only** |
| **V7** Preferred carrier available | Quick quote | Client (advisory) | "No preferred carriers found for {mode}. Showing all carriers." |

#### E.6.2 Mode-Carrier Cross-Validation

**Implementation in QuoteTransformService** (new method):

```typescript
/**
 * Validates that a carrier is compatible with the specified transport mode.
 * Uses the mode_carrier_type_map for authoritative mapping.
 */
public static validateCarrierMode(
  carrierId: string,
  mode: string,
  carriers: CarrierOption[],
  modeCarrierMap: ModeCarrierTypeMap
): { valid: boolean; error?: string } {
  if (!carrierId) return { valid: true }; // carrier is optional

  const carrier = carriers.find(c => c.id === carrierId);
  if (!carrier) return { valid: false, error: `Carrier not found: ${carrierId}` };

  const normalizedMode = normalizeModeCode(mode);
  const allowedTypes = modeCarrierMap[normalizedMode] || [];

  if (allowedTypes.length === 0) {
    return { valid: true }; // no mapping defined = allow any
  }

  const carrierType = (carrier.carrier_type || '').toLowerCase();
  if (!allowedTypes.includes(carrierType)) {
    return {
      valid: false,
      error: `Carrier "${carrier.carrier_name}" (type: ${carrierType}) ` +
        `is not valid for ${normalizedMode} transport. ` +
        `Expected types: ${allowedTypes.join(', ')}`
    };
  }

  return { valid: true };
}
```

#### E.6.3 Save-Time Validation Pipeline

Add to existing validation pipeline (Section 7.1 of main document):

```
Stage 3: Carrier Validation (new)
+- For each leg where legType === 'transport':
|   +- If carrierId is set:
|   |   +- Verify carrier exists and is_active
|   |   +- Verify carrier_type matches leg mode (via mode_carrier_type_map)
|   |   +- Verify carrier is accessible to tenant (RLS handles this)
|   +- If carrierId is not set:
|       +- Add warning (not error): "Leg {n} has no carrier assigned"
+- Cross-leg check: warn on duplicate carriers (informational only)
+- Output: ValidationResult with errors[] and warnings[]
```

### E.7 Integration Requirements

#### E.7.1 Integration with Existing Quote Components

| Component | Integration Point | Changes Required |
|-----------|-------------------|-----------------|
| **MultiModalQuoteComposer** | Reference data loading (lines 731-861) | Replace carrier fetch with `useCarriersByMode()` hook; remove `uniqueByCarrierName()` dedup logic (handled by RPC) |
| **LegsConfigurationStep** | Carrier dropdown (lines 387-413) | Replace inline filter with `<CarrierSelect mode={leg.mode} />` component |
| **QuoteDetailsStep** | Quote-level carrier (lines 305-320) | Add mode-aware filtering; use `<CarrierSelect mode={quoteData.transport_mode} />` |
| **QuoteLegRow** | Per-leg carrier (lines 40-47) | Replace inline filter with `getCarriersForMode()` |
| **QuoteLogistics** | Service-type-based filtering (lines 68-89) | Replace with `getCarriersForMode()` using resolved mode from service type |
| **QuickQuoteModalContent** | Preferred carriers multi-select | Use `getCarriersForMode(selectedMode)` for options |
| **CarrierQuotesSection** | Manual carrier quote entry | Add mode prop; filter carriers by mode |
| **QuoteOptionService** | `insertLegs()` — carrier resolution | Use `get_carriers_by_mode` RPC for validation before insert |
| **QuoteTransformService** | `resolveCarrierId()` (lines 341-370) | Add mode parameter to narrow search scope |

#### E.7.2 Integration with AI Advisor

When AI Advisor generates quotes with carrier names:

```
AI Response: { carrier: "Maersk", transport_mode: "ocean", ... }
    |
    +-> QuoteTransformService.resolveCarrierId("Maersk", carriers)
    |       +- Step 1: Exact name match in mode-filtered carriers
    |       +- Step 2: SCAC match (MAEU)
    |       +- Step 3: Fuzzy match
    |       +- Step 4: Return null (carrier name from AI not in DB)
    |
    +-> If resolved: Set carrierId + carrierName on leg/option
        If not resolved: Set carrierName only (display purposes)
```

**Enhancement**: Pass actual carrier list to AI Advisor prompt so it generates quotes with carriers that exist in the tenant's database:

```typescript
// In ai-advisor edge function
const carrierContext = await supabase.rpc('get_carriers_by_mode', { p_mode: requestedMode });
const carrierNames = carrierContext.map(c => c.carrier_name).join(', ');

systemPrompt += `\nAvailable carriers for ${requestedMode}: ${carrierNames}. ` +
  `ONLY use these carrier names in your response.`;
```

#### E.7.3 Integration with Rate Engine

The rate engine (`supabase/functions/rate-engine/index.ts`) queries `carrier_rates` which already links to carriers by `carrier_id`. No changes needed for rate lookup. However, rate results should include the carrier's mode compatibility for display:

```sql
-- Enhance rate engine query to include carrier mode info
SELECT cr.*, c.carrier_name, c.carrier_type, c.scac, c.iata
FROM carrier_rates cr
JOIN carriers c ON cr.carrier_id = c.id
WHERE cr.origin_port_id = p_origin
  AND cr.destination_port_id = p_destination
  AND c.carrier_type IN (
    SELECT mcm.carrier_type
    FROM mode_carrier_type_map mcm
    WHERE mcm.transport_mode_code = p_mode
  )
  AND cr.status = 'active';
```

#### E.7.4 Integration with Shipment Conversion

When a quote converts to a shipment (`create_shipment_from_quote()` RPC), carrier data flows through:

```
quotation_version_options.carrier_id -> shipments.carrier_id
quotation_version_option_legs.provider_id -> shipment_legs.provider_id
quotation_version_option_legs.mode_id -> shipment_legs.mode_id
```

No changes needed — existing FK relationships carry carrier data through conversion.

### E.8 Error Handling

#### E.8.1 Error Scenarios & Recovery

| Scenario | Detection | User Feedback | Recovery |
|----------|-----------|---------------|----------|
| **RPC call fails** | `useQuery` error state | Toast: "Failed to load carriers. Retrying..." | Auto-retry (2 attempts, exponential backoff) |
| **No carriers for mode** | `getCarriersForMode()` returns `[]` | Empty state in dropdown + disabled submit | Link to admin panel: "Add carriers" |
| **Selected carrier deactivated** | Carrier not in filtered list after refresh | Warning badge on leg card: "Carrier unavailable" | Auto-clear carrierId; prompt re-selection |
| **Carrier ID orphaned** | `resolveCarrierId()` returns undefined | Warning: "Carrier not found -- please re-select" | Keep carrier_name for display; clear carrier_id |
| **Mode changed with carrier set** | `onUpdateLeg()` mode change handler | Toast: "Carrier cleared for new mode" | Clear carrierId and carrierName |
| **Duplicate carrier across legs** | Cross-leg validation check | Warning (non-blocking): "Same carrier on multiple legs" | Allow but highlight |
| **Tenant carrier data empty** | `useCarriersByMode()` returns empty map | Full-page advisory: "No carriers configured" | Show admin setup guide |
| **Stale cache after carrier CRUD** | User adds carrier in admin, comes back to quote | Carrier not in list | "Refresh" button on dropdown; invalidate query cache |

#### E.8.2 Graceful Degradation

If the new `get_carriers_by_mode` RPC is unavailable (e.g., migration not deployed):

```typescript
// Fallback in useCarriersByMode
const { data, error } = await supabase.rpc('get_all_carriers_grouped_by_mode');

if (error?.code === '42883') {
  // Function not found — fall back to legacy client-side filtering
  console.warn('get_all_carriers_grouped_by_mode RPC not found, using fallback');
  const { data: legacyData } = await supabase
    .from('carriers')
    .select('id, carrier_name, carrier_code, carrier_type, scac, iata, mc_dot, mode')
    .eq('is_active', true)
    .order('carrier_name');

  // Group by carrier_type using legacy modeMap
  return groupCarriersByMode(legacyData || []);
}
```

### E.9 Data Consistency & Real-Time Filtering

#### E.9.1 Cache Strategy

| Data | Cache Duration | Invalidation Trigger |
|------|---------------|---------------------|
| `carriers_by_mode` | 30 minutes | Carrier CRUD in admin panel |
| `mode_carrier_type_map` | 24 hours | Platform admin changes (rare) |
| `vendor_preferred_carriers` | 5 minutes | Vendor settings change |

**React Query Configuration**:
```typescript
{
  staleTime: 1000 * 60 * 30,      // 30 min
  gcTime: 1000 * 60 * 60,         // 1 hour garbage collection
  refetchOnWindowFocus: false,     // Don't refetch on tab switch
  refetchOnReconnect: true,        // Refetch after network recovery
  retry: 2,
  retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
}
```

#### E.9.2 Real-Time Filtering Behavior

When user changes transport mode on a leg:

```
1. Mode change event fires
2. CarrierSelect receives new mode prop
3. getCarriersForMode(newMode) returns from cache (instant, < 1ms)
4. Dropdown options re-render with filtered carriers
5. Previous carrier selection cleared if incompatible
6. Service type dropdown also re-filters (existing behavior)
```

**No network request needed** — all carrier data is pre-grouped by mode in the initial RPC call. Mode switching is purely a client-side filter operation.

#### E.9.3 Multi-Tenant Data Isolation

```
Tenant A carriers: [Maersk, MSC, Custom Carrier A]
Tenant B carriers: [CMA CGM, Hapag-Lloyd, Custom Carrier B]
Global carriers:   [Maersk, MSC, CMA CGM, ...] (shared)

Tenant A sees: Global carriers + Tenant A custom carriers
               Maersk, MSC, CMA CGM, ..., Custom Carrier A
               (deduplication: tenant-specific takes priority over global)

Tenant B sees: Global carriers + Tenant B custom carriers
               Maersk, MSC, CMA CGM, ..., Custom Carrier B
```

### E.10 Testing Plan

#### E.10.1 Unit Tests

```
CarrierSelect Component Tests:
+- renders carrier dropdown with correct options for ocean mode
+- renders carrier dropdown with correct options for air mode
+- renders empty state when no carriers for mode
+- filters carriers when search text entered
+- shows preferred carriers section when available
+- clears selection when mode changes
+- calls onChange with carrier id and name on selection
+- handles loading state with skeleton
+- handles error state with retry button

useCarriersByMode Hook Tests:
+- returns empty map when RPC fails (graceful degradation)
+- groups carriers correctly by mode
+- normalizeModeCode handles all known aliases
+- getCarriersForMode returns [] for unknown mode
+- getAllCarriers returns flat list of all carriers
+- cache invalidation works after carrier CRUD
+- fallback to legacy filtering when RPC unavailable

normalizeModeCode Tests:
+- 'ocean' -> 'ocean'
+- 'sea' -> 'ocean'
+- 'maritime' -> 'ocean'
+- 'air' -> 'air'
+- 'air_cargo' -> 'air'
+- 'rail' -> 'rail'
+- 'train' -> 'rail'
+- 'railway' -> 'rail'
+- 'road' -> 'road'
+- 'truck' -> 'road'
+- 'trucking' -> 'road'
+- 'inland' -> 'road'
+- 'ground' -> 'road'
+- 'courier' -> 'courier'
+- 'express' -> 'courier'
+- 'movers' -> 'movers_packers'
+- '' -> ''
+- null -> ''
+- 'unknown_mode' -> 'unknown_mode'
```

#### E.10.2 Integration Tests

```
Carrier Selection in LegsConfigurationStep:
+- Adding ocean leg shows only ocean carriers in dropdown
+- Adding air leg shows only air cargo carriers
+- Adding road leg shows only trucking carriers
+- Adding rail leg shows only rail carriers
+- Changing leg mode from ocean to air clears carrier and refreshes list
+- Pre-filled carrier from AI option appears selected
+- Carrier selection persists through save_quote_atomic
+- Carrier ID correctly written to quotation_version_option_legs.provider_id

Quick Quote Carrier Preferences:
+- Mode selection filters carrier multi-select options
+- Selected carriers passed to AI Advisor request
+- AI Advisor response carriers resolve against filtered list
+- Unresolvable AI carrier names show warning but don't block

Cross-Component Consistency:
+- Same carrier selected in QuoteDetailsStep appears in LegsConfigurationStep
+- Carrier change in leg updates option-level carrier_name
+- Carrier data consistent after save + reload
+- Carrier visible in PDF after generation
```

#### E.10.3 Database Tests (RPC)

```sql
-- Test: get_carriers_by_mode returns only matching carriers
SELECT * FROM get_carriers_by_mode('ocean');
-- Expected: Only carriers with carrier_type = 'ocean'

-- Test: get_carriers_by_mode handles unknown mode
SELECT * FROM get_carriers_by_mode('drone');
-- Expected: Empty result set (no mapping exists)

-- Test: search_carriers with mode filter
SELECT * FROM search_carriers('maer', 'ocean');
-- Expected: Maersk (score 80, prefix match)

-- Test: search_carriers with SCAC code
SELECT * FROM search_carriers('MAEU', NULL);
-- Expected: Maersk (score 95, exact SCAC match)

-- Test: Tenant isolation
-- As Tenant A user:
SELECT * FROM get_carriers_by_mode('ocean');
-- Expected: Global carriers + Tenant A custom carriers only

-- Test: mode_carrier_type_map integrity
SELECT tm.code, mcm.carrier_type, COUNT(c.id) as carrier_count
FROM transport_modes tm
LEFT JOIN mode_carrier_type_map mcm ON tm.code = mcm.transport_mode_code
LEFT JOIN carriers c ON c.carrier_type = mcm.carrier_type AND c.is_active = true
GROUP BY tm.code, mcm.carrier_type
ORDER BY tm.display_order;
-- Expected: All modes have at least one carrier_type mapping
```

#### E.10.4 Performance Benchmarks

| Operation | Target | Method |
|-----------|--------|--------|
| `get_carriers_by_mode('ocean')` | < 30ms | RPC cold call |
| `get_all_carriers_grouped_by_mode()` | < 100ms | RPC initial load |
| `search_carriers('maer', 'ocean')` | < 20ms | RPC with index |
| Client-side mode switch (cached) | < 5ms | `getCarriersForMode()` from cache |
| CarrierSelect render (10 items) | < 16ms | React render cycle |
| CarrierSelect render (50 items) | < 50ms | React render cycle with virtualization |

### E.11 Implementation Roadmap

| Step | Task | Effort | Dependencies |
|------|------|--------|-------------|
| E.11.1 | Create `mode_carrier_type_map` table migration | 1h | None |
| E.11.2 | Create `get_carriers_by_mode` RPC | 2h | E.11.1 |
| E.11.3 | Create `search_carriers` RPC | 1.5h | E.11.1 |
| E.11.4 | Create `get_all_carriers_grouped_by_mode` RPC | 1.5h | E.11.1 |
| E.11.5 | Create `useCarriersByMode` hook + `normalizeModeCode` | 3h | E.11.4 |
| E.11.6 | Create `CarrierSelect` component | 4h | E.11.5 |
| E.11.7 | Migrate `LegsConfigurationStep` carrier dropdown | 2h | E.11.6 |
| E.11.8 | Migrate `QuoteLegRow` carrier filtering | 1h | E.11.6 |
| E.11.9 | Migrate `QuoteLogistics` carrier filtering | 1h | E.11.6 |
| E.11.10 | Migrate `MultiModalQuoteComposer` option dialog | 1.5h | E.11.6 |
| E.11.11 | Update `QuickQuoteModalContent` carrier multi-select | 2h | E.11.6 |
| E.11.12 | Add `validateCarrierMode()` to QuoteTransformService | 1.5h | E.11.5 |
| E.11.13 | Update AI Advisor to include actual carrier names | 2h | E.11.2 |
| E.11.14 | Remove all legacy normalization functions + inline filters | 1h | E.11.7-11 |
| E.11.15 | Write unit tests (hook, component, normalizer) | 3h | E.11.6 |
| E.11.16 | Write integration tests (full flow) | 3h | E.11.7-11 |
| E.11.17 | Write RPC database tests | 1.5h | E.11.2-4 |
| **Total** | | **~33h** | |

### E.12 Open Questions & Decisions

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| Q1 | Should carrier selection be **required** or **optional** for transport legs? | Required / Optional (current) | **Optional** — Keep current behavior. Many quotes start without carrier and get assigned later. |
| Q2 | Should we support **multi-carrier** per leg? | Single / Multi | **Single** — One carrier per leg is standard. Multi-modal is handled by multiple legs. |
| Q3 | Should `carrier_type` be migrated to match `transport_modes.code` exactly? | Migrate / Keep mapping table | **Keep mapping table** — Migration risk too high; mapping table is cleaner and handles aliases. |
| Q4 | Should the `carrier_service_types` table replace `mode_carrier_type_map`? | Use existing / New table | **New table** — `carrier_service_types` is per-tenant and per-carrier; we need a global mode-to-type mapping. Different abstraction level. |
| Q5 | Should AI Advisor be constrained to only suggest carriers in the tenant's database? | Constrain / Allow any | **Constrain** — Reduces unresolvable carrier names and improves data consistency. |

---

*This document is a living reference. Update as issues are resolved and architecture evolves. Version history tracked in git.*

*v2.0: 2026-02-15 — Initial release (38 issues)*
*v2.1: 2026-02-15 — Codebase audit added 29 findings; total effort revised to ~367h across 18 weeks*
*v2.2: 2026-02-16 — Appendix D added: Comprehensive transport mode, carrier, and parameter analysis*
*v2.3: 2026-02-17 — Appendix E added: Mode-based carrier selection implementation design with dynamic filtering*
