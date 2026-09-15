# Design System Verification Report

Generated 2026-09-14 at commit `8ee3fca8` by `npm run audit:design-system`. **Do not edit by hand.**

## What this is — and is not

- **Engines:** chromium 143.0.7499.4, firefox 144.0.2, webkit 26.0, msedge system channel.
- **WebKit stands in for Safari.** Same engine, but not Safari's shell, OS font stack, or iOS; a real Safari pass is still an open item.
- **ARIA snapshots are structure only** — this is not a screen-reader session (NVDA/JAWS/VoiceOver were not run); it catches missing names and landmarks, not announcement order or live regions.
- **Viewports** are emulated at 360/768/1280/1920; no real devices.
- Gates: layout integrity (no page-level horizontal scroll, no unscrolled overflow), axe-core WCAG 2.1 A/AA `serious`+`critical`, keyboard visible-focus/no-trap (1280 light), ARIA structure (1280 light). axe `moderate`/`minor` are reported, not gated.
- **WebKit's Tab skips links by default** (Safari reaches them with Option+Tab; Playwright's WebKit does not honour Alt+Tab); link focus visibility is not gated on WebKit, and links are not counted as Tab-reachable there.
- **`lead-detail`'s cells fail the content-readiness gate**: the page renders only "Lead not found" and a "Failed to load lead" toast, so its keyboard/ARIA cells are listed under "Cells that did not complete" rather than scored. This is a known harness bug, not backend availability — `resolveFirstLead` resolves a lead the current user's tenant scope can't open (see README Appendix B).

## Running

```bash
# needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in the gitignored repo-root `env` file
npx playwright install               # chromium, firefox, webkit; msedge must be installed system-wide (channel: msedge)
npm run audit:design-system          # all 4 engines
npm run audit:design-system:quick    # chromium only
```

Start the backend services first (`npm run services:start`; each `services/*` package needs its own `npm install` beforehand) or CRM pages render with degraded data.

Run metadata:
- Backend services (npm run services:start) up: crm, amro, uim; down: sales, finance, logistics, compliance, comms, marketsWorker.
- Engines run: chromium, firefox, webkit, msedge; each with its own setup login.

## Matrix — light mode

Cell = layout + axe gates for that page/engine/width. Click to open the screenshot.

