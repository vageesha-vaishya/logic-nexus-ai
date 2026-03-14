# Enterprise UI/UX Enhancement Strategy (Production-Ready Transformation)

## 1) Executive Intent

This strategy transforms Logic Nexus-AI into an enterprise-grade platform with:

- World-class visual quality
- High-efficiency workflows for logistics + CRM personas
- Strict accessibility compliance (WCAG 2.1 AA)
- Measurable UX and performance gains
- A scalable Storybook-driven design system

Primary business outcomes:

- User satisfaction score (CSAT) ≥ 4.5/5.0
- Task completion rate +25% minimum
- Page load time < 2.0s for key dashboards on broadband
- Reduced UI inconsistency defects by >60%

---

## 2) Platform Scope (Current Module Map)

Source-aligned module landscape (from navigation and command center architecture):

1. Sales
2. Logistics
3. Compliance
4. Billing
5. Finance
6. Administration
7. Settings

Cross-cutting experience surfaces:

- Global shell (sidebar, command center navigation, top actions)
- Dashboard cards and analytics
- Data tables and list workflows
- Form-heavy create/edit flows
- Modal/task dialogs
- Notifications and activity streams

---

## 3) Competitive Analysis: Top 10 CRM Platforms

## 3.1 Benchmark Targets

Platforms analyzed:

1. Salesforce
2. Microsoft Dynamics 365
3. HubSpot
4. Pipedrive
5. Zoho CRM
6. Oracle CX
7. SAP CRM
8. Freshworks CRM
9. Monday.com
10. Zendesk Sell

## 3.2 Best-in-Class Pattern Matrix

| Platform | Strongest UI Pattern | Interaction Paradigm | Workflow Strength | Pattern to Adopt |
|---|---|---|---|---|
| Salesforce | Dense but structured record pages | Progressive disclosure + tabbed details | Deep enterprise data navigation | Utility bar + sticky action row + modular detail regions |
| Dynamics 365 | Consistent command bar model | Ribbon-style global actions | Role-oriented productivity | Contextual command bars with permission-aware states |
| HubSpot | Clean low-friction forms | Inline assistance + guided setup | Fast onboarding and data entry | Contextual help + defaults + reduced field burden |
| Pipedrive | Pipeline-first clarity | Drag/drop stage transitions | Sales velocity visibility | Lightweight kanban interactions and stage cues |
| Zoho CRM | Configurability breadth | Adaptive form sections | SMB-to-enterprise scalability | Configurable modules with consistent core primitives |
| Oracle CX | Information architecture depth | Structured enterprise navigation | Cross-functional process coverage | Multi-level navigation + data governance cues |
| SAP CRM | Process rigor | Deterministic, compliance-first flow | Operational control | Audit-ready status transitions and explicit confirmations |
| Freshworks CRM | Friendly visual hierarchy | Low-cognitive list-to-detail flow | Fast adoption | Simplified typography hierarchy and status chips |
| Monday.com | Visual composability | Inline edit and state-rich boards | Team collaboration | Unified board/table/list with quick state edits |
| Zendesk Sell | Task-focused productivity | Minimal-friction sales actions | Rapid user throughput | Action-first layouts and timeline-centric context |

## 3.3 Design Standards Derived from Competitor Synthesis

1. **Action-first surfaces**: sticky primary actions and context toolbars.
2. **Predictable information architecture**: standardized list → detail → edit flow.
3. **Progressive complexity**: reveal advanced fields only when context requires.
4. **State-rich components**: explicit hover/focus/disabled/loading/error/success patterns.
5. **Cognitive-load reduction**: fewer simultaneous decisions per screen.
6. **Enterprise accessibility**: keyboard-first workflows, semantic landmarks, robust focus order.

---

## 4) Global UX Architecture Blueprint

## 4.1 Layout Framework

- **Desktop**: 12-column responsive grid, fixed structural rails, fluid content pane.
- **Tablet**: 8-column grid with adaptive side panels and collapsible secondary actions.
- **Mobile**: 4-column stack; action sheet pattern for secondary controls.

Spacing system:

- 4px baseline grid
- Core spacing tokens: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Section rhythm: 24px vertical separation (desktop), 16px (mobile)

Typography hierarchy:

