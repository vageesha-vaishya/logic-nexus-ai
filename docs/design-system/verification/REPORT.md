# Design System Verification Report

Generated 2026-09-14 at commit `fa7aad9b` by `npm run audit:design-system`. **Do not edit by hand.**

## What this is — and is not

- **Engines:** chromium 143.0.7499.4, firefox 144.0.2, webkit 26.0, msedge system channel.
- **WebKit stands in for Safari.** Same engine, but not Safari's shell, OS font stack, or iOS; a real Safari pass is still an open item.
- **ARIA snapshots are structure only** — this is not a screen-reader session (NVDA/JAWS/VoiceOver were not run); it catches missing names and landmarks, not announcement order or live regions.
- **Viewports** are emulated at 360/768/1280/1920; no real devices.
- Gates: layout integrity (no page-level horizontal scroll, no unscrolled overflow), axe-core WCAG 2.1 A/AA `serious`+`critical`, keyboard visible-focus/no-trap (1280 light), ARIA structure (1280 light). axe `moderate`/`minor` are reported, not gated.
- **WebKit's Tab skips links by default** (Safari reaches them with Option+Tab; Playwright's WebKit does not honour Alt+Tab); link focus visibility is not gated on WebKit, and links are not counted as Tab-reachable there.
- **`lead-detail` was measured with the CRM API down**: the page renders only "Lead not found" and a "Failed to load lead" toast, so its keyboard/ARIA cells fail the content-readiness gate and are listed under "Cells that did not complete" rather than scored.

## Running

```bash
# needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in the gitignored repo-root `env` file
npx playwright install               # chromium, firefox, webkit; msedge must be installed system-wide (channel: msedge)
npm run audit:design-system          # all 4 engines
npm run audit:design-system:quick    # chromium only
```

Start the backend services first (`npm run services:start`; each `services/*` package needs its own `npm install` beforehand) or CRM pages render with degraded data.

