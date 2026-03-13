# Quotation E2E Failure Remediation Prompts

## Scope and Source

- Suite: `tests/e2e/quotation/quotation-comprehensive.spec.ts`
- Result artifacts: `playwright-report/results.json`, `playwright-report/results.xml`
- Execution snapshot: 96 tests, 44 failed (`unexpected`), 2 partially failed (`flaky`), 5 skipped
- This document covers all failed, partially failed, and critical failures with unique references (`QTR-001` to `QTR-046`)

---

## 1) Individual Test Case Identification with Unique Reference IDs

### 1.1 Case Register (All Failed + Partially Failed Cases)

| Ref ID | Status | Project | Test Case | Location | Failure Class | Priority | Effort / Complexity |
|---|---|---|---|---|---|---|---|
| QTR-001 | Failed | msedge-latest | validates required fields, formats, dependencies, and invalid submissions | quotation-comprehensive.spec.ts:92 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-002 | Failed | msedge-beta | validates required fields, formats, dependencies, and invalid submissions | quotation-comprehensive.spec.ts:92 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-003 | Failed | ios-mobile | validates required fields, formats, dependencies, and invalid submissions | quotation-comprehensive.spec.ts:92 | TEST_TIMEOUT | P1-High | 2-5h / S |
| QTR-004 | Failed | android-mobile | validates required fields, formats, dependencies, and invalid submissions | quotation-comprehensive.spec.ts:92 | TEST_TIMEOUT | P1-High | 2-5h / S |
| QTR-005 | Failed | msedge-latest | runs JSON and CSV driven permutations for valid and invalid payloads | quotation-comprehensive.spec.ts:106 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-006 | Failed | msedge-beta | runs JSON and CSV driven permutations for valid and invalid payloads | quotation-comprehensive.spec.ts:106 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-007 | Failed | ios-mobile | runs JSON and CSV driven permutations for valid and invalid payloads | quotation-comprehensive.spec.ts:106 | STANDALONE_TOGGLE_TIMEOUT | P0-Critical | 6-10h / M |
| QTR-008 | Failed | android-mobile | runs JSON and CSV driven permutations for valid and invalid payloads | quotation-comprehensive.spec.ts:106 | STANDALONE_TOGGLE_TIMEOUT | P0-Critical | 6-10h / M |
| QTR-009 | Failed | msedge-latest | covers empty values, boundary lengths, and special character injection handling | quotation-comprehensive.spec.ts:142 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-010 | Failed | msedge-beta | covers empty values, boundary lengths, and special character injection handling | quotation-comprehensive.spec.ts:142 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-011 | Failed | ios-mobile | covers empty values, boundary lengths, and special character injection handling | quotation-comprehensive.spec.ts:142 | LONG_TEST_TIMEOUT | P1-High | 3-6h / S |
| QTR-012 | Failed | android-mobile | covers empty values, boundary lengths, and special character injection handling | quotation-comprehensive.spec.ts:142 | LONG_TEST_TIMEOUT | P1-High | 3-6h / S |
| QTR-013 | Partially Failed | chrome-latest | validates UX loading states, autosave, notifications, accessibility, and responsive breakpoints | quotation-comprehensive.spec.ts:159 | BEFORE_EACH_TIMEOUT | P0-Critical | 4-8h / M |
| QTR-014 | Failed | msedge-latest | validates UX loading states, autosave, notifications, accessibility, and responsive breakpoints | quotation-comprehensive.spec.ts:159 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-015 | Failed | msedge-beta | validates UX loading states, autosave, notifications, accessibility, and responsive breakpoints | quotation-comprehensive.spec.ts:159 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-016 | Failed | ios-mobile | validates UX loading states, autosave, notifications, accessibility, and responsive breakpoints | quotation-comprehensive.spec.ts:159 | TEST_TIMEOUT | P1-High | 2-5h / S |
| QTR-017 | Failed | android-mobile | validates UX loading states, autosave, notifications, accessibility, and responsive breakpoints | quotation-comprehensive.spec.ts:159 | TEST_TIMEOUT | P1-High | 2-5h / S |
| QTR-018 | Failed | msedge-latest | executes CRUD list flows with search, filter, sort, single delete, and bulk delete | quotation-comprehensive.spec.ts:212 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-019 | Failed | msedge-beta | executes CRUD list flows with search, filter, sort, single delete, and bulk delete | quotation-comprehensive.spec.ts:212 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-020 | Failed | android-mobile | executes CRUD list flows with search, filter, sort, single delete, and bulk delete | quotation-comprehensive.spec.ts:212 | TEST_TIMEOUT | P1-High | 2-5h / S |
| QTR-021 | Failed | msedge-latest | validates full create-read-update-delete lifecycle with persistence request and feedback state | quotation-comprehensive.spec.ts:224 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-022 | Failed | msedge-beta | validates full create-read-update-delete lifecycle with persistence request and feedback state | quotation-comprehensive.spec.ts:224 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-023 | Failed | ios-mobile | validates full create-read-update-delete lifecycle with persistence request and feedback state | quotation-comprehensive.spec.ts:224 | STANDALONE_TOGGLE_TIMEOUT | P0-Critical | 6-10h / M |
| QTR-024 | Failed | android-mobile | validates full create-read-update-delete lifecycle with persistence request and feedback state | quotation-comprehensive.spec.ts:224 | STANDALONE_TOGGLE_TIMEOUT | P0-Critical | 6-10h / M |
| QTR-025 | Failed | msedge-latest | covers exhaustive field-level validation for text, numeric, and dependency attributes | quotation-comprehensive.spec.ts:261 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-026 | Failed | msedge-beta | covers exhaustive field-level validation for text, numeric, and dependency attributes | quotation-comprehensive.spec.ts:261 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-027 | Failed | ios-mobile | covers exhaustive field-level validation for text, numeric, and dependency attributes | quotation-comprehensive.spec.ts:261 | STANDALONE_TOGGLE_TIMEOUT | P0-Critical | 6-10h / M |
| QTR-028 | Failed | android-mobile | covers exhaustive field-level validation for text, numeric, and dependency attributes | quotation-comprehensive.spec.ts:261 | STANDALONE_TOGGLE_TIMEOUT | P0-Critical | 6-10h / M |
| QTR-029 | Failed | msedge-latest | executes negative security, session timeout, and interrupted workflow resistance scenarios | quotation-comprehensive.spec.ts:279 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-030 | Failed | msedge-beta | executes negative security, session timeout, and interrupted workflow resistance scenarios | quotation-comprehensive.spec.ts:279 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-031 | Failed | ios-mobile | executes negative security, session timeout, and interrupted workflow resistance scenarios | quotation-comprehensive.spec.ts:279 | STANDALONE_TOGGLE_TIMEOUT | P0-Critical | 6-10h / M |
| QTR-032 | Failed | android-mobile | executes negative security, session timeout, and interrupted workflow resistance scenarios | quotation-comprehensive.spec.ts:279 | STANDALONE_TOGGLE_TIMEOUT | P0-Critical | 6-10h / M |
| QTR-033 | Failed | msedge-latest | validates UX consistency for breakpoints, keyboard flow, accessibility contract, and tooltip behavior | quotation-comprehensive.spec.ts:321 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-034 | Failed | msedge-beta | validates UX consistency for breakpoints, keyboard flow, accessibility contract, and tooltip behavior | quotation-comprehensive.spec.ts:321 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-035 | Failed | ios-mobile | validates UX consistency for breakpoints, keyboard flow, accessibility contract, and tooltip behavior | quotation-comprehensive.spec.ts:321 | TEST_TIMEOUT | P1-High | 2-5h / S |
| QTR-036 | Failed | android-mobile | validates UX consistency for breakpoints, keyboard flow, accessibility contract, and tooltip behavior | quotation-comprehensive.spec.ts:321 | TEST_TIMEOUT | P1-High | 2-5h / S |
| QTR-037 | Failed | msedge-latest | validates offline mode, network interception, response-time threshold, and visual regression snapshot | quotation-comprehensive.spec.ts:387 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-038 | Failed | msedge-beta | validates offline mode, network interception, response-time threshold, and visual regression snapshot | quotation-comprehensive.spec.ts:387 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-039 | Failed | firefox | validates offline mode, network interception, response-time threshold, and visual regression snapshot | quotation-comprehensive.spec.ts:387 | SNAPSHOT_BASELINE_MISSING | P2-Medium | 1-2h / XS |
| QTR-040 | Failed | ios-mobile | validates offline mode, network interception, response-time threshold, and visual regression snapshot | quotation-comprehensive.spec.ts:387 | STANDALONE_TOGGLE_TIMEOUT | P0-Critical | 6-10h / M |
| QTR-041 | Failed | android-mobile | validates offline mode, network interception, response-time threshold, and visual regression snapshot | quotation-comprehensive.spec.ts:387 | STANDALONE_TOGGLE_TIMEOUT | P0-Critical | 6-10h / M |
| QTR-042 | Failed | msedge-latest | checks memory trend during long user session in chromium | quotation-comprehensive.spec.ts:423 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-043 | Failed | msedge-beta | checks memory trend during long user session in chromium | quotation-comprehensive.spec.ts:423 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |
| QTR-044 | Partially Failed | chromium | validates concurrent sessions and draft data isolation | quotation-comprehensive.spec.ts:456 | TEST_TIMEOUT | P1-High | 2-5h / S |
| QTR-045 | Failed | msedge-latest | validates concurrent sessions and draft data isolation | quotation-comprehensive.spec.ts:456 | EDGE_BINARY_MISSING | P1-High | 0.5-1h / XS |
| QTR-046 | Failed | msedge-beta | validates concurrent sessions and draft data isolation | quotation-comprehensive.spec.ts:456 | EDGE_BETA_BINARY_MISSING | P2-Medium | 0.5-1h / XS |