- H1: 32/40, semibold
- H2: 24/32, semibold
- H3: 20/28, medium
- Body: 14/20 default
- Meta labels: 12/16 medium

## 4.2 Navigation and Wayfinding

- Persistent sidebar with grouped modules and saved expansion state.
- Breadcrumb trail for every detail/form page.
- Module-level quick actions in top command row.
- Universal search with keyboard shortcut and result grouping by entity type.

## 4.3 Interaction Model

- Micro-interactions: 120–220ms for hover/focus; 220–320ms for state transitions.
- Motion easing: standard cubic-bezier(0.4, 0, 0.2, 1).
- High-frequency actions receive optimistic UI where rollback safety is guaranteed.

---

## 5) Module-by-Module Enhancement Recommendations

## 5.1 Sales Module

### A) UI Improvements (Before/After, Wireframe, Specs)

**Before (current pattern):** mixed hierarchy between pipeline/list/forms, uneven action prominence.

**After (target):**

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Breadcrumbs: Sales / Leads / Pipeline            [Search] [Filter] [New] │
├───────────────────────────────────────────────────────────────────────────┤
│ KPI Strip: New Leads | MQL | SQL | Win Rate | Avg Cycle                  │
├───────────────────────────────────────────────────────────────────────────┤
│ Left: Kanban/List Toggle + Saved Views   Right: Bulk Actions + Export    │
├───────────────────────────────────────────────────────────────────────────┤
│ Main: Pipeline columns with WIP limits, stage SLA badges, assignee chips │
└───────────────────────────────────────────────────────────────────────────┘
```

Pixel specs:

- Command row height: 56px
- KPI strip card min width: 180px
- Kanban card padding: 12px; radius 10px
- Primary CTA min width: 96px; height 36px

### B) Form Redesign Strategy

- Lead/Opportunity forms split into:
  - Identity
  - Qualification
  - Commercial context
  - Next action
- Progressive disclosure:
  - Show advanced firmographic fields only after lead source + segment selected.
- Field grouping by task sequence:
  - Contact + account context first
  - Deal value + probability second
  - Internal notes last
- Micro-interactions:
  - Inline stage-change confirmation
  - Smart defaults for owner and expected close date

### C) Section-Level Layout

- Two-column desktop edit forms; single-column mobile.
- Sticky right summary rail with activity and reminders.
- Strong contrast between active stage and pending stages.

### D) Component Upgrades

- Buttons: primary, secondary, tertiary, danger with full state matrix.
- Inputs: success/warning/error + helper text semantics.
- Tables: column pinning, density switch, keyboard sorting.
- Cards: hover elevation + status side accent.
- Modals: focus trap, escape handling, return-focus origin.

---

## 5.2 Logistics Module

### A) UI Improvements

**Before:** operational data scattered across disparate pages.

**After:**

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Breadcrumbs: Logistics / Shipments / SHP-2026-00123      [Create] [Track]│
├───────────────────────────────────────────────────────────────────────────┤
│ Status Timeline: Booking → Pickup → POL → POD → Delivered               │
├───────────────────────────────────────────────────────────────────────────┤
│ Left: Shipment detail sheet        Right: Live events + docs + alerts    │
└───────────────────────────────────────────────────────────────────────────┘
```

Pixel specs:

- Timeline nodes: 24px with 2px connector
- Alert panel width: 340px desktop, full-width drawer mobile
- Data key/value rows: 28px row height

### B) Form Redesign Strategy

- Multi-leg shipment wizard:
  1) Route and Incoterm
  2) Cargo profile
  3) Carrier/service
  4) Pricing/charges
  5) Review and confirm
- Conditional sections:
  - Show hazardous, reefer, oversize fields by cargo flags.
- Inline calculation previews:
  - Transit days, margin estimate, capacity fit.

### C) Section-Level Layout

- Master-detail on desktop; stacked accordion on mobile.
- Whitespace tuned to reduce table visual noise in tracking screens.
- Status colors standardized and non-color fallback icons included.

### D) Component Upgrades

- Shipment status chips with icon + text.
- Event feed cards with timestamp precision and source badge.
- Table virtualization for large tracking datasets.

---

## 5.3 Compliance Module

### A) UI Improvements

