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


# Create User Prompt
Use this exact prompt to generate the full user creation automation in `dataentry/UserCreation.spec.ts`.

Create a Playwright test in TypeScript using `@playwright/test` that performs data-driven user creation from CSV and writes execution status back to the CSV after each processed row.

Implementation requirements:
- Use imports from:
  - `@playwright/test` (`test`, `expect`, `Page`)
  - `node:fs`, `node:path`, `node:url`
  - `papaparse`
- Input CSV path must be:
  - `/Users/sarvesh/workspace/SOS-CRM_LogicProEnt/logic-nexus-ai/dataentry/CreateUsers_MGL.csv`
- Test file path must be:
  - `dataentry/UserCreation.spec.ts`

Authentication requirements:
- Implement `login(page)`:
  - Resolve credentials from env:
    - `DATAENTRY_EMAIL` fallback `E2E_ADMIN_EMAIL`
    - `DATAENTRY_PASSWORD` fallback `E2E_ADMIN_PASSWORD`
  - Throw if credentials are missing.
  - Navigate to `/`.
  - If `Start in` is visible, click it.
  - Ensure current page is `/auth`.
  - Fill `data-testid=email-input` and `data-testid=password-input`.
  - Click `data-testid=login-btn`.
  - Wait for URL matching `/dashboard`.
  - Assert dashboard header is visible.

Overlay handling requirements:
- Implement `dismissWelcomePopupIfPresent(page)`:
  - Detect Joyride overlay: `#react-joyride-portal .react-joyride__overlay`.
  - Detect onboarding popup text `/welcome to logic nexus/i`.
  - If present, click `Skip` from Joyride container.
  - If `Skip` is not clickable, press `Escape`.
  - Retry with short delays until overlay disappears.

CSV handling requirements:
- Parse CSV with headers using `Papa.parse(..., { header: true, skipEmptyLines: true })`.
- Expected columns:
  - `Email *`
  - `Temporary Password *`
  - `First Name *`
  - `Last Name *`
  - `Phone`
  - `Avatar URL`
  - `Active Status`
  - `Must Change Password`
  - `Override Email Verification`
  - `Role *`
- Implement helper parsing:
  - normalize/trim strings
  - boolean parsing for values like `on/off`, `true/false`, `yes/no`, `1/0`
- Persist processing status into the CSV after each row:
  - Use the last column as status target.
  - If no status column exists, append one named `Result`.
  - Write `PASS` or `FAIL` immediately after each row execution.

User creation workflow requirements:
- Organize interactions in a page object class for maintainability.
- For each row:
  - Navigate to `/dashboard/users`.
  - Dismiss welcome popup if present.
  - Click `New User` robustly (retry with popup dismissal).
  - Wait for `/dashboard/users/new`.
  - Fill:
    - Email via placeholder `user@example.com`
    - Temporary Password via placeholder `Min 6 characters`
    - First Name via placeholder `John`
    - Last Name via placeholder `Doe`
    - Phone via placeholder `+1 (555) 123-4567` if provided
    - Avatar URL via placeholder `https://example.com/avatar.jpg` if provided
  - Set switches based on CSV:
    - `Active Status`
    - `Must Change Password`
    - `Override Email Verification`
  - Select role from `Role *` using exact role label text.
  - If `Tenant` select is visible and no value selected, select the first available tenant option.
  - If `Franchise` select is visible and no value selected, select the first available franchise option.
  - Submit with `Create User`.
  - In confirmation dialog, click `Confirm`.
  - Wait for `/dashboard/users`.
  - Verify new user by checking visibility of the created email text in users list.

Error-handling requirements:
- Process all CSV rows in one test execution.
- Wrap each row execution in try/catch.
- On success:
  - Mark row `PASS` in CSV immediately.
- On failure:
  - Capture and log error with row index and email.
  - Mark row `FAIL` in CSV immediately.
  - Continue to next row.
- After all rows:
  - Fail test if any row failed, including a concise summary of failed row indices/emails.

Test structure requirements:
- Use `test.describe('Data Entry: User Creation (CSV)', ...)` with serial mode.
- Use strong TypeScript interfaces for CSV rows and processing result.
- Keep helper methods reusable and deterministic.
- Keep selectors resilient and aligned with actual UI labels/placeholders.

# Command To Run User Creation Program
DATAENTRY_EMAIL="your-email" DATAENTRY_PASSWORD="your-password" \
npx playwright test dataentry/UserCreation.spec.ts --config playwright.config.ts --project=chromium --headed


Use this command from the project root:
DATAENTRY_EMAIL="your-email" DATAENTRY_PASSWORD="your-password" npx playwright test /Users/sarvesh/workspace/SOS-CRM_LogicProEnt/logic-nexus-ai/dataentry/UserCreation.spec.ts --config /Users/sarvesh/workspace/SOS-CRM_LogicProEnt/logic-nexus-ai/playwright.config.ts --project=chromium --headed



If your app is already running, add this to reuse existing server:
PLAYWRIGHT_REUSE_EXISTING_SERVER=true DATAENTRY_EMAIL="mgl.tenant.admin.001@gmail.com" DATAENTRY_PASSWORD="Vimal@1234" npx playwright test /Users/sarvesh/workspace/SOS-CRM_LogicProEnt/logic-nexus-ai/dataentry/UserCreation.spec.ts --config /Users/sarvesh/workspace/SOS-CRM_LogicProEnt/logic-nexus-ai/playwright.config.ts --project=chromium --headed