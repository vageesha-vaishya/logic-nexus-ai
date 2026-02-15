# Quotation Platform Enterprise Enhancement Design

**Version**: 2.0
**Date**: 2026-02-15
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

**Critical data consistency challenges (38 issues identified):**

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Data Consistency | 4 | 6 | 3 | 2 | 15 |
| PDF Generation | 3 | 3 | 2 | 1 | 9 |
| Auto-Population | 2 | 4 | 1 | 0 | 7 |
| Schema/Type Safety | 1 | 2 | 2 | 2 | 7 |
| **Total** | **10** | **15** | **8** | **5** | **38** |

### 1.2 Top 5 Data Consistency Blockers

1. **Field name mismatches** — Code references `port.port_name` / `port.name` but DB column is `location_name`. Result: blank origin/destination in Composer.
2. **Dual PDF engine divergence** — V1 and V2 engines use different field mappings (`weight_kg` vs `total_weight`), producing inconsistent PDFs.
3. **Missing commodity join** — PDF query never joins `commodities` table; defaults to "General Cargo" for every quote.
4. **RPC save gap** — `save_quote_atomic()` does not persist new options, new legs, or any charges. Silent data loss on every save.
5. **Schema triple-divergence** — Zod frontend (`is_primary`), TypeScript types, and Postgres (`is_selected`) disagree on column names for 6+ fields.

### 1.3 Enhancement Strategy

This document proposes a **6-phase enhancement roadmap** targeting enterprise-grade data consistency:

| Phase | Focus | Duration | Key Outcome |
|-------|-------|----------|-------------|
| 1 | Critical Fixes | Weeks 1-2 | Data visible in Composer and PDF |
| 2 | Data Integrity | Weeks 3-4 | Zero silent data loss |
| 3 | Unification | Weeks 5-7 | Single source of truth everywhere |
| 4 | Enterprise Hardening | Weeks 8-10 | Production resilience + audit trail |
| 5 | API & Integration | Weeks 11-13 | Versioned API, real-time sync |
| 6 | Competitive Edge | Weeks 14-16 | Advanced features, observability |

**Total estimated effort**: ~280 engineering hours (~7 weeks at full capacity, 1 senior engineer)

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

**Quality Gate**: All 8 tasks pass unit tests; manual QA confirms field population rate > 85%.

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

**Effort**: ~24 hours
**Milestone**: `v1.1.0-field-fixes`
**Approval**: Engineering lead sign-off after CI green + QA pass

### Phase 2: Data Integrity (Weeks 3-4)

**Goal**: Zero silent data loss — charges saved, new options persisted, strict validation.

**Quality Gate**: Integration test covers Quick Quote → Composer → Save → Reload → all data present.

| # | Task | Severity | Effort | Files Affected | Deliverable |
|---|------|----------|--------|----------------|-------------|
| 2.1 | Extend `save_quote_atomic` → create new options (INSERT when `id` is NULL) | Critical | 8h | `save_quote_atomic` RPC, `useQuoteRepository.ts` | New options persisted |
| 2.2 | Add charge persistence to RPC (INSERT/UPDATE/DELETE `quote_charges`) | Critical | 8h | `save_quote_atomic` RPC, `useQuoteRepository.ts` | Charges survive save |
| 2.3 | Replace all `z.any()` in `QuoteTransferSchema` with strict types | High | 4h | `quote-transfer.ts` (10+ fields) | Malformed data rejected at entry |
| 2.4 | Post-save consistency validation (verify options > 0, charges > 0) | High | 4h | `useQuoteRepository.ts` | User warned on incomplete save |
| 2.5 | Fix sell-side charge filtering — log warning instead of fallback to ALL | High | 3h | `generate-quote-pdf/index.ts:172-187` | No buy-side data on customer PDF |
| 2.6 | Multi-leg auto-population from rate option data | Medium | 4h | `LegsConfigurationStep.tsx:136-137` | Intermediate ports pre-filled |
| 2.7 | Fix auto-save guard: `origin_location_id` → `origin_port_id` | Medium | 1h | `QuoteFormRefactored.tsx:108` | Auto-save triggers correctly |

**Effort**: ~32 hours
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

**Effort**: ~48 hours
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
| 4.8 | Version diff mechanism (charge-level comparison between versions) | Low | 10h | New `VersionDiff` component | Version comparison |