- Case dashboard with severity queues.
- Risk score visualization using color + icon + text labels.

### B) Form Redesign Strategy

- Screening form in staged blocks:
  - Entity input
  - Jurisdiction context
  - Match confidence and disposition
- Progressive evidence fields only when match threshold exceeded.

### C) Section-Level Layout

- Fixed filter sidebar + primary case table.
- Detail pane with immutable audit timeline.

### D) Component Upgrades

- Incident severity badge system (Critical/High/Medium/Low).
- Modal approvals requiring typed confirmation for destructive actions.

---

## 5.4 Billing Module

### A) UI Improvements

- Subscription overview with plan/usage/renewal cards.
- Clear differentiation between tenant plan management vs self-service.

### B) Form Redesign Strategy

- Billing forms grouped by:
  - Plan selection
  - Payment method
  - Tax information
  - Confirmation
- Real-time validation for payment fields.

### C) Section-Level Layout

- Usage chart + invoice history split layout.
- Mobile: chart collapses into summary chips + drill-down.

### D) Component Upgrades

- Price cards with comparative highlights.
- Stepper component for upgrade/downgrade flows.

---

## 5.5 Finance Module

### A) UI Improvements

- Invoices, margin rules, and tax jurisdictions unified in common financial shell.
- Consistent monetary formatting and column alignment.

### B) Form Redesign Strategy

- Invoice form:
  - Header data
  - Line items table
  - Totals/tax summary
  - Approval notes
- Margin rules:
  - Condition builder with natural language preview.

### C) Section-Level Layout

- Split view with line-item editing and live total recalculation.
- High-contrast sticky totals footer.

### D) Component Upgrades

- Numeric inputs with locale-aware formatting.
- Data tables with sticky summary rows and export presets.

---

## 5.6 Administration Module

### A) UI Improvements

- Unified admin control center for tenants, franchises, users, transfers.
- Permission and role visualization matrix.

### B) Form Redesign Strategy

- User provisioning:
  - Identity
  - Access scope (tenant/franchise)
  - Role template
  - Review
- Transfer center:
  - Source/target validation with impact preview.

### C) Section-Level Layout

- Three-pane admin layout:
  - Entity list
  - Detail
  - Audit history

### D) Component Upgrades

- Permission chips with inheritance states.
- Confirmation workflows with reversible timeout for safe undo.

---

## 5.7 Settings Module

### A) UI Improvements

- Settings index by domain (System, Integrations, Theme, Data, Quotation, Security).
- Searchable settings registry with “last modified” metadata.

### B) Form Redesign Strategy

- Use section cards with explicit save boundaries.
- Long settings pages broken into sub-tabs with unsaved-change guards.

### C) Section-Level Layout

- Max readable width for settings text (720px) to reduce scan fatigue.
- Side summary panel for health/status indicators.

### D) Component Upgrades

- Toggle rows with description and dependency hints.
- Secret key fields with reveal-copy-rotate controls and a11y labels.

---

## 6) Multi-Layout Form Design Patterns (All Modules)

## 6.1 Layout Selection Rules

- **Single-column**: high cognitive complexity, compliance forms, mobile-first critical workflows.
- **Two-column**: moderate complexity and editable business entities on desktop.
- **Hybrid**: section cards where summary remains fixed and details scroll.

## 6.2 Section Placement Strategy

1. “Identity/context” always first
2. “Core task data” second
3. “Advanced/conditional” third
4. “Review/confirm” final

## 6.3 Label Positioning Policy

- Top-aligned labels default for responsiveness and scan speed.
- Left-aligned labels allowed for compact desktop admin matrices.
- Floating labels only for short simple inputs (never for long textareas/select-heavy forms).

## 6.4 Progressive Disclosure Standards

- Trigger by explicit switch/select state.
- Animate open/close within 180–220ms.
- Maintain keyboard focus continuity when sections reveal.

## 6.5 Validation + Contextual Help

- Inline validation on blur; submit validation on full-form check.
- Helper text always visible for high-error fields.
- Contextual help icon opens non-modal side explainers for complex logistics/finance terms.

---

## 7) Storybook Component Library Overhaul

## 7.1 Design Tokens Foundation

Token categories:

- Colors: brand, semantic, neutral, data-viz
- Typography: families, sizes, weights, line heights, tracking
- Spacing: baseline scale + layout spacing aliases
- Radii and borders
- Shadows and elevation levels
- Motion: duration, easing, distance curves
- Z-index layers and overlay priorities

Token implementation layers:

1. Global primitives (raw scales)
2. Semantic aliases (surface, text, border, action, status)
3. Component tokens (button, input, table, card, modal)

## 7.2 Variant and State Coverage

For every core component:

- States: default, hover, active, focus-visible, disabled, loading, success, warning, error
- Sizes: compact, default, comfortable
- Themes: light/dark/high-contrast
- Density: data-dense vs relaxed

## 7.3 Documentation Standards

Each Storybook component page must include:

1. Usage guidance (do/don’t)
2. Accessibility notes (keyboard, ARIA, contrast)
3. State matrix examples
4. Anatomy diagram
5. Code snippets for common integration patterns
6. Design token references

## 7.4 Interaction Specs

- Hover in: 120ms
- Press in: 80ms
- Expand/collapse: 220ms
- Modal entrance: 240ms + backdrop fade 180ms

---

## 8) WCAG 2.1 AA Accessibility Program

Mandatory standards:

- Contrast ratio:
  - Normal text ≥ 4.5:1
  - Large text ≥ 3:1
  - UI graphics and controls ≥ 3:1
- Keyboard full operability for all interactive controls.
- Visible focus indicators on all actionable elements.
- Semantic heading hierarchy and landmark regions.
- ARIA labeling for icon-only and complex controls.
- Screen reader announcements for validation errors and async updates.

Accessibility quality gates:

1. Automated checks in CI (axe + eslint a11y rules)
2. Keyboard-only walkthrough script for all critical flows
3. Screen reader smoke tests (NVDA/VoiceOver)

---

## 9) Implementation Roadmap

## Phase 1: Foundation + Critical Components

Scope:

- Establish token architecture
- Update buttons, inputs, table, modal, navigation primitives
- Integrate WCAG and interaction standards into Storybook

Feasibility:

- High (existing shadcn/Tailwind foundation supports token migration)

Performance impact:

- Bundle change: +8% expected initially (token/util layers), then optimized via dedupe
- Render impact: neutral to positive with reduced ad hoc styling

## Phase 2: Module-Specific Enhancements

Scope:

- Apply new layout/form patterns to Sales, Logistics, Finance first
- Then Compliance, Billing, Administration, Settings

Feasibility:

- Medium-high (requires coordination with module owners and domain validation)

Performance impact:

- Potential +5–10% component complexity; offset through table virtualization and lazy sections

## Phase 3: Advanced Interactions + Motion

Scope:

- Introduce intelligent micro-interactions, optimistic updates, advanced board interactions
- Add contextual help overlays and inline productivity affordances

Feasibility:

- Medium (needs disciplined motion governance)

Performance impact:

- Must keep animation budgets < 16ms/frame; GPU-friendly transforms only

## Phase 4: Testing, Hardening, Optimization

Scope:

- Cross-browser validation
- A/B experiments
- Accessibility certification
- Performance tuning and regression controls

Feasibility:

- High with established test harness and CI gating

Performance targets:

- Largest Contentful Paint < 2.0s (key dashboards)
- Interaction to Next Paint < 200ms (top workflows)
- JS bundle growth capped at +12% net from baseline

---

## 10) Cross-Browser Compatibility Requirements

Test matrix:

- Desktop: Chrome, Firefox, Safari, Edge (latest stable + one previous major)
- Mobile: iOS Safari, Chrome Android

Validation areas:

- Layout stability across breakpoints
- Form controls, date/time inputs, and focus rings
- Sticky headers/columns and scroll containers
- Animation fallback behavior under reduced-motion preferences

---

## 11) Measurement and Success Criteria

## 11.1 Quantitative Targets

- CSAT ≥ 4.5/5.0
- Task completion +25% minimum in top 10 workflows
- Time-on-task reduction ≥ 20%
- Error rate reduction ≥ 30% for high-volume forms
- Page load time < 2.0s on primary dashboards

## 11.2 UX Scorecard Cadence

