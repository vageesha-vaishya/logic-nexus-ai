# SOS Services brand-usage guide

Audience: anyone placing the SOS Services / Sthira / per-domain marks
on any surface — product UI, marketing site, decks, social, email,
invoices.

Companion docs:
- `docs/plans/2026-05-22-platform-brand-architecture-design.md` (BR0 architecture)
- `docs/plans/2026-05-22-brand-logos-design-brief.md` (mark spec)

> All marks below are **placeholders** today. The commissioned designer
> work (see brief) will replace them in-place — same file paths, same
> React component APIs. Anything using `<SosLogo />`, `<SthiraMonogram />`,
> or `<DomainMarketingIcon />` keeps working when the real assets land.

## The three marks

### 1. SOS master mark

The umbrella mark for SOS Services and every B2B product under it.

- **In React:** `<SosLogo size={64} variant="default" showWordmark productName="Logistics" />`
- **As an SVG asset:** `src/assets/branding/sos-mark-{dark,light}.svg`
- **Two variants:**
  - `default` — white "S" on `--sos-ink` (#0F172A). Default everywhere.
  - `light` — `--sos-ink` "S" on `--sos-mist` (#F8FAFC) + 1px `--sos-fog` (#E2E8F0) inner stroke. Use on light-on-light surfaces where the dark variant would visually float.
- **Minimum size:** 16px (favicon). Below this, the curves of the "S" degrade.
- **Clear space:** at least 25% of the mark's edge length on every side.
- **Never:** rotate, recolor outside the locked palette, stretch the aspect ratio, or add shadow / glow / gradient.

### 2. Sthira monogram

Small-surface mark for Sthira retail. The full Sthira wordmark stays for headers / marketing / mobile shell — the monogram is only for surfaces where the wordmark won't fit.

- **In React:** `<SthiraMonogram size={48} variant="default" withContainer />`
- **As an SVG asset:** `src/assets/branding/sthira-mark-{default,reverse}.svg`
- **Two variants:**
  - `default` — `--sthira-copper` (#B47545) "S" on `--sthira-cream` (#FAF7F2). Favicon, app icon, social profile.
  - `reverse` — `--sthira-cream` on `--sthira-navy` (#0F1A2E). Dark push notifications, dark marketing.
- **Visual distinctiveness:** the monogram keeps the **thick-thin stroke contrast** of the wordmark. The SOS master "S" is monoweight. The two must never be mistakable — a Sthira retail user with an SOS workspace will see both in the browser at the same time.
- **Never:** swap the monogram in for the wordmark in headers — the wordmark is what carries the consumer brand at large sizes.

### 3. Per-domain marketing icons

A family of 10 monoline pictograms — one per active platform domain — for marketing decks, the website's product grid, social posts.

- **In React:** `<DomainMarketingIcon domain="logistics" size={80} variant="color" />`
- **As an SVG asset:** `src/assets/branding/domains/{domain}-icon-{color,mono}.svg`
- **Two variants:**
  - `color` — domain accent fill + white pictogram. Default for grid layouts.
  - `mono` — `--sos-ink` fill + white pictogram. Use when the surface already carries the domain accent elsewhere and the icon should sit quietly.
- **Marketing-use only** — in-app surfaces stay on the SOS master mark per BR0. Don't reach for these from inside `/dashboard/*`.

## Color tokens (canonical)

| Token | Hex | Used for |
|---|---|---|
| `--sos-ink` | #0F172A | SOS master dark variant background, primary text |
| `--sos-mist` | #F8FAFC | Default app background, SOS master light variant background |
| `--sos-fog` | #E2E8F0 | Borders, inner stroke on the light SOS variant |
| `--sos-slate` | #334155 | Secondary text |
| `--sos-copper` | #B45309 | The one warm accent — CTA, link, focus ring |
| `--sthira-cream` | #FAF7F2 | Sthira app background, monogram default background |
| `--sthira-copper` | #B47545 | Sthira primary, monogram default fill |
| `--sthira-ink` | #2C2C2C | Sthira body text |
| `--sthira-navy` | #0F1A2E | Sthira monogram reverse background |
| `--domain-accent` | runtime | Per-active-membership domain color (set by useDomainAccent) |

## Per-domain accent colors

(see `src/components/branding/domainAccents.ts`)

| Domain | Hex |
|---|---|
| `logistics` | #1D4ED8 |
| `markets` | #059669 |
| `amro` | #EA580C |
| `banking` | #4338CA |
| `trading` | #DC2626 |
| `insurance` | #0D9488 |
| `customs` | #D97706 |
| `telecom` | #0891B2 |
| `real_estate` | #57534E |
| `ecommerce` | #DB2777 |

## Naming rules (when writing copy)

- Bare ("SOS Logistics") unless the category collides ("SOS Markets Advisor" because retail = Sthira; "SOS AMRO" because the acronym is already specific)
- Parent / legal name: **SOS Services** (use for invoices, contracts, the corporate About page)
- Retired strings: "SOS Logistic Pro Enterprise", "Logic Nexus AI" — do not introduce these in new code
- Tenant override: `tenants.branding_settings.company_name` replaces the topbar pill inside the dashboard only; pre-auth surfaces always say "SOS Services"

## Swap-in checklist (when commissioned assets arrive)

1. Replace each `src/assets/branding/*.svg` file in place — same names, same paths
2. Update `<SosLogo>` (`src/components/branding/SosLogo.tsx`): replace the inline `S_PATH` + `<rect>` with `<img src="@/assets/branding/sos-mark-dark.svg">` or an inlined SVG component
3. Update `<SthiraMonogram>` similarly
4. Update `<DomainMarketingIcon>` — swap the `DOMAIN_ICONS` map's `icon` values from lucide imports to the commissioned per-domain SVG components
5. Drop the source `.fig` into `docs/branding/sos-brand-system.fig` (or similar) for future designer reference
6. Update this doc's "All marks below are **placeholders** today" disclaimer