| Page | chromium 360 | chromium 768 | chromium 1280 | chromium 1920 | firefox 360 | firefox 768 | firefox 1280 | firefox 1920 | webkit 360 | webkit 768 | webkit 1280 | webkit 1920 | msedge 360 | msedge 768 | msedge 1280 | msedge 1920 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| accounts-list | [✅](screenshots/accounts-list/chromium-360-light.png) | [✅](screenshots/accounts-list/chromium-768-light.png) | [✅](screenshots/accounts-list/chromium-1280-light.png) | [✅](screenshots/accounts-list/chromium-1920-light.png) | [✅](screenshots/accounts-list/firefox-360-light.png) | [✅](screenshots/accounts-list/firefox-768-light.png) | [✅](screenshots/accounts-list/firefox-1280-light.png) | [✅](screenshots/accounts-list/firefox-1920-light.png) | [✅](screenshots/accounts-list/webkit-360-light.png) | [✅](screenshots/accounts-list/webkit-768-light.png) | [✅](screenshots/accounts-list/webkit-1280-light.png) | [✅](screenshots/accounts-list/webkit-1920-light.png) | [✅](screenshots/accounts-list/msedge-360-light.png) | [✅](screenshots/accounts-list/msedge-768-light.png) | [✅](screenshots/accounts-list/msedge-1280-light.png) | [✅](screenshots/accounts-list/msedge-1920-light.png) |
| auth | [✅](screenshots/auth/chromium-360-light.png) | [✅](screenshots/auth/chromium-768-light.png) | [✅](screenshots/auth/chromium-1280-light.png) | [✅](screenshots/auth/chromium-1920-light.png) | [✅](screenshots/auth/firefox-360-light.png) | [✅](screenshots/auth/firefox-768-light.png) | [✅](screenshots/auth/firefox-1280-light.png) | [✅](screenshots/auth/firefox-1920-light.png) | [✅](screenshots/auth/webkit-360-light.png) | [✅](screenshots/auth/webkit-768-light.png) | [✅](screenshots/auth/webkit-1280-light.png) | [✅](screenshots/auth/webkit-1920-light.png) | [✅](screenshots/auth/msedge-360-light.png) | [✅](screenshots/auth/msedge-768-light.png) | [✅](screenshots/auth/msedge-1280-light.png) | [✅](screenshots/auth/msedge-1920-light.png) |
| contacts-list | [✅](screenshots/contacts-list/chromium-360-light.png) | [✅](screenshots/contacts-list/chromium-768-light.png) | [✅](screenshots/contacts-list/chromium-1280-light.png) | [✅](screenshots/contacts-list/chromium-1920-light.png) | [✅](screenshots/contacts-list/firefox-360-light.png) | [✅](screenshots/contacts-list/firefox-768-light.png) | [✅](screenshots/contacts-list/firefox-1280-light.png) | [✅](screenshots/contacts-list/firefox-1920-light.png) | [✅](screenshots/contacts-list/webkit-360-light.png) | [✅](screenshots/contacts-list/webkit-768-light.png) | [✅](screenshots/contacts-list/webkit-1280-light.png) | [✅](screenshots/contacts-list/webkit-1920-light.png) | [✅](screenshots/contacts-list/msedge-360-light.png) | [✅](screenshots/contacts-list/msedge-768-light.png) | [✅](screenshots/contacts-list/msedge-1280-light.png) | [✅](screenshots/contacts-list/msedge-1920-light.png) |
| dashboard | [✅](screenshots/dashboard/chromium-360-light.png) | [✅](screenshots/dashboard/chromium-768-light.png) | [✅](screenshots/dashboard/chromium-1280-light.png) | [✅](screenshots/dashboard/chromium-1920-light.png) | [✅](screenshots/dashboard/firefox-360-light.png) | [✅](screenshots/dashboard/firefox-768-light.png) | [✅](screenshots/dashboard/firefox-1280-light.png) | [✅](screenshots/dashboard/firefox-1920-light.png) | [❌](screenshots/dashboard/webkit-360-light.png) | [✅](screenshots/dashboard/webkit-768-light.png) | [✅](screenshots/dashboard/webkit-1280-light.png) | [✅](screenshots/dashboard/webkit-1920-light.png) | [✅](screenshots/dashboard/msedge-360-light.png) | [✅](screenshots/dashboard/msedge-768-light.png) | [✅](screenshots/dashboard/msedge-1280-light.png) | [✅](screenshots/dashboard/msedge-1920-light.png) |
| lead-detail | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| leads-kanban | [✅](screenshots/leads-kanban/chromium-360-light.png) | [✅](screenshots/leads-kanban/chromium-768-light.png) | [✅](screenshots/leads-kanban/chromium-1280-light.png) | [✅](screenshots/leads-kanban/chromium-1920-light.png) | [✅](screenshots/leads-kanban/firefox-360-light.png) | [✅](screenshots/leads-kanban/firefox-768-light.png) | [✅](screenshots/leads-kanban/firefox-1280-light.png) | [✅](screenshots/leads-kanban/firefox-1920-light.png) | ❌ | [✅](screenshots/leads-kanban/webkit-768-light.png) | [✅](screenshots/leads-kanban/webkit-1280-light.png) | [✅](screenshots/leads-kanban/webkit-1920-light.png) | [✅](screenshots/leads-kanban/msedge-360-light.png) | [✅](screenshots/leads-kanban/msedge-768-light.png) | [✅](screenshots/leads-kanban/msedge-1280-light.png) | [✅](screenshots/leads-kanban/msedge-1920-light.png) |
| leads-list | [✅](screenshots/leads-list/chromium-360-light.png) | [✅](screenshots/leads-list/chromium-768-light.png) | [✅](screenshots/leads-list/chromium-1280-light.png) | [✅](screenshots/leads-list/chromium-1920-light.png) | [✅](screenshots/leads-list/firefox-360-light.png) | [✅](screenshots/leads-list/firefox-768-light.png) | [✅](screenshots/leads-list/firefox-1280-light.png) | [✅](screenshots/leads-list/firefox-1920-light.png) | [✅](screenshots/leads-list/webkit-360-light.png) | [✅](screenshots/leads-list/webkit-768-light.png) | [✅](screenshots/leads-list/webkit-1280-light.png) | [✅](screenshots/leads-list/webkit-1920-light.png) | [✅](screenshots/leads-list/msedge-360-light.png) | [✅](screenshots/leads-list/msedge-768-light.png) | [✅](screenshots/leads-list/msedge-1280-light.png) | [✅](screenshots/leads-list/msedge-1920-light.png) |
| opportunities-list | [✅](screenshots/opportunities-list/chromium-360-light.png) | [✅](screenshots/opportunities-list/chromium-768-light.png) | [✅](screenshots/opportunities-list/chromium-1280-light.png) | [✅](screenshots/opportunities-list/chromium-1920-light.png) | [✅](screenshots/opportunities-list/firefox-360-light.png) | [✅](screenshots/opportunities-list/firefox-768-light.png) | [✅](screenshots/opportunities-list/firefox-1280-light.png) | [✅](screenshots/opportunities-list/firefox-1920-light.png) | [✅](screenshots/opportunities-list/webkit-360-light.png) | [✅](screenshots/opportunities-list/webkit-768-light.png) | [✅](screenshots/opportunities-list/webkit-1280-light.png) | [✅](screenshots/opportunities-list/webkit-1920-light.png) | [✅](screenshots/opportunities-list/msedge-360-light.png) | [✅](screenshots/opportunities-list/msedge-768-light.png) | [✅](screenshots/opportunities-list/msedge-1280-light.png) | [✅](screenshots/opportunities-list/msedge-1920-light.png) |
| opportunity-new | [✅](screenshots/opportunity-new/chromium-360-light.png) | [✅](screenshots/opportunity-new/chromium-768-light.png) | [✅](screenshots/opportunity-new/chromium-1280-light.png) | [✅](screenshots/opportunity-new/chromium-1920-light.png) | [✅](screenshots/opportunity-new/firefox-360-light.png) | [✅](screenshots/opportunity-new/firefox-768-light.png) | [✅](screenshots/opportunity-new/firefox-1280-light.png) | [✅](screenshots/opportunity-new/firefox-1920-light.png) | [✅](screenshots/opportunity-new/webkit-360-light.png) | [✅](screenshots/opportunity-new/webkit-768-light.png) | [✅](screenshots/opportunity-new/webkit-1280-light.png) | [✅](screenshots/opportunity-new/webkit-1920-light.png) | [✅](screenshots/opportunity-new/msedge-360-light.png) | [✅](screenshots/opportunity-new/msedge-768-light.png) | [✅](screenshots/opportunity-new/msedge-1280-light.png) | [✅](screenshots/opportunity-new/msedge-1920-light.png) |
| themes | [❌](screenshots/themes/chromium-360-light.png) | [❌](screenshots/themes/chromium-768-light.png) | [❌](screenshots/themes/chromium-1280-light.png) | [❌](screenshots/themes/chromium-1920-light.png) | [❌](screenshots/themes/firefox-360-light.png) | [❌](screenshots/themes/firefox-768-light.png) | [❌](screenshots/themes/firefox-1280-light.png) | [❌](screenshots/themes/firefox-1920-light.png) | [❌](screenshots/themes/webkit-360-light.png) | [❌](screenshots/themes/webkit-768-light.png) | [❌](screenshots/themes/webkit-1280-light.png) | [❌](screenshots/themes/webkit-1920-light.png) | [❌](screenshots/themes/msedge-360-light.png) | [❌](screenshots/themes/msedge-768-light.png) | [❌](screenshots/themes/msedge-1280-light.png) | [❌](screenshots/themes/msedge-1920-light.png) |

## Matrix — dark mode

Cell = layout + axe gates for that page/engine/width. Click to open the screenshot.