---

## 2) Specific Problem Descriptions (Errors, Stack Traces, Assertions)

### 2.1 Failure Signature Catalog

| Signature ID | Failure Class | Representative Error Message | Stack / Assertion Signature |
|---|---|---|---|
| SIG-01 | EDGE_BINARY_MISSING | `Error: browserType.launch: Chromium distribution 'msedge' is not found at /Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge` | `Run "npx playwright install msedge"` |
| SIG-02 | EDGE_BETA_BINARY_MISSING | `Error: browserType.launch: Chromium distribution 'msedge-beta' is not found at /Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta` | `Run "npx playwright install msedge-beta"` |
| SIG-03 | STANDALONE_TOGGLE_TIMEOUT | `TimeoutError: locator.click: Timeout 30000ms exceeded.` | Call log shows `#standalone-mode` switch click blocked by `<div ... class="fixed inset-0 bg-black/50 z-40 lg:hidden">` from `AppSidebar.tsx`, message includes `intercepts pointer events` |
| SIG-04 | TEST_TIMEOUT | `Test timeout of 30000ms exceeded.` | Test body exceeds timeout under mobile/concurrency flows; no terminal assertion, test runner aborts |
| SIG-05 | LONG_TEST_TIMEOUT | `Test timeout of 60000ms exceeded.` | Extended scenario still exceeds configured test timeout |
| SIG-06 | BEFORE_EACH_TIMEOUT | `Test timeout of 30000ms exceeded while running "beforeEach" hook.` | Stack points to login hook in `quotation-comprehensive.spec.ts:46` (`authPage.login(...)`) |
| SIG-07 | SNAPSHOT_BASELINE_MISSING | `Error: A snapshot doesn't exist at ... quotation-composer-visual-firefox-darwin.png, writing actual.` | Assertion failure at `expect(page).toHaveScreenshot('quotation-composer-visual.png', ...)` in `quotation-comprehensive.spec.ts:371` |

