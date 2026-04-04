# AMRO Engine UI/UX Redesign System

## 1. Redesign Objectives
- Elevate AMRO Engine workspace from utility layout to enterprise command-center experience.
- Improve scanability and task speed for planners, reliability engineers, compliance officers, and line maintenance users.
- Standardize typography, spacing, color semantics, and interaction states across all engine sections.
- Preserve existing workflow logic and data contracts while improving visual and navigational quality.

## 2. Information Architecture
- Level 1:
- Engine Operations Command Center (hero + KPI strip + lane navigation).
- Level 2:
- Maintenance Scheduling & Tracking.
- Component Monitoring.
- Work Order Management.
- Compliance Tracking.
- Performance Analytics.
- Integration & Validation Mesh.
- Level 3:
- Lifecycle & Configuration Records.
- Serialized/Thrust/On-Wing Records.
- Validated Engine Data Entry.

## 3. Wireframe Specification (Low Fidelity)
```text
+------------------------------------------------------------------------------------+
| Engine Operations Command Center                        [status badges]            |
| Unified lifecycle, reliability, compliance, and performance cockpit                |
| [KPI 1] [KPI 2] [KPI 3] [KPI 4]                                                   |
| [Maintenance Lane] [Work Order Lane] [Compliance Lane] [Performance Lane]         |
+------------------------------------------------------------------------------------+
| Performance Trend Chart                                                            |
|                                                                                    |
|                                                                            [chart] |
+--------------------------------------+---------------------------------------------+
| Maintenance Scheduling & Tracking     | Component Monitoring                        |
| - visible/total queue                  | - signal statuses                           |
| - queue rows                           | - source/update time                         |
| - conflicts/resources                  |                                             |
+--------------------------------------+---------------------------------------------+
| Work Order Management                 | Compliance Tracking                          |
| - W/O status counters                 | - ready/pending/overdue                      |
| - recent work orders                  | - authority profile statuses                 |
| - parts + signatures                  | - standards                                  |
+--------------------------------------+---------------------------------------------+
| Performance Analytics                 | Integration & Validation Mesh                |
| - anomaly index/prediction/confidence | - adapters, channels, circuit breaker        |
| - mini chart + anomalies              | - standards + validation layers              |
+--------------------------------------+---------------------------------------------+
| Lifecycle & Configuration Records     | Serialized/Thrust/On-Wing Records           |
+------------------------------------------------------------------------------------+
| Engine Data Entry (Validated)                                                         |
+------------------------------------------------------------------------------------+
```

## 4. High-Fidelity Style Tokens
- Typography:
- Heading: `text-sm font-semibold tracking-tight`.
- Section title: `text-sm font-semibold`.
- Body/supporting: `text-[11px]` and `text-xs`.
- KPI labels: uppercase micro-label style, `text-[11px]` with tracking.
- Spacing:
- Outer card: `p-3 md:p-4`, gaps `gap-3` to `gap-4`.
- Inner cards: `rounded-lg`, content `px-2.5 py-1.5` or `px-3 py-2`.
- Density standardized for operational tables and badges.
- Color/semantic palette:
- Base surface: `bg-card/80`.
- Soft secondary panel: `bg-muted/40`.
- Warning KPI state: amber background + amber border.
- Border system: `border-[hsl(var(--mdm-template-border))]`.
- Interactions:
- Hover elevation: `hover:shadow-md` + subtle lift `hover:-translate-y-0.5`.
- Focus accessibility: `focus-visible:ring-2 focus-visible:ring-primary`.

## 5. Component Library Contract
- `EngineWorkspaceShell`
- Hero + KPI + lane navigation wrapper.
- Props: `statusBadges`, `headlineKpis`, `laneLinks`.
- `EngineOperationalCard`
- Reusable section card with title, subtitle, optional badge, and list body.
- Props: `title`, `subtitle`, `badge`, `children`.
- `EngineMetricTile`
- KPI tile with optional warning tone.
- Props: `label`, `value`, `tone`.
- `EngineDataListItem`
- Compact list row for schedule/work-order/anomaly entries.
- Props: `title`, `status`, `meta[]`.
- `EngineValidatedFormPanel`
- Standardized form shell with helper text and submit state handling.

## 6. Interaction Specification
- Lane chips:
- Anchor-based quick jump to major sections (`#engine-lane-*`).
- Hover/focus state must preserve visible outline at 3:1 minimum contrast.
- Operational rows:
- Card rows animate only transform/shadow/background for lightweight performance.
- Status badges:
- Use semantic variants only (`secondary` and `destructive`) mapped by operational severity.
- Form interaction:
- Inline validation messages remain directly under fields.
- Submit button exposes `aria-busy` during validation.

## 7. Accessibility (WCAG 2.1 AA)
- Keyboard:
- All lane links are keyboard focusable and have visible focus treatment.
- All form controls retain explicit `Label` and `aria-label` attributes.
- Semantics:
- Landmark sections use `section` and `aria-label`.
- Real-time lists use polite ARIA live regions for conflict/anomaly updates.
- Contrast:
- Warning tiles and muted text use contrast-safe combinations.
- Motion:
- Transition durations are short and non-disruptive; no continuous animation loops.

## 8. Responsive Behavior
- Desktop (`>=1280px`):
- Two-column operational cards for parallel workflows.
- Tablet (`>=768px` and `<1280px`):
- One/two column adaptive based on section complexity.
- Mobile (`<768px`):
- Single-column stack; lane chips wrap; forms remain full-width.

## 9. Cross-Browser and Performance Criteria
- Supported:
- Chromium latest stable, Firefox latest stable, Safari latest stable.
- Rendering:
- No layout shift in lane chips and KPI tiles during data refresh.
- Performance:
- UI transitions limited to transform/shadow/color properties.
- Charts remain bounded to fixed-height containers to prevent reflow spikes.

## 10. Implementation Traceability
- Primary implementation file:
- `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx`
- Test updates:
- `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.test.tsx`