| Page | chromium 360 | chromium 768 | chromium 1280 | chromium 1920 | firefox 360 | firefox 768 | firefox 1280 | firefox 1920 | webkit 360 | webkit 768 | webkit 1280 | webkit 1920 | msedge 360 | msedge 768 | msedge 1280 | msedge 1920 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| accounts-list | [✅](screenshots/accounts-list/chromium-360-dark.png) | [✅](screenshots/accounts-list/chromium-768-dark.png) | [✅](screenshots/accounts-list/chromium-1280-dark.png) | [✅](screenshots/accounts-list/chromium-1920-dark.png) | [✅](screenshots/accounts-list/firefox-360-dark.png) | [✅](screenshots/accounts-list/firefox-768-dark.png) | [✅](screenshots/accounts-list/firefox-1280-dark.png) | [✅](screenshots/accounts-list/firefox-1920-dark.png) | [✅](screenshots/accounts-list/webkit-360-dark.png) | [✅](screenshots/accounts-list/webkit-768-dark.png) | [✅](screenshots/accounts-list/webkit-1280-dark.png) | [✅](screenshots/accounts-list/webkit-1920-dark.png) | [✅](screenshots/accounts-list/msedge-360-dark.png) | [✅](screenshots/accounts-list/msedge-768-dark.png) | [✅](screenshots/accounts-list/msedge-1280-dark.png) | [✅](screenshots/accounts-list/msedge-1920-dark.png) |
| auth | [✅](screenshots/auth/chromium-360-dark.png) | [✅](screenshots/auth/chromium-768-dark.png) | [✅](screenshots/auth/chromium-1280-dark.png) | [✅](screenshots/auth/chromium-1920-dark.png) | [✅](screenshots/auth/firefox-360-dark.png) | [✅](screenshots/auth/firefox-768-dark.png) | [✅](screenshots/auth/firefox-1280-dark.png) | [✅](screenshots/auth/firefox-1920-dark.png) | [✅](screenshots/auth/webkit-360-dark.png) | [✅](screenshots/auth/webkit-768-dark.png) | [✅](screenshots/auth/webkit-1280-dark.png) | [✅](screenshots/auth/webkit-1920-dark.png) | [✅](screenshots/auth/msedge-360-dark.png) | [✅](screenshots/auth/msedge-768-dark.png) | [✅](screenshots/auth/msedge-1280-dark.png) | [✅](screenshots/auth/msedge-1920-dark.png) |
| contacts-list | [✅](screenshots/contacts-list/chromium-360-dark.png) | [✅](screenshots/contacts-list/chromium-768-dark.png) | [✅](screenshots/contacts-list/chromium-1280-dark.png) | [✅](screenshots/contacts-list/chromium-1920-dark.png) | [✅](screenshots/contacts-list/firefox-360-dark.png) | [✅](screenshots/contacts-list/firefox-768-dark.png) | [✅](screenshots/contacts-list/firefox-1280-dark.png) | [✅](screenshots/contacts-list/firefox-1920-dark.png) | [✅](screenshots/contacts-list/webkit-360-dark.png) | [✅](screenshots/contacts-list/webkit-768-dark.png) | [✅](screenshots/contacts-list/webkit-1280-dark.png) | [✅](screenshots/contacts-list/webkit-1920-dark.png) | [✅](screenshots/contacts-list/msedge-360-dark.png) | [✅](screenshots/contacts-list/msedge-768-dark.png) | [✅](screenshots/contacts-list/msedge-1280-dark.png) | [✅](screenshots/contacts-list/msedge-1920-dark.png) |
| dashboard | [✅](screenshots/dashboard/chromium-360-dark.png) | [✅](screenshots/dashboard/chromium-768-dark.png) | [✅](screenshots/dashboard/chromium-1280-dark.png) | [✅](screenshots/dashboard/chromium-1920-dark.png) | [✅](screenshots/dashboard/firefox-360-dark.png) | [✅](screenshots/dashboard/firefox-768-dark.png) | [✅](screenshots/dashboard/firefox-1280-dark.png) | [✅](screenshots/dashboard/firefox-1920-dark.png) | [✅](screenshots/dashboard/webkit-360-dark.png) | [✅](screenshots/dashboard/webkit-768-dark.png) | [✅](screenshots/dashboard/webkit-1280-dark.png) | [✅](screenshots/dashboard/webkit-1920-dark.png) | [✅](screenshots/dashboard/msedge-360-dark.png) | [✅](screenshots/dashboard/msedge-768-dark.png) | [✅](screenshots/dashboard/msedge-1280-dark.png) | [✅](screenshots/dashboard/msedge-1920-dark.png) |
| lead-detail | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| leads-kanban | [❌](screenshots/leads-kanban/chromium-360-dark.png) | [❌](screenshots/leads-kanban/chromium-768-dark.png) | [❌](screenshots/leads-kanban/chromium-1280-dark.png) | [❌](screenshots/leads-kanban/chromium-1920-dark.png) | [❌](screenshots/leads-kanban/firefox-360-dark.png) | [❌](screenshots/leads-kanban/firefox-768-dark.png) | [❌](screenshots/leads-kanban/firefox-1280-dark.png) | [❌](screenshots/leads-kanban/firefox-1920-dark.png) | [❌](screenshots/leads-kanban/webkit-360-dark.png) | [❌](screenshots/leads-kanban/webkit-768-dark.png) | [❌](screenshots/leads-kanban/webkit-1280-dark.png) | [❌](screenshots/leads-kanban/webkit-1920-dark.png) | [❌](screenshots/leads-kanban/msedge-360-dark.png) | [❌](screenshots/leads-kanban/msedge-768-dark.png) | [❌](screenshots/leads-kanban/msedge-1280-dark.png) | [❌](screenshots/leads-kanban/msedge-1920-dark.png) |
| leads-list | [✅](screenshots/leads-list/chromium-360-dark.png) | [✅](screenshots/leads-list/chromium-768-dark.png) | [✅](screenshots/leads-list/chromium-1280-dark.png) | [✅](screenshots/leads-list/chromium-1920-dark.png) | [✅](screenshots/leads-list/firefox-360-dark.png) | [✅](screenshots/leads-list/firefox-768-dark.png) | [✅](screenshots/leads-list/firefox-1280-dark.png) | [✅](screenshots/leads-list/firefox-1920-dark.png) | [✅](screenshots/leads-list/webkit-360-dark.png) | [✅](screenshots/leads-list/webkit-768-dark.png) | [✅](screenshots/leads-list/webkit-1280-dark.png) | [✅](screenshots/leads-list/webkit-1920-dark.png) | [✅](screenshots/leads-list/msedge-360-dark.png) | [✅](screenshots/leads-list/msedge-768-dark.png) | [✅](screenshots/leads-list/msedge-1280-dark.png) | [✅](screenshots/leads-list/msedge-1920-dark.png) |
| opportunities-list | [✅](screenshots/opportunities-list/chromium-360-dark.png) | [✅](screenshots/opportunities-list/chromium-768-dark.png) | [✅](screenshots/opportunities-list/chromium-1280-dark.png) | [✅](screenshots/opportunities-list/chromium-1920-dark.png) | [✅](screenshots/opportunities-list/firefox-360-dark.png) | [✅](screenshots/opportunities-list/firefox-768-dark.png) | [✅](screenshots/opportunities-list/firefox-1280-dark.png) | [✅](screenshots/opportunities-list/firefox-1920-dark.png) | [✅](screenshots/opportunities-list/webkit-360-dark.png) | [✅](screenshots/opportunities-list/webkit-768-dark.png) | [✅](screenshots/opportunities-list/webkit-1280-dark.png) | [✅](screenshots/opportunities-list/webkit-1920-dark.png) | [✅](screenshots/opportunities-list/msedge-360-dark.png) | [✅](screenshots/opportunities-list/msedge-768-dark.png) | [✅](screenshots/opportunities-list/msedge-1280-dark.png) | [✅](screenshots/opportunities-list/msedge-1920-dark.png) |
| opportunity-new | [✅](screenshots/opportunity-new/chromium-360-dark.png) | [✅](screenshots/opportunity-new/chromium-768-dark.png) | [✅](screenshots/opportunity-new/chromium-1280-dark.png) | [✅](screenshots/opportunity-new/chromium-1920-dark.png) | [✅](screenshots/opportunity-new/firefox-360-dark.png) | [✅](screenshots/opportunity-new/firefox-768-dark.png) | [✅](screenshots/opportunity-new/firefox-1280-dark.png) | [✅](screenshots/opportunity-new/firefox-1920-dark.png) | [✅](screenshots/opportunity-new/webkit-360-dark.png) | [✅](screenshots/opportunity-new/webkit-768-dark.png) | [✅](screenshots/opportunity-new/webkit-1280-dark.png) | [✅](screenshots/opportunity-new/webkit-1920-dark.png) | [✅](screenshots/opportunity-new/msedge-360-dark.png) | [✅](screenshots/opportunity-new/msedge-768-dark.png) | [✅](screenshots/opportunity-new/msedge-1280-dark.png) | [✅](screenshots/opportunity-new/msedge-1920-dark.png) |
| themes | [❌](screenshots/themes/chromium-360-dark.png) | [❌](screenshots/themes/chromium-768-dark.png) | [❌](screenshots/themes/chromium-1280-dark.png) | [❌](screenshots/themes/chromium-1920-dark.png) | [❌](screenshots/themes/firefox-360-dark.png) | [❌](screenshots/themes/firefox-768-dark.png) | [❌](screenshots/themes/firefox-1280-dark.png) | [❌](screenshots/themes/firefox-1920-dark.png) | [❌](screenshots/themes/webkit-360-dark.png) | [❌](screenshots/themes/webkit-768-dark.png) | [❌](screenshots/themes/webkit-1280-dark.png) | [❌](screenshots/themes/webkit-1920-dark.png) | [❌](screenshots/themes/msedge-360-dark.png) | [❌](screenshots/themes/msedge-768-dark.png) | [❌](screenshots/themes/msedge-1280-dark.png) | [❌](screenshots/themes/msedge-1920-dark.png) |

