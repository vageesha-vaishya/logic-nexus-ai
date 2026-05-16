# Threat Model — Logic Nexus AI Platform

| Field | Value |
|---|---|
| Version | 0.1 — skeleton |
| Date | 2026-05-15 |
| Author | Vimal Bahuguna + Claude |
| Status | Draft |
| Review cadence | Quarterly or on significant architecture change |
| CERT-In ref | CERT-In CCMP 2022 §4.3 — Threat Modelling requirement |

---

## 1. Scope

This document covers the Logic Nexus AI platform as deployed on Supabase (PostgreSQL + Edge Functions) with a React SPA frontend. It addresses the following domains: CRM, Finance, Logistics, Markets, AMRO, and shared platform infrastructure.

**In scope:**
- Supabase project `gzhxgoigflftharcmdqj` (production)
- All Supabase Edge Functions
- React SPA served via CDN
- Third-party integrations (Anthropic, OpenAI, Google, AMFI, NSE, MCX, Frankfurter, Yahoo Finance)
- GitHub repository `vageesha-vaishya/logic-nexus-ai`

**Out of scope:**
- End-user devices / browser security
- Supabase infrastructure (responsibility of Supabase)
- Third-party vendor security posture (covered by `platform.integrations.vendor_risk_class`)

---

## 2. Assets

| Asset | Classification | Location | Owner |
|---|---|---|---|
| Supabase service-role key | Secret / Critical | Supabase vault + `.env` | Platform |
| Database passwords | Secret / Critical | Supabase vault | Platform |
| OpenAI / Anthropic API keys | Secret / High | Supabase vault | Platform |
| Google API key | Secret / High | Supabase vault | Platform |
| User PII (name, email, phone) | Confidential | `public.profiles`, `public.contacts` | Per-tenant |
| Portfolio / holdings data | Confidential | `markets.*` | Per-user |
| Audit + access logs | Confidential | `platform.audit_log`, `platform.access_log` | Platform |
| LLM usage records | Internal | `platform.llm_usage` | Platform |
| Source code | Internal | GitHub (private) | Platform |
| JWT signing secret | Secret / Critical | Supabase managed | Supabase |

---

## 3. Trust Boundaries

```
[Browser / SPA]
    │  HTTPS + Supabase anon JWT
    ▼
[Supabase Edge Functions]  ◄── x-tenant-id / x-franchise-id headers
    │  service-role key (internal)
    ▼
[Supabase PostgreSQL]
    │  RLS enforced on every query
    ▼
[Vault]  (pgsodium — Supabase managed)
    │
    ▼
[Third-party APIs]  (Anthropic, OpenAI, NSE, AMFI, MCX…)
```

External actors that cross a trust boundary:
1. **Authenticated user** — browser → Edge Function via JWT
2. **Service-role cron jobs** — pg_cron → Edge Function via service-role key
3. **Third-party webhooks** (future) — external → Edge Function via HMAC signature
4. **Platform admin impersonation** — platform staff acting as a user (audited)

---

## 4. Threat Enumeration (STRIDE)

### 4.1 Spoofing

| ID | Threat | Mitigations | Status |
|---|---|---|---|
| S-01 | JWT forgery / replay — attacker uses a stolen or forged JWT | Short JWT expiry (Supabase default 1h), RLS verifies `auth.uid()` on every query | ✅ Mitigated |
| S-02 | Tenant spoofing via `x-tenant-id` header | `checkDomainAccess` + RLS ensures the authenticated user belongs to the tenant | ✅ Mitigated |
| S-03 | Service-role key exposure — attacker uses leaked key to bypass all RLS | **T0 outstanding**: rotate key; restrict key usage to internal Edge Functions only | ⚠️ Partial |
| S-04 | Cross-tenant data access via manipulated query params | RLS policies enforce `tenant_id = auth.uid()'s tenant` at DB layer | ✅ Mitigated |

### 4.2 Tampering