- Weekly during rollout waves
- Monthly post-rollout stabilization
- Quarterly benchmark against CRM competitive standards

---

## 12) A/B Testing Protocol

## 12.1 Experiment Design Standards

- Confidence level: 95%
- Statistical power: 80%
- Significance threshold: p < 0.05
- Guardrail metrics: bounce, latency, accessibility regressions

## 12.2 Sample Size Rules

For binary outcomes (task completed vs not):

- Use two-proportion sample-size estimation.
- Example baseline completion = 60%, target = 75%:
  - Minimum sample ≈ 152 users per variant (304 total), before attrition buffer.
- Apply +15% buffer for drop-off/incomplete sessions.

For continuous metrics (time-on-task):

- Minimum 100–150 participants per variant, calibrated using observed variance.

## 12.3 Test Duration

- Minimum 2 full business cycles (usually 2–4 weeks).
- Extend if segment coverage is insufficient (role/device/geography).

---

## 13) User Acceptance Testing (UAT) Framework

## 13.1 Usability Scenarios

Mandatory scenarios per module:

1. Create new record end-to-end
2. Edit and validate complex form data
3. Find and filter records in high-volume table
4. Complete approval or status-change action
5. Recover from validation error and continue successfully

## 13.2 Accessibility Audit Checklist

- Keyboard-only completion for all critical workflows
- Focus order and visible ring checks
- Contrast verification for all interactive states
- Screen reader labels and announcements for errors/status updates

## 13.3 Cross-Platform Validation

- Desktop and mobile browser pass criteria
- Touch target minimum 44x44 for mobile controls
- Orientation and viewport change resilience

---

## 14) Technical Feasibility and Risk Register

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Token migration inconsistency across legacy components | High | Medium | Enforce semantic token linting and Storybook visual regression checks |
| Module-by-module rollout causes temporary UX divergence | Medium | High | Use migration flags and aligned shell primitives first |
| Performance regressions from richer interactions | High | Medium | Add performance budgets and CI thresholds (LCP/INP/bundle delta) |
| Accessibility regressions in custom widgets | High | Medium | A11y checklist + automated axe + manual keyboard/SR gates |
| Cross-browser rendering edge cases | Medium | Medium | Dedicated compatibility suite and per-browser bug triage SLAs |

---

## 15) Implementation Deliverables by Phase

## Phase 1 Deliverables

- Token taxonomy and naming convention
- Core component refresh: button/input/select/table/modal/navigation
- Storybook state matrices and accessibility notes

## Phase 2 Deliverables

- Sales, Logistics, Finance upgraded layouts/forms
- Compliance, Billing, Administration, Settings upgraded layouts/forms
- Standardized module shell and breadcrumb/action patterns

## Phase 3 Deliverables

- Micro-interaction system
- Guided assistance and contextual help patterns
- Advanced table and board interactions

## Phase 4 Deliverables

- UAT sign-off packs per module
- Cross-browser certification report
- Accessibility conformance report
- Performance benchmark and optimization summary

---

## 16) Design QA Acceptance Gate (Release Criteria)

A module is production-ready only if all gates pass:

1. Functional QA pass
2. A11y WCAG 2.1 AA pass
3. Performance budget pass
4. Storybook documentation complete
5. UX acceptance score ≥ target benchmark

---

## 17) Immediate Next Execution Steps

1. Approve token model and component priority list.
2. Start Phase 1 on foundational components in Storybook.
3. Run pilot module migration on Sales (highest workflow frequency).
4. Execute A/B experiment for redesigned lead/opportunity forms.
5. Expand rollout to Logistics and Finance after pilot KPI validation.

---

## 18) Execution Backlog (Epics + Stories + Acceptance Criteria + Code Mapping)

This backlog converts the strategy into executable workstreams mapped to existing files and modules.

## 18.1 Prioritization Model

- **P0 (Critical Foundation):** Design tokens, shell/navigation, base primitives, accessibility gates.
- **P1 (Core Business Flows):** Sales + Logistics + Finance high-frequency workflows.
- **P2 (Operational Maturity):** Administration, Settings, Compliance, Billing improvements.
- **P3 (Optimization):** Advanced interactions, experimentation, performance hardening.

## 18.2 Epic Backlog