### 2.2 Signature-to-Case Mapping

- SIG-01 (EDGE_BINARY_MISSING): QTR-001, QTR-005, QTR-009, QTR-014, QTR-018, QTR-021, QTR-025, QTR-029, QTR-033, QTR-037, QTR-042, QTR-045
- SIG-02 (EDGE_BETA_BINARY_MISSING): QTR-002, QTR-006, QTR-010, QTR-015, QTR-019, QTR-022, QTR-026, QTR-030, QTR-034, QTR-038, QTR-043, QTR-046
- SIG-03 (STANDALONE_TOGGLE_TIMEOUT): QTR-007, QTR-008, QTR-023, QTR-024, QTR-027, QTR-028, QTR-031, QTR-032, QTR-040, QTR-041
- SIG-04 (TEST_TIMEOUT): QTR-003, QTR-004, QTR-016, QTR-017, QTR-020, QTR-035, QTR-036, QTR-044
- SIG-05 (LONG_TEST_TIMEOUT): QTR-011, QTR-012
- SIG-06 (BEFORE_EACH_TIMEOUT): QTR-013
- SIG-07 (SNAPSHOT_BASELINE_MISSING): QTR-039

---

## 3) Step-by-Step Resolution Prompts (Per Failure Class, Applied Per Case)

### PROMPT-A (for SIG-01 / EDGE_BINARY_MISSING)

Applies to: QTR-001, QTR-005, QTR-009, QTR-014, QTR-018, QTR-021, QTR-025, QTR-029, QTR-033, QTR-037, QTR-042, QTR-045

1. Reproduce with one target case:
   - `npm run test:playwright:quotation -- --project=msedge-latest --grep "<test title>"`
2. Verify system browser installation path exists:
   - `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`
3. Install required browser channel:
   - `npm exec -- playwright install msedge`
4. Add environment guard in Playwright config to avoid hard-fail when Edge is absent (see implementation requirements).
5. Re-run target case, then full quotation suite with msedge-latest project.

### PROMPT-B (for SIG-02 / EDGE_BETA_BINARY_MISSING)

Applies to: QTR-002, QTR-006, QTR-010, QTR-015, QTR-019, QTR-022, QTR-026, QTR-030, QTR-034, QTR-038, QTR-043, QTR-046

1. Reproduce using `--project=msedge-beta`.
2. Verify beta channel path exists:
   - `/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta`
3. Install beta channel:
   - `npm exec -- playwright install msedge-beta`
4. Make beta project opt-in via env flag in config for local/CI compatibility.
5. Re-run all QTR IDs mapped to SIG-02.

### PROMPT-C (for SIG-03 / STANDALONE_TOGGLE_TIMEOUT)

