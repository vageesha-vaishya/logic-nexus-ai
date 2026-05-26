# sosservices.online — Parent Marketing Site Redesign Scope

**Date:** 2026-05-25
**Repo to change:** `github.com/vimalbahuguna/sosservices-marketing` (Astro 6 + Tailwind v4 + MDX, deployed on Coolify)
**Sister sites (out of scope for this round):** `logicnexus-marketing`, `aviation-ai-pro-marketing`, `sthira-marketing`, `amro-pro-marketing`

## 1. The diagnosis

The current site is **structurally competent but generically forgettable.** It looks like what a strong engineer ships with a Tailwind UI starter kit and stops at "it works." That's the gap between "competent" and "wins on first impression."

Six specific weaknesses, in order of impact:

1. **No product imagery.** Five product cards, zero screenshots. Linear shows Linear. Vercel shows a deploy. We show five rectangles with text. Buyers want to see the product.
2. **Engineering metrics, not buyer metrics.** "209 API endpoints · 110 typed schemas · 11 alert rules" is what you put in a hiring deck. Buyers want outcomes ("aircraft tracked", "shipments processed", "uptime") — even if some are projections.
3. **No social proof.** Zero customer logos, zero testimonials, zero certification badges. Even placeholders ("SEBI registered · EASA-aligned · Design partners under NDA") would beat the current blank.
4. **Passive CTAs.** "See our products" + "Talk to us" is generic. Category leaders use active first-CTAs ("Start free", "Book demo", "Get a quote in 2 min").
5. **No signature visual.** White-on-white-on-light-gray with no defining hook. Linear has dark gradient + motion. Stripe has illustrated workflows. We have nothing memorable.
6. **Product-card chaos.** Five products at five different maturity levels rendered with equal visual weight. First-time visitor can't tell which one to click.

What's already good (keep): the hero copy ("Practical SaaS for operators who'd rather get things done.") is sharp. The IA is sane. The bones are clean.

**Diagnosis in one line:** the writing has an opinion; the visual design doesn't.

## 2. Audience + job

The parent site's only job is **to convince an operator that SOS Services can build real software for serious operators**, then route them to the right product subdomain.

Three buyer profiles land here:
- Operations / ops director evaluating logistics or CRM → routes to Logic Nexus
- Aviation MRO / safety officer / CAMO → routes to Aviation AI Pro or AMRO Pro
- Retail investor → routes to Sthira (usually direct, occasionally via parent)

Engineering / talent / press is a secondary audience handled by the existing "Engineering" nav link.

## 3. Visual direction

Pick a *signature* — one defining visual move. Recommend: **dark hero (charcoal / near-black) with a single vivid accent**, plus a screenshot carousel as the hero visual.

Reference points to match in taste (not copy):
- **Linear** — dark hero, bold display typography, subtle motion
- **Vercel** — bold typography contrast, generous whitespace
- **Stripe** — illustration + real UI samples
- **Notion** — clear product showcase, simple CTAs

NOT like: Salesforce/Oracle enterprise marketing, default Tailwind starter.

Specifics:
- **Color:** dark hero (slate-950 or near-black), accent yellow OR electric blue OR emerald — pick *one* and use it consistently across the site
- **Typography:** display-weight (700+) for hero headline, generous size jumps between H1/H2/body
- **Motion:** subtle. Scroll-triggered fade-ups for sections, counter animations for outcome metrics, gentle hover lifts on product cards. Nothing flashy.
- **Density:** spacious in the hero, denser below

## 4. Page structure (text wireframe)

Section-by-section, top to bottom:

```
NAV  (slim, sticky)
  Logo · Products · Engineering · About · Contact      [Talk to founder] CTA

HERO  (dark bg, full viewport on desktop)
  Eyebrow: VENTURE STUDIO · ONE ENGINEERING TEAM
  H1: For operators, not pitch decks.
  Sub: One studio. Every platform built to ship.
  CTA primary:   [See products ↓]
  CTA secondary: [Talk to founder →]
  Visual:        Screenshot carousel cycling through 5 product UIs
                 (5-second cycle, pause on hover)

TRUST ROW  (thin band, dark or contrasting color)
  "Trusted by operators in" + 3-4 logos OR badges
  Fallback if no live customer logos:
    SEBI registered · EASA-aligned · India-incorporated · Design partners under NDA

PRODUCTS  (asymmetric layout, NOT equal-weight)
  Lead card (full-bleed, larger):
    Logic Nexus OR Sthira — whichever is most mature/most-paying
    Includes: product screenshot, value prop in 1 line, maturity badge ("Live"),
              concrete CTA ("Start Logic Nexus free" / "Open Sthira account")
  Supporting cards (2x2 grid below):
    AMRO Pro, Aviation AI Pro, Customs Pro
    Smaller: mini-screenshot or icon, 1-line value, maturity badge,
             CTA ("Book demo" / "Join pilot" / "Coming Q3 2026")
  Maturity badges visible on every card: Live · Pilot · Beta · In Development

OUTCOMES  (replace current metrics bar — biggest single change)
  4 stats, each tied to a buyer-relevant outcome. Label projections honestly:
    "₹X processed in shipments"           Logic Nexus (real or projected)
    "Y aircraft monitored"                Aviation AI Pro / AMRO Pro
    "Z retail portfolios under guidance"  Sthira
    "99.9% uptime SLA"                    platform-wide
  Footnote if projections: "Targets for Q3 2026 — pilot customers in design"
  Counter animation on scroll-into-view.

HOW WE WORK  (keep, lightly polish)
  Current 3-col block. Tighter copy, add subtle icons.

ENGINEERING DIFFERENTIATORS  (new, optional but high-leverage)
  Why SOS Services vs. a competitor — 3 strong claims with 1-paragraph proof:
    - Multi-tenant from day 1 (not retrofitted later)
    - Compliance built in (SEBI / EASA / GST), not bolted on
    - Owned services, no vendor lock-in
  Each links to a relevant engineering post or product page.

PROOF  (new — even minimal beats blank)
  Pick whichever is real today:
    - Testimonial quote (founder, design partner, advisor) with name + role
    - Anonymized design partner descriptor ("Mid-sized Indian logistics
      operator running 47 lanes")
    - Case study card linking to a longer write-up

FOOTER  (keep)
```

