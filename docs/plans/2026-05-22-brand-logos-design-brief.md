# SOS Services + Sthira + per-domain marketing icons — design brief

Date: 2026-05-22 · Audience: external designer / AI-assisted design
workflow operator · Status: locked spec, pending astrologer cross-check
before commissioning.

## Why now

The BR0 epic (see
`docs/plans/2026-05-22-platform-brand-architecture-design.md`) shipped
brand tokens + a four-tier brand architecture across the codebase, with
the SOS master mark rendered as a temporary type-only "SOS" placeholder
inside a rounded square. This brief is the spec a designer (or an AI →
designer-cleanup workflow) executes against to produce the real marks
that replace the placeholder.

In scope: the SOS Services master mark, a Sthira small-surface monogram,
and a per-domain marketing icon set for all 10 active
`platform_domains`. Out of scope: marketing site, app-icon platform
packaging, email + invoice template overhaul (those are separate BR-4
graduation paths).

## Locked decisions (brand brief)

Together with the nine BR0 decisions, this brainstorm locked these nine.

| # | Topic | Locked choice |
|---|---|---|
| 1 | Scope | SOS master + Sthira refinement + per-domain marketing icons. In-app chrome stays lean (only SOS master in product surfaces). |
| 2 | Visual languages | Hybrid by tier — SOS geometric / Sthira typographic-serif / per-domain monoline |
| 3 | SOS form direction | Letterform inside a contained shape |
| 4 | Container shape | Rounded square (~18–20% corner radius) — **pending Vedic / Vastu chart cross-check before commissioning** |
| 5 | Mark scaling | Single "S" mark used everywhere; full "SOS Services" wordmark renders separately in plain type |
| 6 | Letterform style | Pure custom letterform with one quiet signature move; no conceptual baggage |
| 7 | Color | Monochrome — white-on-ink default + ink-on-mist light variant. Two assets of one mark |
| 8 | Sthira | Preserve serif wordmark; **add** a Sthira "S" monogram for small surfaces (favicon, app icon, push, social) |
| 9 | Domain icons | Hybrid — object metaphor where iconic (truck, plane); abstract motion where clichéd (markets, banking, trading) |

## SOS master mark spec

**Container.** Rounded square, ~18–20% corner radius. Square aspect
ratio (1:1) at every size. Internal padding: "S" sits in the central
~60% of the square.

**The "S" itself.** Single custom glyph — not lifted from any existing
typeface. Confident geometric construction with **one** quiet signature
move. Directions to explore:

- Upper terminal cut flat (horizontal slice) instead of curling
- Slight optical thickening at the spine
- Off-axis spine angle (~67°) rather than 60° / 90°
- Asymmetric counter shapes (slightly fuller lower bowl)

Pick **one** and execute it well; stacking multiple signatures makes the
mark fussy. **Monoweight construction** (consistent stroke thickness),
no thick-thin contrast. Optical correction so the mark looks right at
16px, not mathematically perfect.

**Color variants (two assets):**