### Epic E1 — Token System Consolidation and Semantic Layering (P0)

**Objective:** unify visual primitives and remove ad-hoc styling drift.

**Target files/components:**

- `src/design-system/tokens/index.ts`
- `src/lib/theme-utils.ts`
- `src/design-system/index.ts`
- `src/hooks/useTheme.tsx`

**Stories:**

1. Create semantic token aliases for surfaces, text, actions, and statuses.
2. Add motion/elevation/spacing token groups and consumption guidelines.
3. Enforce token usage in shared UI primitives via lint/test guards.

**Acceptance criteria:**

- No direct hardcoded color values in refreshed shared primitives.
- Light/dark token parity for all semantic categories.
- Storybook docs show token-to-component mapping for all core components.

---

### Epic E2 — App Shell, Navigation, and Wayfinding Modernization (P0)

**Objective:** deliver predictable enterprise shell with high discoverability.

**Target files/components:**

- `src/components/layout/AppSidebar.tsx`
- `src/components/navigation/CommandCenterNav.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/app-launcher.tsx`
- `src/config/navigation.ts`

**Stories:**

1. Standardize sidebar group behaviors, active states, and keyboard traversal.
2. Add breadcrumb + command-row contract for module entry screens.
3. Integrate consistent search/filter affordances in shell-level navigation.

**Acceptance criteria:**

- Sidebar state persists reliably and never overlaps main content.
- Keyboard users can traverse all nav groups and execute links.
- Route labels and launcher labels are taxonomy-consistent.

---

### Epic E3 — Core Primitive State Completion in Storybook (P0)

**Objective:** complete state matrix for enterprise primitives with WCAG notes.

**Target files/components:**

- `src/components/ui/enterprise/EnterpriseComponents.tsx`
- `src/components/ui/enterprise/EnterpriseComponents.stories.tsx`
- `src/components/ui/enterprise/index.ts`
- `src/stories/crm/CRM.mdx`

**Stories:**

1. Expand button/input/table/modal/card states (default/hover/focus/active/disabled/loading/error/success).
2. Add interaction specs and keyboard behavior docs to stories.
3. Add accessibility documentation block to each primitive story.

**Acceptance criteria:**

- Every core primitive exposes complete interactive state coverage.
- Storybook pages include keyboard and screen-reader expectations.
- Visual diffs show no regressions across default themes.

---

### Epic E4 — Sales Pipeline UX Refactor (Leads/Opportunities/Accounts/Contacts/Quotes) (P1)

**Objective:** improve conversion throughput and reduce cognitive load in Sales.

**Target files/components/screens:**

- `src/pages/dashboard/LeadsPipeline.tsx`
- `src/pages/dashboard/OpportunitiesPipeline.tsx`
- `src/pages/dashboard/AccountsPipeline.tsx`
- `src/pages/dashboard/ContactsPipeline.tsx`
- `src/pages/dashboard/QuotesPipeline.tsx`
- `src/pages/dashboard/LeadDetail.tsx`
- `src/pages/dashboard/OpportunityDetail.tsx`
- `src/pages/dashboard/AccountDetail.tsx`
- `src/pages/dashboard/ContactDetail.tsx`
- `src/pages/dashboard/QuoteDetail.tsx`

**Stories:**

1. Implement command-row pattern with search/filter/saved views and bulk actions.
2. Redesign list-to-detail transitions with clearer hierarchy and sticky actions.
3. Apply progressive disclosure to advanced deal and quote fields.

**Acceptance criteria:**

- Top 5 Sales workflows show >=25% completion improvement in A/B tests.
- Form abandonment decreases by >=20% in redesigned flows.
- Mobile/tablet/desktop layouts pass responsive baseline stories.

---

### Epic E5 — Sales Form Architecture Modernization (P1)

**Objective:** create reusable high-conversion form patterns for CRM entities.

**Target files/components/screens:**

- `src/pages/dashboard/LeadNew.tsx`
- `src/pages/dashboard/OpportunityNew.tsx`
- `src/pages/dashboard/AccountNew.tsx`
- `src/pages/dashboard/ContactNew.tsx`
- `src/pages/dashboard/QuoteNew.tsx`
- `src/components/sales/templates/TemplateBuilder.tsx`
- `src/components/sales/shared/QuoteDetailView.tsx`