**Effort**: ~68 hours
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
| 6.2 | Multi-currency charge aggregation in PDF (show charges in original + converted) | Medium | 8h | `generate-quote-pdf` | Multi-currency support |
| 6.3 | Distributed tracing integration (connect `trace_id` to OpenTelemetry-compatible backend) | Medium | 12h | `emit-event`, `_shared/logger.ts`, frontend telemetry | End-to-end trace visibility |
| 6.4 | Quote analytics dashboard (conversion rate, avg margin, quote-to-close time) | Low | 14h | New `QuoteAnalyticsDashboard` page | Business intelligence |
| 6.5 | Soft delete with restore capability for quotes | Low | 8h | Migration + `QuoteDataProvider` | Data recovery |
| 6.6 | Template marketplace (tenant-specific PDF/email templates) | Low | 10h | New template management UI + edge function | Customization |

**Effort**: ~58 hours
**Milestone**: `v3.0.0-competitive`
**Approval**: Product review + full regression + performance benchmark pass

### Summary Timeline

```
Week 1-2    ████████  Phase 1: Critical Fixes (24h)
Week 3-4    ████████  Phase 2: Data Integrity (32h)
Week 5-7    ████████████  Phase 3: Unification (48h)
Week 8-10   ████████████  Phase 4: Enterprise Hardening (68h)
Week 11-13  ██████████  Phase 5: API & Integration (50h)
Week 14-16  ██████████  Phase 6: Competitive Edge (58h)
            ─────────────────────────────────────────────
            Total: ~280 hours across 16 weeks
```

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
│  │  PROBLEM: 10+ fields use z.any() — no real validation     │      │
│  └────────────────────────┬──────────────────────────────────┘      │
│                           │                                          │
│  ┌────────────────────────▼──────────────────────────────────┐      │
│  │       TRANSFORMATION (QuoteTransformService)               │      │
│  │  PROBLEM: String-based ID resolution, silent undefined     │      │
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
  ├── Port resolution: MUST resolve to UUID (warn if fuzzy match, error if no match)
  ├── Carrier resolution: SHOULD resolve (warn if missing, allow null)
  ├── Service type: MUST resolve for mode-specific operations
  ├── Container: Validate type+size combination against master data
  └── Output: TransformationReport { resolved: [], warnings: [], errors: [] }

Stage 3: PERSISTENCE VALIDATION (save_quote_atomic_v2)
  ├── FK integrity: All UUIDs reference existing records
  ├── Business rules: options > 0, charges per option > 0
  ├── Financial validation: total = sum(charges) within tolerance (0.01)
  ├── Tenant scope: quote.tenant_id matches auth context
  └── Output: SaveResult { quote_id, warnings: [] } or error

Stage 4: PRE-RENDER VALIDATION (PDF generation)
  ├── Required data present: commodity != "General Cargo" when commodity_id exists
  ├── Weight/volume non-zero when items exist
  ├── Company branding loaded for tenant
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