- **Default:** white "S" on `--sos-ink` (#0F172A) rounded square. App icons, dark surfaces, dashboard topbar, marketing decks.
- **Light:** `--sos-ink` "S" on `--sos-mist` (#F8FAFC) rounded square + 1px `--sos-fog` (#E2E8F0) inner stroke. White-site favicons.

**References (study, don't copy):** Stripe `S`, Spotify wordmark "S",
Anthropic monogram, Linear's mark, Snowflake's snowflake-S.

**Avoid:** thick-thin serif contrast, decorative flourishes, signal /
pulse / wave motifs, gradients, drop shadows, "S" tilted to suggest a
check mark or arrow.

## Sthira monogram spec (small surfaces only)

**Existing Sthira wordmark — preserved.** The copper serif "Sthira"
wordmark + Calm Wealth palette ships untouched in headers, marketing,
the mobile shell, the wizard.

**New: Sthira "S" monogram.** *Separate* glyph from the SOS master "S"
— must be obviously not-the-SOS-mark.

- **Container:** transparent SVG default; the designer also delivers a
  `--sthira-cream` rounded-square variant for the iOS / Android launcher.
- **The "S":** lifted from the existing Sthira serif wordmark; same
  family, same proportions, same copper. Soft serif terminals — these
  are the Calm Wealth signature. Stroke contrast (thick-thin) **kept**
  — this is the visual opposite of the SOS monoweight S. The two marks
  must never be mistaken for each other (a Sthira retail user with an
  SOS workspace will see both marks side by side in their browser).

**Color variants (two assets):**

- **Default:** `--sthira-copper` (#B47545) "S" on `--sthira-cream` (#FAF7F2)
- **Reverse:** `--sthira-cream` (#FAF7F2) "S" on `--sthira-navy` (#0F1A2E)

**References:** Caslon / Garamond capital "S"; Tiffany & Co. wordmark
"T" feel. Avoid Trajan-chiseled serifs (too archaic).

## Per-domain marketing icons (10 domains)

**Shared form factor:** every per-domain icon lives in the *same*
rounded square as the SOS master, same corner radius, same 60% interior
padding. Pictogram inside swaps per domain. This makes the set read as
one family on the marketing site product grid.

**Inside each square:** monoline pictogram, consistent stroke weight
across the set. Pure outline, no fills inside the pictogram.

**Color variants — two per domain:**

- **Color:** domain accent (from `DOMAIN_ACCENT_HEX`) filled rounded
  square, white monoline pictogram
- **Mono:** `--sos-ink` rounded square, white monoline pictogram

**Per-domain concept:**

| Domain | Accent | Approach | Pictogram concept |
|---|---|---|---|
| `logistics` | #1D4ED8 | Object | Side-view delivery truck — clean monoline, cab + box trailer, no wheel detail |
| `markets` | #059669 | Abstract | One clean upward-sweeping stroke (NOT a candlestick). 30° rising arc with a small endpoint dot. |
| `amro` | #EA580C | Object | Side-view aircraft silhouette — clean monoline, narrow body + wing |
| `banking` | #4338CA | Abstract | Three vertical columns of equal height (vault doors / pillars without a roof) |
| `trading` | #DC2626 | Abstract | Two arrows passing — one up-right, one down-left — forming an "X" of motion |
| `insurance` | #0D9488 | Object | Open umbrella canopy from above (concentric arc segments), no handle |
| `customs` | #D97706 | Abstract | A chevron / gate — two angled lines forming a `>` passage |
| `telecom` | #0891B2 | Abstract | Concentric arcs (signal waves) emanating from a single dot |
| `real_estate` | #57534E | Object | House roofline — pitched-roof outline, no walls, no door |
| `ecommerce` | #DB2777 | Object | Shopping bag (NOT a cart — bags read modern, carts look 2008) |

**System invariants:**
- All pictograms inscribed in the same logical bounding box at the same optical weight
- All rounded-square containers identical to the SOS master container
- No domain icon uses a letterform — letters reserved for SOS + Sthira

## Deliverables checklist

**SOS master (4 files):** `sos-mark-{dark,light}.{svg,png}` at 1024 / 512 / 256 / 192 / 128 / 64 / 32 / 16 px for PNG.

**Sthira monogram (4 files):** `sthira-mark-{default,reverse}.{svg,png}` at the same size set.

**Per-domain icons (20 SVG + 120 PNG):** for each of the 10 domains, `{domain}-icon-{color,mono}.svg` + PNG at 1024 / 512 / 256 / 128 / 64 / 32.

**Source file (1):** `sos-brand-system.fig` — single Figma file with components for the rounded-square container, "S" glyph, each pictogram, and color tokens as styles.

**Specification doc (1):** `brand-usage.md` — minimum clear space, minimum size, do / don't, hex tokens. Lands at `docs/branding/brand-usage.md`.

**Total:** ~150 files. Source `.fig` is canonical; everything else regenerates from it.

## Execution paths (pick one)

A) **External designer.** Brief + this doc + the BR0 architecture doc. ~₹1.5–3L INR mid-tier; 2–3 weeks.

B) **AI-assisted draft + designer cleanup.** Generate ~20 candidate "S" letterforms via Midjourney / Recraft / Firefly per the spec. Pick the best 2–3. Hand to a designer to vectorize, optical-correct, and ship the full deliverables. ~5–7 days, ~₹40–80k. **Recommended for momentum.**

C) **All-AI.** Not recommended for the parent brand mark — AI SVGs are usually crude and favicon-size legibility tends to fail.

## Pre-commission gate

**Run the locked design (rounded-square container + navy/copper palette + single "S") past a Vedic astrologer / Vastu consultant before committing budget.**

Two questions for them:
1. Is the shape + palette compatible with the founder's natal chart?
2. Is there an auspicious *mahurat* for commissioning and / or launching the mark?

If they raise concerns: container shape is the easiest to revisit
(hexagon, soft circle, and S-letterform-derived shapes from Q4 are the
back-up options). The palette is harder to change after BR0 shipped —
discuss with designer if so.

## Acceptance criteria

- Mark legible at 16px on a busy browser tab strip
- All 28 SVGs use single-path geometry (no embedded raster, no unused groups)
- 1024px renders hold up against iOS / Android adaptive-icon templates
- Source Figma file is component-based — adding domain N+1 is a duplicate-and-swap, not a rebuild

## Integration when assets land

1. Drop SVGs into `src/assets/branding/`
2. Replace the temporary `<SosLogo />` body with the real `sos-mark-dark.svg` import (one-file change in `src/components/branding/SosLogo.tsx`)
3. Wire the Sthira monogram into `SthiraSplashRoute` + favicons
4. Marketing icons stay un-imported in product code (marketing-only per Q1-C)
5. Add `docs/branding/brand-usage.md` reference in `CLAUDE.md`

## Documented graduation paths (deferred)

- Custom typeface for the SOS wordmark (system sans is fine until brand awareness compounds)
- Motion / animated variants (Lottie for splash, loading states)
- Per-domain icons promoted to in-app surfaces (currently marketing-only; could revisit if product team wants product-tinted Setup-cards)

## References

- `docs/plans/2026-05-22-platform-brand-architecture-design.md` — the brand-architecture decisions this brief executes against
- `src/components/branding/SosLogo.tsx` — current temporary placeholder (replace its render body with the real SVG once delivered)
- `src/components/branding/domainAccents.ts` — `DOMAIN_ACCENT_HEX` map of accent colors per domain (used by per-domain icon "color" variants)
- `src/index.css` — `--sos-*` and `--sthira-*` brand tokens (the source of truth for hex values)
