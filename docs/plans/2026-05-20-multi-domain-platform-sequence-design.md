# Multi-Domain Platform — Independence Sequence Design

**Date:** 2026-05-20
**Status:** Design — agreed, not yet implemented
**Author:** vimalbahuguna (with Claude)
**Related:** `src/components/navigation/CommandCenterNav.tsx:184-187`, `supabase/migrations/20260411000000_seed_amro_domain_and_assignments.sql`, `docs/plans/2026-05-18-retail-investment-platform-design.md`

## Context

The platform hosts multiple business domains — CRM, AMRO, Logistics, Quotation, Finance, Compliance, Communications, and (in flight) Markets / Retail Investment Platform. The product vision is **enterprise-grade independence per domain**: each domain should be usable as a standalone application by tenants who buy only that domain, backed by a shared platform backbone (auth, tenants, billing, notifications, audit).

The trigger for this design was a concrete symptom: on the Sthira Capacitor Android build (`com.sos.sthira`), the Markets module did not appear in the sidebar. Investigation revealed the cause is not mobile-specific. The sidebar gate `hasMarketsDomain` (`CommandCenterNav.tsx:184-187`) requires either platform-admin status or an `availableDomains` entry with `code = 'MARKETS'`. No `MARKETS` row was ever seeded into `platform_domains`, so no tenant can ever be assigned it; only platform admins see Markets, via the short-circuit.

This is a symptom of a deeper gap: there is no contract that says **"if you ship a domain, you must ship a seed + assignment policy."** AMRO needed a rescue migration in April 2026 for the same reason. Comprehensive domain seeding migrations exist but do not cover newer domains. Every new domain currently accretes one-off plumbing.

## Strategy

"Independence per domain" decomposes into three orthogonal flavors:

- **A. Functional independence** — a Markets-only tenant boots into a Markets-shaped app (Markets sidebar, Markets dashboard, Markets routes), not the full shell with most items hidden. Shared chrome: auth, profile, billing, notifications.
- **B. Commercial independence** — each domain is a separately subscribable SKU with its own lifecycle (trial → active → grace → expired). Pricing, trial, and suspension are per-domain.
- **C. Deployment independence** — each domain can be scaled, feature-flagged, and rolled out independently in infra. Partially present today (`markets-worker`, `amro-api` are separate services).

These can be sequenced. Order matters because each depends on the previous.

## Recommended Sequence

### Phase 0 — Domain Manifest (prerequisite to A/B/C)

A single in-code source of truth per domain. Every domain declares:

```ts
{
  key: 'markets',
  code: 'MARKETS',
  name: 'Retail Investment Platform',
  routePrefix: '/markets',
  sidebarGroup: 'Investments',
  requiredPermissions: ['MARKETS_USER'],
  defaultAssignmentPolicy: 'opt-in',   // 'auto' | 'opt-in' | 'trial'
  services: ['markets-worker'],
  seedMigration: '20260520150000_seed_markets_domain_and_assignments.sql',
  status: 'active',
}
```

The manifest is the contract. CI / a domain-registry lint rule fails the build if a domain referenced in nav lacks a manifest entry, or a manifest entry lacks a seed migration. The platform-admin short-circuit on the nav gate is removed; production behavior matches paying-customer behavior.

Cost: ~1 day. Risk: low. Unblocks everything below.

### Phase 1 — Commercial Independence (B)

Schema mostly exists (`tenant_domain_assignments.subscription_status`, `grace_until` from the AMRO migration). Concrete work:

1. Seed every domain from its manifest entry.
2. **Stop auto-assigning every domain to every tenant.** Switch default to `opt-in`. The AMRO-style "assign all active tenants" pattern is replaced by manifest-driven policy.
3. Remove the `isPlatformAdmin` short-circuit from `hasMarketsDomain` / `hasAmroDomain` gates.
4. Implement subscription lifecycle enforcement (trial expiry → grace → suspended).

Cost: ~3-5 days. Risk: low. Unblocks selling Markets as a standalone SKU.

### Phase 2 — Functional Independence (A)

Per-domain "app shells." A tenant with only Markets sees a Markets-only sidebar, dashboard, and route tree. Shared chrome stays shared. Depends on B for an accurate `availableDomains`.

Implementation sketch: a `DomainShellRouter` at the top of `App.tsx` inspects `availableDomains`. If exactly one domain is assigned (or one is marked "primary"), it renders that domain's shell. If multiple, it falls back to the unified Command Center (today's shell). Each domain ships a `<DomainShell>` component alongside its manifest.

Cost: ~2-3 weeks. Risk: medium-high — touches routing, nav, possibly auth-redirect logic. Visible payoff: this is what makes "independent application" real to the end user.

### Phase 3 — Deployment Independence (C)

Partially present:

- `services/markets-worker` and `services/amro-api` are already separate processes.
- The remaining work is expensive: per-tenant worker scaling, per-domain feature-flag rollout at the infra layer, splitting the React bundle so a Markets-only tenant doesn't download AMRO + CRM code, per-domain observability (Sentry projects, PostHog buckets).

Constraint: production deploys to Hostinger VPS (per project memory), not Kubernetes / Fly.io. Per-tenant horizontal scaling on a single VPS is harder than on a cloud-native orchestrator. **Defer until contractually forced** (a customer with domain-level SLAs).

Cost: open-ended. Risk: high. Do not start until A and B are stable in production.

## Alternatives Considered and Rejected

- **C → B → A (infra-first).** Tempting because services are already half-split. Rejected: infra investment without a commercial gate is wasted; you would be scaling code nobody is paying differently for. Also delays the visible UX payoff.

- **A → B → C (UX-first).** Build per-domain shells first so the demo looks clean. Rejected: without B's accurate `availableDomains`, shell-selection logic has nothing reliable to dispatch on. You would hardcode tenant→shell mappings, then rip them out when B lands.

- **All three in parallel.** Rejected: the SEBI Apr 2026 deadline for Markets is one focused sprint. Splitting attention three ways drops Markets quality. Sequence forces focus.

## Implications for In-Flight Work

The migration written at `supabase/migrations/20260520150000_seed_markets_domain_and_assignments.sql` currently **auto-assigns MARKETS to every active tenant**, modeled on the AMRO pattern. Under this design, it contradicts the Phase 1 `opt-in` policy.

Two acceptable resolutions:

1. **Apply as-written for dev convenience**, with a follow-up migration in Phase 1 that converts `defaultAssignmentPolicy: 'auto'` to `'opt-in'` for MARKETS once paying customers exist.
2. **Amend now** to seed the domain row only, and assign it only to a single explicit dev tenant (the user's). This matches the target end state earlier.

Recommendation: option 2 — sets the right pattern from the start and reduces the cleanup surface in Phase 1.

## Open Questions

- Does the manifest live in `src/config/domains.ts`, or per-module under `src/features/module-*/domain.manifest.ts`? Latter is more colocated; former is easier to lint.
- Should domain manifests also drive route registration (today routes are hand-wired in `App.tsx`)? Likely yes, but out of scope for Phase 0.
- How does the manifest interact with the existing `PluginRegistry` (`src/plugins/`)? Plugins are industry-specific (Banking, Telecom, etc.) and orthogonal to domains. They should compose; this design does not address that.

## Next Actions

- Get sign-off on this sequence.
- Decide migration resolution (option 1 vs 2 above) before applying.
- Phase 0 ticket: scaffold the Domain Manifest + lint rule.
