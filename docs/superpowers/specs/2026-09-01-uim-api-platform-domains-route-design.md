# uim-api: `GET /api/v1/platform-domains` — Design

## Background

Tonight's infrastructure work correctly deployed `uim-api` and wired production
`nginx.conf` to route `/api/v1/platform-domains` (and several other paths) to
it. But `uim-api`'s Express app has zero routes implementing any
domain-management logic — confirmed via source inspection, no file under
`services/uim-api/src/routes/` matches "domain" at all. The frontend's
`DomainService.ts` calls this exact path to back the dashboard's "authorized
domains" feature; today it reaches `uim-api`, gets an honest 404, and falls
back to a degraded client-side path (`fallbackAuthorizedDomains`).

Three related endpoints (`domain-assignments`, `domain-config`, `franchises`)
have similarly incomplete backend support, but each already has a working
fallback or isn't urgently needed (`franchises` in particular has a graceful
client-side degrade in `Franchises.tsx` and no dev-mode reference
implementation ever existed for it). This design covers `platform-domains`
only — the one endpoint that's actually broken today. The other three are
explicitly out of scope; see "Out of scope" below.

## Goal

Implement `GET /api/v1/platform-domains` in `uim-api`, matching the response
shape `DomainService.ts` already expects, so the dashboard's authorized-domains
feature works without falling back to a degraded path.

## Reference material already confirmed

- **Response shape** (from `DomainService.ts` and its test file): `{ version:
  'v1', correlationId: <string>, data: { domains: DomainSummary[],
  tenantDomainCount: number, tenantId: string | null, isPlatformAdmin: boolean
  } }`. Each `DomainSummary`: `{ id, code, name, description, is_active,
  status }`.
