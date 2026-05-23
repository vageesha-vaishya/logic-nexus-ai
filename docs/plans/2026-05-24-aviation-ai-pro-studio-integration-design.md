# Aviation AI Pro — Studio Integration Design

**Date:** 2026-05-24
**Status:** Design — agreed, executing Day 1 immediately
**Author:** vimalbahuguna (with Claude)
**Related:**
- `docs/plans/2026-05-23-sos-services-platform-brand-architecture-design.md` (parent venture-studio architecture)
- `github.com/vimalbahuguna/aviation-ai-pro` (existing product repo)
- Memory: `project_marketing_site.md`, `project_coolify_access.md`

## Context

`vimalbahuguna/aviation-ai-pro` is an existing flight data analytics platform — ARINC 717 FDR parser (C++17), DLU decoder, approach scoring, PFD/3D visualization, FastAPI backend, React/Vite frontend. Active development through May 2026, DCDCA (DGCA-India) regulatory submission in flight. Has its own Supabase project (`mxbanyfhmaxvxnktbtkm`, ap-northeast-1 / Tokyo). Not yet on the Hostinger Coolify infrastructure.

The question: how does this product fit into the SOS Services venture studio architecture established in `2026-05-23-sos-services-platform-brand-architecture-design.md`?

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Position in studio | **Fourth standalone product** under SOS Services (alongside Logic Nexus, Sthira, plus AMRO module inside Logic Nexus) | Atlassian model from parent architecture: own brand, own domain, own app |
| Primary buyer | Airline safety/FOQA teams, DGCA/DCDCA regulator | Different procurement than AMRO (maintenance ops); same airline corporate, different department |
| Relation to AMRO inside Logic Nexus | Complementary; cross-link in marketing, don't merge | AMRO = "what to do to aircraft" (maintenance). AvAI Pro = "what happened on the flight" (data). Different workflows, different teams |
| Deployment model | Multi-tenant SaaS (Phase 1) | Matches Logic Nexus pattern; revisit if airline procurement demands single-tenant or on-prem |
| Marketing domain (v1) | `aviation.sosservices.online` (subdomain) | Budget path — matches Logic Nexus pattern; migrate to standalone `.com` later |
| Repo | Keep existing `vimalbahuguna/aviation-ai-pro` as-is; new `aviation-ai-pro-marketing` for the showcase site | Same repo separation as Logic Nexus (`logic-nexus-ai` ← product code; `logicnexus-marketing` ← marketing site) |
| Supabase | Keep on its existing project (`mxbanyfhmaxvxnktbtkm`, ap-northeast-1) | Separate data plane from Logic Nexus; flight data has different retention/audit posture |
| Identity at launch | Own Supabase Auth | Federate to `account.sosservices.online` later when shared SSO exists (parent design Phase 2) |
| Brand accent | `#dc2626` (red-600) | Aviation/safety semantics; not yet used by other products |

## Architecture

### Repo layout

```
github.com/vimalbahuguna/
  aviation-ai-pro                       (existing — product code, no changes for this slice)
    backend/         FastAPI
    frontend/        React + Vite
    src/             C++ ARINC 717 parser
    supabase/        DB migrations, edge functions
  aviation-ai-pro-marketing             (new — Phase 1)
    src/content/features/*.mdx          8 feature MDX files
    src/pages/                          Astro pages
    Dockerfile + nginx.conf             multi-stage build pattern proven yesterday
```

### Coolify topology

New project `aviation-ai-pro-dev` (separate from `logic-nexus-dev` for clean blast-radius isolation):

```
aviation-ai-pro-marketing    Astro static via Dockerfile+nginx   → aviation.sosservices.online
[Phase 2]
aviation-ai-pro-app          Vite SPA                            → app.aviation.sosservices.online
aviation-ai-pro-api          FastAPI (Python+Dockerfile)         → api.aviation.sosservices.online
aviation-ai-pro-decoder      C++ batch worker (Dockerfile)       → no public domain; queue-driven
```