**Stories:**

1. Implement sectioned forms with Identity → Commercial → Review structure.
2. Add inline validation and contextual help for high-error fields.
3. Introduce conditional sections for optional complexity (advanced pricing/routing).

**Acceptance criteria:**

- Validation guidance appears inline and is screen-reader announced.
- Required-field error rate drops by >=30% in usability sessions.
- Quote form completion time improves by >=20%.

---

### Epic E6 — Logistics Workspace and Shipment Lifecycle UX (P1)

**Objective:** provide operational clarity across booking-to-delivery workflows.

**Target files/components/screens:**

- `src/pages/dashboard/Bookings.tsx`
- `src/pages/dashboard/BookingNew.tsx`
- `src/pages/dashboard/BookingDetail.tsx`
- `src/pages/dashboard/ShipmentsPipeline.tsx`
- `src/pages/dashboard/ShipmentDetail.tsx`
- `src/pages/dashboard/ShipmentNew.tsx`
- `src/pages/dashboard/ShipmentDocumentViewer.tsx`

**Stories:**

1. Build shipment status timeline with live event context and SLA indicators.
2. Add split layout with detail sheet + activity/documents rail.
3. Redesign booking/shipment creation into staged guided flow.

**Acceptance criteria:**

- Dispatch/operator task completion improves >=25%.
- Navigation depth for shipment diagnostics decreases by >=30%.
- Status and alert states pass color + non-color accessibility checks.

---

### Epic E7 — Finance and Billing Experience Unification (P1)

**Objective:** make financial workflows auditable, legible, and efficient.

**Target files/components/screens:**

- `src/pages/dashboard/finance/Invoices.tsx`
- `src/pages/dashboard/finance/InvoiceDetail.tsx`
- `src/pages/dashboard/TenantSubscription.tsx`
- finance route surfaces in `src/App.tsx`

**Stories:**

1. Standardize invoice list/detail with sticky totals and table density controls.
2. Improve subscription plan pages with clearer comparison and renewal cues.
3. Introduce export/filter presets aligned to finance operator roles.

**Acceptance criteria:**

- Financial table scans complete faster in moderated testing by >=20%.
- Invoice workflow error rate decreases >=25%.
- Subscription pages meet accessibility and mobile pass criteria.

---

### Epic E8 — Administration IA and Permission-Centered UX (P2)

**Objective:** reduce admin errors and increase confidence in high-impact actions.

**Target files/components/screens:**

- `src/pages/dashboard/Users.tsx`
- `src/pages/dashboard/UserDetail.tsx`
- `src/pages/dashboard/UserNew.tsx`
- `src/pages/dashboard/Tenants.tsx`
- `src/pages/dashboard/TenantDetail.tsx`
- `src/pages/dashboard/TenantNew.tsx`
- `src/components/admin/UserForm.tsx`
- `src/components/admin/TenantForm.tsx`

**Stories:**

1. Implement role/permission visibility and scoped warning patterns.
2. Add high-risk action confirmations with reversible undo where safe.
3. Standardize admin list/detail/create layouts with clear breadcrumbs.

**Acceptance criteria:**

- Admin misconfiguration incidents decline >=30%.
- Permission assignment success rate reaches >=95% in UAT scenarios.
- All admin forms pass keyboard-only completion tests.

---

### Epic E9 — Settings and Theme Management Simplification (P2)

**Objective:** reduce settings complexity and improve discoverability.

**Target files/components/screens:**

- `src/pages/dashboard/Settings.tsx`
- `src/pages/dashboard/ThemeManagement.tsx`
- `src/pages/dashboard/QuotationSettings.tsx`
- `src/pages/dashboard/QuoteNumberSettings.tsx`
- `src/pages/dashboard/RolesPermissions.tsx`

**Stories:**

1. Reorganize settings into domain-based sections with search and metadata.
2. Add save-boundary indicators and unsaved-change protections.
3. Harmonize theme/token settings with system-level token model.

**Acceptance criteria:**

- Users find target setting in <=3 interactions for top 20 tasks.
- Unsaved-change data loss incidents are eliminated.
- Theme changes preview and apply consistently across modules.

