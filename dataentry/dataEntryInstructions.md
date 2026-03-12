# Franchise Creation Prompt
Use this exact prompt to regenerate the same Playwright automation logic implemented in `dataentry/franchiseCreation.spec.ts`.

Create a Playwright test file at `dataentry/franchiseCreation.spec.ts` using TypeScript and `@playwright/test`.

Requirements:
- Use imports: `test, expect` from `@playwright/test`, `fs` from `node:fs`, `path` from `node:path`, `fileURLToPath` from `node:url`, and `Papa` from `papaparse`.
- Read CSV from `dataentry/franchises.csv` using a helper `readFranchisesCsv()` with `Papa.parse(..., { header: true, skipEmptyLines: true })`.
- Define CSV row fields for:
  - `Tenant Name`
  - `Franchise Name`
  - `Franchise Code`
  - `address`
  - `Franchise Is Active`
- Add helper methods:
  - `toBool(value, defaultValue)` to parse `true/false/yes/no/1/0`.
  - `safeText(value)` to trim values safely.
  - `parseAddressJson(raw)` to parse `address` JSON and return `{}` on invalid JSON.

Login flow:
- In `login(page)`, use env credentials:
  - `DATAENTRY_EMAIL` (fallback `E2E_ADMIN_EMAIL`)
  - `DATAENTRY_PASSWORD` (fallback `E2E_ADMIN_PASSWORD`)
- Throw error if credentials are missing.
- `page.goto('/')`
- If button `Start in` is visible, click it.
- Ensure navigation to `/auth` if not already there.
- Fill `data-testid=email-input` and `data-testid=password-input`.
- Click `data-testid=login-btn`.
- Wait for URL `/dashboard` and visible `header`.

Popup/overlay handling:
- Add `dismissWelcomePopupIfPresent(page)` to handle onboarding popup and Joyride overlay.
- Detect overlay selector `#react-joyride-portal .react-joyride__overlay`.
- Detect popup text matching `/welcome to logic nexus/i`.
- Try clicking `Skip` button from Joyride container; if not clickable, press `Escape`.
- Retry several times with short waits until overlay disappears.

Robust click helpers:
- Add `clickNewButtonSafely(page)`:
  - Target button by role/name `/^new$/i`.
  - Before each click attempt, call `dismissWelcomePopupIfPresent`.
  - Retry with short wait on failure.
- Add `selectTenantSafely(page, tenantName)`:
  - Find tenant combobox by text `/select tenant/i`.
  - If not visible or tenant is empty, skip.
  - Before each click attempt, call `dismissWelcomePopupIfPresent`.
  - Click combobox, select tenant option by visible text, retry on failure.

Main test:
- Use `test.describe('Data Entry: Franchise Creation (CSV)', ...)` and serial mode.
- Test name: `create franchises from dataentry/franchises.csv`.
- Read CSV and assert rows count is greater than zero.
- Login once, dismiss popup once after login.
- For each CSV row:
  - Map:
    - `tenantName` from `Tenant Name`
    - `franchiseName` from `Franchise Name`
    - `franchiseCode` from `Franchise Code`
    - `isActive` from `Franchise Is Active` via `toBool(..., true)`
    - `address` from parsed JSON
  - Skip row if name or code is empty.
  - Navigate to `/dashboard/franchises`, verify URL, dismiss popup.
  - Click New using `clickNewButtonSafely`.
  - Wait for `/dashboard/franchises/new`.
  - Fill name placeholder `Downtown Branch` with `franchiseName`.
  - Fill code placeholder `DT-001` with `franchiseCode`.
  - Select tenant using `selectTenantSafely(page, tenantName)`.
  - Fill phone placeholder `+1 555-123-4567` using:
    - `address.phone` if present
    - fallback `+1 555-000-${String(1000 + i).slice(-4)}`
  - Fill email placeholder `branch@example.com` using:
    - `address.email` if present
    - fallback `${franchiseCode.toLowerCase()}@example.com`
  - Handle active switch:
    - Locate first switch role.
    - If checked state differs from `isActive`, click it.
  - Click Save button (`/^save$/i`) then Confirm button (`/^confirm$/i`).
  - Wait for `/dashboard/franchises`.
  - Assert the newly created franchise name is visible in the list.

Do not simplify this prompt. Keep resilient retries and popup handling to avoid flaky failures from Joyride overlays.

# Command To Run The Program
DATAENTRY_EMAIL="your-email" DATAENTRY_PASSWORD="your-password" \
npx playwright test dataentry/franchiseCreation.spec.ts --config playwright.config.ts --project=chromium --headed
