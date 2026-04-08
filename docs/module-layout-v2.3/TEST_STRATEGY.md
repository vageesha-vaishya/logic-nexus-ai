# Test Strategy – Module Layout v2.3

## Objectives
- Validate functional correctness of Event Stream, CRUD Events, and Viewport Checklist.
- Enforce performance, accessibility, and security quality gates.
- Ensure end-to-end workflow integrity from Grid through Detail and event propagation.

## 1) Unit Testing (Vitest + RTL)
Coverage target:
- >= 90% line coverage for v2.3 feature package.

Primary unit suites:
- `AmroInventoryDataGridTemplate.test.tsx`
- `AmroPartsInventoryWorkbench.test.tsx`

Assertions include:
- panel collapse/restore resilience.
- keyboard restore shortcut (`Ctrl/Cmd + Shift + E`).
- CRUD callback emission behavior.
- loading/error/empty/ready state correctness.

## 2) Integration Testing
### Cypress scenario chain
Flow:
1. grid row click
2. record detail visible
3. CRUD event action triggered
4. Event Stream updated
5. checklist recomputed and badge updated

File:
- `cypress/integration/module-layout-v23.cy.ts`

## 3) Accessibility Testing
Tools:
- RTL + axe checks in CI extension stage.
- keyboard-only walk-through for:
  - separator resize
  - collapse/restore
  - icon action bar controls

Required passes:
- visible focus indicators
- ARIA labels on icon controls
- no keyboard traps

## 4) Performance Testing
### Lighthouse CI
Primary assertions:
- LCP < 1.5s (3G throttled profile)
- CLS < 0.1
- INP/FID proxy within interaction budget

Secondary assertions:
- no horizontal scrolling for detail form at 1366x768
- stable frame transitions while resizing/collapsing

## 5) Security Testing
Pipelines:
- SAST: lint + static checks + security rules
- DAST: OWASP ZAP baseline scan
- Dependencies: `npm audit` and policy gating

Pass conditions:
- zero high or critical findings
- all medium findings triaged with remediation owner

## 6) UAT Scenarios
- operations user executes CRUD workflow under high row volume.
- quality user validates checklist coverage for critical fields.
- accessibility tester validates keyboard and screen-reader interactions.

## 7) Exit Criteria
- all phase-5 tests pass
- KPI thresholds achieved
- release candidate approved by engineering + QA + security gate