---

### Epic E10 — Compliance and Security UX Hardening (P2)

**Objective:** increase confidence and speed for compliance operations.

**Target files/components/screens:**

- Compliance routes in `src/App.tsx`
- `src/config/navigation.ts` compliance entries

**Stories:**

1. Build severity-oriented case queue and drill-down flow.
2. Add explicit disposition workflow with audit trail surfacing.
3. Improve alert triage UI with status-driven visual hierarchy.

**Acceptance criteria:**

- Critical incident triage initiation time improves >=30%.
- Disposition actions are fully auditable and reversible where policy allows.
- Compliance flows pass WCAG 2.1 AA with keyboard parity.

---

### Epic E11 — Storybook Documentation and Quality Gates (P0/P3)

**Objective:** make Storybook the canonical UX delivery and QA reference.

**Target files/components:**

- `.storybook/preview.ts`
- `.storybook/manager.ts`
- `src/stories/crm/*.stories.tsx`
- `src/stories/crm/prototypes/*.stories.tsx`
- `src/stories/crm/prototypes/*.mdx`
- `src/components/dashboard/crm/SalesRepDashboard.stories.tsx`
- `src/components/dashboard/logistics/DispatcherDashboard.stories.tsx`
- `src/components/dashboard/sales/QuoteManagerDashboard.stories.tsx`

**Stories:**

1. Standardize docs templates (usage, state matrix, accessibility, code examples).
2. Add baseline viewport stories for desktop/tablet/mobile across key modules.
3. Integrate visual regression and accessibility checks into CI gates.

**Acceptance criteria:**

- Every critical component has docs + states + a11y notes.
- Baseline stories exist for all high-traffic module dashboards.
- Storybook build is green with no critical accessibility violations.

---

### Epic E12 — UX Experimentation, Performance, and Release Governance (P3)

**Objective:** guarantee measurable impact with safe rollout controls.

**Target files/components:**

- `src/design-system/rolloutPlan.ts`
- `src/design-system/componentCatalog.ts`
- `src/design-system/design-system-exports.test.ts`
- CI workflow files under `.github/workflows/`

**Stories:**

1. Define A/B experiment templates for top workflows and instrument KPIs.
2. Add performance budgets (LCP/INP/bundle delta) to release gates.
3. Maintain phased rollout ledger with go/no-go checklist per module.

**Acceptance criteria:**

- Every phase has explicit entry/exit criteria and risk sign-off.
- Dashboard performance remains within budget after each rollout slice.
- Experiment readouts include statistical significance and recommendation.

---

## 18.3 Route-to-Screen Mapping Reference (Implementation Anchor)

Primary routing and module entry anchors:

- `src/App.tsx` for route ownership (`/dashboard/leads/pipeline`, `/dashboard/opportunities/pipeline`, `/dashboard/accounts/pipeline`, `/dashboard/contacts/pipeline`, `/dashboard/quotes/pipeline`, `/dashboard/bookings`, `/dashboard/shipments/pipeline`, `/dashboard/finance/invoices`, `/dashboard/users`, `/dashboard/tenants`, `/dashboard/settings`).
- `src/config/navigation.ts` for menu taxonomy and cross-module IA consistency.
- `src/components/navigation/CommandCenterNav.tsx` and `src/components/layout/AppSidebar.tsx` for command-center UX behavior.

## 18.4 Definition of Ready / Definition of Done

### Definition of Ready

- Story has linked target files/screens.
- UX acceptance criteria are measurable.
- Accessibility requirements are explicit.
- Telemetry/KPI event definitions are identified.

### Definition of Done

- Functional requirements pass QA.
- WCAG 2.1 AA checks pass automated + manual checks.
- Storybook states/docs updated for changed components.
- Performance budgets and cross-browser smoke checks pass.

## 18.5 Suggested Sprint Sequencing (First 4 Sprints)

### Sprint 1

- E1, E2 core shell standards, E3 primitive state completion.

### Sprint 2

- E4 Sales pipeline/layout modernization + pilot A/B setup.

### Sprint 3

- E5 Sales form architecture + E6 Logistics workflow modernization start.

### Sprint 4

- E6 completion + E7 Finance/Billing unification + E11 quality gates hardening.