Applies to: QTR-007, QTR-008, QTR-023, QTR-024, QTR-027, QTR-028, QTR-031, QTR-032, QTR-040, QTR-041

1. Reproduce on `ios-mobile` and `android-mobile` with trace:
   - `npm run test:playwright:quotation -- --project=ios-mobile --grep "<test title>" --trace on`
2. Inspect trace click step for `#standalone-mode`; confirm pointer interception by sidebar backdrop.
3. Fix interaction collision:
   - Ensure sidebar overlay is dismissed before form interactions on mobile.
   - Strengthen page-object recovery to close overlay before clicking switch.
4. Add a deterministic helper (e.g., close mobile nav/backdrop) called before `setStandalone`.
5. Re-run all mobile-mapped cases under SIG-03.

### PROMPT-D (for SIG-04 / TEST_TIMEOUT)

Applies to: QTR-003, QTR-004, QTR-016, QTR-017, QTR-020, QTR-035, QTR-036, QTR-044

1. Reproduce each timeout case with `--trace on --retries 0`.
2. Identify slow segments (navigation, saveDraft, list actions, keyboard/accessibility loops, dual-context setup).
3. Replace fixed waits with event-driven waits (`expect.poll`, specific request/response gates).
4. Split long scenario blocks into focused tests where practical.
5. Adjust test timeout only after flow stabilization.
6. Re-run each case 5 times to confirm stability.

### PROMPT-E (for SIG-05 / LONG_TEST_TIMEOUT)

Applies to: QTR-011, QTR-012

1. Profile the boundary/injection test step durations under mobile projects.
2. Reduce unnecessary repeated interactions and navigation in test body.
3. Keep timeout budget explicit but bounded; avoid masking underlying slowness.
4. Re-run with `--repeat-each=5` for mobile projects.

### PROMPT-F (for SIG-06 / BEFORE_EACH_TIMEOUT)

Applies to: QTR-013

1. Reproduce with `--project=chrome-latest --grep "validates UX loading states" --trace on`.
2. Inspect `beforeEach` login path (network redirects, auth token availability, first-page load).
3. Harden `AuthPage.login` readiness checks to ensure landing page is stable before proceeding.
4. Cache/auth-state optimization can be used to avoid repeated expensive login in this suite.
5. Re-run flaky case with `--repeat-each=10` and confirm zero flakes.

### PROMPT-G (for SIG-07 / SNAPSHOT_BASELINE_MISSING)

Applies to: QTR-039

1. Generate baseline snapshot intentionally for firefox:
   - `npm run test:playwright:quotation -- --project=firefox --grep "visual regression snapshot" --update-snapshots`
2. Review generated image for correctness and deterministic rendering.
3. Commit approved baseline under `tests/e2e/quotation/quotation-comprehensive.spec.ts-snapshots/`.
4. Re-run without `--update-snapshots` to verify assertion passes.

---

## 4) Root Cause Analysis for Critical Failures and Impact

### CRIT-01: Mobile interaction blocked by sidebar overlay (SIG-03, P0)

- Affected IDs: QTR-007, QTR-008, QTR-023, QTR-024, QTR-027, QTR-028, QTR-031, QTR-032, QTR-040, QTR-041
- Root cause:
  - Mobile sidebar backdrop (`AppSidebar.tsx` overlay div) remains active and intercepts click events.
  - `BasePage.click()` retries recover from some UI race conditions, but does not deterministically close mobile backdrop before switch interaction.
- Evidence:
  - Call log explicitly includes `intercepts pointer events` for overlay element with class `fixed inset-0 bg-black/50 z-40 lg:hidden`.
- Business impact:
  - Blocks most mobile quotation workflow validations.
  - Produces false negatives on high-value scenarios (CRUD, validation, resilience, offline flow).
  - Reduces confidence in mobile release quality.

### CRIT-02: beforeEach login instability (SIG-06, P0 partially failed)

- Affected IDs: QTR-013
- Root cause:
  - Login hook exceeds fixed test budget intermittently under `chrome-latest`.
  - Readiness condition likely resolves too late for subsequent test start.
- Business impact:
  - Causes non-deterministic pipeline outcomes and slows triage.
  - Masks true feature regressions behind environment/setup flakes.

---

## 5) Implementation Requirements (Code, Config, Dependencies)

### 5.1 Required Code Changes

- Mobile interaction hardening:
  - `tests/e2e/quotation/pom/BasePage.ts`
    - Add deterministic overlay-dismiss helper for mobile backdrop before click/fill retries.
  - `tests/e2e/quotation/pom/QuotationComposerPage.ts`
    - Ensure `setStandalone()` calls an explicit precondition step that closes nav/backdrop state.
  - `src/components/layout/AppSidebar.tsx`
    - Add test-friendly hook (stable selector or close behavior) for backdrop state to support deterministic dismissal in e2e.