## axe-core violations by rule

### `label` — critical (gated)

Form elements must have labels ([rule](https://dequeuniversity.com/rules/axe/4.11/label?application=axeAPI))

Affected cells (32): themes/chromium/1280/dark, themes/chromium/1280/light, themes/chromium/1920/dark, themes/chromium/1920/light, themes/chromium/360/dark, themes/chromium/360/light, themes/chromium/768/dark, themes/chromium/768/light, themes/firefox/1280/dark, themes/firefox/1280/light, themes/firefox/1920/dark, themes/firefox/1920/light, themes/firefox/360/dark, themes/firefox/360/light, themes/firefox/768/dark, themes/firefox/768/light, themes/msedge/1280/dark, themes/msedge/1280/light, themes/msedge/1920/dark, themes/msedge/1920/light, themes/msedge/360/dark, themes/msedge/360/light, themes/msedge/768/dark, themes/msedge/768/light, …
Sample targets: `src/pages/dashboard/ThemeManagement.tsx:445 input[data-component-line="445"]`, `src/pages/dashboard/ThemeManagement.tsx:525 input[data-component-line="525"]`, `src/pages/dashboard/ThemeManagement.tsx:526 input[data-component-line="526"]`

### `color-contrast` — serious (gated)

Elements must meet minimum color contrast ratio thresholds ([rule](https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=axeAPI))

Affected cells (33): dashboard/webkit/360/light, leads-kanban/chromium/1280/dark, leads-kanban/chromium/1920/dark, leads-kanban/chromium/360/dark, leads-kanban/chromium/768/dark, leads-kanban/firefox/1280/dark, leads-kanban/firefox/1920/dark, leads-kanban/firefox/360/dark, leads-kanban/firefox/768/dark, leads-kanban/msedge/1280/dark, leads-kanban/msedge/1920/dark, leads-kanban/msedge/360/dark, leads-kanban/msedge/768/dark, leads-kanban/webkit/1280/dark, leads-kanban/webkit/1920/dark, leads-kanban/webkit/360/dark, leads-kanban/webkit/768/dark, themes/chromium/1280/dark, themes/chromium/1920/dark, themes/chromium/360/dark, themes/chromium/768/dark, themes/firefox/1280/dark, themes/firefox/1920/dark, themes/firefox/360/dark, …
Sample targets: `src/components/dashboard/crm/widgets/SalesForecast.tsx:151 span[data-component-line="151"]`, `src/components/dashboard/crm/widgets/RevenueYTD.tsx:111 .font-semibold[data-component-line="111"][data-lov-name="span"]`, `src/components/dashboard/crm/widgets/RevenueYTD.tsx:127 span[data-component-line="127"]`

## Layout failures

- **themes** chromium 360px dark:
  - `src/pages/dashboard/ThemeManagement.tsx:386 button.inline-flex.items-center.justify-center right=388 > 360`
- **themes** chromium 360px light:
  - `src/pages/dashboard/ThemeManagement.tsx:386 button.inline-flex.items-center.justify-center right=388 > 360`
- **themes** firefox 360px dark:
  - `src/pages/dashboard/ThemeManagement.tsx:386 button.inline-flex.items-center.justify-center right=388 > 360`
- **themes** firefox 360px light:
  - `src/pages/dashboard/ThemeManagement.tsx:386 button.inline-flex.items-center.justify-center right=388 > 360`
- **themes** msedge 360px dark:
  - `src/pages/dashboard/ThemeManagement.tsx:386 button.inline-flex.items-center.justify-center right=388 > 360`
- **themes** msedge 360px light:
  - `src/pages/dashboard/ThemeManagement.tsx:386 button.inline-flex.items-center.justify-center right=388 > 360`
- **themes** webkit 360px dark:
  - `src/pages/dashboard/ThemeManagement.tsx:386 button.inline-flex.items-center.justify-center right=388 > 360`
- **themes** webkit 360px light:
  - `src/pages/dashboard/ThemeManagement.tsx:386 button.inline-flex.items-center.justify-center right=388 > 360`

Screenshots that are viewport-only because the engine refused a full-page capture (the page height is itself a finding):
- opportunities-list webkit 360 dark: viewport screenshot — page is 18616px tall
- opportunities-list webkit 360 light: viewport screenshot — page is 18616px tall

## Keyboard walk (1280, light)

| Page | Engine | Stops (visited/focusable) | Result | First failure |
|---|---|---|---|---|
| accounts-list | chromium | 40/130 | ✅ |  |
| accounts-list | firefox | 40/130 | ✅ |  |
| accounts-list | webkit | 40/122 | ✅ |  |
| auth | chromium | 6/6 | ✅ |  |
| auth | firefox | 6/6 | ✅ |  |
| auth | webkit | 3/3 | ✅ |  |
| contacts-list | chromium | 40/55 | ✅ |  |
| contacts-list | firefox | 40/55 | ✅ |  |
| contacts-list | webkit | 19/19 | ✅ |  |
| dashboard | chromium | 19/19 | ✅ |  |
| dashboard | firefox | 19/19 | ✅ |  |
| dashboard | webkit | 12/12 | ✅ |  |
| dashboard-onboarding | chromium | 2/21 | ❌ | focus confined to 2 of 21 focusable elements (possible trap/overlay) |
| dashboard-onboarding | firefox | 2/21 | ❌ | focus confined to 2 of 21 focusable elements (possible trap/overlay) |
| dashboard-onboarding | webkit | 2/14 | ❌ | focus confined to 2 of 14 focusable elements (possible trap/overlay) |
| lead-detail | chromium | 0 | ❌ | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |
| lead-detail | firefox | 0 | ❌ | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |
| lead-detail | webkit | 0 | ❌ | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |
| leads-kanban | chromium | 34/182 | ✅ |  |
| leads-kanban | firefox | 34/182 | ✅ |  |
| leads-kanban | webkit | 40/175 | ✅ |  |
| leads-list | chromium | 40/38 | ✅ |  |
| leads-list | firefox | 40/38 | ✅ |  |
| leads-list | webkit | 40/31 | ❌ | stop #36 <button> "Select Lead1770725149462 TestUser" is not visible |
| opportunities-list | chromium | 25/25 | ✅ |  |
| opportunities-list | firefox | 25/25 | ✅ |  |
| opportunities-list | webkit | 18/18 | ✅ |  |
| opportunity-new | chromium | 37/37 | ✅ |  |
| opportunity-new | firefox | 37/37 | ✅ |  |
| opportunity-new | webkit | 0 | ❌ | expect(page).not.toHaveURL(expected) failed — Expected pattern: not /\/auth(\?\|$)/ |
| themes | chromium | 40/303 | ✅ |  |
| themes | firefox | 40/303 | ✅ |  |
| themes | webkit | 0 | ❌ | expect(locator).toBeVisible() failed — Locator: locator('#main-content') |

<details><summary>accounts-list / chromium — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `a` Dashboard
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

</details>

<details><summary>accounts-list / firefox — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `a` Dashboard
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

</details>

<details><summary>accounts-list / webkit — tab order (40 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Sign Out
3. `button` Go back
4. `button[role=combobox]` Domain
5. `button` SOS Services
6. `button` Open global search
7. `button` Help
8. `button` 7 unread notifications
9. `button` Switch to dark mode
10. `button` Deccan AMRO
11. `button` New
12. `button` Accounts Pipeline view
13. `button` Accounts Card view
14. `button` Accounts Grid view
15. `button` Accounts List view
16. `button` Accounts New Account
17. `button` Accounts refresh
18. `button` Accounts import export
19. `button` DeDup (6)
20. `input` Search accounts...
21. `div` MGL Matrix Test Customer
22. `div` Hapag-Lloyd
23. `div` CMA CGM
24. `div` Maersk
25. `div` MSC
26. `div` Zim
27. `div` Generic Carrier
28. `div` Maersk Line
29. `div` EVERGREEN LINES
30. `div` Company 1770725185010
31. `div` Company 1770725149462
32. `div` Company 1770725119442
33. `div` Adv Test Customer 1770699707535
34. `div` Adv Test Customer 1770699542961
35. `div` Adv Test Customer 1770699137977
36. `div` Adv Test Customer 1770699096685
37. `div` Adv Test Customer 1770697948978
38. `div` Adv Test Customer 1770692162285
39. `div` Adv Test Customer 1770691574037
40. `div` Adv Test Customer 1770691544297

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
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Contacts Pipeline view
19. `button` Contacts Card view
20. `button` Contacts Grid view
21. `button` Contacts List view
22. `button` Contacts New Contact
23. `button` Contacts refresh
24. `button` Contacts import export
25. `input` Search contacts...
26. `a` Lead1770725185010 TestUserCompany 1770725185010lead177072518
27. `a` Lead1770725149462 TestUserCompany 1770725149462lead177072514
28. `a` Lead1770725119442 TestUserCompany 1770725119442lead177072511
29. `a` John DoeAdv Test Customer 1770684216319john.doe.177068421640
30. `a` Lead1770602498092 TestUserCompany 1770602498092lead177060249
31. `a` Lead1770561981489 TestUserCompany 1770561981489lead177056198
32. `a` Lead1770468792440 TestUserCompany 1770468792440lead177046879
33. `a` Lead1770468651350 TestUserCompany 1770468651350lead177046865
34. `a` Lead1770468538797 TestUserCompany 1770468538797lead177046853
35. `a` Lead1770468476163 TestUserCompany 1770468476163lead177046847
36. `a` Lead1770468374368 TestUserCompany 1770468374368lead177046837
37. `a` Lead1770467882360 TestUserCompany 1770467882360lead177046788
38. `a` Lead1770467571856 TestUserCompany 1770467571856lead177046757
39. `a` Lead1770467513624 TestUserCompany 1770467513624lead177046751
40. `a` Lead1770467426655 TestUserCompany 1770467426655lead177046742

</details>

<details><summary>contacts-list / firefox — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Contacts Pipeline view
19. `button` Contacts Card view
20. `button` Contacts Grid view
21. `button` Contacts List view
22. `button` Contacts New Contact
23. `button` Contacts refresh
24. `button` Contacts import export
25. `input` Search contacts...
26. `a` Lead1770725185010 TestUserCompany 1770725185010lead177072518
27. `a` Lead1770725149462 TestUserCompany 1770725149462lead177072514
28. `a` Lead1770725119442 TestUserCompany 1770725119442lead177072511
29. `a` John DoeAdv Test Customer 1770684216319john.doe.177068421640
30. `a` Lead1770602498092 TestUserCompany 1770602498092lead177060249
31. `a` Lead1770561981489 TestUserCompany 1770561981489lead177056198
32. `a` Lead1770468792440 TestUserCompany 1770468792440lead177046879
33. `a` Lead1770468651350 TestUserCompany 1770468651350lead177046865
34. `a` Lead1770468538797 TestUserCompany 1770468538797lead177046853
35. `a` Lead1770468476163 TestUserCompany 1770468476163lead177046847
36. `a` Lead1770468374368 TestUserCompany 1770468374368lead177046837
37. `a` Lead1770467882360 TestUserCompany 1770467882360lead177046788
38. `a` Lead1770467571856 TestUserCompany 1770467571856lead177046757
39. `a` Lead1770467513624 TestUserCompany 1770467513624lead177046751
40. `a` Lead1770467426655 TestUserCompany 1770467426655lead177046742

</details>

<details><summary>contacts-list / webkit — tab order (19 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Sign Out
3. `button` Go back
4. `button[role=combobox]` Domain
5. `button` SOS Services
6. `button` Open global search
7. `button` Help
8. `button` 7 unread notifications
9. `button` Switch to dark mode
10. `button` Deccan AMRO
11. `button` Contacts Pipeline view
12. `button` Contacts Card view
13. `button` Contacts Grid view
14. `button` Contacts List view
15. `button` Contacts New Contact
16. `button` Contacts refresh
17. `button` Contacts import export
18. `input` Search contacts...
19. `button` Open AI Markets Assistant

</details>

<details><summary>dashboard / chromium — tab order (19 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Create Action
19. `button` Open AI Markets Assistant

</details>

<details><summary>dashboard / firefox — tab order (19 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Create Action
19. `button` Open AI Markets Assistant

</details>

<details><summary>dashboard / webkit — tab order (12 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Sign Out
3. `button` Go back
4. `button[role=combobox]` Domain
5. `button` SOS Services
6. `button` Open global search
7. `button` Help
8. `button` 7 unread notifications
9. `button` Switch to dark mode
10. `button` Deccan AMRO
11. `button` Create Action
12. `button` Open AI Markets Assistant

</details>

<details><summary>dashboard-onboarding / chromium — tab order (2 stops)</summary>

1. `button[role=button]` Skip
2. `button[role=button]` Next (Step 1 of 5)
- ❌ focus confined to 2 of 21 focusable elements (possible trap/overlay)

</details>

<details><summary>dashboard-onboarding / firefox — tab order (2 stops)</summary>

1. `button[role=button]` Skip
2. `button[role=button]` Next (Step 1 of 5)
- ❌ focus confined to 2 of 21 focusable elements (possible trap/overlay)

</details>

<details><summary>dashboard-onboarding / webkit — tab order (2 stops)</summary>

1. `button[role=button]` Skip
2. `button[role=button]` Next (Step 1 of 5)
- ❌ focus confined to 2 of 14 focusable elements (possible trap/overlay)

</details>

<details><summary>leads-kanban / chromium — tab order (34 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Leads Pipeline view
19. `button` Leads Card view
20. `button` Leads Grid view
21. `button` Leads List view
22. `button` Leads New Lead
23. `button` Leads refresh
24. `button` Leads import export
25. `button` Leads Analytics view
26. `div[role=tabpanel]` StatusSourceCustom FieldsNew Lead1Total Value$12,000mediumJa
27. `input` Start date
28. `input` End date
29. `input` Search...
30. `button` Status
31. `button` Source
32. `button` Custom Fields
33. `div` _(unnamed)_
34. `div` New Lead1Total Value$12,000mediumJan 20Sarvesh Gupta €12,000

</details>

<details><summary>leads-kanban / firefox — tab order (34 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Leads Pipeline view
19. `button` Leads Card view
20. `button` Leads Grid view
21. `button` Leads List view
22. `button` Leads New Lead
23. `button` Leads refresh
24. `button` Leads import export
25. `button` Leads Analytics view
26. `div[role=tabpanel]` StatusSourceCustom FieldsNew Lead1Total Value$12,000mediumJa
27. `input` Start date
28. `input` End date
29. `input` Search...
30. `div` StatusSourceCustom Fields
31. `button` Status
32. `button` Source
33. `button` Custom Fields
34. `div` _(unnamed)_

</details>

<details><summary>leads-kanban / webkit — tab order (40 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Sign Out
3. `button` Go back
4. `button[role=combobox]` Domain
5. `button` SOS Services
6. `button` Open global search
7. `button` Help
8. `button` 7 unread notifications
9. `button` Switch to dark mode
10. `button` Deccan AMRO
11. `button` Leads Pipeline view
12. `button` Leads Card view
13. `button` Leads Grid view
14. `button` Leads List view
15. `button` Leads New Lead
16. `button` Leads refresh
17. `button` Leads import export
18. `button` Leads Analytics view
19. `div[role=tabpanel]` StatusSourceCustom FieldsNew Lead1Total Value$12,000mediumJa
20. `input` Start date
21. `input` End date
22. `input` Search...
23. `button` Status
24. `button` Source
25. `button` Custom Fields
26. `div` _(unnamed)_
27. `div` New Lead1Total Value$12,000mediumJan 20Sarvesh Gupta €12,000
28. `button[role=button]` Drag New Lead to reorder
29. `button` Add card to New Lead
30. `button` Column options for New Lead
31. `div` mediumJan 20Sarvesh Gupta €12,000
32. `button[role=button]` Drag Sarvesh Gupta to another column
33. `button` View Sarvesh Gupta
34. `button` Actions for Sarvesh Gupta
35. `button[role=button]` Drag Contacted to reorder
36. `button` Add card to Contacted
37. `button` Column options for Contacted
38. `div` lowFeb 7Lead1770463359225 TestUserCompany 1770463359225 €0
39. `button[role=button]` Drag Lead1770463359225 TestUser to another column
40. `button` View Lead1770463359225 TestUser

</details>

<details><summary>leads-list / chromium — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Leads Pipeline view
19. `button` Leads Card view
20. `button` Leads Grid view
21. `button` Leads List view
22. `button` Leads New Lead
23. `button` Leads refresh
24. `button` Leads import export
25. `button` Leads Analytics view
26. `button` Refresh
27. `button` Import/Export
28. `button` New Lead
29. `input` Search leads...
30. `button[role=combobox]` Filter by status
31. `button[role=combobox]` Filter by owner
32. `button[role=combobox]` Filter by score
33. `button[role=combobox]` Group By
34. `input` Min Value
35. `input` Max Value
36. `button[role=combobox]` Name match type
37. `input` Lead Name
38. `button` Fields
39. `button[role=checkbox]` Select Lead1770725185010 TestUser
40. `button` Open Lead1770725185010 TestUser

</details>

<details><summary>leads-list / firefox — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Leads Pipeline view
19. `button` Leads Card view
20. `button` Leads Grid view
21. `button` Leads List view
22. `button` Leads New Lead
23. `button` Leads refresh
24. `button` Leads import export
25. `button` Leads Analytics view
26. `button` Refresh
27. `button` Import/Export
28. `button` New Lead
29. `div` All StatusAny OwnerAll ScoresNo Grouping-ContainsFieldsClear
30. `input` Search leads...
31. `button[role=combobox]` Filter by status
32. `button[role=combobox]` Filter by owner
33. `button[role=combobox]` Filter by score
34. `button[role=combobox]` Group By
35. `input` Min Value
36. `input` Max Value
37. `button[role=combobox]` Name match type
38. `input` Lead Name
39. `button` Fields
40. `button[role=checkbox]` Select Lead1770725185010 TestUser

</details>

<details><summary>leads-list / webkit — tab order (40 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Sign Out
3. `button` Go back
4. `button[role=combobox]` Domain
5. `button` SOS Services
6. `button` Open global search
7. `button` Help
8. `button` 7 unread notifications
9. `button` Switch to dark mode
10. `button` Deccan AMRO
11. `button` Leads Pipeline view
12. `button` Leads Card view
13. `button` Leads Grid view
14. `button` Leads List view
15. `button` Leads New Lead
16. `button` Leads refresh
17. `button` Leads import export
18. `button` Leads Analytics view
19. `button` Refresh
20. `button` Import/Export
21. `button` New Lead
22. `input` Search leads...
23. `button[role=combobox]` Filter by status
24. `button[role=combobox]` Filter by owner
25. `button[role=combobox]` Filter by score
26. `button[role=combobox]` Group By
27. `input` Min Value
28. `input` Max Value
29. `button[role=combobox]` Name match type
30. `input` Lead Name
31. `button` Fields
32. `button[role=checkbox]` Select Lead1770725185010 TestUser
33. `button` Open Lead1770725185010 TestUser
34. `button` Email Lead1770725185010 TestUser
35. `button` Edit Lead1770725185010 TestUser
36. `button` Delete Lead1770725185010 TestUser
37. `button[role=checkbox]` Select Lead1770725149462 TestUser
38. `button` Open Lead1770725149462 TestUser
39. `button` Email Lead1770725149462 TestUser
40. `button` Edit Lead1770725149462 TestUser
- ❌ stop #36 <button> "Select Lead1770725149462 TestUser" is not visible

</details>

<details><summary>opportunities-list / chromium — tab order (25 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Opportunities Pipeline view
19. `button` Opportunities Card view
20. `button` Opportunities Grid view
21. `button` Opportunities List view
22. `button` Opportunities New Opportunity
23. `button` Opportunities refresh
24. `button` Opportunities import export
25. `button` Open AI Markets Assistant

</details>

<details><summary>opportunities-list / firefox — tab order (25 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Opportunities Pipeline view
19. `button` Opportunities Card view
20. `button` Opportunities Grid view
21. `button` Opportunities List view
22. `button` Opportunities New Opportunity
23. `button` Opportunities refresh
24. `button` Opportunities import export
25. `button` Open AI Markets Assistant

</details>

<details><summary>opportunities-list / webkit — tab order (18 stops)</summary>

1. `button` Toggle Sidebar
2. `button` Sign Out
3. `button` Go back
4. `button[role=combobox]` Domain
5. `button` SOS Services
6. `button` Open global search
7. `button` Help
8. `button` 7 unread notifications
9. `button` Switch to dark mode
10. `button` Deccan AMRO
11. `button` Opportunities Pipeline view
12. `button` Opportunities Card view
13. `button` Opportunities Grid view
14. `button` Opportunities List view
15. `button` Opportunities New Opportunity
16. `button` Opportunities refresh
17. `button` Opportunities import export
18. `button` Open AI Markets Assistant

</details>

<details><summary>opportunity-new / chromium — tab order (37 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Back
19. `input` Opportunity Name *
20. `button[role=combobox]` Stage
21. `input` Amount
22. `input` Probability (%)
23. `input` Expected Close Date
24. `button[role=combobox]` Account
25. `button[role=combobox]` Primary Contact
26. `button[role=combobox]` Related Lead
27. `button[role=combobox]` Lead Source
28. `input` Type
29. `input` Forecast Category
30. `button[role=combobox]` Tenant *
31. `button[role=combobox]` Franchise
32. `textarea` Description
33. `input` Next Step
34. `textarea` Competitors
35. `button` Cancel
36. `button` Create Opportunity
37. `button` Open AI Markets Assistant

</details>

<details><summary>opportunity-new / firefox — tab order (37 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` Back
19. `input` Opportunity Name *
20. `button[role=combobox]` Stage
21. `input` Amount
22. `input` Probability (%)
23. `input` Expected Close Date
24. `button[role=combobox]` Account
25. `button[role=combobox]` Primary Contact
26. `button[role=combobox]` Related Lead
27. `button[role=combobox]` Lead Source
28. `input` Type
29. `input` Forecast Category
30. `button[role=combobox]` Tenant *
31. `button[role=combobox]` Franchise
32. `textarea` Description
33. `input` Next Step
34. `textarea` Competitors
35. `button` Cancel
36. `button` Create Opportunity
37. `button` Open AI Markets Assistant

</details>

<details><summary>themes / chromium — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` User
19. `button` Franchise
20. `button` Tenant
21. `button` Platform
22. `input` Pick
23. `input` Hue
24. `input` CRM Strip Hue (number)
25. `input` Sat
26. `input` CRM Strip Sat (number)
27. `input` Light
28. `input` CRM Strip Light (number)
29. `input` CRM Strip HSL value
30. `input` Pick
31. `input` Hue
32. `input` Sales Strip Hue (number)
33. `input` Sat
34. `input` Sales Strip Sat (number)
35. `input` Light
36. `input` Sales Strip Light (number)
37. `input` Sales Strip HSL value
38. `input` Pick
39. `input` Hue
40. `input` Financials Strip Hue (number)

</details>

<details><summary>themes / firefox — tab order (40 stops)</summary>

1. `a` Skip to main content
2. `button` Toggle Sidebar
3. `a` Leads
4. `a` Tasks/Activities
5. `a` Opportunities
6. `a` Accounts
7. `a` Contacts
8. `button` Sign Out
9. `button` Go back
10. `a` Dashboard
11. `button[role=combobox]` Domain
12. `button` SOS Services
13. `button` Open global search
14. `button` Help
15. `button` 7 unread notifications
16. `button` Switch to dark mode
17. `button` Deccan AMRO
18. `button` User
19. `button` Franchise
20. `button` Tenant
21. `button` Platform
22. `input` Pick
23. `input` Hue
24. `input` CRM Strip Hue (number)
25. `input` Sat
26. `input` CRM Strip Sat (number)
27. `input` Light
28. `input` CRM Strip Light (number)
29. `input` CRM Strip HSL value
30. `input` Pick
31. `input` Hue
32. `input` Sales Strip Hue (number)
33. `input` Sat
34. `input` Sales Strip Sat (number)
35. `input` Light
36. `input` Sales Strip Light (number)
37. `input` Sales Strip HSL value
38. `input` Pick
39. `input` Hue
40. `input` Financials Strip Hue (number)

</details>

## ARIA structure (1280, light)

Main text = rendered characters in `#main-content` (`#root` on the login page) when the readiness gate passed; a near-empty page cannot pass by having nothing to check.

| Page | Engine | Result | Main text | Failures | Snapshot |
|---|---|---|---|---|---|
| accounts-list | chromium | ✅ | 6619 |  | [yaml](aria/accounts-list-chromium.yaml) |
| accounts-list | firefox | ✅ | 6619 |  | [yaml](aria/accounts-list-firefox.yaml) |
| accounts-list | msedge | ✅ | 6619 |  | [yaml](aria/accounts-list-msedge.yaml) |
| accounts-list | webkit | ✅ | 155 |  | [yaml](aria/accounts-list-webkit.yaml) |
| auth | chromium | ✅ | 153 |  | [yaml](aria/auth-chromium.yaml) |
| auth | firefox | ✅ | 153 |  | [yaml](aria/auth-firefox.yaml) |
| auth | msedge | ✅ | 153 |  | [yaml](aria/auth-msedge.yaml) |
| auth | webkit | ✅ | 151 |  | [yaml](aria/auth-webkit.yaml) |
| contacts-list | chromium | ✅ | 2314 |  | [yaml](aria/contacts-list-chromium.yaml) |
| contacts-list | firefox | ✅ | 2314 |  | [yaml](aria/contacts-list-firefox.yaml) |
| contacts-list | msedge | ✅ | 2314 |  | [yaml](aria/contacts-list-msedge.yaml) |
| contacts-list | webkit | ✅ | 2311 |  | [yaml](aria/contacts-list-webkit.yaml) |
| dashboard | chromium | ✅ | 1108 |  | [yaml](aria/dashboard-chromium.yaml) |
| dashboard | firefox | ✅ | 438 |  | [yaml](aria/dashboard-firefox.yaml) |
| dashboard | msedge | ✅ | 1108 |  | [yaml](aria/dashboard-msedge.yaml) |
| dashboard | webkit | ✅ | 1081 |  | [yaml](aria/dashboard-webkit.yaml) |
| lead-detail | chromium | ❌ | — | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |  |
| lead-detail | firefox | ❌ | — | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |  |
| lead-detail | msedge | ❌ | — | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |  |
| lead-detail | webkit | ❌ | — | expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14 |  |
| leads-kanban | chromium | ✅ | 4523 |  | [yaml](aria/leads-kanban-chromium.yaml) |
| leads-kanban | firefox | ✅ | 4523 |  | [yaml](aria/leads-kanban-firefox.yaml) |
| leads-kanban | msedge | ✅ | 4523 |  | [yaml](aria/leads-kanban-msedge.yaml) |
| leads-kanban | webkit | ✅ | 4584 |  | [yaml](aria/leads-kanban-webkit.yaml) |
| leads-list | chromium | ✅ | 1763 |  | [yaml](aria/leads-list-chromium.yaml) |
| leads-list | firefox | ✅ | 1763 |  | [yaml](aria/leads-list-firefox.yaml) |
| leads-list | msedge | ✅ | 1763 |  | [yaml](aria/leads-list-msedge.yaml) |
| leads-list | webkit | ✅ | 337 |  | [yaml](aria/leads-list-webkit.yaml) |
| opportunities-list | chromium | ✅ | 10122 |  | [yaml](aria/opportunities-list-chromium.yaml) |
| opportunities-list | firefox | ✅ | 10122 |  | [yaml](aria/opportunities-list-firefox.yaml) |
| opportunities-list | msedge | ✅ | 10122 |  | [yaml](aria/opportunities-list-msedge.yaml) |
| opportunities-list | webkit | ✅ | 220 |  | [yaml](aria/opportunities-list-webkit.yaml) |
| opportunity-new | chromium | ✅ | 8944 |  | [yaml](aria/opportunity-new-chromium.yaml) |
| opportunity-new | firefox | ✅ | 462 |  | [yaml](aria/opportunity-new-firefox.yaml) |
| opportunity-new | msedge | ✅ | 8944 |  | [yaml](aria/opportunity-new-msedge.yaml) |
| opportunity-new | webkit | ✅ | 452 |  | [yaml](aria/opportunity-new-webkit.yaml) |
| themes | chromium | ❌ | 2829 | 1 unnamed button/link/textbox controls | [yaml](aria/themes-chromium.yaml) |
| themes | firefox | ❌ | 2757 | 1 unnamed button/link/textbox controls | [yaml](aria/themes-firefox.yaml) |
| themes | msedge | ❌ | 2829 | 1 unnamed button/link/textbox controls | [yaml](aria/themes-msedge.yaml) |
| themes | webkit | ❌ | 2881 | 1 unnamed button/link/textbox controls | [yaml](aria/themes-webkit.yaml) |

## Engine-specific divergences

A gate that passes in at least one engine and fails in another for the same page/width/mode (matrix) or page (keyboard, aria) — the cross-browser findings.

- **dashboard** 360px light: passes in chromium, firefox, msedge; fails in webkit
- **leads-kanban** 360px light: passes in chromium, firefox, msedge; fails in webkit
- **leads-list** keyboard (1280 light): passes in chromium, firefox; fails in webkit
- **opportunity-new** keyboard (1280 light): passes in chromium, firefox; fails in webkit
- **themes** keyboard (1280 light): passes in chromium, firefox; fails in webkit

## Cells that did not complete

- aria lead-detail/chromium/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- aria lead-detail/firefox/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- aria lead-detail/msedge/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- aria lead-detail/webkit/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- keyboard lead-detail/chromium/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- keyboard lead-detail/firefox/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- keyboard lead-detail/webkit/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- keyboard opportunity-new/webkit/1280/light: `expect(page).not.toHaveURL(expected) failed — Expected pattern: not /\/auth(\?|$)/`
- keyboard themes/webkit/1280/light: `expect(locator).toBeVisible() failed — Locator: locator('#main-content')`
- matrix lead-detail/chromium/1280/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/chromium/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/chromium/1920/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/chromium/1920/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/chromium/360/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/chromium/360/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/chromium/768/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/chromium/768/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/firefox/1280/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/firefox/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/firefox/1920/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/firefox/1920/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/firefox/360/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/firefox/360/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/firefox/768/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/firefox/768/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/msedge/1280/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/msedge/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/msedge/1920/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/msedge/1920/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/msedge/360/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/msedge/360/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/msedge/768/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/msedge/768/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/webkit/1280/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/webkit/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/webkit/1920/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/webkit/1920/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/webkit/360/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/webkit/360/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/webkit/768/dark: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix lead-detail/webkit/768/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`
- matrix leads-kanban/webkit/360/light: `expect(page).not.toHaveURL(expected) failed — Expected pattern: not /\/auth(\?|$)/`

## Cells with no result file

_None — every expected cell wrote a result._