| ID | Threat | Mitigations | Status |
|---|---|---|---|
| T-01 | SQL injection via Edge Function inputs | Supabase JS client uses parameterised queries; no raw SQL from user input | ✅ Mitigated |
| T-02 | Migration tampering — malicious migration alters RLS policies | GitHub PR required; CI runs governance check; DB-ARCH-APPROVAL tag required | ✅ Mitigated |
| T-03 | Audit log tampering — attacker deletes evidence | `platform.audit_log` has no DELETE RLS policy; only service-role can delete | ✅ Mitigated |
| T-04 | Prompt injection via user-controlled data fed to LLM | PII guard in `_shared/pii-guard.ts`; system prompts not user-controllable | ⚠️ Partial — eval needed |
| T-05 | CSV injection in holdings import (formula injection) | Parsed in server, never rendered to spreadsheet; validated field-by-field | ✅ Mitigated |

### 4.3 Repudiation

| ID | Threat | Mitigations | Status |
|---|---|---|---|
| R-01 | User denies performing a destructive action | `platform.audit_log` records every mutation with `user_id`, `acted_by`, `before`, `after` | ✅ Mitigated |
| R-02 | Platform admin impersonation without record | `platform.impersonation_sessions` table created (T3 flow not yet implemented) | ⚠️ Schema exists, flow pending |
| R-03 | Cron job actions not attributed | Cron trigger functions run as service-role; `source="import"` tag on records | ⚠️ Partial |

### 4.4 Information Disclosure

| ID | Threat | Mitigations | Status |
|---|---|---|---|
| I-01 | Cross-tenant data leak via API | RLS enforces `tenant_id` isolation; platform admins audited | ✅ Mitigated |
| I-02 | Secrets in git history | **T0 outstanding**: purge `.env` from history; rotate all keys | 🔴 Open |
| I-03 | LLM response leaks other users' data | Context is scoped per-user per-request; no shared context store | ✅ Mitigated |
| I-04 | Error messages exposing internal state | Edge Functions return generic messages; stack traces suppressed in prod | ✅ Mitigated |
| I-05 | CORS misconfiguration exposing API to arbitrary origins | `_shared/cors.ts` enforces allowlist; credentials headers not wildcarded | ✅ Mitigated |
| I-06 | Vault secret name leakage via `integration_credentials` table | Table restricted to `platform_admin` role via RLS | ✅ Mitigated |

### 4.5 Denial of Service

| ID | Threat | Mitigations | Status |
|---|---|---|---|
| D-01 | Per-user API flooding exhausting DB connections | Upstash distributed rate limiter (fixed window, per-tenant-user) | ✅ Mitigated |
| D-02 | LLM cost exhaustion — tenant triggers unlimited AI calls | `POLICIES.llm_call` = 20/min/tenant; `platform.llm_usage` for spend tracking | ✅ Mitigated |
| D-03 | Holdings import flooding — 500-row batches at high frequency | `POLICIES.import_holdings` = 5/min/tenant-user | ✅ Mitigated |
| D-04 | Ingest function hammering external APIs | Rate limiter + `POLICIES.ingest` = 10/min global per function | ✅ Mitigated |
| D-05 | Cron job accumulation — pg_cron jobs never cleaned up | Idempotent cron registration (`IF NOT EXISTS`); monitored via `cron.job_run_details` | ✅ Mitigated |

### 4.6 Elevation of Privilege

| ID | Threat | Mitigations | Status |
|---|---|---|---|
| E-01 | Operator role performing admin actions | Role-based RLS policies; `platform.user_can_access_franchise` helper | ✅ Mitigated |
| E-02 | Tenant admin accessing another tenant's data | RLS `tenant_id` isolation; `platform.is_within_tenant_subtree` check | ✅ Mitigated |
| E-03 | Platform admin accessing user data without audit trail | Impersonation sessions table exists; UI flow not yet gated (T3) | ⚠️ Partial |
| E-04 | Expired role grants still active | `expires_at` column on `user_roles`; checked in RLS helper functions | ✅ Mitigated |
| E-05 | Service account key brute-force | `key_hash` stored (SHA-256); rate limiter on auth endpoints | ✅ Schema mitigated |