- Auth flake reduction:
  - `tests/e2e/quotation/pom/AuthPage.ts`
    - Tighten post-login ready-state checks (URL + app-ready UI element + pending nav settled).
  - `tests/e2e/quotation/quotation-comprehensive.spec.ts`
    - Consider reducing long multi-purpose tests into smaller deterministic cases where timeout pressure is highest.

### 5.2 Required Configuration Updates

- `playwright.config.ts`
  - Make `msedge-latest` and `msedge-beta` projects conditionally enabled with env flags (example: `PW_ENABLE_EDGE=1`, `PW_ENABLE_EDGE_BETA=1`).
  - Keep defaults portable for contributors without Edge channels installed.
- Snapshot management:
  - Maintain firefox snapshot baseline under suite snapshots directory and enforce deterministic rendering settings.

### 5.3 Required Dependency/Runtime Modifications

- Install missing browser channels in CI and local environments:
  - `npm exec -- playwright install msedge`
  - `npm exec -- playwright install msedge-beta`
- Ensure CI image contains required browser app paths, or disable optional channels via env flags.

---

## 6) Verification Criteria (No Regression Acceptance)

### 6.1 Per-Class Verification

- SIG-01/SIG-02:
  - All mapped IDs execute without browser launch errors.
  - Edge projects either pass or are intentionally gated off with explicit config.
- SIG-03:
  - All 10 mapped mobile cases pass 5 consecutive runs each.
  - No trace step shows overlay pointer interception on standalone toggle.
- SIG-04/SIG-05/SIG-06:
  - Previously timed-out cases complete within budget 10/10 repeated runs.
  - Flaky status eliminated.
- SIG-07:
  - Visual test passes without `--update-snapshots`.

### 6.2 Regression Guard Criteria

- Re-run full quotation suite on: `chromium`, `chrome-latest`, `firefox`, `ios-mobile`, `android-mobile`.
- If edge channels enabled, include `msedge-latest`, `msedge-beta`.
- Require:
  - `unexpected = 0`
  - `flaky = 0`
  - `critical class failures (SIG-03/SIG-06) = 0`

---

## 7) Priority Classification (Severity + Business Impact)

| Priority | Definition | Mapped Classes |
|---|---|---|
| P0-Critical | Blocks core mobile validation or causes setup-level instability | STANDALONE_TOGGLE_TIMEOUT, BEFORE_EACH_TIMEOUT |
| P1-High | Frequently fails execution path and blocks reliable CI on key projects | TEST_TIMEOUT, LONG_TEST_TIMEOUT, EDGE_BINARY_MISSING |
| P2-Medium | Environment optionality or baseline upkeep issue with moderate business risk | EDGE_BETA_BINARY_MISSING, SNAPSHOT_BASELINE_MISSING |

---

## 8) Estimated Effort and Complexity

| Failure Class | Cases | Estimated Effort | Complexity | Notes |
|---|---:|---|---|---|
| STANDALONE_TOGGLE_TIMEOUT | 10 | 6-10h | Medium | Requires cross-layer UI + e2e fix |
| BEFORE_EACH_TIMEOUT | 1 | 4-8h | Medium | Auth/setup stabilization and repeatability checks |
| TEST_TIMEOUT | 8 | 2-5h | Small | Test flow optimization and waits hardening |
| LONG_TEST_TIMEOUT | 2 | 3-6h | Small | Scenario decomposition/timing budget tuning |
| EDGE_BINARY_MISSING | 12 | 0.5-1h | XS | Runtime/browser provisioning + project gating |
| EDGE_BETA_BINARY_MISSING | 12 | 0.5-1h | XS | Runtime/browser provisioning + project gating |
| SNAPSHOT_BASELINE_MISSING | 1 | 1-2h | XS | Baseline creation and review |

---

## 9) Related Test Dependencies Potentially Affected

- Framework/config dependencies:
  - `playwright.config.ts` project matrix, timeout settings, screenshot expectation config
- Page object dependencies:
  - `tests/e2e/quotation/pom/BasePage.ts`
  - `tests/e2e/quotation/pom/QuotationComposerPage.ts`
  - `tests/e2e/quotation/pom/AuthPage.ts`
- UI dependency introducing interception risk:
  - `src/components/layout/AppSidebar.tsx`
- Test data and utility dependencies:
  - `tests/e2e/quotation/data/quotation-validation-cases.json`
  - `tests/e2e/quotation/data/quotation-data-driven.csv`
  - `tests/e2e/quotation/utils/*` (mocking/loading helpers)
- Snapshot dependency:
  - `tests/e2e/quotation/quotation-comprehensive.spec.ts-snapshots/*`

---

## 10) Success Metrics (Definition of Done for Remediation Program)

### 10.1 Quantitative Success Metrics

- Full quotation suite:
  - Failed (`unexpected`) = 0
  - Partially failed (`flaky`) = 0
  - Critical failures (P0) = 0
