# Platform brand architecture — design

Date: 2026-05-22 · Audience: solo operator + future contributors · Status:
locked, pending implementation

## Why now

The unified onboarding work (see
`docs/plans/2026-05-22-unified-platform-onboarding-design.md`) replaced
the legacy signup chain but the cross-cutting brand surfaces still tell
the wrong story. The `/auth` login page currently shows "SOS Logistic
Pro Enterprise" + a truck-shield logo — a logistics product identity on
a platform that now serves Markets / Sthira retail / AMRO / Banking /
Trading / Insurance / Customs / Telecom / Real-estate / E-commerce
domains. The codebase also carries three competing umbrella names —
"Logic Nexus AI" (early codename), "SOS Services" (tenant slug),
"SOS Logistic Pro Enterprise" (login page) — each surfacing in different
places. Brand architecture is the cross-cutting decision that fixes all
of them at once.

## Locked decisions

| # | Topic | Choice | Rationale |
|---|---|---|---|
| 1 | Brand architecture | **Hybrid by audience.** B2C consumer brands standalone (Sthira); B2B products under SOS umbrella; SOS Services is the parent / legal entity | Sthira already has a real consumer brand kit and shouldn't lose momentum; B2B buyers benefit from vendor consolidation |
| 2 | Naming convention | **Bare with qualifier when needed.** "SOS Logistics", "SOS AMRO" — but "SOS Markets Advisor" because retail = Sthira and we differentiate the B2B variant | Shortest unambiguous name; sets a clear rule for future products |
| 3 | Logo system | **Sthira-exception.** Sthira keeps its standalone serif wordmark; every B2B product uses one SOS master mark + product name in plain type | Combines operational simplicity (one B2B logo to maintain) with respecting the consumer-brand standalone status |
| 4 | Login chrome | **Audience-aware (2 variants).** Sthira-branded when `?intent=retail` / `/sthira/*`; SOS-neutral everywhere else | Respects the Sthira-exception rule; no duplicate routes — one `if` in `<Auth>` reading searchParams |
| 5 | Color system | **Neutral SOS chrome + per-domain accent strip.** Umbrella has a calm slate identity; active product expressed by a 4px accent strip + small dot in topbar | Gives the umbrella a real identity, makes active product clear, no chrome rewrite per domain |
| 6 | Tenant white-labeling | **Dashboard only.** Tenants can override logo + accent + display-name inside `/dashboard/*`; pre-auth surfaces (auth, signup, invite, welcome) always show SOS chrome | Front door always belongs to the platform; tenant identity expressible once inside; defers Enterprise-tier subdomain white-label as a paid upsell |

## Brand architecture (four-tier system)

```
                    ┌─────────────────────────────────────┐
                    │   SOS SERVICES (parent / holding)    │
                    │   Legal entity • invoices • corp     │
                    │   Invisible to retail customers      │
                    └──────────────┬───────────────────────┘
                                   │
                ┌──────────────────┼────────────────────────┐
                │                  │                        │
       ┌────────▼────────┐  ┌──────▼──────────────┐   ┌─────▼────────────┐
       │  CONSUMER (B2C) │  │  B2B UMBRELLA       │   │  TENANT BRAND    │
       │  Standalone     │  │  "SOS …"            │   │  (white-label,   │
       │                 │  │                     │   │   dashboard only)│
       │  • Sthira       │  │  • SOS Logistics    │   │                  │
       │  • (future B2C  │  │  • SOS Markets      │   │  Per-tenant      │
       │     siblings)   │  │       Advisor       │   │  logo + accent   │
       │                 │  │  • SOS AMRO         │   │  + display name  │
       │  Cream / copper │  │  • SOS Banking …    │   │  override inside │
       │  serif wordmark │  │  Neutral SOS chrome │   │  /dashboard/*    │
       │  Own app icon   │  │  + domain accent    │   │                  │
       └─────────────────┘  └─────────────────────┘   └──────────────────┘
```

**Rules of the road**

- **SOS Services** is the parent / legal / billing brand. Appears on invoices, contracts, the corporate "About" page. *Not* a customer-facing product.
- **Consumer brands** (Sthira today) are standalone — own logo, palette, mobile app, marketing tone. Umbrella stays invisible. Future B2C siblings inherit the same standalone treatment.
- **B2B umbrella** is "SOS + product name" with one shared visual system (one logo, one type, one neutral palette, one domain accent). New B2B products inherit everything for free.
- **Tenant brand** is a per-customer override inside the dashboard only; covers logo, accent, display name (Section "Tenant white-labeling" below).
- **Naming rule:** bare ("SOS Logistics") unless the category collides ("SOS Markets Advisor" because retail = Sthira; "SOS AMRO" because the acronym is already specific).

## Canonical names + writing voice