---

## 5. Open Risks (Priority Order)

| Risk | Severity | Owner | Target |
|---|---|---|---|
| **I-02 / S-03** — Production secrets in git history | Critical | Vimal | T0 — Immediate |
| **R-02 / E-03** — Impersonation flow not fully gated | High | Engineering | T3 |
| **T-04** — Prompt injection eval coverage insufficient | High | Engineering | T2 |
| **R-03** — Cron job actions not fully attributed to a user | Medium | Engineering | T2 |
| **S-03** — Service-role key has no IP allowlist | Medium | Vimal | T1 |

---

## 6. Security Controls Summary

| Control | Implementation | ADR |
|---|---|---|
| Authentication | Supabase Auth JWT (RS256) | ADR-003 |
| Authorisation | PostgreSQL RLS, `platform.*` SECURITY DEFINER helpers | ADR-013 |
| Multi-tenancy isolation | `tenant_id` on every business table, enforced by RLS | ADR-004 |
| Audit trail | `platform.audit_log` + `platform.access_log` (append-only) | ADR-005, ADR-014 |
| Secret management | Supabase Vault (pgsodium); `platform.integration_credentials` stores vault refs | ADR-016 |
| Rate limiting | Upstash Redis fixed-window; fail-open if unavailable | ADR-020 |
| Input validation | Zod / manual field-by-field in Edge Functions; parameterised queries | ADR-001 |
| Transport security | HTTPS enforced by Supabase; HSTS via CDN | — |
| Dependency scanning | Dependabot on GitHub; Gitleaks pre-commit + CI | ADR-CI |
| Incident response | Runbook: `docs/runbooks/incident-cert-in.md` (to be written) | CERT-In CCMP |

---

## 7. Data Flow Diagrams

### 7.1 Portfolio read (GET /markets-portfolios)

```
Browser → [JWT] → Edge Function
  → requireAuth()       → Supabase Auth
  → checkDomainAccess() → public.tenant_domain_assignments
  → logAccess()         → platform.access_log   (async, no-block)
  → checkRateLimit()    → Upstash Redis
  → RLS-gated SELECT    → markets.portfolios
  ← JSON response
```

### 7.2 Holdings import (POST /markets-import-holdings)

```
Browser → [JWT + CSV parsed client-side] → Edge Function
  → requireAuth()         → Supabase Auth
  → checkDomainAccess()   → public.tenant_domain_assignments
  → logAccess()           → platform.access_log   (async)
  → checkRateLimit()      → Upstash Redis (5/min limit)
  → instrument resolution → markets.instruments (upsert if unknown)
  → bulk INSERT           → markets.transactions (100-row chunks)
  → upsert holdings       → markets.holdings
  → seed tax lots         → markets.tax_lots
  → logAudit()            → platform.audit_log    (async)
  ← { imported, skipped, errors }
```

---

## 8. Regulatory Mapping

| Regulation | Requirement | Platform implementation |
|---|---|---|
| **CERT-In CCMP 2022** | Threat model documented; incident < 6h report | This document; `docs/incidents/` dir; `platform.access_log` as forensic source |
| **DPDP Act 2023** | Consent records, right-to-erasure | `platform.consents` (T3); tenant lifecycle `purged` state |
| **SEBI IT Outsourcing 2023** | Vendor risk register | `platform.integrations.vendor_risk_class` |
| **RBI IT Outsourcing 2023** | Concentration risk | Traffic share computable from `platform.integration_log` |

---

## 9. Review History

| Date | Version | Changes |
|---|---|---|
| 2026-05-15 | 0.1 | Initial skeleton — STRIDE enumeration, asset register, trust boundaries |

---

*Next review due: 2026-08-15 or on any architecture change affecting trust boundaries.*