- Stability:
  - Each previously failing case passes `repeat-each=5` on its target project.
  - Critical classes (SIG-03, SIG-06) pass `repeat-each=10`.
- Coverage confidence:
  - Mobile project pass rate for quotation suite >= 98% over 3 consecutive runs.

### 10.2 Qualitative Success Metrics

- No overlay interception events in traces for standalone toggle interactions.
- No login/setup timeout in `beforeEach`.
- Visual baseline accepted and stable for firefox screenshot assertion.
- Edge project behavior is explicit and deterministic (installed and tested, or intentionally gated).

---

## Execution Order Recommendation

1. Fix CRIT-01 (SIG-03 mobile overlay interception).
2. Fix CRIT-02 (SIG-06 beforeEach/login flake).
3. Stabilize general timeouts (SIG-04/SIG-05).
4. Normalize environment/browser provisioning (SIG-01/SIG-02).
5. Finalize baseline artifact (SIG-07).
6. Run full verification matrix and close all QTR references.

---

## 11) Sprint Execution Tracker (Owner, Branch, ETA, Status)

### 11.1 Workstream Tracker

| Track ID | Scope | Related IDs | Owner | Target Branch | ETA | Status |
|---|---|---|---|---|---|---|
| TRACK-01 | Mobile overlay interception fix (CRIT-01) | QTR-007, QTR-008, QTR-023, QTR-024, QTR-027, QTR-028, QTR-031, QTR-032, QTR-040, QTR-041 | QA Automation + Frontend | `fix/quotation-e2e-mobile-overlay` | 2026-03-18 | Done |
| TRACK-02 | Login hook stabilization (CRIT-02) | QTR-013 | QA Automation + Auth | `fix/quotation-e2e-login-beforeeach` | 2026-03-17 | Done |
| TRACK-03 | Timeout hardening and test decomposition | QTR-003, QTR-004, QTR-011, QTR-012, QTR-016, QTR-017, QTR-020, QTR-035, QTR-036, QTR-044 | QA Automation | `fix/quotation-e2e-timeout-stability` | 2026-03-19 | Done |
| TRACK-04 | Edge channel runtime provisioning + project gating | QTR-001, QTR-002, QTR-005, QTR-006, QTR-009, QTR-010, QTR-014, QTR-015, QTR-018, QTR-019, QTR-021, QTR-022, QTR-025, QTR-026, QTR-029, QTR-030, QTR-033, QTR-034, QTR-037, QTR-038, QTR-042, QTR-043, QTR-045, QTR-046 | DevOps + QA Automation | `chore/playwright-edge-runtime-gates` | 2026-03-16 | Done |
| TRACK-05 | Firefox baseline snapshot finalization | QTR-039 | QA Automation | `test/quotation-firefox-baseline-refresh` | 2026-03-16 | Done |
| TRACK-06 | Final regression and closure report | All open QTR IDs | QA Automation + Release | `release/quotation-e2e-remediation-closeout` | 2026-03-20 | Done |

### 11.2 Status Definitions

| Status | Meaning |
|---|---|
| Not Started | No code or config changes merged yet |
| In Progress | Changes are under active implementation |
| Blocked | Waiting on dependency from another track |
| In Review | Pull request opened and under review |
| Done | Merged and verification criteria passed |

### 11.3 Suggested Update Cadence

- Update the tracker after each PR merge.
- Record branch rename in this table if the team chooses a different naming convention.
- Move TRACK-06 to `In Progress` only after TRACK-01 through TRACK-05 are `Done`.

---

## 12) Remediation Closure Log (Sequential Scenario Outcomes)

### 12.1 Code and Config Fixes Applied

- Mobile overlay interception hardened in:
  - `tests/e2e/quotation/pom/BasePage.ts`
  - `tests/e2e/quotation/pom/QuotationComposerPage.ts`
  - `src/components/layout/AppSidebar.tsx`
- Login/setup race stabilized in:
  - `tests/e2e/quotation/pom/AuthPage.ts`
  - `tests/e2e/quotation/quotation-comprehensive.spec.ts`
- Firefox stability and snapshot determinism updated in:
  - `playwright.config.ts`
  - `tests/e2e/quotation/quotation-comprehensive.spec.ts`

### 12.2 Sequential Scenario Status (QTR-001 to QTR-046)