| Audience | Surface name | Codebase identifier | Domain code |
|---|---|---|---|
| B2C retail | **Sthira** | `sthira-retail` | `SOS-RETAIL` franchise on `markets` domain |
| B2B logistics | **SOS Logistics** | `logistics` | `logistics` |
| B2B advisor firms | **SOS Markets Advisor** | `markets-advisor` | `markets` (B2B side) |
| B2B aviation MRO | **SOS AMRO** | `amro` | `amro` |
| Future B2B | **SOS Banking / Trading / Insurance / Customs / Telecom / RealEstate / Ecommerce** | matches `platform_domains.code` | each domain code |
| Parent / legal / invoices | **SOS Services** | `sos-services` tenant slug | n/a |

**Strings to retire (with replacements):**

- "SOS Logistic Pro Enterprise" → **SOS Services** (login page) or **SOS Logistics** (product context)
- "Logic Nexus AI" → **SOS Services** (parent — early codename, shouldn't surface)
- "Logistics & Supply Chain" → **SOS Logistics** (drop long-form)

**Voice per audience:**

- **Sthira** (B2C retail) — calm, plain Hindi-rooted English, warm "you", no jargon. Inherited from existing Sthira copy.
- **SOS B2B** — operational, credible, lightly formal. Speaks to people running businesses. No "rockstar" / "ninja" slang.
- **SOS Services / corporate / invoices** — clipped legal-leaning. "SOS Services Pvt. Ltd. is the seller of record."

## Logo + typography

**Two logos, not five-plus:**

1. **SOS Services master logo.** Used everywhere except Sthira surfaces. Today's truck-shield retires. New SOS mark needs to:
   - Read as the parent brand, not any specific product
   - Work as a 24px favicon, 64px topbar logo, 512px app icon
   - Pair with the product name in plain type ("SOS Logistics")
   - Direction: geometric "S" or shield monogram, neutral palette only (no truck, no chart, no plane). Delivered in mono + colour + reverse.

2. **Sthira wordmark.** Existing copper serif "Sthira" stays exactly as is. Surfaces only on Sthira routes / `?intent=retail` login variant.

**No per-product logos** in the B2B tier. All inherit SOS master + product name in type.

**Typography (two systems):**

- **SOS B2B + corporate** — system sans (`-apple-system, "Inter", sans-serif` per existing). One family, three weights (400 / 500 / 700). No serif except long-form legal.
- **Sthira** — keeps existing serif + sans pairing (`Sthira Serif` / Fraunces fallback + sans body). Already wired in `src/index.css`.

**Favicons + app icons:**

- `sosservices.online` → SOS master favicon. Used at `/`, `/auth`, `/welcome`, `/signup/*`, `/dashboard`, `/invite/*`.
- Sthira mobile (Capacitor) keeps existing copper icon.
- Future B2B mobile apps inherit SOS master.

## Color palette

**SOS-neutral chrome** (B2B + corporate umbrella):

| Token | Hex | Role |
|---|---|---|
| `--sos-ink` | `#0F172A` | Primary text, dark surfaces, master-logo background |
| `--sos-slate` | `#334155` | Secondary text, borders |
| `--sos-mist` | `#F8FAFC` | App background |
| `--sos-fog` | `#E2E8F0` | Card borders, dividers |
| `--sos-copper` | `#B45309` | Primary CTA, link, focus ring — single warm accent |

The umbrella deliberately reads calm, neutral, professional — no domain implied. One warm CTA color is the only branded element on otherwise greyscale chrome.

**Per-domain accent strip** (4px top strip + small dot beside active-membership name — the *only* place these colors appear on B2B surfaces):

| Domain | `--domain-accent` |
|---|---|
| `logistics` | `#1D4ED8` |
| `markets` (advisor) | `#059669` |
| `amro` | `#EA580C` |
| `banking` | `#4338CA` |
| `trading` | `#DC2626` |
| `insurance` | `#0D9488` |
| `customs` | `#D97706` |
| `telecom` | `#0891B2` |
| `real_estate` | `#57534E` |
| `ecommerce` | `#DB2777` |

**Sthira (preserved):** `--sthira-cream` `#FAF7F2`, `--sthira-copper` `#B47545`, `--sthira-ink` `#1A1614`, `--sthira-navy` `#1B2237`, `--sthira-fog` `#EDE6DC`. All existing tokens in `src/index.css` unchanged.

**Implementation:** `--sos-*` and `--domain-accent` tokens added to `src/index.css`. A `useDomainAccent()` hook reads `activeMembership.domain_code` and sets `--domain-accent` on `:root`. `DashboardLayout` renders the 4px strip via `style={{ background: 'var(--domain-accent)' }}`.

## Surface-by-surface map

| Surface | Chrome | Logo | Name strings | Accent |
|---|---|---|---|---|
| `/auth` (no `?intent=retail`) | SOS-neutral | SOS master | "Welcome back to **SOS Services**" + "Sign in to continue" | none |
| `/auth?intent=retail`<br>or `/sthira/auth` | Sthira | Sthira wordmark | "Welcome back to **Sthira**" | none |
| `/welcome` | SOS-neutral | SOS master | Already correct | none |
| `/signup` (domain picker) | SOS-neutral | SOS master | Already correct | none |
| `/signup/:domain` | SOS-neutral | SOS master | "Create your **SOS Logistics** account" (product name from domain param) | none |
| `/sthira/signup` | Sthira | Sthira wordmark | "Open your **Sthira** account" | none |
| `/invite/:token` | SOS-neutral | SOS master | "Join {tenant} on **SOS Services**" | none |
| `/dashboard` (B2B) | SOS-neutral chrome + sidebar | SOS master in topbar | Active membership name in switcher | **4px strip** at top of main panel + small dot in switcher, color from active domain |
| `/dashboard/markets/retail/*` (Sthira) | Sthira mobile shell | Sthira | Unchanged | n/a |
| Email templates | SOS letterhead + product in subject ("[SOS Logistics] You've been invited") | SOS master in header | "Sent from SOS Services" footer | optional product in subject |
| Invoices | SOS Services Pvt. Ltd. letterhead | SOS master | "SOS Services Pvt. Ltd. is the seller" | n/a |
| Mobile app icons | Sthira keeps copper icon; future SOS-umbrella app uses SOS master | — | — | n/a |

## Tenant white-labeling

`tenants.branding_settings` jsonb (already exists) accepts:

```typescript
{
  logo_url?:     string;   // overrides SOS master logo INSIDE dashboard only
  accent_color?: string;   // overrides per-domain accent strip color
  display_name?: string;   // overrides "{tenant.name}" in topbar
}
```

**Pre-auth surfaces always show SOS chrome** — they're the platform's front door, not the tenant's. Once inside `/dashboard/*`, overrides apply. `tenant_admin` can configure these from Settings → Branding.

**Sthira retail dashboards ignore `branding_settings`** — Sthira chrome is sacred.

## Implementation phasing

| Phase | Scope | Effort |
|---|---|---|
| **BR-1** | Brand tokens: add `--sos-*` to `src/index.css`. Map `domain_code` → `--domain-accent`. Build `<SosLogo />` + `<DomainAccentStrip />`. Retire "Logic Nexus AI" / "SOS Logistic Pro Enterprise" strings. | ~1 d |
| **BR-2** | Audience-aware `/auth` chrome — Sthira variant on `?intent=retail` / `/sthira` referrer, SOS-neutral otherwise. Refresh `<Welcome />` + `<SignupForm />` + `<InviteAccept />` copy + logos. | ~1 d |
| **BR-3** | Mount `<DomainAccentStrip />` in `DashboardLayout`. Topbar membership switcher gains per-domain dot. Wire `useDomainAccent()` from `activeMembership.domain_code`. | ~1 d |
| **BR-4** | Settings → Branding page. Tenant logo upload (Supabase Storage), accent picker, display-name override. Update `<TopBar />` to prefer `branding_settings` inside dashboard. | ~2 d |

Total ~5 days. BR-1 unblocks the rest. BR-2 and BR-3 can run in parallel after BR-1. BR-4 is independent and can ship last.

**SOS master logo blocker:** commission the mark before BR-1 ships. Until it lands, fall back to a temporary type-only mark ("SOS" set in heavy sans on `--sos-ink`).

## Documented graduation paths (intentionally deferred)

- **Enterprise full white-label** (subdomain + auth pages too — Q6-C upgrade for Enterprise tier)
- **Per-B2C-sibling brand kits** as future consumer products arrive
- **Marketing site at `www.sosservices.online`** (separate property; uses SOS-neutral palette + product cards as the landing page)
- **Email + invoice template overhaul** (BR-4 covers in-app surfaces; transactional templates are a follow-on)
- **Per-product mobile apps** (only Sthira has one today; future B2B apps would inherit SOS master)

## References

- `docs/plans/2026-05-22-unified-platform-onboarding-design.md` — the onboarding architecture this branding layer dresses
- `docs/plans/2026-05-21-self-onboarding-wizard-design.md` — Sthira retail wizard (the existing standalone consumer brand)
- `docs/plans/2026-05-20-sthira-mobile-onboarding-and-markets-ux-design.md` — Sthira mobile shell brand kit
- `src/index.css` — existing brand tokens (Sthira section to keep, new `--sos-*` tokens to add in BR-1)
- `src/features/markets/manifest.ts` — the existing manifest where domain brand tokens already live for Markets (`hybridWithTenantBranding: true`)