Run metadata:
- Backend services (npm run services:start) up: uim (mock); down: crm, amro — services/* deps not installed on this machine.
- Matrix cells and screenshots: full run at 770ba99b/b8292943 plus firefox contacts-list refills at ed6fcfa5 (unchanged this round).
- Keyboard (33) and ARIA (40) cells re-run at fa7aad9b with the content-readiness gate, trap/visible-focus measurement fixes and WebKit link-reachability rule; per-engine slices (chromium, firefox --workers=1, webkit --workers=1, msedge aria). 15 firefox cells stalled once at the #main-content step in a single ~10 min window (dashboard/auth passed in between) and were re-run sequentially; each completed normally. webkit leads-list aria was re-run after a concurrent setup login invalidated its session (operator error).
- lead-detail: 7 cells refused by the content gate — with the CRM API down the page renders only 'Lead not found'.

## Matrix — light mode

Cell = layout + axe gates for that page/engine/width. Click to open the screenshot.

| Page | chromium 360 | chromium 768 | chromium 1280 | chromium 1920 | firefox 360 | firefox 768 | firefox 1280 | firefox 1920 | webkit 360 | webkit 768 | webkit 1280 | webkit 1920 | msedge 360 | msedge 768 | msedge 1280 | msedge 1920 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| accounts-list | [❌](screenshots/accounts-list/chromium-360-light.png) | [❌](screenshots/accounts-list/chromium-768-light.png) | [❌](screenshots/accounts-list/chromium-1280-light.png) | [❌](screenshots/accounts-list/chromium-1920-light.png) | [❌](screenshots/accounts-list/firefox-360-light.png) | [❌](screenshots/accounts-list/firefox-768-light.png) | [❌](screenshots/accounts-list/firefox-1280-light.png) | [❌](screenshots/accounts-list/firefox-1920-light.png) | [❌](screenshots/accounts-list/webkit-360-light.png) | [❌](screenshots/accounts-list/webkit-768-light.png) | [❌](screenshots/accounts-list/webkit-1280-light.png) | [❌](screenshots/accounts-list/webkit-1920-light.png) | [❌](screenshots/accounts-list/msedge-360-light.png) | [❌](screenshots/accounts-list/msedge-768-light.png) | [❌](screenshots/accounts-list/msedge-1280-light.png) | [❌](screenshots/accounts-list/msedge-1920-light.png) |
| auth | [✅](screenshots/auth/chromium-360-light.png) | [✅](screenshots/auth/chromium-768-light.png) | [✅](screenshots/auth/chromium-1280-light.png) | [✅](screenshots/auth/chromium-1920-light.png) | [✅](screenshots/auth/firefox-360-light.png) | [✅](screenshots/auth/firefox-768-light.png) | [✅](screenshots/auth/firefox-1280-light.png) | [✅](screenshots/auth/firefox-1920-light.png) | [✅](screenshots/auth/webkit-360-light.png) | [✅](screenshots/auth/webkit-768-light.png) | [✅](screenshots/auth/webkit-1280-light.png) | [✅](screenshots/auth/webkit-1920-light.png) | [✅](screenshots/auth/msedge-360-light.png) | [✅](screenshots/auth/msedge-768-light.png) | [✅](screenshots/auth/msedge-1280-light.png) | [✅](screenshots/auth/msedge-1920-light.png) |
| contacts-list | [❌](screenshots/contacts-list/chromium-360-light.png) | [❌](screenshots/contacts-list/chromium-768-light.png) | [❌](screenshots/contacts-list/chromium-1280-light.png) | [❌](screenshots/contacts-list/chromium-1920-light.png) | [❌](screenshots/contacts-list/firefox-360-light.png) | [❌](screenshots/contacts-list/firefox-768-light.png) | [❌](screenshots/contacts-list/firefox-1280-light.png) | [❌](screenshots/contacts-list/firefox-1920-light.png) | [❌](screenshots/contacts-list/webkit-360-light.png) | [❌](screenshots/contacts-list/webkit-768-light.png) | [❌](screenshots/contacts-list/webkit-1280-light.png) | [❌](screenshots/contacts-list/webkit-1920-light.png) | [❌](screenshots/contacts-list/msedge-360-light.png) | [❌](screenshots/contacts-list/msedge-768-light.png) | [❌](screenshots/contacts-list/msedge-1280-light.png) | [❌](screenshots/contacts-list/msedge-1920-light.png) |
| dashboard | [❌](screenshots/dashboard/chromium-360-light.png) | [❌](screenshots/dashboard/chromium-768-light.png) | [❌](screenshots/dashboard/chromium-1280-light.png) | [❌](screenshots/dashboard/chromium-1920-light.png) | [❌](screenshots/dashboard/firefox-360-light.png) | [❌](screenshots/dashboard/firefox-768-light.png) | [❌](screenshots/dashboard/firefox-1280-light.png) | [❌](screenshots/dashboard/firefox-1920-light.png) | [❌](screenshots/dashboard/webkit-360-light.png) | [❌](screenshots/dashboard/webkit-768-light.png) | [❌](screenshots/dashboard/webkit-1280-light.png) | [❌](screenshots/dashboard/webkit-1920-light.png) | [❌](screenshots/dashboard/msedge-360-light.png) | [❌](screenshots/dashboard/msedge-768-light.png) | [❌](screenshots/dashboard/msedge-1280-light.png) | [❌](screenshots/dashboard/msedge-1920-light.png) |
| lead-detail | [❌](screenshots/lead-detail/chromium-360-light.png) | [❌](screenshots/lead-detail/chromium-768-light.png) | [❌](screenshots/lead-detail/chromium-1280-light.png) | [❌](screenshots/lead-detail/chromium-1920-light.png) | [❌](screenshots/lead-detail/firefox-360-light.png) | [❌](screenshots/lead-detail/firefox-768-light.png) | [❌](screenshots/lead-detail/firefox-1280-light.png) | [❌](screenshots/lead-detail/firefox-1920-light.png) | [❌](screenshots/lead-detail/webkit-360-light.png) | [❌](screenshots/lead-detail/webkit-768-light.png) | [❌](screenshots/lead-detail/webkit-1280-light.png) | [❌](screenshots/lead-detail/webkit-1920-light.png) | [❌](screenshots/lead-detail/msedge-360-light.png) | [❌](screenshots/lead-detail/msedge-768-light.png) | [❌](screenshots/lead-detail/msedge-1280-light.png) | [❌](screenshots/lead-detail/msedge-1920-light.png) |
| leads-kanban | [❌](screenshots/leads-kanban/chromium-360-light.png) | [❌](screenshots/leads-kanban/chromium-768-light.png) | [❌](screenshots/leads-kanban/chromium-1280-light.png) | [❌](screenshots/leads-kanban/chromium-1920-light.png) | [❌](screenshots/leads-kanban/firefox-360-light.png) | [❌](screenshots/leads-kanban/firefox-768-light.png) | [❌](screenshots/leads-kanban/firefox-1280-light.png) | [❌](screenshots/leads-kanban/firefox-1920-light.png) | [❌](screenshots/leads-kanban/webkit-360-light.png) | [❌](screenshots/leads-kanban/webkit-768-light.png) | [❌](screenshots/leads-kanban/webkit-1280-light.png) | [❌](screenshots/leads-kanban/webkit-1920-light.png) | [❌](screenshots/leads-kanban/msedge-360-light.png) | [❌](screenshots/leads-kanban/msedge-768-light.png) | [❌](screenshots/leads-kanban/msedge-1280-light.png) | [❌](screenshots/leads-kanban/msedge-1920-light.png) |
| leads-list | [❌](screenshots/leads-list/chromium-360-light.png) | [❌](screenshots/leads-list/chromium-768-light.png) | [❌](screenshots/leads-list/chromium-1280-light.png) | [❌](screenshots/leads-list/chromium-1920-light.png) | [❌](screenshots/leads-list/firefox-360-light.png) | [❌](screenshots/leads-list/firefox-768-light.png) | [❌](screenshots/leads-list/firefox-1280-light.png) | [❌](screenshots/leads-list/firefox-1920-light.png) | [❌](screenshots/leads-list/webkit-360-light.png) | [❌](screenshots/leads-list/webkit-768-light.png) | [❌](screenshots/leads-list/webkit-1280-light.png) | [❌](screenshots/leads-list/webkit-1920-light.png) | [❌](screenshots/leads-list/msedge-360-light.png) | [❌](screenshots/leads-list/msedge-768-light.png) | [❌](screenshots/leads-list/msedge-1280-light.png) | [❌](screenshots/leads-list/msedge-1920-light.png) |
| opportunities-list | [❌](screenshots/opportunities-list/chromium-360-light.png) | [❌](screenshots/opportunities-list/chromium-768-light.png) | [❌](screenshots/opportunities-list/chromium-1280-light.png) | [❌](screenshots/opportunities-list/chromium-1920-light.png) | [❌](screenshots/opportunities-list/firefox-360-light.png) | [❌](screenshots/opportunities-list/firefox-768-light.png) | [❌](screenshots/opportunities-list/firefox-1280-light.png) | [❌](screenshots/opportunities-list/firefox-1920-light.png) | [❌](screenshots/opportunities-list/webkit-360-light.png) | [❌](screenshots/opportunities-list/webkit-768-light.png) | [❌](screenshots/opportunities-list/webkit-1280-light.png) | [❌](screenshots/opportunities-list/webkit-1920-light.png) | [❌](screenshots/opportunities-list/msedge-360-light.png) | [❌](screenshots/opportunities-list/msedge-768-light.png) | [❌](screenshots/opportunities-list/msedge-1280-light.png) | [❌](screenshots/opportunities-list/msedge-1920-light.png) |
| opportunity-new | [❌](screenshots/opportunity-new/chromium-360-light.png) | [❌](screenshots/opportunity-new/chromium-768-light.png) | [❌](screenshots/opportunity-new/chromium-1280-light.png) | [❌](screenshots/opportunity-new/chromium-1920-light.png) | [❌](screenshots/opportunity-new/firefox-360-light.png) | [❌](screenshots/opportunity-new/firefox-768-light.png) | [❌](screenshots/opportunity-new/firefox-1280-light.png) | [❌](screenshots/opportunity-new/firefox-1920-light.png) | [❌](screenshots/opportunity-new/webkit-360-light.png) | [❌](screenshots/opportunity-new/webkit-768-light.png) | [❌](screenshots/opportunity-new/webkit-1280-light.png) | [❌](screenshots/opportunity-new/webkit-1920-light.png) | [❌](screenshots/opportunity-new/msedge-360-light.png) | [❌](screenshots/opportunity-new/msedge-768-light.png) | [❌](screenshots/opportunity-new/msedge-1280-light.png) | [❌](screenshots/opportunity-new/msedge-1920-light.png) |
| themes | [❌](screenshots/themes/chromium-360-light.png) | [❌](screenshots/themes/chromium-768-light.png) | [❌](screenshots/themes/chromium-1280-light.png) | [❌](screenshots/themes/chromium-1920-light.png) | [❌](screenshots/themes/firefox-360-light.png) | [❌](screenshots/themes/firefox-768-light.png) | [❌](screenshots/themes/firefox-1280-light.png) | [❌](screenshots/themes/firefox-1920-light.png) | [❌](screenshots/themes/webkit-360-light.png) | [❌](screenshots/themes/webkit-768-light.png) | [❌](screenshots/themes/webkit-1280-light.png) | [❌](screenshots/themes/webkit-1920-light.png) | [❌](screenshots/themes/msedge-360-light.png) | [❌](screenshots/themes/msedge-768-light.png) | [❌](screenshots/themes/msedge-1280-light.png) | [❌](screenshots/themes/msedge-1920-light.png) |

## Matrix — dark mode

Cell = layout + axe gates for that page/engine/width. Click to open the screenshot.

| Page | chromium 360 | chromium 768 | chromium 1280 | chromium 1920 | firefox 360 | firefox 768 | firefox 1280 | firefox 1920 | webkit 360 | webkit 768 | webkit 1280 | webkit 1920 | msedge 360 | msedge 768 | msedge 1280 | msedge 1920 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| accounts-list | [❌](screenshots/accounts-list/chromium-360-dark.png) | [❌](screenshots/accounts-list/chromium-768-dark.png) | [❌](screenshots/accounts-list/chromium-1280-dark.png) | [❌](screenshots/accounts-list/chromium-1920-dark.png) | [❌](screenshots/accounts-list/firefox-360-dark.png) | [❌](screenshots/accounts-list/firefox-768-dark.png) | [❌](screenshots/accounts-list/firefox-1280-dark.png) | [❌](screenshots/accounts-list/firefox-1920-dark.png) | [❌](screenshots/accounts-list/webkit-360-dark.png) | [❌](screenshots/accounts-list/webkit-768-dark.png) | [❌](screenshots/accounts-list/webkit-1280-dark.png) | [❌](screenshots/accounts-list/webkit-1920-dark.png) | [❌](screenshots/accounts-list/msedge-360-dark.png) | [❌](screenshots/accounts-list/msedge-768-dark.png) | [❌](screenshots/accounts-list/msedge-1280-dark.png) | [❌](screenshots/accounts-list/msedge-1920-dark.png) |
| auth | [❌](screenshots/auth/chromium-360-dark.png) | [❌](screenshots/auth/chromium-768-dark.png) | [❌](screenshots/auth/chromium-1280-dark.png) | [❌](screenshots/auth/chromium-1920-dark.png) | [❌](screenshots/auth/firefox-360-dark.png) | [❌](screenshots/auth/firefox-768-dark.png) | [❌](screenshots/auth/firefox-1280-dark.png) | [❌](screenshots/auth/firefox-1920-dark.png) | [❌](screenshots/auth/webkit-360-dark.png) | [❌](screenshots/auth/webkit-768-dark.png) | [❌](screenshots/auth/webkit-1280-dark.png) | [❌](screenshots/auth/webkit-1920-dark.png) | [❌](screenshots/auth/msedge-360-dark.png) | [❌](screenshots/auth/msedge-768-dark.png) | [❌](screenshots/auth/msedge-1280-dark.png) | [❌](screenshots/auth/msedge-1920-dark.png) |
| contacts-list | [❌](screenshots/contacts-list/chromium-360-dark.png) | [❌](screenshots/contacts-list/chromium-768-dark.png) | [❌](screenshots/contacts-list/chromium-1280-dark.png) | [❌](screenshots/contacts-list/chromium-1920-dark.png) | [❌](screenshots/contacts-list/firefox-360-dark.png) | [❌](screenshots/contacts-list/firefox-768-dark.png) | [❌](screenshots/contacts-list/firefox-1280-dark.png) | [❌](screenshots/contacts-list/firefox-1920-dark.png) | [❌](screenshots/contacts-list/webkit-360-dark.png) | [❌](screenshots/contacts-list/webkit-768-dark.png) | [❌](screenshots/contacts-list/webkit-1280-dark.png) | [❌](screenshots/contacts-list/webkit-1920-dark.png) | [❌](screenshots/contacts-list/msedge-360-dark.png) | [❌](screenshots/contacts-list/msedge-768-dark.png) | [❌](screenshots/contacts-list/msedge-1280-dark.png) | [❌](screenshots/contacts-list/msedge-1920-dark.png) |
| dashboard | [❌](screenshots/dashboard/chromium-360-dark.png) | [❌](screenshots/dashboard/chromium-768-dark.png) | [❌](screenshots/dashboard/chromium-1280-dark.png) | [❌](screenshots/dashboard/chromium-1920-dark.png) | [❌](screenshots/dashboard/firefox-360-dark.png) | [❌](screenshots/dashboard/firefox-768-dark.png) | [❌](screenshots/dashboard/firefox-1280-dark.png) | [❌](screenshots/dashboard/firefox-1920-dark.png) | [❌](screenshots/dashboard/webkit-360-dark.png) | [❌](screenshots/dashboard/webkit-768-dark.png) | [❌](screenshots/dashboard/webkit-1280-dark.png) | [❌](screenshots/dashboard/webkit-1920-dark.png) | [❌](screenshots/dashboard/msedge-360-dark.png) | [❌](screenshots/dashboard/msedge-768-dark.png) | [❌](screenshots/dashboard/msedge-1280-dark.png) | [❌](screenshots/dashboard/msedge-1920-dark.png) |
| lead-detail | [❌](screenshots/lead-detail/chromium-360-dark.png) | [❌](screenshots/lead-detail/chromium-768-dark.png) | [❌](screenshots/lead-detail/chromium-1280-dark.png) | [❌](screenshots/lead-detail/chromium-1920-dark.png) | [❌](screenshots/lead-detail/firefox-360-dark.png) | [❌](screenshots/lead-detail/firefox-768-dark.png) | [❌](screenshots/lead-detail/firefox-1280-dark.png) | [❌](screenshots/lead-detail/firefox-1920-dark.png) | [❌](screenshots/lead-detail/webkit-360-dark.png) | [❌](screenshots/lead-detail/webkit-768-dark.png) | [❌](screenshots/lead-detail/webkit-1280-dark.png) | [❌](screenshots/lead-detail/webkit-1920-dark.png) | [❌](screenshots/lead-detail/msedge-360-dark.png) | [❌](screenshots/lead-detail/msedge-768-dark.png) | [❌](screenshots/lead-detail/msedge-1280-dark.png) | [❌](screenshots/lead-detail/msedge-1920-dark.png) |
| leads-kanban | [❌](screenshots/leads-kanban/chromium-360-dark.png) | [❌](screenshots/leads-kanban/chromium-768-dark.png) | [❌](screenshots/leads-kanban/chromium-1280-dark.png) | [❌](screenshots/leads-kanban/chromium-1920-dark.png) | [❌](screenshots/leads-kanban/firefox-360-dark.png) | [❌](screenshots/leads-kanban/firefox-768-dark.png) | [❌](screenshots/leads-kanban/firefox-1280-dark.png) | [❌](screenshots/leads-kanban/firefox-1920-dark.png) | [❌](screenshots/leads-kanban/webkit-360-dark.png) | [❌](screenshots/leads-kanban/webkit-768-dark.png) | [❌](screenshots/leads-kanban/webkit-1280-dark.png) | [❌](screenshots/leads-kanban/webkit-1920-dark.png) | [❌](screenshots/leads-kanban/msedge-360-dark.png) | [❌](screenshots/leads-kanban/msedge-768-dark.png) | [❌](screenshots/leads-kanban/msedge-1280-dark.png) | [❌](screenshots/leads-kanban/msedge-1920-dark.png) |
| leads-list | [❌](screenshots/leads-list/chromium-360-dark.png) | [❌](screenshots/leads-list/chromium-768-dark.png) | [❌](screenshots/leads-list/chromium-1280-dark.png) | [❌](screenshots/leads-list/chromium-1920-dark.png) | [❌](screenshots/leads-list/firefox-360-dark.png) | [❌](screenshots/leads-list/firefox-768-dark.png) | [❌](screenshots/leads-list/firefox-1280-dark.png) | [❌](screenshots/leads-list/firefox-1920-dark.png) | [❌](screenshots/leads-list/webkit-360-dark.png) | [❌](screenshots/leads-list/webkit-768-dark.png) | [❌](screenshots/leads-list/webkit-1280-dark.png) | [❌](screenshots/leads-list/webkit-1920-dark.png) | [❌](screenshots/leads-list/msedge-360-dark.png) | [❌](screenshots/leads-list/msedge-768-dark.png) | [❌](screenshots/leads-list/msedge-1280-dark.png) | [❌](screenshots/leads-list/msedge-1920-dark.png) |
| opportunities-list | [❌](screenshots/opportunities-list/chromium-360-dark.png) | [❌](screenshots/opportunities-list/chromium-768-dark.png) | [❌](screenshots/opportunities-list/chromium-1280-dark.png) | [❌](screenshots/opportunities-list/chromium-1920-dark.png) | [❌](screenshots/opportunities-list/firefox-360-dark.png) | [❌](screenshots/opportunities-list/firefox-768-dark.png) | [❌](screenshots/opportunities-list/firefox-1280-dark.png) | [❌](screenshots/opportunities-list/firefox-1920-dark.png) | [❌](screenshots/opportunities-list/webkit-360-dark.png) | [❌](screenshots/opportunities-list/webkit-768-dark.png) | [❌](screenshots/opportunities-list/webkit-1280-dark.png) | [❌](screenshots/opportunities-list/webkit-1920-dark.png) | [❌](screenshots/opportunities-list/msedge-360-dark.png) | [❌](screenshots/opportunities-list/msedge-768-dark.png) | [❌](screenshots/opportunities-list/msedge-1280-dark.png) | [❌](screenshots/opportunities-list/msedge-1920-dark.png) |
| opportunity-new | [❌](screenshots/opportunity-new/chromium-360-dark.png) | [❌](screenshots/opportunity-new/chromium-768-dark.png) | [❌](screenshots/opportunity-new/chromium-1280-dark.png) | [❌](screenshots/opportunity-new/chromium-1920-dark.png) | [❌](screenshots/opportunity-new/firefox-360-dark.png) | [❌](screenshots/opportunity-new/firefox-768-dark.png) | [❌](screenshots/opportunity-new/firefox-1280-dark.png) | [❌](screenshots/opportunity-new/firefox-1920-dark.png) | [❌](screenshots/opportunity-new/webkit-360-dark.png) | [❌](screenshots/opportunity-new/webkit-768-dark.png) | [❌](screenshots/opportunity-new/webkit-1280-dark.png) | [❌](screenshots/opportunity-new/webkit-1920-dark.png) | [❌](screenshots/opportunity-new/msedge-360-dark.png) | [❌](screenshots/opportunity-new/msedge-768-dark.png) | [❌](screenshots/opportunity-new/msedge-1280-dark.png) | [❌](screenshots/opportunity-new/msedge-1920-dark.png) |
| themes | [❌](screenshots/themes/chromium-360-dark.png) | [❌](screenshots/themes/chromium-768-dark.png) | [❌](screenshots/themes/chromium-1280-dark.png) | [❌](screenshots/themes/chromium-1920-dark.png) | [❌](screenshots/themes/firefox-360-dark.png) | [❌](screenshots/themes/firefox-768-dark.png) | [❌](screenshots/themes/firefox-1280-dark.png) | [❌](screenshots/themes/firefox-1920-dark.png) | [❌](screenshots/themes/webkit-360-dark.png) | [❌](screenshots/themes/webkit-768-dark.png) | [❌](screenshots/themes/webkit-1280-dark.png) | [❌](screenshots/themes/webkit-1920-dark.png) | [❌](screenshots/themes/msedge-360-dark.png) | [❌](screenshots/themes/msedge-768-dark.png) | [❌](screenshots/themes/msedge-1280-dark.png) | [❌](screenshots/themes/msedge-1920-dark.png) |

## axe-core violations by rule

### `button-name` — critical (gated)

Buttons must have discernible text ([rule](https://dequeuniversity.com/rules/axe/4.11/button-name?application=axeAPI))

Affected cells (288): accounts-list/chromium/1280/dark, accounts-list/chromium/1280/light, accounts-list/chromium/1920/dark, accounts-list/chromium/1920/light, accounts-list/chromium/360/dark, accounts-list/chromium/360/light, accounts-list/chromium/768/dark, accounts-list/chromium/768/light, accounts-list/firefox/1280/dark, accounts-list/firefox/1280/light, accounts-list/firefox/1920/dark, accounts-list/firefox/1920/light, accounts-list/firefox/360/dark, accounts-list/firefox/360/light, accounts-list/firefox/768/dark, accounts-list/firefox/768/light, accounts-list/msedge/1280/dark, accounts-list/msedge/1280/light, accounts-list/msedge/1920/dark, accounts-list/msedge/1920/light, accounts-list/msedge/360/dark, accounts-list/msedge/360/light, accounts-list/msedge/768/dark, accounts-list/msedge/768/light, …
Sample targets: `.aria-invalid\:focus\:ring-destructive`

### `aria-valid-attr-value` — critical (gated)

ARIA attributes must conform to valid values ([rule](https://dequeuniversity.com/rules/axe/4.11/aria-valid-attr-value?application=axeAPI))

Affected cells (32): leads-kanban/chromium/1280/dark, leads-kanban/chromium/1280/light, leads-kanban/chromium/1920/dark, leads-kanban/chromium/1920/light, leads-kanban/chromium/360/dark, leads-kanban/chromium/360/light, leads-kanban/chromium/768/dark, leads-kanban/chromium/768/light, leads-kanban/firefox/1280/dark, leads-kanban/firefox/1280/light, leads-kanban/firefox/1920/dark, leads-kanban/firefox/1920/light, leads-kanban/firefox/360/dark, leads-kanban/firefox/360/light, leads-kanban/firefox/768/dark, leads-kanban/firefox/768/light, leads-kanban/msedge/1280/dark, leads-kanban/msedge/1280/light, leads-kanban/msedge/1920/dark, leads-kanban/msedge/1920/light, leads-kanban/msedge/360/dark, leads-kanban/msedge/360/light, leads-kanban/msedge/768/dark, leads-kanban/msedge/768/light, …
Sample targets: `#radix-\:r2o\:-trigger-upcoming`

### `label` — critical (gated)

Form elements must have labels ([rule](https://dequeuniversity.com/rules/axe/4.11/label?application=axeAPI))

Affected cells (32): themes/chromium/1280/dark, themes/chromium/1280/light, themes/chromium/1920/dark, themes/chromium/1920/light, themes/chromium/360/dark, themes/chromium/360/light, themes/chromium/768/dark, themes/chromium/768/light, themes/firefox/1280/dark, themes/firefox/1280/light, themes/firefox/1920/dark, themes/firefox/1920/light, themes/firefox/360/dark, themes/firefox/360/light, themes/firefox/768/dark, themes/firefox/768/light, themes/msedge/1280/dark, themes/msedge/1280/light, themes/msedge/1920/dark, themes/msedge/1920/light, themes/msedge/360/dark, themes/msedge/360/light, themes/msedge/768/dark, themes/msedge/768/light, …
Sample targets: `input[value="#932bee"]`, `input[value="272"][data-component-line="80"][max="360"]`, `input[value="272"][data-component-line="81"][max="360"]`

### `select-name` — critical (gated)

Select element must have an accessible name ([rule](https://dequeuniversity.com/rules/axe/4.11/select-name?application=axeAPI))

Affected cells (32): themes/chromium/1280/dark, themes/chromium/1280/light, themes/chromium/1920/dark, themes/chromium/1920/light, themes/chromium/360/dark, themes/chromium/360/light, themes/chromium/768/dark, themes/chromium/768/light, themes/firefox/1280/dark, themes/firefox/1280/light, themes/firefox/1920/dark, themes/firefox/1920/light, themes/firefox/360/dark, themes/firefox/360/light, themes/firefox/768/dark, themes/firefox/768/light, themes/msedge/1280/dark, themes/msedge/1280/light, themes/msedge/1920/dark, themes/msedge/1920/light, themes/msedge/360/dark, themes/msedge/360/light, themes/msedge/768/dark, themes/msedge/768/light, …
Sample targets: `select[data-component-line="535"]`, `select[data-component-line="553"]`

### `color-contrast` — serious (gated)

Elements must meet minimum color contrast ratio thresholds ([rule](https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=axeAPI))

Affected cells (208): accounts-list/chromium/1280/light, accounts-list/chromium/1920/light, accounts-list/chromium/360/light, accounts-list/chromium/768/light, accounts-list/firefox/1280/light, accounts-list/firefox/1920/light, accounts-list/firefox/360/light, accounts-list/firefox/768/light, accounts-list/msedge/1280/light, accounts-list/msedge/1920/light, accounts-list/msedge/360/light, accounts-list/msedge/768/light, accounts-list/webkit/1280/light, accounts-list/webkit/1920/light, accounts-list/webkit/360/light, accounts-list/webkit/768/light, auth/chromium/1280/dark, auth/chromium/1920/dark, auth/chromium/360/dark, auth/chromium/768/dark, auth/firefox/1280/dark, auth/firefox/1920/dark, auth/firefox/360/dark, auth/firefox/768/dark, …
Sample targets: `.line-clamp-1`

### `nested-interactive` — serious (gated)

Interactive controls must not be nested ([rule](https://dequeuniversity.com/rules/axe/4.11/nested-interactive?application=axeAPI))

Affected cells (61): leads-kanban/chromium/1280/dark, leads-kanban/chromium/1280/light, leads-kanban/chromium/1920/dark, leads-kanban/chromium/1920/light, leads-kanban/chromium/360/dark, leads-kanban/chromium/360/light, leads-kanban/chromium/768/dark, leads-kanban/chromium/768/light, leads-kanban/firefox/1280/dark, leads-kanban/firefox/1280/light, leads-kanban/firefox/1920/dark, leads-kanban/firefox/1920/light, leads-kanban/firefox/360/dark, leads-kanban/firefox/360/light, leads-kanban/firefox/768/dark, leads-kanban/firefox/768/light, leads-kanban/msedge/1280/dark, leads-kanban/msedge/1280/light, leads-kanban/msedge/1920/dark, leads-kanban/msedge/1920/light, leads-kanban/msedge/360/dark, leads-kanban/msedge/360/light, leads-kanban/msedge/768/dark, leads-kanban/msedge/768/light, …
Sample targets: `div[data-testid="kanban-column-new"] > .active\:cursor-grabbing.border-l-red-500[data-component-line="199"]`, `div[data-status-band="new"] > .touch-none.focus\:ring-primary\/50[data-component-line="110"]`, `div[data-testid="kanban-column-contacted"] > .active\:cursor-grabbing.border-l-red-500[data-component-line="199"]`

### `aria-progressbar-name` — serious (gated)

ARIA progressbar nodes must have an accessible name ([rule](https://dequeuniversity.com/rules/axe/4.11/aria-progressbar-name?application=axeAPI))

Affected cells (32): dashboard/chromium/1280/dark, dashboard/chromium/1280/light, dashboard/chromium/1920/dark, dashboard/chromium/1920/light, dashboard/chromium/360/dark, dashboard/chromium/360/light, dashboard/chromium/768/dark, dashboard/chromium/768/light, dashboard/firefox/1280/dark, dashboard/firefox/1280/light, dashboard/firefox/1920/dark, dashboard/firefox/1920/light, dashboard/firefox/360/dark, dashboard/firefox/360/light, dashboard/firefox/768/dark, dashboard/firefox/768/light, dashboard/msedge/1280/dark, dashboard/msedge/1280/light, dashboard/msedge/1920/dark, dashboard/msedge/1920/light, dashboard/msedge/360/dark, dashboard/msedge/360/light, dashboard/msedge/768/dark, dashboard/msedge/768/light, …
Sample targets: `.p-3.rounded-md[data-component-line="73"]:nth-child(1) > .h-2[aria-valuemax="100"][aria-valuemin="0"]`, `.p-3.rounded-md[data-component-line="73"]:nth-child(2) > .h-2[aria-valuemax="100"][aria-valuemin="0"]`, `.p-3.rounded-md[data-component-line="73"]:nth-child(3) > .h-2[aria-valuemax="100"][aria-valuemin="0"]`

### `scrollable-region-focusable` — serious (gated)

Scrollable region must have keyboard access ([rule](https://dequeuniversity.com/rules/axe/4.11/scrollable-region-focusable?application=axeAPI))

Affected cells (32): leads-kanban/chromium/1280/dark, leads-kanban/chromium/1280/light, leads-kanban/chromium/1920/dark, leads-kanban/chromium/1920/light, leads-kanban/chromium/360/dark, leads-kanban/chromium/360/light, leads-kanban/chromium/768/dark, leads-kanban/chromium/768/light, leads-kanban/firefox/1280/dark, leads-kanban/firefox/1280/light, leads-kanban/firefox/1920/dark, leads-kanban/firefox/1920/light, leads-kanban/firefox/360/dark, leads-kanban/firefox/360/light, leads-kanban/firefox/768/dark, leads-kanban/firefox/768/light, leads-kanban/msedge/1280/dark, leads-kanban/msedge/1280/light, leads-kanban/msedge/1920/dark, leads-kanban/msedge/1920/light, leads-kanban/msedge/360/dark, leads-kanban/msedge/360/light, leads-kanban/msedge/768/dark, leads-kanban/msedge/768/light, …
Sample targets: `div[data-component-line="58"] > .rounded-\[inherit\][data-radix-scroll-area-viewport=""][data-lov-name="ScrollAreaPrimitive.Viewport"]`

## Layout failures

- **leads-list** chromium 360px dark:
  - `div.flex.items-center.gap-2 right=474 > 360`
  - `button.inline-flex.items-center.justify-center right=367 > 360`
  - `button.inline-flex.items-center.justify-center right=474 > 360`
- **leads-list** chromium 360px light:
  - `div.flex.items-center.gap-2 right=474 > 360`
  - `button.inline-flex.items-center.justify-center right=367 > 360`
  - `button.inline-flex.items-center.justify-center right=474 > 360`
- **leads-list** firefox 360px dark:
  - `div.flex.items-center.gap-2 right=522 > 360`
  - `button.inline-flex.items-center.justify-center right=415 > 360`
  - `button.inline-flex.items-center.justify-center right=522 > 360`
- **leads-list** firefox 360px light:
  - `div.flex.items-center.gap-2 right=522 > 360`
  - `button.inline-flex.items-center.justify-center right=415 > 360`
  - `button.inline-flex.items-center.justify-center right=522 > 360`
- **leads-list** msedge 360px dark:
  - `div.flex.items-center.gap-2 right=474 > 360`
  - `button.inline-flex.items-center.justify-center right=367 > 360`
  - `button.inline-flex.items-center.justify-center right=474 > 360`
- **leads-list** msedge 360px light:
  - `div.flex.items-center.gap-2 right=474 > 360`
  - `button.inline-flex.items-center.justify-center right=367 > 360`
  - `button.inline-flex.items-center.justify-center right=474 > 360`
- **leads-list** webkit 360px dark:
  - `div.flex.items-center.gap-2 right=507 > 360`
  - `button.inline-flex.items-center.justify-center right=401 > 360`
  - `button.inline-flex.items-center.justify-center right=507 > 360`
- **leads-list** webkit 360px light:
  - `div.flex.items-center.gap-2 right=507 > 360`
  - `button.inline-flex.items-center.justify-center right=401 > 360`
  - `button.inline-flex.items-center.justify-center right=507 > 360`
- **opportunity-new** webkit 768px dark:
  - `document scrollWidth 862 > innerWidth 768`
- **opportunity-new** webkit 768px light:
  - `document scrollWidth 862 > innerWidth 768`
- **themes** chromium 360px dark:
  - `button.inline-flex.items-center.justify-center right=388 > 360`
  - `div.flex-1.h-16.rounded-lg right=478 > 360`
  - `button.inline-flex.items-center.justify-center right=376 > 360`
  - `div.rounded-lg.p-3.border right=462 > 360`
- **themes** chromium 360px light:
  - `button.inline-flex.items-center.justify-center right=388 > 360`
  - `div.flex-1.h-16.rounded-lg right=478 > 360`
  - `button.inline-flex.items-center.justify-center right=376 > 360`
  - `div.rounded-lg.p-3.border right=462 > 360`
- **themes** firefox 360px dark:
  - `button.inline-flex.items-center.justify-center right=388 > 360`
  - `div.flex-1.h-16.rounded-lg right=478 > 360`
  - `button.inline-flex.items-center.justify-center right=376 > 360`
  - `div.rounded-lg.p-3.border right=462 > 360`
- **themes** firefox 360px light:
  - `button.inline-flex.items-center.justify-center right=388 > 360`
  - `div.flex-1.h-16.rounded-lg right=478 > 360`
  - `button.inline-flex.items-center.justify-center right=376 > 360`
  - `div.rounded-lg.p-3.border right=462 > 360`
- **themes** msedge 360px dark:
  - `button.inline-flex.items-center.justify-center right=388 > 360`
  - `div.flex-1.h-16.rounded-lg right=478 > 360`
  - `button.inline-flex.items-center.justify-center right=376 > 360`
  - `div.rounded-lg.p-3.border right=462 > 360`
- **themes** msedge 360px light:
  - `button.inline-flex.items-center.justify-center right=388 > 360`
  - `div.flex-1.h-16.rounded-lg right=478 > 360`
  - `button.inline-flex.items-center.justify-center right=376 > 360`
  - `div.rounded-lg.p-3.border right=462 > 360`
- **themes** webkit 360px dark:
  - `button.inline-flex.items-center.justify-center right=388 > 360`
  - `div.flex-1.h-16.rounded-lg right=478 > 360`
  - `button.inline-flex.items-center.justify-center right=376 > 360`
  - `div.rounded-lg.p-3.border right=462 > 360`
- **themes** webkit 360px light:
  - `button.inline-flex.items-center.justify-center right=388 > 360`
  - `div.flex-1.h-16.rounded-lg right=478 > 360`
  - `button.inline-flex.items-center.justify-center right=376 > 360`
  - `div.rounded-lg.p-3.border right=462 > 360`

Screenshots that are viewport-only because the engine refused a full-page capture (the page height is itself a finding):
- accounts-list firefox 1280 dark: viewport screenshot — page is 33048px tall
- accounts-list firefox 1280 light: viewport screenshot — page is 33048px tall
- accounts-list firefox 1920 dark: viewport screenshot — page is 33048px tall
- accounts-list firefox 1920 light: viewport screenshot — page is 33048px tall
- accounts-list firefox 360 dark: viewport screenshot — page is 34656px tall
- accounts-list firefox 360 light: viewport screenshot — page is 34656px tall
- accounts-list firefox 768 dark: viewport screenshot — page is 33112px tall
- accounts-list firefox 768 light: viewport screenshot — page is 33112px tall
- accounts-list webkit 1280 dark: viewport screenshot — page is 33047px tall
- accounts-list webkit 1280 light: viewport screenshot — page is 33047px tall
- accounts-list webkit 1920 dark: viewport screenshot — page is 33047px tall
- accounts-list webkit 1920 light: viewport screenshot — page is 33047px tall
- accounts-list webkit 360 light: viewport screenshot — page is 34655px tall
- accounts-list webkit 768 dark: viewport screenshot — page is 33111px tall
- accounts-list webkit 768 light: viewport screenshot — page is 33111px tall
- opportunities-list webkit 360 dark: viewport screenshot — page is 18616px tall
- opportunities-list webkit 360 light: viewport screenshot — page is 18616px tall

## Keyboard walk (1280, light)

| Page | Engine | Stops (visited/focusable) | Result | First failure |
|---|---|---|---|---|
| accounts-list | chromium | 40/321 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| accounts-list | firefox | 40/321 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| accounts-list | webkit | 40/313 | ❌ | stop #1 <button> "Toggle CRM menu" is not visible |
| auth | chromium | 6/6 | ✅ |  |
| auth | firefox | 6/6 | ✅ |  |
| auth | webkit | 3/3 | ✅ |  |
| contacts-list | chromium | 40/63 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| contacts-list | firefox | 40/63 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| contacts-list | webkit | 27/27 | ❌ | stop #1 <button> "Toggle CRM menu" is not visible |
| dashboard | chromium | 27/27 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| dashboard | firefox | 30/30 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| dashboard | webkit | 20/20 | ❌ | stop #1 <button> "Toggle CRM menu" is not visible |
| dashboard-onboarding | chromium | 2/29 | ❌ | focus confined to 2 of 29 focusable elements (possible trap/overlay) |
| dashboard-onboarding | firefox | 2/32 | ❌ | focus confined to 2 of 32 focusable elements (possible trap/overlay) |
| dashboard-onboarding | webkit | 2/22 | ❌ | focus confined to 2 of 22 focusable elements (possible trap/overlay) |
| lead-detail | chromium | 0 | ❌ | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |
| lead-detail | firefox | 0 | ❌ | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |
| lead-detail | webkit | 0 | ❌ | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |
| leads-kanban | chromium | 36/187 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| leads-kanban | firefox | 36/187 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| leads-kanban | webkit | 40/180 | ❌ | stop #1 <button> "Toggle CRM menu" is not visible |
| leads-list | chromium | 40/97 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| leads-list | firefox | 40/97 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| leads-list | webkit | 40/39 | ❌ | stop #1 <button> "Toggle CRM menu" is not visible |
| opportunities-list | chromium | 33/33 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| opportunities-list | firefox | 33/33 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| opportunities-list | webkit | 26/26 | ❌ | stop #1 <button> "Toggle CRM menu" is not visible |
| opportunity-new | chromium | 37/45 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| opportunity-new | firefox | 37/45 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| opportunity-new | webkit | 38/38 | ❌ | stop #1 <button> "Toggle CRM menu" is not visible |
| themes | chromium | 40/311 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| themes | firefox | 40/311 | ❌ | stop #2 <button> "Toggle CRM menu" is not visible |
| themes | webkit | 40/304 | ❌ | stop #1 <button> "Toggle CRM menu" is not visible |

<details><summary>accounts-list / chromium — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `a` Dashboard
27. `button` New
28. `button` Accounts Pipeline view
29. `button` Accounts Card view
30. `button` Accounts Grid view
31. `button` Accounts List view
32. `button` Accounts New Account
33. `button` Accounts refresh
34. `button` Accounts import export
35. `button` DeDup (6)
36. `input` Search accounts...
37. `div` MGL Matrix Test Customer
38. `div` Hapag-Lloyd
39. `div` CMA CGM
40. `div` Maersk
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>accounts-list / firefox — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `a` Dashboard
27. `button` New
28. `button` Accounts Pipeline view
29. `button` Accounts Card view
30. `button` Accounts Grid view
31. `button` Accounts List view
32. `button` Accounts New Account
33. `button` Accounts refresh
34. `button` Accounts import export
35. `button` DeDup (6)
36. `input` Search accounts...
37. `div` MGL Matrix Test Customer
38. `div` Hapag-Lloyd
39. `div` CMA CGM
40. `div` Maersk
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>accounts-list / webkit — tab order (40 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Toggle CRM menu
3. `button` Toggle Sales menu
4. `button` Toggle Markets menu
5. `button` Toggle Financials menu
6. `button` Toggle Logistics menu
7. `button` Toggle UIM menu
8. `button` Toggle AMRO menu
9. `button` Toggle Administration menu
10. `button` Sign Out
11. `button` Go back
12. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
13. `button` SOS Services
14. `button` Open global search
15. `button` Help
16. `button` 7 unread notifications
17. `button` Switch to dark mode
18. `button` Deccan AMRO
19. `button` New
20. `button` Accounts Pipeline view
21. `button` Accounts Card view
22. `button` Accounts Grid view
23. `button` Accounts List view
24. `button` Accounts New Account
25. `button` Accounts refresh
26. `button` Accounts import export
27. `button` DeDup (6)
28. `input` Search accounts...
29. `div` MGL Matrix Test Customer
30. `div` Hapag-Lloyd
31. `div` CMA CGM
32. `div` Maersk
33. `div` MSC
34. `div` Zim
35. `div` Generic Carrier
36. `div` Maersk Line
37. `div` EVERGREEN LINES
38. `div` Company 1770725185010
39. `div` Company 1770725149462
40. `div` Company 1770725119442
- ❌ stop #1 <button> "Toggle CRM menu" is not visible
- ❌ stop #2 <button> "Toggle Sales menu" is not visible
- ❌ stop #3 <button> "Toggle Markets menu" is not visible
- ❌ stop #4 <button> "Toggle Financials menu" is not visible
- ❌ stop #5 <button> "Toggle Logistics menu" is not visible
- ❌ stop #6 <button> "Toggle UIM menu" is not visible
- ❌ stop #7 <button> "Toggle AMRO menu" is not visible
- ❌ stop #8 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>auth / chromium — tab order (6 stops)</summary>

1. `input` Email
2. `input` Password
3. `button` Sign in
4. `a` Create Platform Admin
5. `a` Register your organization
6. `a` explore options

</details>

<details><summary>auth / firefox — tab order (6 stops)</summary>

1. `input` Email
2. `input` Password
3. `button` Sign in
4. `a` Create Platform Admin
5. `a` Register your organization
6. `a` explore options

</details>

<details><summary>auth / webkit — tab order (3 stops)</summary>

1. `input` Email
2. `input` Password
3. `button` Sign in

</details>

<details><summary>contacts-list / chromium — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Contacts Pipeline view
27. `button` Contacts Card view
28. `button` Contacts Grid view
29. `button` Contacts List view
30. `button` Contacts New Contact
31. `button` Contacts refresh
32. `button` Contacts import export
33. `input` Search contacts...
34. `a` Lead1770725185010 TestUserCompany 1770725185010lead177072518
35. `a` Lead1770725149462 TestUserCompany 1770725149462lead177072514
36. `a` Lead1770725119442 TestUserCompany 1770725119442lead177072511
37. `a` John DoeAdv Test Customer 1770684216319john.doe.177068421640
38. `a` Lead1770602498092 TestUserCompany 1770602498092lead177060249
39. `a` Lead1770561981489 TestUserCompany 1770561981489lead177056198
40. `a` Lead1770468792440 TestUserCompany 1770468792440lead177046879
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>contacts-list / firefox — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Contacts Pipeline view
27. `button` Contacts Card view
28. `button` Contacts Grid view
29. `button` Contacts List view
30. `button` Contacts New Contact
31. `button` Contacts refresh
32. `button` Contacts import export
33. `input` Search contacts...
34. `a` Lead1770725185010 TestUserCompany 1770725185010lead177072518
35. `a` Lead1770725149462 TestUserCompany 1770725149462lead177072514
36. `a` Lead1770725119442 TestUserCompany 1770725119442lead177072511
37. `a` John DoeAdv Test Customer 1770684216319john.doe.177068421640
38. `a` Lead1770602498092 TestUserCompany 1770602498092lead177060249
39. `a` Lead1770561981489 TestUserCompany 1770561981489lead177056198
40. `a` Lead1770468792440 TestUserCompany 1770468792440lead177046879
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>contacts-list / webkit — tab order (27 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Toggle CRM menu
3. `button` Toggle Sales menu
4. `button` Toggle Markets menu
5. `button` Toggle Financials menu
6. `button` Toggle Logistics menu
7. `button` Toggle UIM menu
8. `button` Toggle AMRO menu
9. `button` Toggle Administration menu
10. `button` Sign Out
11. `button` Go back
12. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
13. `button` SOS Services
14. `button` Open global search
15. `button` Help
16. `button` 7 unread notifications
17. `button` Switch to dark mode
18. `button` Deccan AMRO
19. `button` Contacts Pipeline view
20. `button` Contacts Card view
21. `button` Contacts Grid view
22. `button` Contacts List view
23. `button` Contacts New Contact
24. `button` Contacts refresh
25. `button` Contacts import export
26. `input` Search contacts...
27. `button` Open AI Markets Assistant
- ❌ stop #1 <button> "Toggle CRM menu" is not visible
- ❌ stop #2 <button> "Toggle Sales menu" is not visible
- ❌ stop #3 <button> "Toggle Markets menu" is not visible
- ❌ stop #4 <button> "Toggle Financials menu" is not visible
- ❌ stop #5 <button> "Toggle Logistics menu" is not visible
- ❌ stop #6 <button> "Toggle UIM menu" is not visible
- ❌ stop #7 <button> "Toggle AMRO menu" is not visible
- ❌ stop #8 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>dashboard / chromium — tab order (27 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Create Action
27. `button` Open AI Markets Assistant
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>dashboard / firefox — tab order (30 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Financials menu
11. `button` Toggle Logistics menu
12. `button` Toggle UIM menu
13. `button` Toggle Administration menu
14. `button` Sign Out
15. `button` Go back
16. `a` Dashboard
17. `button` Open global search
18. `button` Help
19. `button` Notifications
20. `button` Switch to dark mode
21. `button` bahuguna.vimal@gmail.com
22. `button` _(unnamed)_
23. `button` _(unnamed)_
24. `button` _(unnamed)_
25. `button` _(unnamed)_
26. `button` _(unnamed)_
27. `button` _(unnamed)_
28. `button` _(unnamed)_
29. `button` _(unnamed)_
30. `button` Open AI Markets Assistant
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Financials menu" is not visible
- ❌ stop #10 <button> "Toggle Logistics menu" is not visible
- ❌ stop #11 <button> "Toggle UIM menu" is not visible
- ❌ stop #12 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>dashboard / webkit — tab order (20 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Toggle CRM menu
3. `button` Toggle Sales menu
4. `button` Toggle Markets menu
5. `button` Toggle Financials menu
6. `button` Toggle Logistics menu
7. `button` Toggle UIM menu
8. `button` Toggle AMRO menu
9. `button` Toggle Administration menu
10. `button` Sign Out
11. `button` Go back
12. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
13. `button` SOS Services
14. `button` Open global search
15. `button` Help
16. `button` 7 unread notifications
17. `button` Switch to dark mode
18. `button` Deccan AMRO
19. `button` Create Action
20. `button` Open AI Markets Assistant
- ❌ stop #1 <button> "Toggle CRM menu" is not visible
- ❌ stop #2 <button> "Toggle Sales menu" is not visible
- ❌ stop #3 <button> "Toggle Markets menu" is not visible
- ❌ stop #4 <button> "Toggle Financials menu" is not visible
- ❌ stop #5 <button> "Toggle Logistics menu" is not visible
- ❌ stop #6 <button> "Toggle UIM menu" is not visible
- ❌ stop #7 <button> "Toggle AMRO menu" is not visible
- ❌ stop #8 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>dashboard-onboarding / chromium — tab order (2 stops)</summary>

1. `button[role=button]` Skip
2. `button[role=button]` Next (Step 1 of 5)
- ❌ focus confined to 2 of 29 focusable elements (possible trap/overlay)

</details>

<details><summary>dashboard-onboarding / firefox — tab order (2 stops)</summary>

1. `button[role=button]` Skip
2. `button[role=button]` Next (Step 1 of 5)
- ❌ focus confined to 2 of 32 focusable elements (possible trap/overlay)

</details>

<details><summary>dashboard-onboarding / webkit — tab order (2 stops)</summary>

1. `button[role=button]` Skip
2. `button[role=button]` Next (Step 1 of 5)
- ❌ focus confined to 2 of 22 focusable elements (possible trap/overlay)

</details>

<details><summary>leads-kanban / chromium — tab order (36 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Leads Pipeline view
27. `button` Leads Card view
28. `button` Leads Grid view
29. `button` Leads List view
30. `button` Leads New Lead
31. `button` Leads refresh
32. `button` Leads import export
33. `button` Leads Analytics view
34. `div[role=tabpanel]` StatusSourceCustom FieldsNew Lead1Total Value$12,000mediumJa
35. `input` Start date
36. `input` End date
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>leads-kanban / firefox — tab order (36 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Leads Pipeline view
27. `button` Leads Card view
28. `button` Leads Grid view
29. `button` Leads List view
30. `button` Leads New Lead
31. `button` Leads refresh
32. `button` Leads import export
33. `button` Leads Analytics view
34. `div[role=tabpanel]` StatusSourceCustom FieldsNew Lead1Total Value$12,000mediumJa
35. `input` Start date
36. `input` End date
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>leads-kanban / webkit — tab order (40 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Toggle CRM menu
3. `button` Toggle Sales menu
4. `button` Toggle Markets menu
5. `button` Toggle Financials menu
6. `button` Toggle Logistics menu
7. `button` Toggle UIM menu
8. `button` Toggle AMRO menu
9. `button` Toggle Administration menu
10. `button` Sign Out
11. `button` Go back
12. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
13. `button` SOS Services
14. `button` Open global search
15. `button` Help
16. `button` 7 unread notifications
17. `button` Switch to dark mode
18. `button` Deccan AMRO
19. `button` Leads Pipeline view
20. `button` Leads Card view
21. `button` Leads Grid view
22. `button` Leads List view
23. `button` Leads New Lead
24. `button` Leads refresh
25. `button` Leads import export
26. `button` Leads Analytics view
27. `div[role=tabpanel]` StatusSourceCustom FieldsNew Lead1Total Value$12,000mediumJa
28. `input` Start date
29. `input` End date
30. `input` Search...
31. `button` Status
32. `button` Source
33. `button` Custom Fields
34. `div` _(unnamed)_
35. `div` New Lead1Total Value$12,000mediumJan 20Sarvesh Gupta €12,000
36. `div[role=button]` New Lead1
37. `button` _(unnamed)_
38. `button` _(unnamed)_
39. `div` mediumJan 20Sarvesh Gupta €12,000
40. `div[role=button]` mediumJan 20Sarvesh Gupta €12,000
- ❌ stop #1 <button> "Toggle CRM menu" is not visible
- ❌ stop #2 <button> "Toggle Sales menu" is not visible
- ❌ stop #3 <button> "Toggle Markets menu" is not visible
- ❌ stop #4 <button> "Toggle Financials menu" is not visible
- ❌ stop #5 <button> "Toggle Logistics menu" is not visible
- ❌ stop #6 <button> "Toggle UIM menu" is not visible
- ❌ stop #7 <button> "Toggle AMRO menu" is not visible
- ❌ stop #8 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>leads-list / chromium — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Leads Pipeline view
27. `button` Leads Card view
28. `button` Leads Grid view
29. `button` Leads List view
30. `button` Leads New Lead
31. `button` Leads refresh
32. `button` Leads import export
33. `button` Leads Analytics view
34. `button` Refresh
35. `button` Import/Export
36. `button` New Lead
37. `input` Search leads...
38. `button[role=combobox]` All Status
39. `button[role=combobox]` Any Owner
40. `button[role=combobox]` All Scores
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>leads-list / firefox — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Leads Pipeline view
27. `button` Leads Card view
28. `button` Leads Grid view
29. `button` Leads List view
30. `button` Leads New Lead
31. `button` Leads refresh
32. `button` Leads import export
33. `button` Leads Analytics view
34. `button` Refresh
35. `button` Import/Export
36. `button` New Lead
37. `div` All StatusAny OwnerAll ScoresNo Grouping-ContainsFieldsClear
38. `input` Search leads...
39. `button[role=combobox]` All Status
40. `button[role=combobox]` Any Owner
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>leads-list / webkit — tab order (40 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Toggle CRM menu
3. `button` Toggle Sales menu
4. `button` Toggle Markets menu
5. `button` Toggle Financials menu
6. `button` Toggle Logistics menu
7. `button` Toggle UIM menu
8. `button` Toggle AMRO menu
9. `button` Toggle Administration menu
10. `button` Sign Out
11. `button` Go back
12. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
13. `button` SOS Services
14. `button` Open global search
15. `button` Help
16. `button` 7 unread notifications
17. `button` Switch to dark mode
18. `button` Deccan AMRO
19. `button` Leads Pipeline view
20. `button` Leads Card view
21. `button` Leads Grid view
22. `button` Leads List view
23. `button` Leads New Lead
24. `button` Leads refresh
25. `button` Leads import export
26. `button` Leads Analytics view
27. `button` Refresh
28. `button` Import/Export
29. `button` New Lead
30. `input` Search leads...
31. `button[role=combobox]` All Status
32. `button[role=combobox]` Any Owner
33. `button[role=combobox]` All Scores
34. `button[role=combobox]` Group By
35. `input` Min Value
36. `input` Max Value
37. `button[role=combobox]` Contains
38. `input` Lead Name
39. `button` Fields
40. `div[role=button]` Lead1770725185010 TestUser, Converted, score 5 — **no visible focus**
- ❌ stop #1 <button> "Toggle CRM menu" is not visible
- ❌ stop #2 <button> "Toggle Sales menu" is not visible
- ❌ stop #3 <button> "Toggle Markets menu" is not visible
- ❌ stop #4 <button> "Toggle Financials menu" is not visible
- ❌ stop #5 <button> "Toggle Logistics menu" is not visible
- ❌ stop #6 <button> "Toggle UIM menu" is not visible
- ❌ stop #7 <button> "Toggle AMRO menu" is not visible
- ❌ stop #8 <button> "Toggle Administration menu" is not visible
- ❌ stop #39 <div> "Lead1770725185010 TestUser, Converted, score 5" has no visible focus indicator

</details>

<details><summary>opportunities-list / chromium — tab order (33 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Opportunities Pipeline view
27. `button` Opportunities Card view
28. `button` Opportunities Grid view
29. `button` Opportunities List view
30. `button` Opportunities New Opportunity
31. `button` Opportunities refresh
32. `button` Opportunities import export
33. `button` Open AI Markets Assistant
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>opportunities-list / firefox — tab order (33 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Opportunities Pipeline view
27. `button` Opportunities Card view
28. `button` Opportunities Grid view
29. `button` Opportunities List view
30. `button` Opportunities New Opportunity
31. `button` Opportunities refresh
32. `button` Opportunities import export
33. `button` Open AI Markets Assistant
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>opportunities-list / webkit — tab order (26 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Toggle CRM menu
3. `button` Toggle Sales menu
4. `button` Toggle Markets menu
5. `button` Toggle Financials menu
6. `button` Toggle Logistics menu
7. `button` Toggle UIM menu
8. `button` Toggle AMRO menu
9. `button` Toggle Administration menu
10. `button` Sign Out
11. `button` Go back
12. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
13. `button` SOS Services
14. `button` Open global search
15. `button` Help
16. `button` 7 unread notifications
17. `button` Switch to dark mode
18. `button` Deccan AMRO
19. `button` Opportunities Pipeline view
20. `button` Opportunities Card view
21. `button` Opportunities Grid view
22. `button` Opportunities List view
23. `button` Opportunities New Opportunity
24. `button` Opportunities refresh
25. `button` Opportunities import export
26. `button` Open AI Markets Assistant
- ❌ stop #1 <button> "Toggle CRM menu" is not visible
- ❌ stop #2 <button> "Toggle Sales menu" is not visible
- ❌ stop #3 <button> "Toggle Markets menu" is not visible
- ❌ stop #4 <button> "Toggle Financials menu" is not visible
- ❌ stop #5 <button> "Toggle Logistics menu" is not visible
- ❌ stop #6 <button> "Toggle UIM menu" is not visible
- ❌ stop #7 <button> "Toggle AMRO menu" is not visible
- ❌ stop #8 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>opportunity-new / chromium — tab order (37 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Back
27. `input` Opportunity Name *
28. `button[role=combobox]` Stage
29. `input` Amount
30. `input` Probability (%)
31. `input` Expected Close Date
32. `button[role=combobox]` Account
33. `button[role=combobox]` Primary Contact
34. `button[role=combobox]` Related Lead
35. `button[role=combobox]` Lead Source
36. `input` Type
37. `input` Forecast Category
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>opportunity-new / firefox — tab order (37 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` Back
27. `input` Opportunity Name *
28. `button[role=combobox]` Stage
29. `input` Amount
30. `input` Probability (%)
31. `input` Expected Close Date
32. `button[role=combobox]` Account
33. `button[role=combobox]` Primary Contact
34. `button[role=combobox]` Related Lead
35. `button[role=combobox]` Lead Source
36. `input` Type
37. `input` Forecast Category
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>opportunity-new / webkit — tab order (38 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Toggle CRM menu
3. `button` Toggle Sales menu
4. `button` Toggle Markets menu
5. `button` Toggle Financials menu
6. `button` Toggle Logistics menu
7. `button` Toggle UIM menu
8. `button` Toggle AMRO menu
9. `button` Toggle Administration menu
10. `button` Sign Out
11. `button` Go back
12. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
13. `button` SOS Services
14. `button` Open global search
15. `button` Help
16. `button` 7 unread notifications
17. `button` Switch to dark mode
18. `button` Deccan AMRO
19. `button` Back
20. `input` Opportunity Name *
21. `button[role=combobox]` Stage
22. `input` Amount
23. `input` Probability (%)
24. `input` Expected Close Date
25. `button[role=combobox]` Account
26. `button[role=combobox]` Primary Contact
27. `button[role=combobox]` Related Lead
28. `button[role=combobox]` Lead Source
29. `input` Type
30. `input` Forecast Category
31. `button[role=combobox]` Tenant *
32. `button[role=combobox]` Franchise
33. `textarea` Description
34. `input` Next Step
35. `textarea` Competitors
36. `button` Cancel
37. `button` Create Opportunity
38. `button` Open AI Markets Assistant
- ❌ stop #1 <button> "Toggle CRM menu" is not visible
- ❌ stop #2 <button> "Toggle Sales menu" is not visible
- ❌ stop #3 <button> "Toggle Markets menu" is not visible
- ❌ stop #4 <button> "Toggle Financials menu" is not visible
- ❌ stop #5 <button> "Toggle Logistics menu" is not visible
- ❌ stop #6 <button> "Toggle UIM menu" is not visible
- ❌ stop #7 <button> "Toggle AMRO menu" is not visible
- ❌ stop #8 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>themes / chromium — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` User
27. `button` Franchise
28. `button` Tenant
29. `button` Platform
30. `input` _(unnamed)_
31. `input` _(unnamed)_
32. `input` _(unnamed)_
33. `input` _(unnamed)_
34. `input` _(unnamed)_
35. `input` _(unnamed)_
36. `input` _(unnamed)_
37. `input` e.g., 217 91% 60%
38. `input` _(unnamed)_
39. `input` _(unnamed)_
40. `input` _(unnamed)_
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>themes / firefox — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `button` Toggle CRM menu
4. `a` Leads
5. `a` Tasks/Activities
6. `a` Opportunities
7. `a` Accounts
8. `a` Contacts
9. `button` Toggle Sales menu
10. `button` Toggle Markets menu
11. `button` Toggle Financials menu
12. `button` Toggle Logistics menu
13. `button` Toggle UIM menu
14. `button` Toggle AMRO menu
15. `button` Toggle Administration menu
16. `button` Sign Out
17. `button` Go back
18. `a` Dashboard
19. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
20. `button` SOS Services
21. `button` Open global search
22. `button` Help
23. `button` 7 unread notifications
24. `button` Switch to dark mode
25. `button` Deccan AMRO
26. `button` User
27. `button` Franchise
28. `button` Tenant
29. `button` Platform
30. `input` _(unnamed)_
31. `input` _(unnamed)_
32. `input` _(unnamed)_
33. `input` _(unnamed)_
34. `input` _(unnamed)_
35. `input` _(unnamed)_
36. `input` _(unnamed)_
37. `input` e.g., 217 91% 60%
38. `input` _(unnamed)_
39. `input` _(unnamed)_
40. `input` _(unnamed)_
- ❌ stop #2 <button> "Toggle CRM menu" is not visible
- ❌ stop #8 <button> "Toggle Sales menu" is not visible
- ❌ stop #9 <button> "Toggle Markets menu" is not visible
- ❌ stop #10 <button> "Toggle Financials menu" is not visible
- ❌ stop #11 <button> "Toggle Logistics menu" is not visible
- ❌ stop #12 <button> "Toggle UIM menu" is not visible
- ❌ stop #13 <button> "Toggle AMRO menu" is not visible
- ❌ stop #14 <button> "Toggle Administration menu" is not visible

</details>

<details><summary>themes / webkit — tab order (40 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Toggle CRM menu
3. `button` Toggle Sales menu
4. `button` Toggle Markets menu
5. `button` Toggle Financials menu
6. `button` Toggle Logistics menu
7. `button` Toggle UIM menu
8. `button` Toggle AMRO menu
9. `button` Toggle Administration menu
10. `button` Sign Out
11. `button` Go back
12. `button[role=combobox]` Logistics & Supply ChainTransportation, Warehousing, and Fre
13. `button` SOS Services
14. `button` Open global search
15. `button` Help
16. `button` 7 unread notifications
17. `button` Switch to dark mode
18. `button` Deccan AMRO
19. `button` User
20. `button` Franchise
21. `button` Tenant
22. `button` Platform
23. `input` _(unnamed)_
24. `input` _(unnamed)_
25. `input` _(unnamed)_
26. `input` _(unnamed)_
27. `input` _(unnamed)_
28. `input` _(unnamed)_
29. `input` _(unnamed)_
30. `input` e.g., 217 91% 60%
31. `input` _(unnamed)_
32. `input` _(unnamed)_
33. `input` _(unnamed)_
34. `input` _(unnamed)_
35. `input` _(unnamed)_
36. `input` _(unnamed)_
37. `input` _(unnamed)_
38. `input` e.g., 217 91% 60%
39. `input` _(unnamed)_
40. `input` _(unnamed)_
- ❌ stop #1 <button> "Toggle CRM menu" is not visible
- ❌ stop #2 <button> "Toggle Sales menu" is not visible
- ❌ stop #3 <button> "Toggle Markets menu" is not visible
- ❌ stop #4 <button> "Toggle Financials menu" is not visible
- ❌ stop #5 <button> "Toggle Logistics menu" is not visible
- ❌ stop #6 <button> "Toggle UIM menu" is not visible
- ❌ stop #7 <button> "Toggle AMRO menu" is not visible
- ❌ stop #8 <button> "Toggle Administration menu" is not visible

</details>

## ARIA structure (1280, light)

Main text = rendered characters in `#main-content` (`#root` on the login page) when the readiness gate passed; a near-empty page cannot pass by having nothing to check.

| Page | Engine | Result | Main text | Failures | Snapshot |
|---|---|---|---|---|---|
| accounts-list | chromium | ✅ | 11256 |  | [yaml](aria/accounts-list-chromium.yaml) |
| accounts-list | firefox | ✅ | 11256 |  | [yaml](aria/accounts-list-firefox.yaml) |
| accounts-list | msedge | ✅ | 11256 |  | [yaml](aria/accounts-list-msedge.yaml) |
| accounts-list | webkit | ✅ | 11109 |  | [yaml](aria/accounts-list-webkit.yaml) |
| auth | chromium | ❌ | 153 | expected exactly one heading level=1, found 0; no main landmark | [yaml](aria/auth-chromium.yaml) |
| auth | firefox | ❌ | 153 | expected exactly one heading level=1, found 0; no main landmark | [yaml](aria/auth-firefox.yaml) |
| auth | msedge | ❌ | 153 | expected exactly one heading level=1, found 0; no main landmark | [yaml](aria/auth-msedge.yaml) |
| auth | webkit | ❌ | 151 | expected exactly one heading level=1, found 0; no main landmark | [yaml](aria/auth-webkit.yaml) |
| contacts-list | chromium | ✅ | 2314 |  | [yaml](aria/contacts-list-chromium.yaml) |
| contacts-list | firefox | ✅ | 2314 |  | [yaml](aria/contacts-list-firefox.yaml) |
| contacts-list | msedge | ✅ | 2314 |  | [yaml](aria/contacts-list-msedge.yaml) |
| contacts-list | webkit | ✅ | 2311 |  | [yaml](aria/contacts-list-webkit.yaml) |
| dashboard | chromium | ✅ | 1108 |  | [yaml](aria/dashboard-chromium.yaml) |
| dashboard | firefox | ✅ | 1108 |  | [yaml](aria/dashboard-firefox.yaml) |
| dashboard | msedge | ✅ | 1108 |  | [yaml](aria/dashboard-msedge.yaml) |
| dashboard | webkit | ✅ | 1081 |  | [yaml](aria/dashboard-webkit.yaml) |
| lead-detail | chromium | ❌ | — | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |  |
| lead-detail | firefox | ❌ | — | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |  |
| lead-detail | msedge | ❌ | — | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |  |
| lead-detail | webkit | ❌ | — | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |  |
| leads-kanban | chromium | ❌ | 4523 | 82 unnamed button/link/textbox controls | [yaml](aria/leads-kanban-chromium.yaml) |
| leads-kanban | firefox | ❌ | 4523 | 82 unnamed button/link/textbox controls | [yaml](aria/leads-kanban-firefox.yaml) |
| leads-kanban | msedge | ❌ | 4523 | 82 unnamed button/link/textbox controls | [yaml](aria/leads-kanban-msedge.yaml) |
| leads-kanban | webkit | ❌ | 4543 | 82 unnamed button/link/textbox controls | [yaml](aria/leads-kanban-webkit.yaml) |
| leads-list | chromium | ❌ | 330 | expected exactly one heading level=1, found 2 | [yaml](aria/leads-list-chromium.yaml) |
| leads-list | firefox | ❌ | 1763 | expected exactly one heading level=1, found 2 | [yaml](aria/leads-list-firefox.yaml) |
| leads-list | msedge | ❌ | 1763 | expected exactly one heading level=1, found 2 | [yaml](aria/leads-list-msedge.yaml) |
| leads-list | webkit | ❌ | 337 | expected exactly one heading level=1, found 2 | [yaml](aria/leads-list-webkit.yaml) |
| opportunities-list | chromium | ✅ | 10122 |  | [yaml](aria/opportunities-list-chromium.yaml) |
| opportunities-list | firefox | ✅ | 10122 |  | [yaml](aria/opportunities-list-firefox.yaml) |
| opportunities-list | msedge | ✅ | 10122 |  | [yaml](aria/opportunities-list-msedge.yaml) |
| opportunities-list | webkit | ✅ | 10114 |  | [yaml](aria/opportunities-list-webkit.yaml) |
| opportunity-new | chromium | ✅ | 8944 |  | [yaml](aria/opportunity-new-chromium.yaml) |
| opportunity-new | firefox | ✅ | 462 |  | [yaml](aria/opportunity-new-firefox.yaml) |
| opportunity-new | msedge | ✅ | 8944 |  | [yaml](aria/opportunity-new-msedge.yaml) |
| opportunity-new | webkit | ✅ | 465 |  | [yaml](aria/opportunity-new-webkit.yaml) |
| themes | chromium | ❌ | 2829 | 25 unnamed button/link/textbox controls | [yaml](aria/themes-chromium.yaml) |
| themes | firefox | ❌ | 2757 | 25 unnamed button/link/textbox controls | [yaml](aria/themes-firefox.yaml) |
| themes | msedge | ❌ | 2829 | 25 unnamed button/link/textbox controls | [yaml](aria/themes-msedge.yaml) |
| themes | webkit | ❌ | 2881 | 25 unnamed button/link/textbox controls | [yaml](aria/themes-webkit.yaml) |

## Engine-specific divergences

A gate that passes in at least one engine and fails in another for the same page/width/mode (matrix) or page (keyboard, aria) — the cross-browser findings.

_None — every failure reproduces in all engines._

## Cells that did not complete

- aria lead-detail/chromium/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- aria lead-detail/firefox/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- aria lead-detail/msedge/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- aria lead-detail/webkit/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- keyboard lead-detail/chromium/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- keyboard lead-detail/firefox/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- keyboard lead-detail/webkit/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`

## Cells with no result file

_None — every expected cell wrote a result._