## 5. Content strategy

- **Hero copy** — keep current line. Already strong.
- **Metrics** — replace engineering stats with operator-outcome stats. Real numbers preferred; if projections, label honestly with target date. Never use vague "trusted by enterprises" without a number.
- **CTAs** — every product card gets its own active CTA. No more generic "Read more" everywhere.
- **Voice** — confident but not bro-y. Specific over abstract. Numbers > adjectives. "₹47 Cr in shipments" beats "Trusted by enterprises."
- **Maturity honesty** — every product card shows its actual maturity badge. Don't pretend Customs Pro is shipping when it's in development.

## 6. Asset list (what to produce before build)

| Asset | Source | Effort |
|---|---|---|
| 5 product screenshots (1 per product) | Real app captures from this repo + Sthira mobile + AMRO Pro demo | M — capture + retouch (1 day) |
| 1 dark-mode hero background or pattern | New design or Tailwind gradient | S (30 min) |
| 4 outcome metrics (real or projected, labeled) | Founder + ops data | S (decide values, 30 min) |
| 3-4 trust badges (SEBI, EASA, etc) | Existing certifications or "in progress" wording | S (1 hour) |
| 1-2 testimonial quotes OR 1 anonymized design-partner descriptor | Founder + advisor outreach | M (1-3 days lead time) |
| Accent color pick (yellow / blue / emerald) | Founder decision | S (1 hour) |

## 7. Tech notes (from `[[project_marketing_site]]`)

- Astro 6 + Tailwind v4 + MDX, pinned to **vite 7** (vite 8 + @tailwindcss/vite still incompatible)
- YAML-frontmatter gotcha: bullets with `:` or `>` must be single-quoted, or Astro parses as objects
- Deploy: Coolify app UUID `im6jdbfgw1n0827wn1sfo1uj`, deploy key `t14186bg72npfpqrzwbm2gxp` (per memory)
- Existing form endpoint: `marketing-inquiry` Edge Function — CORS now correct for all 5 sites (commit `1b09928e`)
- Each new MDX content type: schema in `src/content.config.ts`

## 8. Phased execution

**Phase 1 — Structure (sprint 1, ~3 days)**
- Restructure homepage to new section order (hero → trust → products → outcomes → how → engineering → proof → footer)
- Replace metrics bar with 4 outcome metrics + projection labels
- Asymmetric product layout: 1 lead + 2x2 supporting
- Per-product active CTAs
- Maturity badges visible on every card

**Phase 2 — Signature (sprint 2, ~2 days)**
- Dark hero implementation + accent color
- Screenshot carousel as hero visual (Astro Image component)
- Scroll-triggered fade-ups, counter animations
- Typography polish (display weights, size scale)
- Trust row with badges

**Phase 3 — Proof (sprint 3, ongoing)**
- Real testimonials as design partners ship
- Case study card + linked write-up
- Engineering differentiator posts (3) with proof points
- Real customer logos as pilots convert

## 9. Out of scope

- Blog / CMS migration
- Multi-language (.in is the same as .online for now)
- Pricing page (lives on product subdomains)
- Status page
- Press kit
- `account.sosservices.online` SSO portal
- Redesign of the 4 product subdomains (separate scope — do parent first, learn, then propagate the patterns)

## 10. Success criteria

This redesign succeeds if, after Phase 1, a stranger landing on `sosservices.online` for the first time can in under 30 seconds:

1. Tell what SOS Services builds and for whom
2. See a real product (not a coloured rectangle)
3. Identify which product is the lead vs. early-stage
4. Know what to click next (not "Talk to us" — a real action per product)
5. See at least one external trust signal (badge, certification, or partner descriptor)

If any of those five fail, we ship Phase 2. If they all pass at Phase 1, Phase 2 becomes polish-not-fix.

## 11. Decisions to make before build

Three blockers I can't decide for you. Answer these and I'll execute Phase 1:

1. **Accent color** — yellow / electric blue / emerald?
2. **Lead product** — Logic Nexus (most mature) or Sthira (most customer-pull)?
3. **Outcome metrics — real or projected?** If real, what are the numbers today? If projected, what targets are you comfortable labeling?
