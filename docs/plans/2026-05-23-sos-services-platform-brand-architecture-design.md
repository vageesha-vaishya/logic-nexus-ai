# SOS Services — Platform & Brand Architecture Design

**Date:** 2026-05-23
**Status:** Design — agreed, not yet implemented
**Author:** vimalbahuguna (with Claude)
**Related:**
- `docs/plans/2026-05-20-multi-domain-platform-sequence-design.md` (internal domain independence inside one product)
- `docs/plans/2026-05-18-retail-investment-platform-design.md` (Sthira product spec)
- Memory: `project_coolify_access.md` (current Coolify topology with 5 services live on `sosservices.online`)

## Context

After today's Coolify migration, `sosservices.online` serves the Logic Nexus Vite SPA at the root domain, and four backend services at `api.`, `uim.`, `amro.`, `markets.` subdomains. The product engineering plan (the 2026-05-20 multi-domain doc) addresses *internal* independence between modules inside one product.

Open question: at the outer shell, **is SOS Services one product with many modules, a holding brand with distinct products, or a builder's portfolio?**

This design answers that and lays out the platform/brand architecture, tech stack, and migration path.

## Decisions

| Decision | Choice | Notes |
|---|---|---|
| Business shape | **Holding brand with distinct products** | SOS Services is the parent (Microsoft/Atlassian model). Products underneath have their own brand identity. |
| Product count target | **10+ products** ("venture studio" scale) | Logic Nexus, Sthira, AMRO Pro exist or are emerging; more planned. |
| Identity model | **Hybrid: shared SSO, separate billing/usage** | One login across products; each product has its own subscription. |
| Domain pattern | **Per-product domains** (Atlassian model) | `sosservices.online` is showcase only; each product gets its own domain. |
| Hosting (v1) | **Hostinger VPS via Coolify** | Move parent marketing to Cloudflare Pages in Phase 2 (when product marketing site #2 ships). |

## Architecture

### Four layers

```
Layer A — Parent brand (sosservices.online / .in / .com)
  /                Studio showcase, products grid
  /products        Portfolio (data-driven from MDX)
  /about /team /careers /press
  /blog            (Phase 2)
  /security /legal

Layer B — Shared platform services
  account.sosservices.online    SSO + billing console (Supabase Auth + Stripe/Razorpay)
  status.sosservices.online     Multi-product uptime
  docs.sosservices.online       Unified docs portal (Astro Starlight)
  support.sosservices.online    Helpdesk (Plain / Crisp)
  cdn.sosservices.online        Shared assets (Cloudflare R2)
  admin.sosservices.online      Internal ops (Retool → custom)

Layer C — Product layer (per product)
  <product>.com                 Product marketing (Astro + MDX, branded)
  app.<product>.com             SaaS app (current Vite SPA)
  Examples:
    logicnexus.com / app.logicnexus.com    (Logistics)
    sthira.app / app.sthira.app             (Retail investing)
    amropro.com / app.amropro.com           (Aviation MRO)

Layer D — Mobile / native
  Each product can ship Capacitor apps (Sthira APK already exists).
  Marketing site /download links to Play/App Store.
  Native apps hit api.<product>.com (same backend as web).
  Auth via OAuth flow to account.sosservices.online.
```

### Key principles

1. **Parent domain is showcase-only.** Never the SaaS app. Users hitting `sosservices.online` either evaluate the company or click through to a product.
2. **Each product owns its own brand domain.** Marketing iterates fast without entangling other products' code.
3. **Shared services centralized under parent subdomains.** Identity, billing, status, support — one source of truth.
4. **`.in` mirrors `.online`** with geo-aware product highlighting (Indian visitors see Sthira up top; global visitors see Logic Nexus).

## Tech Stack

| Layer | Concern | Choice | Why |
|---|---|---|---|
| A — Parent marketing | Site generator | **Astro + MDX** | Static-first, ~0 JS, content collections, fast TTFB. |
| | Hosting (v1) | Hostinger VPS via Coolify (static build pack) | Already operational; zero new platform. |
| | Hosting (Phase 2) | Cloudflare Pages | Global edge, per-PR previews, $0. |
| | Forms | Cloudflare Worker + Resend | No backend. |
| | Calendar | Cal.com embed | Open-source, free. |
| | Analytics | Plausible | Privacy-first; don't pollute product PostHog. |
| | Geo-routing | Cloudflare Worker (edge rewrite) | `.in` and `.online` share deployment. |
| B — Identity/billing | Auth | Supabase Auth (already in stack) | Don't add Clerk/Auth0 until enterprise SSO is required. |
| | Payments | Razorpay (India) + Stripe (global) | Already integrated. |
| B — Other | Status page | cstate (static) | Free; upgrade to Instatus at 5+ products. |
| | Docs portal | Astro Starlight | Same stack as marketing. |
| | Helpdesk | Plain or Crisp free tier | Migrate when scale demands. |
| | CDN | Cloudflare R2 + Image Resizing | Already on CF. |
| | Admin tools | Retool → custom React+Supabase | Don't build custom until Retool feels limiting. |
| C — Product marketing | Stack | Astro + MDX (template per product) | Clone `marketing-site-template` repo, swap brand tokens. |
| C — Product app | Frontend | Vite + React + TS (current — KEEP) | Already shipping. |
| | Backend | Node/Express OR Python/FastAPI (per existing) | Match service to task. |
| | Multi-tenant | Path-based `/<tenant>/...` (current) | Move to subdomain-per-tenant only when a paying customer demands branded URL. |
| D — Mobile | Cross-platform | Capacitor (already in Sthira) | Reuse React codebase. |
| | CI/CD | Jenkins (already wired) | Don't rebuild what works. |
| Cross-cutting | Design system | shadcn/ui + Tailwind as `@sos/ui` package; per-product brand tokens override base |
| | Error tracking | Sentry — one project per product + one for infra |
| | Product analytics | PostHog — one project per product |
| | Email | Resend — modern, cheap, generous free tier |
| | DNS | Cloudflare for all (migrate `.in` from GoDaddy → CF when ready) |
| | CI templates | GitHub Actions reusable workflows ("deploy marketing site", "deploy product app") |
| | Deployment | Coolify on Hostinger VPS → second VPS or Fly/Render at product #5–7 |

**Cost at 5 products live:** ~$120/mo (Supabase Pro $25 + Sentry $26 + VPS $20 + Resend $20 + domains ~$15/mo amortized + buffer). Doubles around 10 products if you add a second VPS.

## Migration Path

### Phase 0 — Brand & domain decisions (this week, 1–2 hours)

| Action | Notes |
|---|---|
| Acquire `sosservices.com` | $10/yr; .com signals trust to international B2B/investors. |
| Acquire `logicnexus.com` (or .app/.us) | For Logic Nexus migration. |
| Acquire `sthira.app` | Complements existing `.in` plan. |
| Optionally acquire `amropro.com` | Defer until AMRO is commercially ready. |
| Fallback if domain budget is $0 | Use `logicnexus.sosservices.online`, etc. — slower brand independence. |

### Phase 1 — Stand up parent marketing (1–2 weeks)

Migration sequence — zero risk to production:

1. Build Astro repo `sosservices-marketing` with 5 content pages (hero, products grid, about, contact, footer).
2. Deploy to **temporary URL** `marketing.sosservices.online` via Coolify — zero impact on prod.
3. Review at temp URL until happy.
4. Cutover: in Coolify, edit two apps' `domains` fields:
   - Vite SaaS app: `https://sosservices.online,https://www.sosservices.online` → `https://app.sosservices.online`
   - Marketing app: `https://marketing.sosservices.online` → `https://sosservices.online,https://www.sosservices.online`
5. Redeploy both → Traefik regenerates labels → Let's Encrypt re-issues certs (~30 sec each).
6. Add 301 redirect in marketing site config: `/app/*` → `app.sosservices.online/*` for 6+ months.

**Result:** `sosservices.online` shows the brand showcase; the SaaS lives at `app.sosservices.online`.

### Phase 2 — Per-product brand migration (one product at a time, async)

For each product (Logic Nexus first):

1. Buy product domain (`logicnexus.com`).
2. Add to Cloudflare; copy the same DNS pattern used for `.online`.
3. Add domain to Coolify app: keep both URLs live during grace period — `https://app.logicnexus.com,https://app.sosservices.online`.
4. Stand up product marketing at `https://logicnexus.com` (Astro template clone).
5. Update mobile app build config (Capacitor) + Supabase Auth allowed redirect URLs.
6. After 60 days, drop the `app.sosservices.online` alias.

Per product: ~1 week. Sequence them as products mature commercially, not all at once.

### Risk controls

| Risk | Mitigation |
|---|---|
| Mobile app (Sthira APK) breaks | Mobile build reads `VITE_*` envs — when SaaS moves to subdomain, rebuild APK with new URL. Keep old URL routing as fallback. |
| SEO loss when root domain content changes | 301 redirects from `sosservices.online/app/*` → `app.sosservices.online/*`. Google preserves authority across 301s. |
| Auth redirect breakage | Update Supabase Auth allowed redirect URLs to include both old and new origins during transition. |
| User bookmarks | Keep old URLs serving via 301 for ≥6 months. |
| Coolify Traefik port cache (see `project_coolify_access`) | Verified-fix pattern: align app to whatever port Coolify caches. |

## First Concrete Slice (7–10 days)

### Day-by-day

**Day 1 — Decisions (60 min)**

- Check + buy domains: `sosservices.com`, `logicnexus.com`/`.app`, `sthira.app`.
- Decide content scope: hero + 5 product cards + about + contact. **No blog, no careers, no press kit, no roadmap — those are Phase 2.**
- Create empty GitHub repo: `vageesha-vaishya/sosservices-marketing`.

**Day 2–3 — Scaffolding**

```bash
npm create astro@latest sosservices-marketing -- --template blog
cd sosservices-marketing
npm i -D @astrojs/tailwind @astrojs/sitemap @astrojs/mdx
```

Folder shape:

```
src/
  content/
    products/         # one .mdx per product
    pages/            # about.mdx, contact.mdx
  pages/
    index.astro       # hero + products grid (reads content/products)
    products/[slug].astro
    about.astro
    contact.astro
  components/
    ProductCard.astro
    Footer.astro
    Header.astro
```

**Day 3–5 — Content draft**

Seed copy from existing module READMEs + package.json descriptions. Per product: 1-sentence positioning + 3 bullet features + a "Learn more →" link placeholder until product domains exist.

**Day 5–6 — Deploy to temp URL**

```
Coolify → New Resource → Public Git
  repo: github.com/vageesha-vaishya/sosservices-marketing
  build_pack: static
  install_command: npm ci
  build_command: npm run build
  publish_directory: dist
  domains: https://marketing.sosservices.online
```

**Day 6–7 — Cutover** (see Phase 1 steps 4–6 above)

**Day 8–10 — Polish + Phase 2 planning**

- Plausible Analytics installed.
- Resend or Cloudflare-Forms hooked to `/contact`.
- Cal.com booking link on `/contact` (optional).
- `robots.txt` + `sitemap.xml` verified.
- Sketch the Logic Nexus marketing site (Phase 2 starts).

## Out of scope for v1

| Skipping | Why |
|---|---|
| `account.sosservices.online` SSO portal | Not needed until product #2 launches with shared identity. |
| Per-product marketing domains | Wait until 1 product is commercially independent. |
| Blog, careers, docs portal | Add when there's real content / open roles to publish. |
| `.in` localization | After `.online` is solid; geo-routing via CF Worker is a 1-hour task later. |
| Move to Cloudflare Pages | Migrate in Phase 2 when you build product marketing site #2. |
| `status.sosservices.online` | Add when first customer asks "what's your uptime?" |

## Open questions

| Question | Resolution timing |
|---|---|
| Acquire `sosservices.com`? | Day 1 decision. |
| Logic Nexus's marketing brand domain? | Day 1 decision. |
| Hindi localization for Sthira marketing? | After Phase 1; needs translator. |
| Where do Stripe + Razorpay merchant accounts live (parent or per-product)? | Phase 2 design — likely parent. |
| Public roadmap per product? | Phase 2; needs product manager input. |

## Success criteria (Phase 1)

- `https://sosservices.online` serves the Astro marketing site, not the Vite SaaS.
- `https://app.sosservices.online` serves the Vite SaaS (now on `app.` subdomain).
- All Let's Encrypt certs valid for both URLs.
- Mobile app still works (Sthira APK unaffected or rebuilt with new URL).
- 301 redirects in place from old paths.
- Total infra cost increment: $0–60 in domain purchases; $0 monthly.