- **DB schema** (self-hosted, confirmed via `psql` this session — all tables
  real, not stubs):
  - `platform_domains`: `id, code, name, description, is_active, status, ...`
  - `tenant_domain_assignments`: `id, tenant_id, domain_id, is_active, ...`,
    plus a `tenant_active_domain_assignments` view over it (already the
    dev-mode handler's own data source).
- **RLS** on both tables is already comprehensive and correct (tenant members
  see their own tenant's rows; platform admins see everything) — not a gap
  this design needs to fix, just not what the new route relies on (see
  Architecture).
- **`uim-api`'s existing conventions**, all confirmed by reading its current
  code rather than assumed:
  - Every route is mounted as `app.use('/api', authMiddleware,
    auditApiRequest, <router>)`.
  - `authMiddleware` (`services/uim-api/src/middleware/auth.middleware.ts` —
    a file shared verbatim across `uim-api`/`crm-api`/`sales-api`, per its own
    "keep in sync" header comment) parses the bearer token, resolves the
    caller's tenant/franchise scope (honoring `x-tenant-id`/`x-franchise-id`
    override headers the same way `DomainService.ts` and `Franchises.tsx`
    already send them), and attaches `req.tenantId`, `req.franchiseId`,
    `req.userId` before calling `next()`.
  - **If the user has no tenant assignment at all, the middleware itself
    responds `401 NO_TENANT_ASSIGNMENT` and never calls `next()`** (confirmed
    by reading the middleware's final branch, `auth.middleware.ts`, the
    `defaultRole?.tenant_id` check). The new route therefore never has to
    handle a missing-tenant case itself — it's fully absorbed upstream.
  - The middleware computes `hasPlatformAdmin` as a **local variable**
    (`auth.middleware.ts:303`) but never attaches it to `req` — this is a real
    gap the new route needs, not something already available.
  - App-level middleware (`services/uim-api/src/app.ts:70-76`) already
    attaches `req.correlationId` to every request (from an incoming
    `x-correlation-id` header, or a fresh `randomUUID()` if absent) before any
    route runs. The new route reads this directly — it does not generate its
    own correlation ID.
  - Every existing route queries via a service-role Supabase client with
    explicit `.eq('tenant_id', ...)`-style filtering in application code, not
    by forwarding the caller's own JWT and relying on RLS. This is a
    deliberate choice for the new route too (see Architecture), for
    consistency with the rest of this service, even though the dev-mode
    reference handler uses the JWT-forwarding approach instead.

## Architecture

**New file**: `services/uim-api/src/routes/platform-domains.routes.ts`,
mounted in `app.ts` alongside the other routers:
`app.use('/api', authMiddleware, auditApiRequest, platformDomainsRoutes)`.

**Middleware change**: extend `AuthRequest` (in `auth.middleware.ts`) with an
`isPlatformAdmin?: boolean` field, and set `req.isPlatformAdmin =
hasPlatformAdmin;` right where `hasPlatformAdmin` is already computed
(`auth.middleware.ts:303`), on every code path that reaches `next()`. This is
a small, additive, low-risk change — it doesn't alter any existing behavior,
only exposes a value the middleware already computes.

**This same middleware file is duplicated (not shared) across `crm-api`,
`sales-api`, and `uim-api`.** This design touches only `uim-api`'s copy, since
only `uim-api` needs `isPlatformAdmin` right now — applying the identical
one-line change to the other two copies "to keep in sync" per the file's own
header convention is a reasonable follow-up but is explicitly **not** done
here (YAGNI: neither `crm-api` nor `sales-api` has any code that would use
this field today).

**Route logic**:
1. If `req.isPlatformAdmin`: query `platform_domains` directly for all
   `is_active = true` rows via the service-role client, no tenant filter.
2. Otherwise: query `tenant_active_domain_assignments`, embedding
   `platform_domains!inner(id, code, name, description, is_active, status)`,
   filtered by `.eq('tenant_id', req.tenantId)` — the same embed shape the
   dev-mode handler already uses, just filtered explicitly in code rather
   than relying on RLS (since the service-role client bypasses RLS).
3. De-duplicate by domain `id` (mirrors the dev handler's `seen` `Set`
   pattern, defensive against the view potentially returning more than one
   assignment row per domain).
4. Respond `{ version: 'v1', correlationId: req.correlationId, data: {
   domains, tenantDomainCount: domains.length, tenantId: req.tenantId ?? null,
   isPlatformAdmin: Boolean(req.isPlatformAdmin) } }`.

**Error handling**: any Supabase query failure → `500` with a structured
`{ error, code: 'PLATFORM_DOMAINS_QUERY_FAILED', correlationId }` body.
`DomainService.ts` already has a client-side fallback
(`fallbackAuthorizedDomains`) for exactly this case, so a 500 here degrades
gracefully on the frontend rather than breaking the dashboard — consistent
with how the rest of this feature already behaves.

## Testing

**No existing precedent to follow**: neither `uim-api` nor `finance-api` (nor,
by extension, any other service checked) has a single `*.test.ts` file for
any route today, and neither has a `jest.config.cjs` — there is no test
framework wired into `uim-api` at all.

**What actually shipped**: per the plan owner's explicit scoping decision
(Global Constraints in the implementation plan), no automated tests were
written for this route — not an oversight, a deliberate choice to avoid
standing up a test framework for one small, low-risk route with no existing
pattern to follow. Verification instead consisted of `npm run build`
type-checking locally, followed by live end-to-end checks against the
deployed VPS (documented in the plan's Task 3): confirming the route exists
and rejects unauthenticated requests with `401` (not `404`/`500`), and
confirming a real request reaches either a real domains list or the
`401 NO_TENANT_ASSIGNMENT` branch, as opposed to the previous fall-through
to the SPA or a blanket 404.

## Out of scope

- `domain-assignments`, `domain-config`, `franchises` — deliberately deferred
  per the scoping decision above. If any of these becomes a real priority
  later, each gets its own brainstorm/spec/plan cycle; `franchises` in
  particular has an unwired-but-real Next.js implementation
  (`src/pages/api/v1/franchises.ts`) worth reading first as a reference, since
  it already encodes real RBAC/tenant-scoping business rules the dev-mode
  handlers for the other three endpoints don't.
- Applying the `isPlatformAdmin`-exposure middleware change to `crm-api`'s and
  `sales-api`'s copies of `auth.middleware.ts` — deferred until one of those
  services actually needs it.
- Any change to RLS policies — they're already correct and this design
  doesn't rely on them (the new route uses the service-role client with
  explicit filtering instead).