const LegSchema = z.object({
  sequence: z.number().int().min(1),
  from: z.string().min(1, "Leg origin required"),
  to: z.string().min(1, "Leg destination required"),
  from_port_id: z.string().uuid().optional(),
  to_port_id: z.string().uuid().optional(),
  mode: z.enum(['air', 'ocean', 'road', 'rail']),
  carrier: z.string().optional(),
  carrier_id: z.string().uuid().optional(),
  transit_time: z.string().optional(),
  transit_time_hours: z.number().optional(),
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
| Charge persistence after save | 0% | 95% | 100% |
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

**Phase 1 tests (8 new):**
- `port.location_name` resolves correctly (not `port_name`)
- Commodity name fetched via JOIN (not hardcoded)
- V2 engine uses `weight_kg` / `volume_cbm`
- `is_selected` mapping roundtrip
- Transport mode enum validation (reject "Best Value")
- Service type resolution via `transport_modes` relationship
- Tenant branding loaded for non-MGL tenants
- Rail mode in Quick Quote enum

**Phase 2 tests (10 new):**
- `save_quote_atomic_v2` creates new options
- `save_quote_atomic_v2` persists charges
- Strict Zod schema rejects `z.any()` payload shapes
- Post-save validation detects empty options/charges
- Sell-side filter never returns buy-side charges
- Multi-leg auto-population for 2, 3, 4-leg routes
- Auto-save trigger with correct field names
- Charge deduplication precision (no false positives)
- Financial balance validation (total = sum of charges)
- Transform audit trail captures all resolutions

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
| **Senior Full-Stack Engineer** (Lead) | Architecture decisions, RPC development, schema migrations, code review | All phases | 100% for 16 weeks |
| **Frontend Engineer** | React components, QuoteDataProvider, Composer fixes, UI validation | Phases 1-3, 6 | 75% for 12 weeks |
| **Backend/Edge Function Engineer** | Edge functions, PDF engine, API layer, event system | Phases 2-5 | 75% for 12 weeks |
| **QA Engineer** | Test automation, integration tests, chaos engineering, regression | All phases | 50% for 16 weeks |
| **DBA / DevOps** | Schema migrations, indexing, backup verification, monitoring setup | Phases 4-6 | 25% for 8 weeks |
| **Product Owner** | Quality gate approvals, acceptance criteria, prioritization | All phases | 10% for 16 weeks |

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

*Note: Labor costs depend on team location and employment model. The 280h estimate in Section 2 assumes a single senior engineer executing all code changes. The 1,760h above includes the full team for parallel execution, QA, and oversight.*

### 12.4 Phase Staffing Matrix

```
            Week 1-2  Week 3-4  Week 5-7  Week 8-10  Week 11-13  Week 14-16
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

### 13.2 Severity Matrix

```
              │  Low Impact  │  Medium Impact  │  High Impact  │  Critical Impact
──────────────┼──────────────┼─────────────────┼───────────────┼─────────────────
High          │  R9          │                 │               │
Likelihood    │  Accept      │                 │               │
──────────────┼──────────────┼─────────────────┼───────────────┼─────────────────
Medium        │  R10         │  R4, R5, R7     │  R2, R3       │
Likelihood    │  Accept      │  Mitigate       │  Mitigate     │
──────────────┼──────────────┼─────────────────┼───────────────┼─────────────────
Low           │              │  R6, R8         │               │  R1
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

---

## 14. Success Metrics and KPIs

### 14.1 Data Accuracy KPIs

| KPI | Baseline | Phase 1 | Phase 2 | Phase 4 | Phase 6 | Measurement |
|-----|----------|---------|---------|---------|---------|-------------|
| Field population rate (QQ → Composer) | ~30% | 85% | 90% | 98% | 99% | `quote.fields.populated` / total fields |
| Charge persistence rate | 0% | 0% | 95% | 100% | 100% | Charges in DB after save / charges in form |
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
| Phase 1 | All 8 field fixes pass unit tests; manual QA confirms > 85% population rate; CI green | Engineering Lead |
| Phase 2 | Integration test: QQ → Composer → Save → Reload → 100% data present; zero `z.any()` in schema; sell-side filter verified | Engineering Lead |
| Phase 3 | V1 engine removed; single provider active; PDF cached and consistent across preview/download/send; pre-render validation blocks incomplete PDFs | Engineering Lead + Architect |
| Phase 4 | No duplicate columns in schema; full audit trail (8 event types); reconciliation auto-repairs common issues; mode-specific PDFs render correctly | Engineering Lead + Security |
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
| `src/components/sales/quick-quote/QuickQuoteModal.tsx` | Quick Quote entry (~670 lines) | Dual state (form + extendedData); no Rail mode |
| `src/components/sales/MultiModalQuoteComposer.tsx` | Composer wizard (~930 lines) | `port.port_name` mismatch; 570-line init |
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
| `src/lib/schemas/quote-transfer.ts` | Transfer Zod schema | 10+ `z.any()` fields |
| `src/lib/quote-mapper.ts` | Rate → quote mapping (405 lines) | `opt.name` mode fallback; loose dedup |

### Edge Functions — Quote System

| File | Purpose | Key Issues |
|------|---------|------------|
| `supabase/functions/generate-quote-pdf/index.ts` | PDF generation | Dual engine; field mismatches; hardcoded company |
| `supabase/functions/generate-quote-pdf/engine/renderer.ts` | V2 PDF renderer | Template-based; uses SafeContext |
| `supabase/functions/generate-quote-pdf/engine/context.ts` | Data → template context | Field name mismatches |
| `supabase/functions/generate-quote-pdf/engine/default_template.ts` | Default template | Generic; not mode-specific |
| `supabase/functions/send-email/index.ts` | Email dispatch (1080 lines) | Multi-provider; retry logic |
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

*This document is a living reference. Update as issues are resolved and architecture evolves. Version history tracked in git.*

*Last updated: 2026-02-15*