DNS already covered by the existing Cloudflare wildcard `A * → 72.61.249.111 DNS only`.

### Cross-cutting

| Concern | Setup |
|---|---|
| Sentry | New project "Aviation AI Pro" (one for marketing, one for app+API) |
| PostHog | New project for product analytics |
| Email | Reuse existing `marketing-inquiry` edge function; add `aviation.sosservices.online` to CORS allowlist |
| Design system | shadcn/ui + Tailwind v4; red-600 accent overrides base brand tokens |
| CI/CD | Manual Coolify deploy for v1; GitHub Actions reusable workflows when product code lands |
| Deploy keys | New ed25519 keypair per repo, same pattern as logicnexus-marketing |

## Migration Sequence

### Phase 0 — Listing in parent showcase (1 hour, this slice)

Add Aviation AI Pro to `sosservices.online`'s products grid via a new MDX file. Status: `in-development`. Result: SOS Services product grid shows 4 cards instead of 3.

### Phase 1 — Marketing site (1–2 days, next slice)

Clone `logicnexus-marketing` template; brand swap; 6–8 feature MDX files seeded from existing repo README; deploy to `aviation.sosservices.online`; wire demo form via existing edge function.

### Phase 2 — App + API deployment (1 week, deferred)

Three Coolify apps under `aviation-ai-pro-dev` project (marketing already deployed in Phase 1). Reuse Dockerfile patterns. Internal-only access initially. Driven by AvAI Pro feature readiness.

### Phase 3 — DCDCA submission + first pilot (driven by regulator clock)

Hardening based on regulator feedback. Likely needs: full audit log surfacing, encryption-at-rest documentation, region-affinity claims, evidence bundle exports.

### Phase 4 — Federate to shared SSO (when account.sosservices.online exists)

AvAI Pro switches from own Supabase Auth to shared SSO. Skip at launch.

### Phase 5 — Region migration (deferred)

Migrate Supabase ap-northeast-1 → ap-south-1 if Indian customer perf complaints land.

## First Concrete Slice (Day 1, this session)

```
□ New file: sosservices-marketing/src/content/products/aviation-ai-pro.mdx
    - name, tagline, description, accent (#dc2626), status (in-development)
    - audience, href (placeholder), order: 4, features: 4–5 points
□ Commit + push sosservices-marketing repo
□ Trigger Coolify redeploy of marketing app (UUID im6jdbfgw1n0827wn1sfo1uj)
□ Verify https://sosservices.online shows 4 product cards
```

## Out of scope for v1

| Skipping | Why |
|---|---|
| Migrating Supabase to ap-south-1 | No customer perf complaints yet; cost > benefit |
| Federating identity | account.sosservices.online doesn't exist yet (parent Phase 2) |
| C++ decoder Coolify deploy | Batch worker; not needed for marketing or basic API |
| Acquiring `aviationaipro.com` or similar | Budget path; subdomain works for v1 |
| Merging AvAI Pro with AMRO into one "SOS Aviation" sub-brand | User confirmed different buyers; keep separate brands |

## Success criteria (Day 1)

- `https://sosservices.online` shows 4 product cards (Logic Nexus, Sthira, AMRO Pro, Aviation AI Pro)
- AvAI Pro card shows correct accent color, status pill, audience, 3 bullet features
- Card links to placeholder URL (live URL once Phase 1 ships)
- Total time: 1 hour, $0 cost

## Open questions (for later phases, not blocking Day 1)

- Will DCDCA submission timing pull Phase 2 (app deploy) urgently forward?
- Should AvAI Pro acquire `aviationaipro.com` now or defer?
- Will the C++ decoder need its own Coolify build infrastructure (CMake) or be packaged as a pre-built binary?
- Does Tokyo Supabase latency materially affect Indian customers? (~110ms RTT to Mumbai VPS — acceptable for API but heavy DB queries may hurt)