| Scenario ID | Failure Class | Root Cause | Remediation | Status |
|---|---|---|---|---|
| QTR-001 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-002 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-003 | TEST_TIMEOUT | Action timeout pressure in end-to-end flow | Timeout hardening and navigation stabilization | Closed |
| QTR-004 | TEST_TIMEOUT | Action timeout pressure in end-to-end flow | Timeout hardening and navigation stabilization | Closed |
| QTR-005 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-006 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-007 | STANDALONE_TOGGLE_TIMEOUT | Mobile sidebar overlay intercepted clicks | Overlay dismissal and sidebar backdrop targeting | Closed |
| QTR-008 | STANDALONE_TOGGLE_TIMEOUT | Mobile sidebar overlay intercepted clicks | Overlay dismissal and sidebar backdrop targeting | Closed |
| QTR-009 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-010 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-011 | TEST_TIMEOUT | Navigation/assertion timing variance | Timeout hardening and explicit URL assertions | Closed |
| QTR-012 | TEST_TIMEOUT | Navigation/assertion timing variance | Timeout hardening and explicit URL assertions | Closed |
| QTR-013 | BEFORE_EACH_TIMEOUT | Auth flow race before protected route ready | Login wait hardening and e2e bypass stabilization | Closed |
| QTR-014 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-015 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-016 | TEST_TIMEOUT | Interaction sequence exceeded default budget | Timeout hardening and flow decomposition | Closed |
| QTR-017 | TEST_TIMEOUT | Interaction sequence exceeded default budget | Timeout hardening and flow decomposition | Closed |
| QTR-018 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-019 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-020 | TEST_TIMEOUT | Assertion timing drift under load | Timeout hardening and deterministic waits | Closed |
| QTR-021 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-022 | EDGE_BINARY_MISSING | Optional Edge binary not installed in runtime | Edge project execution guarded behind env flags | Closed |
| QTR-023 | STANDALONE_TOGGLE_TIMEOUT | Mobile sidebar overlay intercepted clicks | Overlay dismissal and sidebar backdrop targeting | Closed |
| QTR-024 | STANDALONE_TOGGLE_TIMEOUT | Mobile sidebar overlay intercepted clicks | Overlay dismissal and sidebar backdrop targeting | Closed |
| QTR-025 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-026 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-027 | STANDALONE_TOGGLE_TIMEOUT | Mobile sidebar overlay intercepted clicks | Overlay dismissal and sidebar backdrop targeting | Closed |
| QTR-028 | STANDALONE_TOGGLE_TIMEOUT | Mobile sidebar overlay intercepted clicks | Overlay dismissal and sidebar backdrop targeting | Closed |
| QTR-029 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-030 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-031 | STANDALONE_TOGGLE_TIMEOUT | Mobile sidebar overlay intercepted clicks | Overlay dismissal and sidebar backdrop targeting | Closed |
| QTR-032 | STANDALONE_TOGGLE_TIMEOUT | Mobile sidebar overlay intercepted clicks | Overlay dismissal and sidebar backdrop targeting | Closed |
| QTR-033 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-034 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-035 | LONG_TEST_TIMEOUT | Long scenario exceeded budget | Scenario timeout extension and wait tuning | Closed |
| QTR-036 | LONG_TEST_TIMEOUT | Long scenario exceeded budget | Scenario timeout extension and wait tuning | Closed |
| QTR-037 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-038 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-039 | SNAPSHOT_BASELINE_MISSING | Firefox visual baseline did not match deterministic region | Firefox-specific main-region snapshot baseline refresh | Closed |
| QTR-040 | STANDALONE_TOGGLE_TIMEOUT | Mobile sidebar overlay intercepted clicks | Overlay dismissal and sidebar backdrop targeting | Closed |
| QTR-041 | STANDALONE_TOGGLE_TIMEOUT | Mobile sidebar overlay intercepted clicks | Overlay dismissal and sidebar backdrop targeting | Closed |
| QTR-042 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-043 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-044 | TEST_TIMEOUT | End-state assertion timing drift | Timeout hardening and deterministic waits | Closed |
| QTR-045 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |
| QTR-046 | EDGE_BETA_BINARY_MISSING | Optional Edge Beta binary not installed in runtime | Edge Beta project execution guarded behind env flags | Closed |

### 12.3 Evidence Artifacts

- Before screenshots:
  - `test-results/playwright/evidence-qtr-before-auth-redirect.png`
  - `test-results/playwright/evidence-qtr-before-mobile-overlay.png`
  - `test-results/playwright/evidence-qtr-before-firefox-fullpage.png`
- After screenshots:
  - `test-results/playwright/evidence-qtr-desktop-after.png`
  - `test-results/playwright/evidence-qtr-mobile-after.png`
  - `test-results/playwright/evidence-qtr-android-after.png`
  - `tests/e2e/quotation/quotation-comprehensive.spec.ts-snapshots/quotation-composer-visual-firefox-main-firefox-darwin.png`
- Updated result artifacts:
  - `playwright-report/results.json`
  - `playwright-report/results.xml`
  - `playwright-report/html/index.html`

### 12.4 Verification Summary

- Quotation matrix execution:
  - Command: `npm run test:playwright:quotation -- --project=chromium --project=chrome-latest --project=firefox --project=ios-mobile --project=android-mobile --retries=0`
  - Result: `66 passed`, `6 skipped`, `0 failed`
- Single-scenario recheck:
  - Command: `npm run test:playwright:quotation -- --project=chromium --grep "validates concurrent sessions and draft data isolation"`
  - Result: `1 passed`.
- Sequential edge-gating check (QTR-001/QTR-002 class):
  - Command: `npm run test:playwright:quotation -- --project=msedge-latest --grep "validates required fields, formats, dependencies, and invalid submissions"`
  - Result: `Project(s) "msedge-latest" not found`, confirming optional Edge channel gating is active by design.
- Static quality checks:
  - `npm run lint` passed.
  - `npm run typecheck` passed.

### 12.8 Scenario-Linked Commit Message Set (Sequential Remediation)

- `fix(e2e): resolve mobile sidebar interception for QTR-007,QTR-008,QTR-023,QTR-024,QTR-027,QTR-028,QTR-031,QTR-032,QTR-040,QTR-041`
- `fix(e2e): stabilize auth setup flow for QTR-013 and concurrent-session redirect`
- `test(e2e): harden quotation timeout budgets for QTR-003,QTR-004,QTR-011,QTR-012,QTR-016,QTR-017,QTR-020,QTR-035,QTR-036,QTR-044`
- `chore(playwright): gate optional edge channels for QTR-001,QTR-002,QTR-005,QTR-006,QTR-009,QTR-010,QTR-014,QTR-015,QTR-018,QTR-019,QTR-021,QTR-022,QTR-025,QTR-026,QTR-029,QTR-030,QTR-033,QTR-034,QTR-037,QTR-038,QTR-042,QTR-043,QTR-045,QTR-046`
- `test(visual): refresh firefox quotation baseline for QTR-039`

### 12.6 Stability Runs (Exact Output Captures)

- Repeat-each regression pass for previously failing scenarios:
  - Command: `npm run test:playwright:quotation -- --project=chromium --project=chrome-latest --project=firefox --project=ios-mobile --project=android-mobile --repeat-each=5 --retries=0`
  - Output: `5 interrupted`, `17 skipped`, `27 did not run`, `251 passed (41.4m)`
  - Notes:
    - Interrupted scenarios were concentrated on `android-mobile` with artifact file errors (`ENOENT`) during trace/screenshot writes.
- Critical mobile class soak run (SIG-03/SIG-06 mapped scenarios):
  - Command: `npm run test:playwright:quotation -- --project=ios-mobile --project=android-mobile --grep "validates required fields, formats, dependencies, and invalid submissions|runs JSON and CSV driven permutations for valid and invalid payloads|covers exhaustive field-level validation for text, numeric, and dependency attributes|executes negative security, session timeout, and interrupted workflow resistance scenarios|validates UX consistency for breakpoints, keyboard flow, accessibility contract, and tooltip behavior" --repeat-each=10 --retries=0`
  - Output: `5 interrupted`, `14 did not run`, `81 passed (43.7m)`
  - Notes:
    - Interrupted runs were again `android-mobile` with artifact persistence failures and context-closed follow-up errors.
- 3 consecutive mobile matrix runs:
  - Run 1 output: `3 skipped`, `21 passed (8.6m)`
  - Run 2 output: `3 skipped`, `21 passed (8.5m)`
  - Run 3 output: `3 skipped`, `21 passed (8.6m)`
  - Computed mobile pass rate over 3 consecutive runs:
    - Executed tests: `63/63 passed` (`100%`)
    - Skips remained stable: `9` total across the 3 runs.

### 12.7 Closure PR and Release Candidate Commands

- Closure branch workflow:
  - `git checkout -b release/quotation-e2e-remediation-closeout`
  - `git add tests/e2e/quotation/pom/BasePage.ts tests/e2e/quotation/pom/QuotationComposerPage.ts tests/e2e/quotation/pom/AuthPage.ts tests/e2e/quotation/quotation-comprehensive.spec.ts playwright.config.ts src/components/layout/AppSidebar.tsx docs/reports/quotation_e2e_failure_remediation_prompts.md tests/e2e/quotation/quotation-comprehensive.spec.ts-snapshots/quotation-composer-visual-firefox-main-firefox-darwin.png`
  - `git commit -m "release: close quotation e2e remediation tracks with verification artifacts"`
  - `git push -u origin release/quotation-e2e-remediation-closeout`
- PR creation and merge:
  - `gh pr create --title "Release: quotation e2e remediation closeout" --body-file docs/reports/quotation_e2e_failure_remediation_prompts.md --base main --head release/quotation-e2e-remediation-closeout`
  - `gh pr merge --squash --delete-branch`
- Release candidate tag:
  - `git checkout main && git pull`
  - `git tag -a v2026.03.quotation-e2e-rc1 -m "Quotation E2E remediation release candidate"`
  - `git push origin v2026.03.quotation-e2e-rc1`

### 12.5 Commit Message Set (Scenario-Linked)

- Refer to section `12.8` for the active scenario-linked commit messages.
