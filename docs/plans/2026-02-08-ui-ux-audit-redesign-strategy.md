# SOS Logic Nexus AI — Comprehensive UI/UX Architecture Audit & Redesign Strategy

**Version:** 2.0
**Date:** 2026-02-17 (revised)
**Classification:** Internal — Strategic
**Prepared by:** Architecture & Design Team

***

## Document Control

| Field        | Value               |
| ------------ | ------------------- |
| Document ID  | NEXUS-UIUX-2026-001 |
| Version      | 2.0                 |
| Status       | Revised             |
| Last Updated | 2026-02-17          |

### Revision History

| Version | Date       | Author            | Changes                                           |
| ------- | ---------- | ----------------- | ------------------------------------------------- |
| 1.0     | 2026-02-08 | Architecture Team | Initial comprehensive audit and redesign strategy |
| 2.0     | 2026-02-17 | Architecture Team | Codebase verification, corrections, enterprise enhancement analysis (Appendix E-G) |

***

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Audit Methodology](#2-audit-methodology)
3. [Current State Assessment — Component Library](#3-current-state-assessment--component-library)
4. [Current State Assessment — Navigation & Information Architecture](#4-current-state-assessment--navigation--information-architecture)
5. [Current State Assessment — Forms & Data Entry](#5-current-state-assessment--forms--data-entry)
6. [Current State Assessment — Dashboards & Data Visualization](#6-current-state-assessment--dashboards--data-visualization)
7. [Current State Assessment — User Workflows & Critical Paths](#7-current-state-assessment--user-workflows--critical-paths)
8. [Heuristic Evaluation — Nielsen's 10 Usability Heuristics](#8-heuristic-evaluation--nielsens-10-usability-heuristics)
9. [Cognitive Walkthroughs — Critical User Journeys](#9-cognitive-walkthroughs--critical-user-journeys)
10. [WCAG 2.1 AA Accessibility Assessment](#10-wcag-21-aa-accessibility-assessment)
11. [Performance & Responsiveness Analysis](#11-performance--responsiveness-analysis)
12. [Design System Specification](#12-design-system-specification)
13. [Competitive Analysis — vs Salesforce, HubSpot, SAP, Oracle](#13-competitive-analysis--vs-salesforce-hubspot-sap-oracle)
14. [Redesign Strategy & Recommendations](#14-redesign-strategy--recommendations)
15. [Reusable Component Library — 50+ Components](#15-reusable-component-library--50-components)
16. [Implementation Roadmap](#16-implementation-roadmap)
17. [Success Metrics & KPIs](#17-success-metrics--kpis)
18. [Appendices](#18-appendices)
19. [Appendix E: Codebase Verification & Corrections (v2.0)](#appendix-e-codebase-verification--corrections-v20)
20. [Appendix F: Enterprise-Grade Enhancement Gap Analysis (v2.0)](#appendix-f-enterprise-grade-enhancement-gap-analysis-v20)
21. [Appendix G: Competitive Advantage Roadmap & QA Criteria (v2.0)](#appendix-g-competitive-advantage-roadmap--qa-criteria-v20)

***

## 1. Executive Summary

### 1.1 Purpose

This document presents a comprehensive research-driven audit of the SOS Logic Nexus AI platform's entire UI/UX architecture, covering 65+ UI components, 148 lazy-loaded routes, 119 dashboard pages, 15+ form implementations, and 5+ data visualization types. The audit spans heuristic evaluation, accessibility compliance, performance profiling, competitive benchmarking, and a complete redesign strategy with phased implementation roadmap.

### 1.2 Platform Overview

| Dimension            | Current State                                                          |
| -------------------- | ---------------------------------------------------------------------- |
| **Tech Stack**       | React 18.3.1 + TypeScript 5.8.3 + Tailwind CSS 3.4.17 + Vite 5.4.19    |
| **UI Framework**     | shadcn/ui (65+ components) wrapping 27 Radix UI packages               |
| **Design Tokens**    | HSL-based CSS variables (40+ tokens), light/dark modes                 |
| **Theme System**     | 4-level scoped theming (platform/tenant/franchise/user), 35 presets    |
| **Routing**          | 148 lazy-loaded routes via React.lazy() + Suspense                     |
| **State Management** | React Context (14 providers) + React Hook Form + Zustand (quotes only) |
| **Data Fetching**    | TanStack React Query + Supabase client + ScopedDataAccess              |
| **Charts**           | Recharts (AreaChart, BarChart, PieChart, LineChart, FunnelChart)       |
| **Icons**            | lucide-react (30+ icon types)                                          |
| **Drag & Drop**      | @dnd-kit for kanban boards                                             |
| **Testing**          | Vitest + React Testing Library + Playwright + Storybook 8.6.15         |
| **Observability**    | Sentry 10.32.1 + PostHog 1.313.0                                       |
| **i18n**             | i18next (partial coverage)                                             |

### 1.3 Key Findings Summary

| Category                | Score (v1.0) | Score (v2.0 Verified) | Status              | Priority Issues                                     |
| ----------------------- | ------------ | --------------------- | ------------------- | --------------------------------------------------- |
| Component Library       | 90%          | **90%**               | Strong              | 69 UI + 20 feature = 89 total; dual toast system    |
| Navigation & IA         | 85%          | **85%**               | Good                | 8 pages w/ breadcrumbs (not 1-2); sidebar overloaded |
| Forms & Data Entry      | 75%          | **75%**               | Fair                | 3 form patterns confirmed                           |
| Dashboards & Data Viz   | 85%          | **85%**               | Good                | 13 real-time channels (strength not documented)     |
| WCAG 2.1 AA Compliance  | 70%          | **70%**               | Partial             | Skip link missing; 3 ErrorBoundaries exist (not 0)  |
| Mobile Responsiveness   | 80%          | **60%**               | **Needs Work**      | No PWA, no offline, no touch optimization            |
| Performance             | 75%          | **75%**               | Good                | 0 React.memo; virtual scroll stub; 1 Web Worker     |
| Testing Coverage        | N/A          | **55%**               | **Critical Gap**    | 1 e2e test; no a11y tests; no visual regression CI  |
| Error Handling          | N/A          | **65%**               | **Needs Work**      | 3 boundaries exist but not comprehensive             |
| Design Consistency      | 78%          | **78%**               | Fair                | 14 inconsistencies + dual toast system               |
| **Overall UX Maturity** | **78%**      | **74%**               | **Good Foundation** | **See Appendix E-G for verified remediation plan**  |

> **v2.0 Note:** Overall score revised downward from 78% to 74% after codebase verification revealed undocumented gaps in mobile, testing, and error handling. Four original claims corrected (see Appendix E.2).

### 1.4 Critical Recommendations (Top 10, Updated v2.0)

| #  | Recommendation                                               | Impact      | Effort   | Priority | v2.0 Status |
| -- | ------------------------------------------------------------ | ----------- | -------- | -------- | --- |
| 1  | ~~Implement global Error Boundary component~~                | Safety      | ~~2 days~~ | ~~P0~~  | **EXISTS** (3 implementations) — extend to all routes |
| 2  | Add skip-to-content link in DashboardLayout                  | WCAG        | 0.5 day  | P0       | Confirmed missing |
| 3  | Standardize form patterns (unify RHF+Zod across all forms)   | Consistency | 2 weeks  | P1       | Confirmed needed |
| 4  | Add heading hierarchy (h1/h2/h3) across all pages            | WCAG        | 3 days   | P1       | Confirmed needed |
| 5  | Consolidate dual toast system (Sonner vs useToast)           | Consistency | 2 days   | P1       | **NEW** finding |
| 6  | Implement server-side pagination for Quotes and large tables | Scalability | 1 week   | P1       | Confirmed needed |
| 7  | Activate virtual scrolling (react-window installed, unused)  | Performance | 3 days   | P1       | **NEW** finding |
| 8  | Add axe-core + jest-axe to CI pipeline                       | WCAG        | 2 days   | P0       | Confirmed needed |
| 9  | Implement PWA with Service Worker for offline support        | Mobile      | 8 days   | P1       | **NEW** finding |
| 10 | Expand E2E tests from 1 to 20+ critical paths               | Quality     | 10 days  | P0       | **NEW** finding |

***

## 2. Audit Methodology

### 2.1 Scope

The audit covered **every user-facing component, page, and interaction** in the Logic Nexus AI platform, organized into three parallel research streams:

| Stream                                   | Scope                                                                                           | Files Analyzed                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Stream 1: Component Library**          | 65+ UI components, Tailwind config, theme system, design tokens, icons, loading states          | `src/components/ui/`, `tailwind.config.ts`, `src/index.css`, `src/hooks/useTheme.tsx`, `src/theme/themes.ts` |
| **Stream 2: Forms & Navigation**         | 148 routes, sidebar structure, 15+ form components, modals, search, filters, state management   | `src/App.tsx`, `src/components/layout/`, `src/components/crm/`, `src/pages/dashboard/`                       |
| **Stream 3: Dashboards & Accessibility** | 119 dashboard pages, 5+ chart types, WCAG 2.1 AA compliance, mobile responsiveness, performance | `src/components/dashboard/`, `src/components/analytics/`, `src/hooks/use-mobile.tsx`                         |

### 2.2 Evaluation Frameworks

1. **Nielsen's 10 Usability Heuristics** — Systematic evaluation of each heuristic with severity ratings
2. **Cognitive Walkthroughs** — Step-by-step analysis of 5 critical user journeys
3. **WCAG 2.1 AA** — 50 success criteria evaluated with pass/fail/partial ratings
4. **System Usability Scale (SUS)** — Estimated score based on heuristic findings
5. **Competitive Benchmarking** — Feature-by-feature comparison against 4 enterprise platforms

### 2.3 Severity Rating Scale

| Severity          | Definition                                                 | Action Required           |
| ----------------- | ---------------------------------------------------------- | ------------------------- |
| **S0 — Critical** | Prevents task completion or creates security/safety risk   | Immediate fix required    |
| **S1 — Major**    | Significantly degrades user experience or violates WCAG AA | Fix within current sprint |
| **S2 — Minor**    | Noticeable issue but workaround exists                     | Fix within quarter        |
| **S3 — Cosmetic** | Aesthetic issue with no functional impact                  | Fix when convenient       |

***

## 3. Current State Assessment — Component Library

### 3.1 Component Inventory

The platform uses **65+ components** in `src/components/ui/`, built on shadcn/ui patterns wrapping Radix UI primitives. Components are organized by function:

#### Layout Components (5)

| Component        | File                      | Wrapper                | Key Features                                             |
| ---------------- | ------------------------- | ---------------------- | -------------------------------------------------------- |
| Sidebar          | `sidebar.tsx` (156 lines) | @radix-ui/react-dialog | CVA variants, cookie persistence, Ctrl+B shortcut        |
| Sheet            | `sheet.tsx` (120+ lines)  | @radix-ui/react-dialog | Side variants (top/bottom/left/right), animated overlays |
| Resizable        | `resizable.tsx`           | react-resizable-panels | PanelGroup, Panel, Handle with GripVertical              |
| StickyActionsBar | `StickyActionsBar.tsx`    | Custom                 | Fixed bottom bar, backdrop-blur, left/right action slots |
| SplitView        | `split-view.tsx`          | Custom                 | Resizable split pane layout                              |

#### Form & Input Components (16)

| Component       | File                              | Wrapper                     | Key Features                                      |
| --------------- | --------------------------------- | --------------------------- | ------------------------------------------------- |
| Input           | `input.tsx`                       | HTML input                  | Focus rings, disabled states                      |
| Label           | `label.tsx`                       | @radix-ui/react-label       | CVA typography, peer-disabled                     |
| Textarea        | `textarea.tsx`                    | HTML textarea               | min-h-\[72px], bordered                           |
| Form            | `form.tsx` (130 lines)            | react-hook-form             | FormFieldContext, useFormField, ARIA descriptions |
| Checkbox        | `checkbox.tsx`                    | @radix-ui/react-checkbox    | Check icon, ring-offset                           |
| RadioGroup      | `radio-group.tsx`                 | @radix-ui/react-radio-group | Circle indicator, grid layout                     |
| Switch          | `switch.tsx`                      | @radix-ui/react-switch      | Animated thumb, h-6 w-11                          |
| Toggle          | `toggle.tsx`                      | @radix-ui/react-toggle      | CVA default/outline, size sm/default/lg           |
| ToggleGroup     | `toggle-group.tsx`                | Custom                      | Multi-select toggle                               |
| Select          | `select.tsx` (100+ lines)         | @radix-ui/react-select      | Popper positioning, scroll buttons                |
| AsyncCombobox   | `async-combobox.tsx` (100+ lines) | Custom                      | 300ms debounce, Loader2, popover dropdown         |
| DateRangePicker | `date-range-picker.tsx`           | date-fns + Popover          | Dual-month calendar view                          |
| FileUpload      | `file-upload.tsx` (100+ lines)    | Custom                      | Drag-drop, 25MB limit, progress tracking          |
| Calendar        | `calendar.tsx`                    | react-day-picker            | Date selection                                    |
| InputOTP        | `input-otp.tsx`                   | Custom                      | One-time password input                           |
| HslPicker       | `hsl-picker.tsx`                  | Custom                      | HSL/hex color selector with sliders               |

#### Display Components (8)

| Component  | File                    | Variants (CVA)                                                                             | Key Features                                           |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Button     | `button.tsx` (49 lines) | default, destructive, outline, secondary, ghost, link, brand; sizes: default, sm, lg, icon | Slot composition support                               |
| Badge      | `badge.tsx`             | default, secondary, destructive, success, warning, outline                                 | rounded-full, px-2.5 py-0.5                            |
| StatusPill | `status-pill.tsx`       | default, success, warning, error, info, neutral; sizes                                     | Optional dot indicator                                 |
| Card       | `card.tsx`              | —                                                                                          | Compound: Card/Header/Title/Description/Content/Footer |
| Alert      | `alert.tsx`             | default, destructive                                                                       | role="alert", icon positioning                         |
| Avatar     | `avatar.tsx`            | —                                                                                          | @radix-ui/react-avatar, Image + Fallback               |
| Progress   | `progress.tsx`          | —                                                                                          | @radix-ui/react-progress, transform animation          |
| Pagination | `pagination.tsx`        | —                                                                                          | Compound: Pagination/Content/Item/Link/Previous/Next   |

#### Interactive Components (10)

| Component    | File                             | Wrapper                       |
| ------------ | -------------------------------- | ----------------------------- |
| Dialog       | `dialog.tsx` (96 lines)          | @radix-ui/react-dialog        |
| AlertDialog  | `alert-dialog.tsx`               | @radix-ui/react-alert-dialog  |
| Popover      | `popover.tsx`                    | @radix-ui/react-popover       |
| DropdownMenu | `dropdown-menu.tsx` (100+ lines) | @radix-ui/react-dropdown-menu |
| ContextMenu  | `context-menu.tsx`               | @radix-ui/react-context-menu  |
| MenuBar      | `menu-bar.tsx`                   | @radix-ui/react-menubar       |
| Tabs         | `tabs.tsx`                       | @radix-ui/react-tabs          |
| Accordion    | `accordion.tsx`                  | @radix-ui/react-accordion     |
| Collapsible  | `collapsible.tsx`                | @radix-ui/react-collapsible   |
| Command      | `command.tsx` (100+ lines)       | cmdk                          |

#### Data & Content Components (5)

| Component     | File                          | Key Features                                                        |
| ------------- | ----------------------------- | ------------------------------------------------------------------- |
| Table         | `table.tsx` (80+ lines)       | CSS variable theming, hover states, SortableHead with aria-sort     |
| Skeleton      | `skeleton.tsx`                | animate-pulse, bg-muted                                             |
| SkeletonTable | `skeleton-table.tsx`          | Pre-built: SkeletonTable, SkeletonCards, SkeletonForm               |
| EmptyState    | `empty-state.tsx` (101 lines) | Variants: default, search, error; pre-configured patterns           |
| Chart         | `chart.tsx` (304 lines)       | Wraps recharts; ChartContainer, useChart hook, CSS variable theming |

#### Navigation & Search (5)

| Component         | File                     | Key Features                                           |
| ----------------- | ------------------------ | ------------------------------------------------------ |
| Command           | `command.tsx`            | CommandDialog, CommandInput (Search icon), CommandList |
| GlobalSearch      | `global-search.tsx`      | Ctrl+K trigger, cross-entity search                    |
| NavigationMenu    | `navigation-menu.tsx`    | @radix-ui/react-navigation-menu                        |
| Breadcrumb        | `breadcrumb.tsx`         | Breadcrumb/List/Item/Link/Page/Separator               |
| KeyboardShortcuts | `keyboard-shortcuts.tsx` | Keyboard help modal                                    |

#### Specialized Custom Components (12)

| Component            | File                        | Purpose                                     |
| -------------------- | --------------------------- | ------------------------------------------- |
| ActionsToolbar       | `ActionsToolbar.tsx`        | Badge label + action buttons in flex layout |
| AppLauncher          | `app-launcher.tsx`          | Application launcher/switcher               |
| EnvironmentIndicator | `environment-indicator.tsx` | Dev/staging/prod environment display        |
| RecentlyViewed       | `recently-viewed.tsx`       | Recently viewed items tracker               |
| RowActions           | `row-actions.tsx`           | Table row context actions                   |
| InlineEdit           | `inline-edit.tsx`           | Inline editing capability                   |
| EditableText         | `editable-text.tsx`         | Editable text fields                        |
| TitleStrip           | `title-strip.tsx`           | Header title with gradient                  |
| MultiSelectBar       | `multi-select-bar.tsx`      | Multi-selection toolbar                     |
| ViewToggle           | `view-toggle.tsx`           | View mode switcher (grid, list, etc.)       |
| Carousel             | `carousel.tsx`              | Wraps embla-carousel-react                  |
| AspectRatio          | `aspect-ratio.tsx`          | @radix-ui/react-aspect-ratio                |

#### Toast & Notifications (3)

| Component | File          | Key Features                         |
| --------- | ------------- | ------------------------------------ |
| Sonner    | `sonner.tsx`  | Wraps sonner library, theme="system" |
| Toaster   | `toaster.tsx` | Toast provider component             |
| Toast     | `toast.tsx`   | Low-level toast component            |

### 3.2 Component Architecture Assessment

**Strengths:**

* Consistent use of CVA (class-variance-authority) for variant management across 8+ components
* Full TypeScript typing on all components with proper prop interfaces
* Proper Radix UI primitive wrapping ensures accessibility baseline
* Compound component pattern used correctly (Card, Pagination, Breadcrumb)
* Focus ring pattern consistent: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
* Disabled state pattern consistent: `disabled:pointer-events-none disabled:opacity-50`

**Weaknesses:**

* Custom components (ActionsToolbar, StickyActionsBar) do not use CVA — inconsistent with library components
* Icon sizing inconsistent: most use `h-4 w-4`, some use `h-5 w-5`, empty states use `h-12 w-12` with no documented scale
* Magic numbers in timing: 0.3s transitions, 300ms debounce, 500ms save — not centralized as design tokens
* No dedicated Spinner/Loading component — only `Loader2` icon with `animate-spin` is used
* Error boundaries not implemented as dedicated components
* Drawer component (`drawer.tsx`) exists but is unused anywhere in the codebase

### 3.3 Component Metrics

| Metric                    | Count                              |
| ------------------------- | ---------------------------------- |
| Total UI components       | 65+                                |
| Radix UI primitives used  | 20+                                |
| CVA-styled components     | 8+                                 |
| CSS variables defined     | 40+                                |
| Theme presets             | 35                                 |
| Icon types (lucide-react) | 30+                                |
| Color modes               | 2 (light + dark)                   |
| Scoped theme levels       | 4 (platform/tenant/franchise/user) |

***

## 4. Current State Assessment — Navigation & Information Architecture

### 4.1 Route Architecture

**File:** `src/App.tsx` (738 lines)

The application uses React Router v6 with a flat route structure under `/dashboard/*`. All dashboard routes are protected by `<ProtectedRoute>` with role and permission checks.

| Loading Strategy | Route Count | Examples                                                    |
| ---------------- | ----------- | ----------------------------------------------------------- |
| Eager-loaded     | 5           | Landing, Auth, SetupAdmin, Unauthorized, NotFound           |
| Lazy-loaded      | 148         | All `/dashboard/*` routes via `React.lazy()` + `<Suspense>` |

**Route Categories:**

| Category       | Routes | Examples                                                                          |
| -------------- | ------ | --------------------------------------------------------------------------------- |
| Sales/CRM      | 20+    | Leads, Quotes, Opportunities, Accounts, Contacts, Activities                      |
| Logistics      | 22+    | Bookings, Shipments, Warehouses, Vehicles, Carriers                               |
| Compliance     | 2      | Restricted Party Screening, Security Incidents                                    |
| Billing        | 2      | Subscriptions, Tenant Plans                                                       |
| Finance        | 3      | Invoices, Margin Rules, Tax Jurisdictions                                         |
| Administration | 7+     | Lead Assignment/Routing, Tenants, Franchises, Users, Transfer Center, System Logs |
| Settings       | 15+    | System Settings, Email, Roles, Themes, Data Management                            |
| Portal         | 1      | Public Quote Portal (token-based, no auth)                                        |
| Demo/Testing   | 5+     | UIDemoForms, UIDemoAdvanced, QuotationTests                                       |

**Maximum click depth:** 3 clicks to reach any detail page (e.g., Dashboard → Leads → Lead Detail).

### 4.2 Sidebar Navigation

**File:** `src/components/layout/AppSidebar.tsx` (200+ lines)

**Structure:**

```
┌──────────────────────────────────────┐
│ SIDEBAR (264px expanded / 56px icon) │
├──────────────────────────────────────┤
│ ▼ Sales                              │
│   Home, Leads, Tasks, Opportunities, │
│   Accounts, Contacts, Quotes,        │
│   Quote Templates, Files, Campaigns, │
│   Dashboards, CRM Workspace,         │
│   Reports, Chatter, Groups,          │
│   Calendar, More                      │
├──────────────────────────────────────┤
│ ▼ Logistics                          │
│   Bookings, Shipments, Warehouses,   │
│   Vehicles, Rate Management,         │
│   Vendors, Carriers, Consignees,     │
│   Ports & Locations, Package Cats,   │
│   Package Sizes, Container Tracking, │
│   Container Analytics, Vessel Types, │
│   Vessel Classes, Vessels,           │
│   Cargo Types, Cargo Details,        │
│   Incoterms, Service Types,          │
│   Service Type Mappings, Services    │
├──────────────────────────────────────┤
│ ▼ Compliance                         │
│   Restricted Party, Security         │
├──────────────────────────────────────┤
│ ▼ Billing                            │
│   My Subscription, Tenant Plans      │
├──────────────────────────────────────┤
│ ▼ Finance                            │
│   Invoices, Margin Rules, Tax        │
├──────────────────────────────────────┤
│ ▼ Administration                     │
│   Lead Assignment, Lead Routing,     │
│   Tenants, Franchises, Users,        │
│   Transfer Center, System Logs       │
└──────────────────────────────────────┘
```

**Features:**

* NavLink integration with active state: `bg-primary/10 text-primary font-medium`
* Scroll position persistence via `sessionStorage`
* Role-based item visibility via `<RoleGuard>` wrapper
* Collapse/expand with Ctrl+B keyboard shortcut
* Mobile: slides in as Sheet overlay
* Icon-only mode at 56px width with tooltips

**Issues Identified:**

* **S2: Sidebar overload** — Logistics section has 22+ items, requiring excessive scrolling
* **S2: Legacy Sidebar** — `src/components/dashboard/Sidebar.tsx` (73 lines) is unused dead code
* **S3: No grouping/nesting** — Flat list within each section; no sub-menus for related items

### 4.3 Breadcrumb Usage

**Component:** `src/components/ui/breadcrumb.tsx` — Well-built compound component

**Current usage:** Only 1-2 pages (e.g., `/dashboard/quotes/new`) implement breadcrumbs.

**Issue (S2):** Breadcrumbs are not standard across detail or creation pages, reducing wayfinding ability.

### 4.4 Global Search

**Component:** `src/components/ui/global-search.tsx`

* **Trigger:** Ctrl+K / Cmd+K keyboard shortcut
* **Searches across:** Leads, Accounts, Contacts, Quotes, Opportunities
* **Pattern:** `ILIKE %${query}%` with 5-result limit per entity type
* **Scoping:** Filters by `franchise_id` or `tenant_id`

**Issue (S2):** No debounce on search input — may cause performance issues on large datasets.

***

## 5. Current State Assessment — Forms & Data Entry

### 5.1 Form Architecture Overview

The platform uses **3 different form patterns**, creating inconsistency:

| Pattern                    | Used By                                                                                                        | Validation                                     | State                        | Error Display                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------- | ---------------------------------- |
| **React Hook Form + Zod**  | LeadForm, AccountForm, ContactForm, ActivityForm, OpportunityForm, ShipmentForm, VehicleForm, etc. (15+ forms) | Zod schemas with `.refine()` cross-field rules | RHF internal state           | `<FormMessage>` inline below field |
| **Custom Zustand/Reducer** | MultiModalQuoteComposer (4-step wizard)                                                                        | Custom validation per step                     | `useReducer` / Zustand store | Custom error display               |
| **Custom useState**        | EmailComposeDialog, LeadConversionDialog                                                                       | Manual validation                              | React `useState`             | Toast notifications                |

### 5.2 Standard CRUD Form Pattern (React Hook Form + Zod)

**Representative example:** `src/components/crm/LeadForm.tsx` (250+ lines)

```
┌─────────────────────────────────────────┐
│ Lead Information                        │
├─────────────────────────────────────────┤
│ First Name*    │ Last Name*             │
│ ────────────── │ ──────────────         │
│ Company        │ Title                  │
│ ────────────── │ ──────────────         │
│ Email*         │ Phone*                 │
│ ────────────── │ ──────────────         │
│ (* at least one contact required)       │
│ Status ▼       │ Source ▼               │
│ ────────────── │ ──────────────         │
│ Estimated Value │ Close Date            │
│ ────────────── │ ──────────────         │
│ Service*       │ [AI Suggest]           │
│ ────────────── │                        │
│ Description    │ Notes                  │
│ ────────────── │ ──────────────         │
│ Attachments    │ [+ Upload]             │
│ ────────────── │                        │
│         [Cancel]  [Save]                │
└─────────────────────────────────────────┘
```

**Field counts by entity:**

| Entity         | Fields             | Unique Features                                          |
| -------------- | ------------------ | -------------------------------------------------------- |
| Lead           | 13 + refinement    | AI service suggestion, file upload, custom\_fields JSONB |
| Account        | 14                 | Parent account selector, annual revenue, employee count  |
| Contact        | 12                 | Account relation selector                                |
| Activity       | 8                  | Linked to Lead/Account/Opportunity                       |
| Opportunity    | 10                 | Stage/probability, line items editor                     |
| Shipment       | 15+                | File attachments, multi-address                          |
| Quote (wizard) | 30+ across 4 steps | Virtual scrolling for charges, AI commodity analysis     |

### 5.3 Quote Composer (Multi-Step Wizard)

**File:** `src/components/sales/MultiModalQuoteComposer.tsx` (800+ lines)

```
Step 1: Quote Details    Step 2: Transport Legs    Step 3: Charges    Step 4: Review & Save
  ┌──────────┐            ┌──────────┐             ┌──────────┐       ┌──────────┐
  │ Origin   │            │ Leg 1    │             │ Charge 1 │       │ Summary  │
  │ Dest     │  ──────►   │ Leg 2    │  ──────►    │ Charge 2 │ ───►  │ Totals   │
  │ Commodity│            │ Leg N    │             │ ...      │       │ [Save]   │
  │ Incoterms│            │ [+ Add]  │             │ Charge N │       │          │
  │ Currency │            │          │             │ [+ Add]  │       │          │
  └──────────┘            └──────────┘             └──────────┘       └──────────┘
```

**Unique architecture:**

* Uses Zustand store (`QuoteStore.tsx`) instead of React Hook Form
* VirtualChargesList for 1000+ rows
* AI advisor integration for commodity classification
* Real-time sync with `quotation_options` table
* 500ms debounced save

**Issue (S1):** This is the most complex form in the application but uses a completely different pattern from all other forms, making maintenance and onboarding harder.

### 5.4 Import/Export System

**Reusable component:** `src/components/system/DataImportExport.tsx`

| Import/Export Page   | Entity   | Features                                               |
| -------------------- | -------- | ------------------------------------------------------ |
| LeadsImportExport    | Leads    | 14 fields, Zod validation, aliases (fname→first\_name) |
| AccountsImportExport | Accounts | CSV/Excel import with field mapping                    |
| ContactsImportExport | Contacts | Bulk error reporting                                   |
| CargoImportExport    | Cargo    | Progress tracking                                      |

### 5.5 Form Inconsistencies Summary

| #  | Issue                                                                            | Severity | Impact                                         |
| -- | -------------------------------------------------------------------------------- | -------- | ---------------------------------------------- |
| F1 | 3 different form patterns (RHF+Zod, Zustand, useState)                           | S1       | Maintenance burden, inconsistent validation UX |
| F2 | Email compose dialog uses custom state instead of RHF                            | S2       | Different error handling from CRUD forms       |
| F3 | Lead/Account/Contact forms share identical patterns but have no shared base hook | S2       | Code duplication                               |
| F4 | No consistent email domain validation across forms                               | S3       | Data quality risk                              |
| F5 | Some forms use `onChange` mode, others use `onSubmit` mode                       | S3       | Inconsistent validation timing                 |

***

## 6. Current State Assessment — Dashboards & Data Visualization

### 6.1 Dashboard Inventory

**Location:** `src/pages/dashboard/` — 119 dashboard page files

**Key dashboards:**

| Dashboard       | File                        | Widgets                                   | Visualizations      |
| --------------- | --------------------------- | ----------------------------------------- | ------------------- |
| CRM Workspace   | `CRMWorkspace.tsx`          | PrototypeLayout, theme switching          | —                   |
| Leads           | `Leads.tsx` (715 lines)     | LeadCard, ViewToggle, Filters, Pagination | Pipeline kanban     |
| KanbanDashboard | `KanbanDashboard.tsx`       | Multi-entity statistics                   | FunnelChart         |
| Opportunities   | `OpportunitiesPipeline.tsx` | PipelineAnalytics, Kanban                 | 4 chart types       |
| Accounts        | `AccountsPipeline.tsx`      | Kanban, DnD-Kit                           | Stage-based columns |

### 6.2 Chart Types in Use

| Chart Type  | Library  | Files                                                        | Purpose                   |
| ----------- | -------- | ------------------------------------------------------------ | ------------------------- |
| AreaChart   | Recharts | StatsCards.tsx, CustomChartWidget.tsx                        | Sparkline KPI trends      |
| BarChart    | Recharts | PipelineAnalytics.tsx, FinancialWidget.tsx, VolumeWidget.tsx | Revenue, velocity, volume |
| PieChart    | Recharts | PipelineAnalytics.tsx, CustomChartWidget.tsx                 | Conversion overview       |
| LineChart   | Recharts | CustomChartWidget.tsx                                        | Trend analysis            |
| FunnelChart | Recharts | KanbanDashboard.tsx                                          | Sales funnel              |

### 6.3 KPI Cards

**Component:** `src/components/dashboard/StatsCards.tsx`

4 KPI cards with sparkline area charts:

* Shipments (trend)
* Revenue (trend)
* Pipeline Velocity (trend)
* Issues Flagged (trend)

Each card features: gradient fills, trend indicators (up/down arrows), color-coded icons (primary, success, accent, warning), responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`), and skeleton loading state.

### 6.4 Pipeline Analytics

**Component:** `src/components/analytics/PipelineAnalytics.tsx`

4 memoized visualizations:

1. **Velocity Analysis** — Horizontal bar chart (avg days by stage)
2. **Source Performance** — Stacked bar chart (won/lost/active by source)
3. **Conversion Overview** — Donut pie chart (won/lost/open)
4. **Trend Analysis** — Line chart (leads created over 6 months)

**Issue (S2):** Chart colors are hardcoded (`#0088FE`, `#00C49F`, `#FFBB28`, `#FF8042`) instead of using CSS variables from the design system.

### 6.5 Dynamic Chart Widget

**Component:** `src/components/dashboard/widgets/CustomChartWidget.tsx`

* Dynamic chart type selection (pie, line, area, bar)
* Entity filtering (leads, opportunities, quotes, shipments)
* Group-by aggregation
* Loading state and error handling

### 6.6 Data Export from Visualizations

**Status:** Not implemented in dashboard UI

* PDF/Excel export libraries are bundled separately (jspdf, html2canvas, xlsx)
* No active integration into dashboard visualization components
* CSV export not found in current chart components

**Issue (S2):** Users cannot export chart data or screenshots from the dashboard.

***

## 7. Current State Assessment — User Workflows & Critical Paths

### 7.1 CRM Object Hierarchy

```
Tenant
  └── Franchise (optional)
       ├── Lead
       │    ├── Score (rule-based heuristic)
       │    └── Convert ──► Account + Contact + Opportunity
       │                     ├── Account
       │                     │    ├── Contacts[]
       │                     │    └── Opportunities[]
       │                     ├── Contact → Account(1)
       │                     └── Opportunity
       │                          ├── Account(1), Contact(1)
       │                          └── Quote[]
       │                               └── Booking[]
       │                                    └── Shipment[]
       └── Activity (linked to Lead/Account/Opportunity)
```

### 7.2 Critical User Journeys

| Journey                     | Steps | Click Depth                                          | Complexity |
| --------------------------- | ----- | ---------------------------------------------------- | ---------- |
| Create new lead             | 2     | Sidebar → New Lead → Fill form → Save                | Low        |
| Score and qualify lead      | 3     | Leads → Lead detail → View score card                | Low        |
| Convert lead to opportunity | 4     | Leads → Lead detail → Convert → Dialog               | Medium     |
| Create multi-modal quote    | 10+   | Quotes → New → Wizard Steps 1-4 → Save               | High       |
| Create booking from quote   | 3     | Bookings → New → Select quote → Create               | Medium     |
| Send email reply from lead  | 4     | Lead detail → Emails tab → Reply → Send              | Medium     |
| Import leads from CSV       | 5     | Leads → Import/Export → Upload → Map fields → Import | Medium     |
| Create shipment             | 3     | Shipments → New → Fill form + attachments → Save     | Medium     |

### 7.3 Data Tables and List Views

**Shared DataTable component:** `src/components/system/DataTable.tsx`

| Feature            | Leads                 | Quotes                       | Opportunities   | Accounts        |
| ------------------ | --------------------- | ---------------------------- | --------------- | --------------- |
| View modes         | Table, Card, Pipeline | Table, Card, Pipeline        | Table, Pipeline | Card, List      |
| Advanced filters   | Per-column operators  | Per-column text              | Mixed           | Simple contains |
| Sorting            | Multi-column          | Multi-column                 | Multi-column    | Multi-column    |
| Selection/Bulk ops | Yes (delete, status)  | No                           | Yes             | No              |
| Pagination         | Client-side           | Client-side (1000 limit)     | Client-side     | Client-side     |
| Filter persistence | localStorage          | React state (lost on reload) | React state     | React state     |

**Issues identified:**

| #  | Issue                                                   | Severity |
| -- | ------------------------------------------------------- | -------- |
| T1 | No standardized filter UI across tables                 | S1       |
| T2 | Inconsistent bulk operation support                     | S2       |
| T3 | Quotes has 1000-record limit, no server-side pagination | S1       |
| T4 | Filter persistence varies by page                       | S2       |
| T5 | No debounce on page-level filters                       | S2       |

### 7.4 Kanban/Pipeline Views

6 pipeline views identified:

* `LeadsPipeline.tsx` — Leads by stage
* `QuotesPipeline.tsx` — Quotes by status
* `OpportunitiesPipeline.tsx` — Opportunities by stage
* `AccountsPipeline.tsx` — Accounts by status
* `ShipmentsPipeline.tsx` — Shipments by status
* `KanbanDashboard.tsx` — Multi-entity overview

All use `@dnd-kit` for drag-and-drop between columns with vertical scrolling within columns.

***

## 8. Heuristic Evaluation — Nielsen's 10 Usability Heuristics

### H1: Visibility of System Status

| Aspect              | Implementation                      | Score | Issues                                                            |
| ------------------- | ----------------------------------- | ----- | ----------------------------------------------------------------- |
| Loading indicators  | Skeleton loaders, Loader2 spinners  | 85%   | Generic "Loading..." text, not always i18n'd                      |
| Save confirmation   | Toast notifications via Sonner      | 90%   | Good — clear success/error messages                               |
| Form validation     | Inline `<FormMessage>` below fields | 85%   | Only in RHF forms; quote wizard and email have different patterns |
| Real-time updates   | Supabase subscriptions for quotes   | 80%   | Not consistently used across all entities                         |
| Progress indicators | Quote wizard shows step numbers     | 75%   | No progress bar or percentage; step indicators are minimal        |

**Score: 83/100** | **Severity: S2**

**Key gap:** No progress bar for multi-step operations (import, bulk actions). Quote wizard shows step numbers but no visual progress indicator.

### H2: Match Between System and Real World

| Aspect             | Implementation                                                          | Score |
| ------------------ | ----------------------------------------------------------------------- | ----- |
| Domain terminology | Correct logistics terms (incoterms, FCL, LCL, CIF, FOB)                 | 95%   |
| Status labels      | Meaningful: new, contacted, qualified, proposal, negotiation, won, lost | 90%   |
| Icons              | Intuitive lucide-react icons matching functions                         | 85%   |
| Entity naming      | Leads, Accounts, Contacts, Quotes, Bookings, Shipments                  | 95%   |
| Menu organization  | Sales / Logistics / Compliance / Finance / Admin                        | 85%   |

**Score: 90/100** | **Severity: S3**

### H3: User Control and Freedom

| Aspect               | Implementation                   | Score | Issues                                                         |
| -------------------- | -------------------------------- | ----- | -------------------------------------------------------------- |
| Undo/redo            | Not implemented                  | 0%    | No undo for destructive actions                                |
| Cancel operations    | Cancel buttons on all forms      | 90%   |                                                                |
| Back navigation      | ArrowLeft button on detail pages | 85%   | Inconsistent — some pages have it, others rely on browser back |
| Draft saving         | Quote wizard has debounced save  | 70%   | Not available for standard CRUD forms                          |
| Confirmation dialogs | AlertDialog for delete actions   | 90%   | Good pattern — prevents accidental deletion                    |

**Score: 67/100** | **Severity: S1**

**Key gap:** No undo functionality. Users who accidentally delete a lead, quote, or shipment have no recovery path. No draft/autosave on standard CRUD forms.

### H4: Consistency and Standards

| Aspect               | Implementation                               | Score | Issues                                               |
| -------------------- | -------------------------------------------- | ----- | ---------------------------------------------------- |
| Visual consistency   | HSL design tokens, CVA variants              | 85%   | Chart colors hardcoded outside design system         |
| Interaction patterns | 3 different form patterns                    | 60%   | Major inconsistency — RHF+Zod vs Zustand vs useState |
| Navigation patterns  | Sidebar consistent, breadcrumbs inconsistent | 70%   | Breadcrumbs only on 1-2 pages                        |
| Terminology          | Consistent entity naming                     | 90%   |                                                      |
| Button placement     | Save/Cancel in footer                        | 85%   | Email dialog has different button arrangement        |
| Filter patterns      | 4 different filter implementations           | 55%   | Leads advanced, Quotes text, Accounts simple         |

**Score: 74/100** | **Severity: S1**

**Key gap:** 14 documented inconsistencies spanning forms, filters, navigation, modals, and state management (see Section 5.5, 7.3).

### H5: Error Prevention

| Aspect                               | Implementation                           | Score | Issues                                            |
| ------------------------------------ | ---------------------------------------- | ----- | ------------------------------------------------- |
| Validation before submit             | Zod schemas catch errors before API call | 90%   | Only on RHF forms                                 |
| Required field indicators            | Required fields shown in schema          | 80%   | No visual `*` asterisk indicator on all forms     |
| Type checking                        | TypeScript + Zod type safety             | 90%   |                                                   |
| Confirmation for destructive actions | AlertDialog for deletes                  | 90%   |                                                   |
| Data format hints                    | Zod error messages                       | 75%   | No placeholder examples for date/currency formats |

**Score: 85/100** | **Severity: S2**

### H6: Recognition Rather Than Recall

| Aspect             | Implementation                         | Score | Issues                                         |
| ------------------ | -------------------------------------- | ----- | ---------------------------------------------- |
| Menu visibility    | All items visible in sidebar           | 85%   | Sidebar has 60+ items, overwhelming            |
| Recently viewed    | `recently-viewed.tsx` component exists | 80%   |                                                |
| Search suggestions | Global search shows grouped results    | 85%   |                                                |
| Autocomplete       | AsyncCombobox for entity selection     | 85%   |                                                |
| Breadcrumbs        | Component exists, rarely used          | 40%   | Users cannot see current location in hierarchy |

**Score: 75/100** | **Severity: S2**

**Key gap:** Breadcrumbs need consistent implementation across all detail and create pages.

### H7: Flexibility and Efficiency of Use

| Aspect             | Implementation                                 | Score | Issues                             |
| ------------------ | ---------------------------------------------- | ----- | ---------------------------------- |
| Keyboard shortcuts | Ctrl+K (search), Ctrl+B (sidebar)              | 70%   | Only 2 shortcuts documented        |
| Bulk operations    | Available on Leads, some tables                | 60%   | Missing on Quotes, Accounts        |
| View modes         | Table, Card, Pipeline on some pages            | 80%   | Not all entities support all views |
| Templates          | Quote templates available                      | 80%   |                                    |
| Import/Export      | CSV/Excel for Leads, Accounts, Contacts, Cargo | 85%   |                                    |
| Quick actions      | Row actions on tables                          | 80%   |                                    |

**Score: 76/100** | **Severity: S2**

### H8: Aesthetic and Minimalist Design

| Aspect              | Implementation                                  | Score |
| ------------------- | ----------------------------------------------- | ----- |
| Visual hierarchy    | Card-based layout, clear typography             | 85%   |
| Information density | Appropriate use of whitespace                   | 80%   |
| Color usage         | Semantic colors (success, warning, destructive) | 90%   |
| Dark mode           | Full HSL-based dark mode                        | 90%   |
| Theme customization | 35 presets, 4-level scoping                     | 95%   |
| Gradient system     | Brand gradients, hero gradients                 | 85%   |

**Score: 88/100** | **Severity: S3**

### H9: Help Users Recognize, Diagnose, and Recover from Errors

| Aspect              | Implementation                                         | Score | Issues                              |
| ------------------- | ------------------------------------------------------ | ----- | ----------------------------------- |
| Error messages      | Zod provides clear messages ("First name is required") | 85%   |                                     |
| Toast notifications | Sonner shows success/error with descriptions           | 85%   |                                     |
| Empty states        | Comprehensive EmptyState component with actions        | 90%   |                                     |
| Error boundaries    | NOT IMPLEMENTED                                        | 0%    | Unhandled errors crash entire page  |
| Retry mechanisms    | Available in empty states (error variant)              | 70%   | Not available for API call failures |

**Score: 66/100** | **Severity: S0**

**Critical gap:** No global error boundary. An unhandled error in any component can crash the entire application.

### H10: Help and Documentation

| Aspect                   | Implementation                         | Score | Issues                                    |
| ------------------------ | -------------------------------------- | ----- | ----------------------------------------- |
| Keyboard shortcuts modal | `keyboard-shortcuts.tsx` exists        | 70%   | Limited to 2 shortcuts                    |
| Tooltips                 | Used on sidebar icons (collapsed mode) | 75%   | Not widely used on action buttons         |
| FormDescription          | Used in RHF forms for field hints      | 80%   |                                           |
| Onboarding               | Not implemented                        | 0%    | No first-run experience or guided tours   |
| Context help             | Not implemented                        | 0%    | No "?" help icons or inline documentation |

**Score: 45/100** | **Severity: S2**

### Heuristic Evaluation Summary

| Heuristic                                    | Score    | Severity |
| -------------------------------------------- | -------- | -------- |
| H1: Visibility of system status              | 83       | S2       |
| H2: Match between system and real world      | 90       | S3       |
| H3: User control and freedom                 | 67       | S1       |
| H4: Consistency and standards                | 74       | S1       |
| H5: Error prevention                         | 85       | S2       |
| H6: Recognition rather than recall           | 75       | S2       |
| H7: Flexibility and efficiency of use        | 76       | S2       |
| H8: Aesthetic and minimalist design          | 88       | S3       |
| H9: Help users recognize/recover from errors | 66       | S0       |
| H10: Help and documentation                  | 45       | S2       |
| **Weighted Average**                         | **74.9** | **S1**   |

**Estimated SUS Score:** 72/100 (Grade B — "Good" but room for improvement)

***

## 9. Cognitive Walkthroughs — Critical User Journeys

### 9.1 Journey: Lead Capture to Quote Conversion

**Persona:** Sarah, Freight Sales Representative

**Goal:** Capture a new lead, qualify it, convert to opportunity, and create a quote

| Step | Action                               | Page               | Success Criteria              | Issues Found                                                                       |
| ---- | ------------------------------------ | ------------------ | ----------------------------- | ---------------------------------------------------------------------------------- |
| 1    | Click "Leads" in sidebar             | Sidebar            | Menu item visible             | None — clear navigation                                                            |
| 2    | Click "+ New Lead"                   | Leads list         | Button visible and accessible | Button position varies by view mode                                                |
| 3    | Fill required fields                 | LeadNew            | Form validates, shows errors  | AI service suggestion is helpful; cross-field validation (email OR phone) is clear |
| 4    | Click Save                           | LeadNew            | Toast confirms, redirects     | Redirects to detail page correctly                                                 |
| 5    | View lead score                      | LeadDetail         | Score card visible            | Score explanation could be clearer                                                 |
| 6    | Click "Convert to Opportunity"       | LeadDetail         | Conversion dialog opens       | Dialog checkboxes (account, contact, opp) are intuitive                            |
| 7    | Fill opportunity name, click Convert | Dialog             | Backend creates 3 entities    | No error handling if account already exists                                        |
| 8    | Navigate to Quote creation           | Opportunity detail | Link to create quote          | No direct "Create Quote" action from opportunity detail                            |
| 9    | Complete 4-step wizard               | MultiModalComposer | Each step validates           | Step indicators are minimal; no progress percentage                                |
| 10   | Save quote                           | Step 4 Review      | Confirmation toast            | Success — quote saved                                                              |

**Completion rate estimate:** 85%
**Primary friction points:** Step 8 (no direct link from opportunity to quote), Step 9 (wizard progress unclear)

### 9.2 Journey: Email Sync to Lead Association

**Persona:** Mike, Inside Sales Agent

| Step | Action                             | Issues Found                  |
| ---- | ---------------------------------- | ----------------------------- |
| 1    | Navigate to email inbox            | Clear sidebar navigation      |
| 2    | View synced emails                 | Emails appear with threading  |
| 3    | Click an email from unknown sender | Email detail view opens       |
| 4    | Click "Convert to Lead"            | EmailToLeadDialog opens       |
| 5    | Fill lead form fields              | Pre-populated from email data |
| 6    | Save and link                      | Lead created, email linked    |

**Completion rate estimate:** 80%
**Primary friction:** Email classification is backend-only; no user-facing classification UI. Auto-linking may miss matches.

### 9.3 Journey: Shipment Creation and Tracking

**Persona:** Tom, Operations Manager

| Step | Action                          | Issues Found                               |
| ---- | ------------------------------- | ------------------------------------------ |
| 1    | Click "Shipments" → "+ New"     | Clear navigation path                      |
| 2    | Fill shipment form (15+ fields) | Long form — no sections/collapsible groups |
| 3    | Upload documents (PDF, images)  | File upload works well with drag-drop      |
| 4    | Save shipment                   | Redirects to detail view                   |
| 5    | Track in pipeline view          | Kanban board shows status stages           |
| 6    | Drag to update status           | Dnd-kit works smoothly                     |

**Completion rate estimate:** 90%
**Primary friction:** Form length — 15+ fields in a single view without progressive disclosure.

### 9.4 Journey: Dashboard Analytics Review

**Persona:** Linda, Franchise Manager

| Step | Action                       | Issues Found                                        |                            |
| ---- | ---------------------------- | --------------------------------------------------- | -------------------------- |
| 1    | Navigate to dashboard        | Home page loads with KPI cards                      |                            |
| 2    | Review KPI cards (4)         | Sparkline trends are informative                    |                            |
| 3    | Scroll to pipeline analytics | 4 chart types (velocity, source, conversion, trend) |                            |
| 4    | Try to export chart as PDF   | **BLOCKED** — no export button on charts            |                            |
| 5    | Try to filter by date range  | **BLOCKED** — no date filter on dashboard           |                            |
| 6    | View detailed report         | Navigate to Reports page                            | Limited reporting features |

**Completion rate estimate:** 60%
**Primary friction:** Cannot export visualizations; cannot filter dashboard data by date range.

### 9.5 Journey: Multi-Tenant Administration

**Persona:** Alex, Platform Administrator

| Step | Action                   | Issues Found                             |
| ---- | ------------------------ | ---------------------------------------- |
| 1    | Navigate to Tenants page | Requires `platform_admin` role — correct |
| 2    | Create new tenant        | Form with standard fields                |
| 3    | Navigate to Franchises   | Create franchises under tenant           |
| 4    | Create users             | Assign roles per user                    |
| 5    | Configure permissions    | 68+ permissions in config                |
| 6    | Set up email domain      | Domain verification (SPF/DKIM/DMARC)     |
| 7    | Customize theme          | 4-level scoped theming                   |

**Completion rate estimate:** 85%
**Primary friction:** No guided setup wizard for new tenant onboarding.

***

## 10. WCAG 2.1 AA Accessibility Assessment

### 10.1 Compliance Summary

| WCAG Principle        | Criteria Evaluated | Pass   | Partial | Fail  | Score   |
| --------------------- | ------------------ | ------ | ------- | ----- | ------- |
| **1. Perceivable**    | 12                 | 7      | 3       | 2     | 71%     |
| **2. Operable**       | 14                 | 8      | 4       | 2     | 71%     |
| **3. Understandable** | 10                 | 7      | 2       | 1     | 80%     |
| **4. Robust**         | 5                  | 4      | 1       | 0     | 90%     |
| **Overall**           | **41**             | **26** | **10**  | **5** | **70%** |

### 10.2 Detailed Findings

#### Principle 1: Perceivable

| Criterion                         | Status  | Details                                                                                                                    |
| --------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| **1.1.1 Non-text Content**        | FAIL    | Charts missing `aria-label` or `role="img"`; Avatar/Logo components missing alt text                                       |
| **1.2.1 Audio-only/Video**        | N/A     | No audio/video content                                                                                                     |
| **1.3.1 Info and Relationships**  | PARTIAL | Forms use proper label association via RHF; Tables missing `scope="col"` on `<th>` elements; No `<caption>` on data tables |
| **1.3.2 Meaningful Sequence**     | PASS    | DOM order matches visual order                                                                                             |
| **1.3.3 Sensory Characteristics** | PARTIAL | Some status badges rely only on color without text labels or icons                                                         |
| **1.4.1 Use of Color**            | PARTIAL | Status badges use color-only differentiation (e.g., blue=new, red=blocked)                                                 |
| **1.4.3 Contrast (Minimum)**      | PASS    | Light mode: \~15:1 ratio; Dark mode: \~14:1 ratio (both exceed 4.5:1 AA)                                                   |
| **1.4.4 Resize Text**             | PASS    | Text scales with browser zoom                                                                                              |
| **1.4.10 Reflow**                 | PASS    | Responsive grid layouts reflow at all breakpoints                                                                          |
| **1.4.11 Non-text Contrast**      | PASS    | Focus rings (2px blue) provide 3:1+ contrast                                                                               |
| **1.4.12 Text Spacing**           | PASS    | Tailwind utility classes allow spacing adjustment                                                                          |
| **1.4.13 Content on Hover**       | PASS    | Tooltips dismissible, persistent, hoverable                                                                                |

#### Principle 2: Operable

| Criterion                         | Status  | Details                                                                                                                       |
| --------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **2.1.1 Keyboard**                | PARTIAL | Radix UI components are keyboard accessible; Charts are not keyboard-interactive; Custom components may lack keyboard support |
| **2.1.2 No Keyboard Trap**        | PASS    | Radix dialogs handle focus trap correctly with Escape to close                                                                |
| **2.1.4 Character Key Shortcuts** | PASS    | Ctrl+K (search), Ctrl+B (sidebar) use modifier keys                                                                           |
| **2.2.1 Timing Adjustable**       | PASS    | No timeouts on user input                                                                                                     |
| **2.3.1 Three Flashes**           | PASS    | No flashing content                                                                                                           |
| **2.4.1 Bypass Blocks**           | FAIL    | No skip-to-content link found                                                                                                 |
| **2.4.2 Page Titled**             | PASS    | Browser tab titles set correctly                                                                                              |
| **2.4.3 Focus Order**             | PASS    | Tab order follows visual layout                                                                                               |
| **2.4.4 Link Purpose**            | PASS    | Links have descriptive text                                                                                                   |
| **2.4.5 Multiple Ways**           | PASS    | Sidebar + Global search + Breadcrumbs (when present)                                                                          |
| **2.4.6 Headings and Labels**     | PARTIAL | CardTitle used but no semantic h1/h2/h3 hierarchy on dashboard pages                                                          |
| **2.4.7 Focus Visible**           | PASS    | Excellent — `focus-visible:ring-2` on all interactive elements                                                                |
| **2.5.1 Pointer Gestures**        | PASS    | All interactions available via click (no required gestures)                                                                   |
| **2.5.3 Label in Name**           | PARTIAL | Most buttons have visible text; some icon-only buttons lack aria-label                                                        |

#### Principle 3: Understandable

| Criterion                           | Status  | Details                                                    |
| ----------------------------------- | ------- | ---------------------------------------------------------- |
| **3.1.1 Language of Page**          | PASS    | `<html lang="en">` set                                     |
| **3.2.1 On Focus**                  | PASS    | No unexpected context changes on focus                     |
| **3.2.2 On Input**                  | PASS    | Form validation on change is predictable                   |
| **3.2.3 Consistent Navigation**     | PARTIAL | Sidebar consistent; breadcrumbs inconsistent               |
| **3.2.4 Consistent Identification** | PASS    | Same actions use same labels throughout                    |
| **3.3.1 Error Identification**      | PASS    | Zod errors identify field and issue clearly                |
| **3.3.2 Labels or Instructions**    | PASS    | Form fields have labels via FormLabel                      |
| **3.3.3 Error Suggestion**          | PASS    | Zod messages suggest corrections ("Invalid email")         |
| **3.3.4 Error Prevention**          | PARTIAL | Confirmation dialogs for delete; no undo for other actions |

#### Principle 4: Robust

| Criterion                   | Status  | Details                                                             |
| --------------------------- | ------- | ------------------------------------------------------------------- |
| **4.1.1 Parsing**           | PASS    | Valid JSX/HTML output                                               |
| **4.1.2 Name, Role, Value** | PARTIAL | Radix components have proper ARIA; custom components may miss roles |
| **4.1.3 Status Messages**   | PASS    | Toast notifications use Sonner with aria-live support               |

### 10.3 Critical WCAG Fixes Required

| Priority | Fix                                                    | Effort | Impact                              |
| -------- | ------------------------------------------------------ | ------ | ----------------------------------- |
| P0       | Add skip-to-content link in DashboardLayout            | 1 day  | 2.4.1 compliance                    |
| P0       | Implement global Error Boundary                        | 2 days | Prevents total app crash            |
| P1       | Add `aria-label` to all chart containers               | 3 days | 1.1.1 compliance for screen readers |
| P1       | Add `scope="col"` and `<caption>` to all data tables   | 3 days | 1.3.1 compliance                    |
| P1       | Add semantic heading hierarchy (h1/h2/h3) to all pages | 3 days | 2.4.6 compliance                    |
| P1       | Add `prefers-reduced-motion` media query               | 2 days | 2.3.3 (AAA) / Motion sensitivity    |
| P2       | Add text/icon alongside color in status badges         | 1 week | 1.4.1 compliance                    |
| P2       | Add alt text to all Avatar/Logo/Image components       | 1 week | 1.1.1 compliance                    |
| P2       | Add `aria-label` to icon-only buttons without text     | 3 days | 2.5.3 compliance                    |

### 10.4 Accessibility Score Card

| Category                     | Score   |
| ---------------------------- | ------- |
| Form Labels & Validation     | 95%     |
| Focus Indicators             | 100%    |
| Color Contrast               | 95%     |
| Semantic HTML                | 70%     |
| ARIA Labels/Descriptions     | 65%     |
| Keyboard Navigation          | 75%     |
| Images Alt Text              | 20%     |
| Heading Hierarchy            | 60%     |
| Motion/Animation Preferences | 0%      |
| **Overall WCAG 2.1 AA**      | **70%** |

***

## 11. Performance & Responsiveness Analysis

### 11.1 Bundle Optimization

| Optimization            | Status      | Details                                                       |
| ----------------------- | ----------- | ------------------------------------------------------------- |
| Code splitting (routes) | Implemented | 148 routes via React.lazy() + Suspense                        |
| Manual chunks (Vite)    | Implemented | recharts, xlsx, dnd-kit, jszip, pdf-export in separate chunks |
| Tree shaking            | Enabled     | Vite default                                                  |
| CSS purging             | Enabled     | Tailwind content scanning                                     |

### 11.2 React Performance Patterns

| Pattern               | Usage                               | Score | Notes                                          |
| --------------------- | ----------------------------------- | ----- | ---------------------------------------------- |
| `useMemo`             | Used in PipelineAnalytics (4 hooks) | 80%   | Good for expensive computations                |
| `useCallback`         | **Minimal usage**                   | 40%   | Event handlers not wrapped — causes re-renders |
| `React.memo`          | **1 instance** (KanbanCard only)    | 20%   | Under-utilized for list item components        |
| `Suspense` boundaries | Widget-level (DraggableWidget)      | 85%   | Proper fallback with WidgetSkeleton            |
| Virtual scrolling     | VirtualChargesList in Quote wizard  | 80%   | Used for 1000+ charge rows                     |

### 11.3 Data Fetching

| Pattern                | Status                         | Notes                                                       |
| ---------------------- | ------------------------------ | ----------------------------------------------------------- |
| TanStack React Query   | Used for some queries          | Provides caching and stale-while-revalidate                 |
| ScopedDataAccess       | All queries scoped             | Selects only needed columns                                 |
| Server-side pagination | **NOT implemented**            | All pagination is client-side (1000 record limit on Quotes) |
| Debounce on search     | Hook exists (`useDebounce.ts`) | Not consistently applied                                    |

### 11.4 Image Optimization

| Pattern                               | Status          |
| ------------------------------------- | --------------- |
| Lazy loading (`loading="lazy"`)       | NOT implemented |
| Responsive images (`srcset`, `sizes`) | NOT implemented |
| Image compression                     | NOT implemented |
| WebP/AVIF formats                     | NOT implemented |

### 11.5 Mobile Responsiveness

**Responsive Infrastructure:**

| Feature              | Implementation                                           |
| -------------------- | -------------------------------------------------------- |
| Mobile detection     | `useIsMobile()` hook at 768px breakpoint                 |
| Sidebar behavior     | Desktop: visible; Mobile: Sheet overlay drawer           |
| Grid layouts         | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` (excellent)  |
| Tailwind breakpoints | Default: sm(640), md(768), lg(1024), xl(1280), 2xl(1536) |
| Container            | Max-width 1400px at 2xl                                  |

**Responsive Scores by Area:**

| Area                 | Score | Issues                                             |
| -------------------- | ----- | -------------------------------------------------- |
| Navigation (sidebar) | 95%   | Excellent — Sheet drawer on mobile                 |
| Grid layouts         | 90%   | Responsive grids well-implemented                  |
| Tables               | 60%   | Horizontal scroll only — no mobile card view       |
| Forms                | 70%   | Not all forms have mobile-specific column layouts  |
| Touch targets        | 65%   | Default h-9 (36px) — WCAG recommends 44px minimum  |
| Charts               | 80%   | Responsive containers but may be cramped on mobile |

### 11.6 Performance Targets vs Current

| Metric                         | Target | Current Estimate | Gap       |
| ------------------------------ | ------ | ---------------- | --------- |
| First Contentful Paint (FCP)   | <1.5s  | \~2.0s           | 0.5s      |
| Time to Interactive (TTI)      | <3.0s  | \~3.5s           | 0.5s      |
| Initial bundle size            | <500KB | \~600KB\*        | 100KB     |
| Largest Contentful Paint (LCP) | <2.5s  | \~3.0s           | 0.5s      |
| Cumulative Layout Shift (CLS)  | <0.1   | \~0.05           | On target |

\*Estimated — actual profiling needed with Lighthouse

***

## 12. Design System Specification

### 12.1 Design Tokens

#### Color Tokens (HSL-based)

| Token                  | Light Mode  | Dark Mode   | Purpose                 |
| ---------------------- | ----------- | ----------- | ----------------------- |
| `--background`         | 0 0% 100%   | 222 47% 11% | Page background         |
| `--foreground`         | 222 47% 11% | 210 40% 98% | Primary text            |
| `--card`               | 0 0% 100%   | 217 32% 17% | Card surfaces           |
| `--card-foreground`    | 222 47% 11% | 210 40% 98% | Card text               |
| `--popover`            | 0 0% 100%   | 217 32% 17% | Popover backgrounds     |
| `--primary`            | 217 91% 60% | 217 91% 60% | Primary actions (blue)  |
| `--primary-foreground` | 210 40% 98% | 210 40% 98% | Text on primary         |
| `--secondary`          | 210 40% 96% | 217 32% 17% | Secondary backgrounds   |
| `--muted`              | 210 40% 96% | 217 32% 17% | Muted backgrounds       |
| `--muted-foreground`   | 215 16% 47% | 215 20% 65% | Muted text              |
| `--accent`             | 197 71% 52% | 197 71% 52% | Accent/highlight (cyan) |
| `--destructive`        | 0 84% 60%   | 0 62% 30%   | Error/delete (red)      |
| `--success`            | 142 71% 45% | 142 71% 45% | Success (green)         |
| `--warning`            | 38 92% 50%  | 38 92% 50%  | Warning (orange)        |
| `--border`             | 214 32% 91% | 217 32% 17% | Border color            |
| `--input`              | 214 32% 91% | 217 32% 17% | Input borders           |
| `--ring`               | 217 91% 60% | 217 91% 60% | Focus ring              |

#### Brand Tokens

| Token                     | Value                                                                                    | Purpose          |
| ------------------------- | ---------------------------------------------------------------------------------------- | ---------------- |
| `--gradient-primary`      | `linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(197 71% 52%) 100%)`                    | Primary gradient |
| `--gradient-brand-golden` | `linear-gradient(135deg, hsl(45 96% 62%) 0%, hsl(40 94% 58%) 35%, hsl(35 88% 48%) 100%)` | Brand golden     |
| `--gradient-hero`         | `linear-gradient(135deg, hsl(222 47% 11%) 0%, hsl(217 32% 17%) 100%)`                    | Hero sections    |
| `--gradient-success`      | `linear-gradient(135deg, hsl(142 71% 45%) 0%, hsl(142 71% 55%) 100%)`                    | Success gradient |
| `--brand-gold`            | 40 94% 58%                                                                               | Brand gold       |
| `--brand-gold-light`      | 48 96% 70%                                                                               | Brand gold light |
| `--brand-gold-dark`       | 35 88% 48%                                                                               | Brand gold dark  |

#### Sidebar Tokens

| Token                  | Light          | Dark            |
| ---------------------- | -------------- | --------------- |
| `--sidebar-background` | 0 0% 98%       | 240 5.9% 10%    |
| `--sidebar-foreground` | 240 5.3% 26.1% | 240 4.8% 95.9%  |
| `--sidebar-primary`    | 240 5.9% 10%   | 224.3 76.3% 48% |
| `--sidebar-accent`     | 240 4.8% 95.9% | 240 3.7% 15.9%  |
| `--sidebar-border`     | 220 13% 91%    | 240 3.7% 15.9%  |

#### Table Tokens

| Token                       | Value                   |
| --------------------------- | ----------------------- |
| `--table-background`        | 0 0% 100%               |
| `--table-header-background` | 197 35% 92%             |
| `--table-header-text`       | 0 0% 10%                |
| `--table-header-separator`  | 0 0% 0% / 0.15          |
| `--table-foreground`        | inherits `--foreground` |

#### Utility Tokens

| Token                 | Value                                                                 | Purpose                |
| --------------------- | --------------------------------------------------------------------- | ---------------------- |
| `--radius`            | 0.5rem                                                                | Default border radius  |
| `--shadow-lg`         | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` | Large shadow           |
| `--shadow-primary`    | `0 10px 30px -10px hsl(217 91% 60% / 0.3)`                            | Primary element shadow |
| `--transition-smooth` | `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`                               | Smooth transition      |

### 12.2 Typography Scale

| Level         | Size Class  | Weight          | Spacing          | Usage               |
| ------------- | ----------- | --------------- | ---------------- | ------------------- |
| Page Title    | `text-3xl`  | `font-bold`     | `tracking-tight` | Page headers (h1)   |
| Card Title    | `text-xl`   | `font-semibold` | `tracking-tight` | Card/widget headers |
| Dialog Title  | `text-lg`   | `font-semibold` | `tracking-tight` | Dialog headers      |
| Section Title | `text-base` | `font-semibold` | —                | Section headers     |
| Alert Title   | `text-sm`   | `font-medium`   | `tracking-tight` | Alert headers       |
| Body          | `text-sm`   | `font-normal`   | —                | Default text        |
| Label         | `text-sm`   | `font-medium`   | —                | Form labels         |
| Caption       | `text-xs`   | `font-normal`   | —                | Supplementary text  |
| Button        | `text-sm`   | `font-medium`   | —                | Button labels       |

### 12.3 Spacing Scale

| Token     | Value    | Tailwind          | Usage                      |
| --------- | -------- | ----------------- | -------------------------- |
| space-1   | 0.25rem  | `gap-1`, `p-1`    | Tight spacing (icons)      |
| space-1.5 | 0.375rem | `gap-1.5`         | Component internal         |
| space-2   | 0.5rem   | `gap-2`, `p-2`    | Button padding             |
| space-3   | 0.75rem  | `gap-3`, `p-3`    | Card padding               |
| space-4   | 1rem     | `gap-4`, `p-4`    | Section spacing            |
| space-6   | 1.5rem   | `gap-6`, `p-6`    | Page padding               |
| space-8   | 2rem     | Container padding | Container padding          |
| space-24  | 6rem     | `pb-24`           | StickyActionsBar clearance |

### 12.4 Border Radius Scale

| Level | Value                                | Tailwind                         |
| ----- | ------------------------------------ | -------------------------------- |
| sm    | calc(var(--radius) - 4px) = 0.25rem  | `rounded-sm`                     |
| md    | calc(var(--radius) - 2px) = 0.375rem | `rounded-md`                     |
| lg    | var(--radius) = 0.5rem               | `rounded-lg`                     |
| full  | 9999px                               | `rounded-full` (badges, avatars) |

### 12.5 Shadow Scale

| Level              | Tailwind                | Usage                     |
| ------------------ | ----------------------- | ------------------------- |
| `shadow-sm`        | buttons, inputs         | Subtle elevation          |
| `shadow-md`        | dropdowns, popovers     | Medium elevation          |
| `shadow-lg`        | modals, critical alerts | High elevation            |
| `--shadow-primary` | branded elements        | Primary shadow with color |

### 12.6 Animation Tokens

| Animation             | Duration | Easing                       | Usage                     |
| --------------------- | -------- | ---------------------------- | ------------------------- |
| `animate-pulse`       | 2s       | ease-in-out                  | Skeleton loaders          |
| `animate-spin`        | 1s       | linear                       | Loading spinners          |
| `accordion-down`      | 0.2s     | ease-out                     | Accordion expand          |
| `accordion-up`        | 0.2s     | ease-out                     | Accordion collapse        |
| `animate-in`          | varies   | cubic-bezier                 | tailwindcss-animate entry |
| `animate-out`         | varies   | cubic-bezier                 | tailwindcss-animate exit  |
| `--transition-smooth` | 0.3s     | cubic-bezier(0.4, 0, 0.2, 1) | General transitions       |

### 12.7 Icon System

**Library:** lucide-react

**Size Scale:**

| Scale | Class       | Usage                            |
| ----- | ----------- | -------------------------------- |
| xs    | `h-3 w-3`   | Inline indicators                |
| sm    | `h-4 w-4`   | Default for UI elements, buttons |
| md    | `h-5 w-5`   | Command dialog, dropdown menus   |
| lg    | `h-8 w-8`   | Loading spinners                 |
| xl    | `h-12 w-12` | Empty state illustrations        |

### 12.8 Theme System

**Architecture:**

```
ThemeProvider (useTheme.tsx, 340 lines)
├── Storage: localStorage (soslogicpro.themes, .activeThemeName, .darkMode)
├── Database: ui_themes table (scoped by platform/tenant/franchise/user)
├── Dark mode: CSS class-based (.dark on <html>)
├── Dynamic CSS: applyTheme() sets 14+ CSS variables on :root
└── Presets: 35 themes in src/theme/themes.ts
     ├── 21 Basic color gradient presets
     ├── 4 Advanced dark presets (with sidebar styling)
     ├── 3 Light presets (with sidebar styling)
     └── 7 Accessibility presets (High Contrast, Solarized, Accessible Warm/Cool)
```

**Customizable Properties (per theme):**

* Gradient start/end colors and angle
* Primary and accent colors
* Title strip color
* Table header/background/foreground/separator colors
* Border radius
* Sidebar background and accent
* Page background gradient
* Dark mode toggle

***

## 13. Competitive Analysis — vs Salesforce, HubSpot, SAP, Oracle

### 13.1 Feature Comparison Matrix

| Feature                 | Logic Nexus AI                     | Salesforce                   | HubSpot              | SAP S/4HANA          | Oracle CX          |
| ----------------------- | ---------------------------------- | ---------------------------- | -------------------- | -------------------- | ------------------ |
| **UI Framework**        | React + shadcn/ui + Radix          | Lightning (Aura/LWC)         | React (custom)       | Fiori (SAPUI5)       | Oracle JET         |
| **Design System**       | HSL tokens + CVA + 35 themes       | SLDS (Salesforce Lightning)  | Canvas Design        | SAP Fiori Guidelines | Redwood UX         |
| **Dark Mode**           | Full (CSS class-based)             | Limited                      | Full                 | Limited              | Full               |
| **Theme Customization** | 4-level scoped (platform→user)     | Org-level only               | Account-level        | Client/role-level    | Org-level          |
| **Component Count**     | 65+                                | 200+                         | 100+                 | 150+                 | 120+               |
| **Accessibility**       | 70% WCAG AA                        | 90% WCAG AA                  | 85% WCAG AA          | 95% WCAG AA          | 80% WCAG AA        |
| **Mobile Responsive**   | Tailwind responsive + Sheet drawer | Salesforce Mobile app        | Fully responsive     | SAP Fiori Mobile     | Oracle Mobile      |
| **Kanban/Pipeline**     | 6 kanban views + DnD-kit           | Kanban views                 | Pipeline views       | Limited              | Pipeline views     |
| **Data Visualization**  | 5 Recharts types                   | Einstein Analytics (Tableau) | Custom charts        | SAP Analytics Cloud  | Oracle Analytics   |
| **Real-time Updates**   | Supabase subscriptions             | Platform Events              | WebSocket            | SAP Event Mesh       | Oracle Streaming   |
| **Global Search**       | Ctrl+K, cross-entity               | SOSL/SOQL search             | Global search bar    | SAP Search           | Oracle Search      |
| **Keyboard Shortcuts**  | 2 (Ctrl+K, Ctrl+B)                 | 20+ shortcuts                | 10+ shortcuts        | Fiori shortcuts      | 15+ shortcuts      |
| **Form Validation**     | Zod + RHF (partial)                | Built-in validation          | Form validation      | SAP Smart Forms      | Oracle Forms       |
| **Import/Export**       | CSV/Excel (4 entities)             | Data Loader + CSV            | CSV/Excel            | BTP Integration      | Import/Export      |
| **AI Integration**      | GPT-4o + Gemini + GPT-4o-mini      | Einstein AI                  | Breeze AI            | SAP Joule            | Oracle AI          |
| **Multi-tenancy**       | 3-tier (platform→tenant→franchise) | Single-tenant per org        | Multi-hub            | Multi-client         | Multi-org          |
| **Onboarding**          | None                               | Trailhead + in-app tours     | Setup wizard + tours | SAP Enable Now       | Guided Setup       |
| **Help System**         | Keyboard shortcuts modal only      | Contextual help + docs       | Knowledge base       | SAP Help Portal      | Oracle Help Center |
| **Error Boundaries**    | Not implemented                    | Implemented                  | Implemented          | Implemented          | Implemented        |
| **Skip Links**          | Not implemented                    | Implemented                  | Implemented          | Implemented          | Implemented        |

### 13.2 UX Maturity Comparison

| Dimension                | Logic Nexus AI | Salesforce | HubSpot   | SAP       | Oracle    |
| ------------------------ | -------------- | ---------- | --------- | --------- | --------- |
| Design System Maturity   | 3/5            | 5/5        | 4/5       | 5/5       | 4/5       |
| Accessibility Compliance | 2.5/5          | 4.5/5      | 4/5       | 5/5       | 3.5/5     |
| Mobile Experience        | 3.5/5          | 4/5        | 4.5/5     | 3/5       | 3.5/5     |
| Customization            | 4/5            | 3/5        | 3/5       | 3.5/5     | 3/5       |
| Performance              | 3.5/5          | 3/5        | 4/5       | 3/5       | 3/5       |
| User Onboarding          | 1/5            | 5/5        | 5/5       | 4/5       | 3/5       |
| **Overall UX Maturity**  | **2.9/5**      | **4.1/5**  | **4.1/5** | **3.9/5** | **3.3/5** |

### 13.3 Competitive Advantages

Logic Nexus AI has unique strengths that competitors lack:

1. **4-level scoped theming** — No competitor offers platform→tenant→franchise→user theme cascading
2. **35 built-in theme presets** including 7 accessibility-focused themes — More than any competitor
3. **Multi-model AI routing** — GPT-4o + Gemini + GPT-4o-mini vs single-provider in competitors
4. **Dual-layer security** — DB-level RLS + app-level ScopedDataAccess, unique approach
5. **Plugin architecture** — Domain-extensible via IPlugin interface, not available in SaaS CRMs
6. **Open-source stack** — No vendor lock-in; Supabase, React, Tailwind are all open technologies
7. **Custom quote engine** — 3-tier rate engine (contract → spot → Monte Carlo) more sophisticated than competitors

### 13.4 Competitive Gaps to Close

| Gap                      | Competitor Benchmark                        | Priority |
| ------------------------ | ------------------------------------------- | -------- |
| Onboarding/guided tours  | HubSpot setup wizard, Salesforce Trailhead  | P1       |
| Keyboard shortcuts (20+) | Salesforce (20+ shortcuts)                  | P2       |
| Error boundaries         | All competitors implement this              | P0       |
| Skip-to-content link     | All competitors implement this              | P0       |
| Contextual help          | SAP Help Portal, Salesforce contextual tips | P2       |
| Data export from charts  | Tableau/Einstein Analytics export           | P2       |
| Mobile-optimized tables  | HubSpot card view on mobile                 | P2       |
| Undo functionality       | Salesforce Recycle Bin, HubSpot undo        | P1       |

***

## 14. Redesign Strategy & Recommendations

### 14.1 Design Principles

Based on the audit findings, the redesign should follow these principles:

1. **Consistency First** — Unify all form patterns to React Hook Form + Zod
2. **Accessibility by Default** — WCAG 2.1 AA compliance as baseline, not afterthought
3. **Progressive Disclosure** — Show only what's needed at each step
4. **Mobile-First** — Design for mobile, enhance for desktop
5. **Performance Budget** — No component should block interactivity for >100ms
6. **Composability** — All components should be composable via compound patterns

### 14.2 Priority Remediation Plan

#### Phase 0: Critical Safety (Week 1)

| Action                                              | File(s)                                                          | Effort  |
| --------------------------------------------------- | ---------------------------------------------------------------- | ------- |
| Implement global `<ErrorBoundary>` component        | New: `src/components/ui/error-boundary.tsx`, Edit: `src/App.tsx` | 2 days  |
| Add skip-to-content link                            | Edit: `src/components/layout/DashboardLayout.tsx`                | 0.5 day |
| Add heading hierarchy (h1) to all dashboard pages   | Edit: 20+ page files                                             | 2 days  |
| Remove unused legacy `Sidebar.tsx` and `drawer.tsx` | Delete: 2 files                                                  | 0.5 day |

#### Phase 1: Accessibility Compliance (Weeks 2-3)

| Action                                                                         | Files                                                                                                     | Effort |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------ |
| Add `aria-label` to all chart containers (AreaChart, BarChart, PieChart, etc.) | Edit: StatsCards.tsx, PipelineAnalytics.tsx, CustomChartWidget.tsx, FinancialWidget.tsx, VolumeWidget.tsx | 3 days |
| Add `scope="col"` to all table headers, `<caption>` to data tables             | Edit: `table.tsx`, all table usage pages                                                                  | 3 days |
| Add `prefers-reduced-motion` media query                                       | Edit: `src/index.css`, components with animations                                                         | 2 days |
| Add text labels alongside colors in status badges                              | Edit: Badge/StatusPill usage across 10+ files                                                             | 3 days |
| Add alt text to all Avatar, Logo, and Image components                         | Edit: 15+ files                                                                                           | 3 days |
| Add `aria-label` to all icon-only buttons                                      | Edit: 20+ files                                                                                           | 2 days |

#### Phase 2: Consistency Unification (Weeks 4-6)

| Action                                                            | Files                                        | Effort |
| ----------------------------------------------------------------- | -------------------------------------------- | ------ |
| Create shared `useEntityForm()` base hook for CRUD forms          | New: `src/hooks/useEntityForm.ts`            | 3 days |
| Migrate EmailComposeDialog to React Hook Form + Zod               | Edit: `EmailComposeDialog.tsx`               | 3 days |
| Migrate LeadConversionDialog to React Hook Form + Zod             | Edit: `LeadConversionDialog.tsx`             | 2 days |
| Create unified `<AdvancedFilter>` component with operator support | New: `src/components/ui/advanced-filter.tsx` | 5 days |
| Standardize filter persistence (localStorage) across all pages    | Edit: 10+ list pages                         | 3 days |
| Add breadcrumbs to all detail and create pages                    | Edit: 30+ pages                              | 5 days |
| Add debounce (300ms) to global search and page filters            | Edit: `global-search.tsx`, filter hooks      | 2 days |

#### Phase 3: Navigation & UX Enhancement (Weeks 7-9)

| Action                                                                    | Files                                              | Effort |
| ------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| Reorganize sidebar: group Logistics sub-items into collapsible categories | Edit: navigation config, AppSidebar.tsx            | 3 days |
| Add mobile card view for data tables                                      | New: `src/components/ui/responsive-table.tsx`      | 5 days |
| Implement server-side pagination for Quotes and large datasets            | Edit: Quotes.tsx, DataTable.tsx, add RPC functions | 5 days |
| Increase touch target sizes to 44px minimum                               | Edit: Button, Pagination, icon buttons             | 3 days |
| Add bulk operations to Quotes and Accounts tables                         | Edit: 2 page files                                 | 3 days |
| Implement chart export (PNG/PDF) for dashboard widgets                    | New: Export utility, Edit: chart widgets           | 3 days |

#### Phase 4: Advanced UX Features (Weeks 10-14)

| Action                                                                  | Files                                        | Effort  |
| ----------------------------------------------------------------------- | -------------------------------------------- | ------- |
| Implement undo/redo for destructive actions (soft delete + Recycle Bin) | New: Recycle Bin page, soft delete migration | 2 weeks |
| Add onboarding wizard for new tenants                                   | New: `src/components/onboarding/`            | 1 week  |
| Add contextual help ("?") tooltips on complex fields                    | New: `src/components/ui/help-tooltip.tsx`    | 3 days  |
| Expand keyboard shortcuts to 20+ (N=new, E=edit, D=delete, etc.)        | Edit: `keyboard-shortcuts.tsx`, add handlers | 1 week  |
| Implement form autosave/draft for CRUD forms                            | New: `useAutoSave` hook                      | 3 days  |
| Add date range filter to dashboards                                     | Edit: Dashboard widgets                      | 3 days  |
| Chart colors via CSS variables (replace hardcoded hex)                  | Edit: PipelineAnalytics.tsx, chart configs   | 2 days  |

### 14.3 User Personas

| Persona   | Role              | Primary Tasks                                | Key UX Needs                                    |
| --------- | ----------------- | -------------------------------------------- | ----------------------------------------------- |
| **Sarah** | Sales Rep         | Lead capture, qualification, quote creation  | Fast forms, AI suggestions, pipeline visibility |
| **Mike**  | Inside Sales      | Email management, lead follow-up             | Email-to-lead conversion, notification center   |
| **Tom**   | Ops Manager       | Shipment creation, tracking, status updates  | Kanban views, bulk operations, mobile access    |
| **Linda** | Franchise Manager | Dashboard analytics, team oversight          | Exportable reports, date filtering, KPI cards   |
| **Alex**  | Platform Admin    | Tenant setup, user management, configuration | Guided setup, theme customization, audit logs   |

### 14.4 Information Architecture Redesign

**Current sidebar (60+ items, flat list):**

```
Sales (17 items) → Logistics (22 items) → Compliance (2) → Billing (2) → Finance (3) → Admin (7)
```

**Proposed sidebar (grouped, collapsible):**

```
Sales
  ├── Pipeline (Leads, Opportunities, Quotes)
  ├── Relationships (Accounts, Contacts)
  ├── Communication (Activities, Campaigns, Email, Chatter)
  └── Insights (Dashboards, Reports, Calendar)

Operations
  ├── Fulfillment (Bookings, Shipments)
  ├── Fleet (Vehicles, Carriers, Vendors, Warehouses)
  ├── Reference Data (Ports, Packages, Containers, Vessels, Cargo, Incoterms, Services)
  └── Compliance (Screening, Incidents)

Finance
  ├── Invoices
  ├── Rate Management
  └── Configuration (Margin Rules, Tax Jurisdictions)

Administration (platform_admin only)
  ├── Organization (Tenants, Franchises, Users)
  ├── Assignments (Lead Assignment, Lead Routing)
  └── System (Settings, Transfer Center, Logs)
```

**Benefits:**

* Reduces visible items from 60+ to \~12 top-level groups
* Groups related items by workflow
* Reference Data hidden under collapsible section
* Faster navigation for common tasks

***

## 15. Reusable Component Library — 50+ Components

### 15.1 Existing Components (Retain & Enhance)

| #  | Component                | Status | Enhancement Needed                      |
| -- | ------------------------ | ------ | --------------------------------------- |
| 1  | Button                   | Retain | Add loading variant with spinner        |
| 2  | Badge                    | Retain | Add icon slot for accessibility         |
| 3  | StatusPill               | Retain | Add icon variant for colorblind support |
| 4  | Card                     | Retain | None                                    |
| 5  | Alert                    | Retain | None                                    |
| 6  | Avatar                   | Retain | Add mandatory alt text prop             |
| 7  | Progress                 | Retain | None                                    |
| 8  | Pagination               | Retain | Increase touch target to 44px           |
| 9  | Input                    | Retain | None                                    |
| 10 | Label                    | Retain | None                                    |
| 11 | Textarea                 | Retain | None                                    |
| 12 | Form (RHF wrapper)       | Retain | None                                    |
| 13 | Checkbox                 | Retain | None                                    |
| 14 | RadioGroup               | Retain | None                                    |
| 15 | Switch                   | Retain | None                                    |
| 16 | Toggle/ToggleGroup       | Retain | None                                    |
| 17 | Select                   | Retain | None                                    |
| 18 | AsyncCombobox            | Retain | None                                    |
| 19 | DateRangePicker          | Retain | None                                    |
| 20 | FileUpload               | Retain | None                                    |
| 21 | Calendar                 | Retain | None                                    |
| 22 | Dialog                   | Retain | Add size variants (sm, md, lg, xl)      |
| 23 | AlertDialog              | Retain | None                                    |
| 24 | Popover                  | Retain | None                                    |
| 25 | DropdownMenu             | Retain | None                                    |
| 26 | Tabs                     | Retain | None                                    |
| 27 | Accordion                | Retain | None                                    |
| 28 | Command                  | Retain | None                                    |
| 29 | GlobalSearch             | Retain | Add debounce                            |
| 30 | Breadcrumb               | Retain | Standardize usage                       |
| 31 | Table                    | Retain | Add scope="col", caption                |
| 32 | Skeleton/SkeletonTable   | Retain | None                                    |
| 33 | EmptyState               | Retain | None                                    |
| 34 | Chart (Recharts wrapper) | Retain | Add aria-label support                  |
| 35 | Sonner (toast)           | Retain | None                                    |
| 36 | Sidebar                  | Retain | Add collapsible groups                  |
| 37 | Sheet                    | Retain | None                                    |
| 38 | Resizable                | Retain | None                                    |
| 39 | StickyActionsBar         | Retain | Add CVA variants                        |
| 40 | ActionsToolbar           | Retain | Add CVA variants                        |
| 41 | ViewToggle               | Retain | None                                    |
| 42 | InlineEdit               | Retain | None                                    |
| 43 | EditableText             | Retain | None                                    |
| 44 | MultiSelectBar           | Retain | None                                    |
| 45 | HslPicker                | Retain | None                                    |
| 46 | ScrollArea               | Retain | None                                    |
| 47 | Separator                | Retain | None                                    |
| 48 | HoverCard                | Retain | None                                    |

### 15.2 New Components (To Build)

| #  | Component                | Purpose                                                        | Priority | Effort  |
| -- | ------------------------ | -------------------------------------------------------------- | -------- | ------- |
| 49 | **ErrorBoundary**        | Catch and display unhandled errors gracefully                  | P0       | 2 days  |
| 50 | **SkipLink**             | Skip-to-content accessibility link                             | P0       | 0.5 day |
| 51 | **Spinner**              | Dedicated loading spinner (replaces Loader2 pattern)           | P1       | 1 day   |
| 52 | **AdvancedFilter**       | Unified filter component with operators, persistence, debounce | P1       | 5 days  |
| 53 | **ResponsiveTable**      | Table that switches to card view on mobile                     | P2       | 5 days  |
| 54 | **ProgressStepper**      | Visual step indicator for multi-step wizards                   | P1       | 2 days  |
| 55 | **HelpTooltip**          | Contextual help "?" icon with popover                          | P2       | 1 day   |
| 56 | **ChartExport**          | Export chart as PNG/PDF/CSV                                    | P2       | 3 days  |
| 57 | **OnboardingTour**       | Step-by-step guided tour overlay                               | P2       | 5 days  |
| 58 | **AutoSaveIndicator**    | Shows "Saving..." / "Saved" / "Unsaved changes" status         | P2       | 1 day   |
| 59 | **RecycleBin**           | Soft-deleted items recovery view                               | P3       | 5 days  |
| 60 | **NotificationCenter**   | In-app notification bell with dropdown                         | P2       | 3 days  |
| 61 | **DashboardDateFilter**  | Date range filter for dashboard widgets                        | P2       | 2 days  |
| 62 | **CollapsibleMenuGroup** | Sidebar menu section with expand/collapse                      | P1       | 2 days  |
| 63 | **StatusBadgeWithIcon**  | Badge variant that includes icon alongside color               | P1       | 1 day   |

**Total component count:** 63 (48 existing + 15 new)

***

## 16. Implementation Roadmap

### 16.1 Phased Rollout Strategy

```
Phase 0: Critical Safety ──────── Week 1
  │ Error Boundary, Skip Link, Heading Hierarchy
  │ Alpha: Internal QA only
  │
Phase 1: Accessibility ─────────── Weeks 2-3
  │ ARIA labels, table a11y, reduced motion, alt text
  │ Alpha: Internal QA + accessibility audit tool
  │
Phase 2: Consistency ────────────── Weeks 4-6
  │ Form unification, filter standardization, breadcrumbs
  │ Beta: Selected internal users
  │
Phase 3: Navigation & UX ───────── Weeks 7-9
  │ Sidebar redesign, mobile tables, server pagination
  │ Beta: Expanded user group
  │
Phase 4: Advanced Features ──────── Weeks 10-14
  │ Undo/redo, onboarding, help system, keyboard shortcuts
  │ Limited Release: Early adopter tenants
  │
General Availability ────────────── Week 15+
  │ Full rollout to all tenants
  │ A/B testing framework active
```

### 16.2 Release Criteria by Phase

| Phase   | Entry Criteria   | Exit Criteria                                                                                              |
| ------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Phase 0 | Audit complete   | Error boundary catches 100% of unhandled errors; skip link works; headings pass axe-core                   |
| Phase 1 | Phase 0 deployed | WCAG AA score ≥85%; axe-core reports 0 critical violations                                                 |
| Phase 2 | Phase 1 deployed | All forms use RHF+Zod; filters persist on page reload; breadcrumbs on all detail pages                     |
| Phase 3 | Phase 2 deployed | Sidebar fits on screen without scrolling; tables show card view on mobile; pagination handles 10K+ records |
| Phase 4 | Phase 3 deployed | Undo works for delete operations; onboarding completes with 90% success; 20+ keyboard shortcuts documented |
| GA      | Phase 4 deployed | SUS score ≥80; WCAG AA score ≥90%; task completion rate ≥85%                                               |

### 16.3 Testing Strategy

| Test Type                 | Tool                                     | When                     |
| ------------------------- | ---------------------------------------- | ------------------------ |
| Unit tests (components)   | Vitest + React Testing Library           | Every PR                 |
| Visual regression         | Storybook 8.6.15 + Chromatic             | Every PR                 |
| Accessibility (automated) | axe-core + jest-axe                      | Every PR                 |
| Accessibility (manual)    | Screen reader testing (VoiceOver, NVDA)  | Each phase release       |
| E2E (critical paths)      | Playwright                               | Nightly + phase releases |
| Performance (Lighthouse)  | Lighthouse CI                            | Weekly + phase releases  |
| Usability testing         | Moderated sessions (5 users per persona) | Phase 2 + Phase 4        |
| A/B testing               | PostHog 1.313.0                          | Phase 4+                 |

### 16.4 A/B Testing Framework

**Tool:** PostHog (already integrated)

**Planned experiments:**

| Experiment            | Hypothesis                                      | Metric                            | Phase   |
| --------------------- | ----------------------------------------------- | --------------------------------- | ------- |
| Sidebar grouping      | Grouped sidebar reduces time-to-navigate by 30% | Click-to-target time              | Phase 3 |
| Mobile card view      | Card view reduces horizontal scrolling by 80%   | Scroll events on mobile           | Phase 3 |
| Breadcrumb navigation | Breadcrumbs reduce "back button" usage by 40%   | Browser back vs breadcrumb clicks | Phase 2 |
| Onboarding wizard     | Guided onboarding reduces setup time by 50%     | Time to first quote               | Phase 4 |
| Dark mode default     | Dark mode reduces eye strain complaints         | User feedback score               | Phase 4 |

***

## 17. Success Metrics & KPIs

### 17.1 Primary Success Metrics

| Metric                       | Current Baseline  | Target (6 months) | Target (12 months) |
| ---------------------------- | ----------------- | ----------------- | ------------------ |
| Task completion rate         | \~75% (estimated) | ≥85%              | ≥90%               |
| System Usability Scale (SUS) | \~72 (estimated)  | ≥78               | ≥82                |
| WCAG 2.1 AA compliance       | 70%               | ≥90%              | ≥95%               |
| User satisfaction (CSAT)     | Not measured      | ≥4.0/5            | ≥4.3/5             |
| Support ticket volume        | Baseline TBD      | -25%              | -40%               |
| Time to complete key tasks   | Baseline TBD      | -20%              | -30%               |

### 17.2 UX Performance KPIs

| KPI                            | Current Estimate | Target |
| ------------------------------ | ---------------- | ------ |
| First Contentful Paint (FCP)   | \~2.0s           | <1.5s  |
| Time to Interactive (TTI)      | \~3.5s           | <3.0s  |
| Largest Contentful Paint (LCP) | \~3.0s           | <2.5s  |
| Cumulative Layout Shift (CLS)  | \~0.05           | <0.1   |
| Initial bundle size            | \~600KB          | <500KB |

### 17.3 Engagement Metrics

| Metric                                 | Measurement Method           | Target                         |
| -------------------------------------- | ---------------------------- | ------------------------------ |
| Feature adoption rate (new components) | PostHog event tracking       | ≥70% usage within 30 days      |
| Mobile usage share                     | PostHog device analytics     | ≥15% of sessions               |
| Keyboard shortcut usage                | PostHog event tracking       | ≥20% of power users            |
| Theme customization rate               | Database query on ui\_themes | ≥30% of tenants customize      |
| Pipeline view adoption                 | PostHog page views           | ≥50% of users use kanban views |

### 17.4 Accessibility Metrics

| Metric                         | Tool           | Target |
| ------------------------------ | -------------- | ------ |
| axe-core violations (critical) | axe-core CI    | 0      |
| axe-core violations (serious)  | axe-core CI    | 0      |
| axe-core violations (moderate) | axe-core CI    | <5     |
| Screen reader task completion  | Manual testing | ≥80%   |
| Keyboard-only task completion  | Manual testing | ≥90%   |

### 17.5 Measurement Plan

| Phase   | Measurement Activities                                                  |
| ------- | ----------------------------------------------------------------------- |
| Phase 0 | Establish baselines for all metrics via Lighthouse + PostHog + axe-core |
| Phase 1 | Re-run accessibility audit; compare axe-core violations pre/post        |
| Phase 2 | Moderated usability test (5 users × 5 tasks); measure SUS score         |
| Phase 3 | A/B test sidebar grouping and mobile card views; measure engagement     |
| Phase 4 | Full usability test; measure CSAT; compare support ticket volume        |
| GA      | Continuous monitoring via PostHog dashboards; monthly SUS surveys       |

***

## 18. Appendices

### Appendix A: All Identified Inconsistencies

| #  | Category    | Issue                                                         | Severity | Section |
| -- | ----------- | ------------------------------------------------------------- | -------- | ------- |
| 1  | Navigation  | Breadcrumbs only on 1-2 pages                                 | S2       | 4.3     |
| 2  | Dead Code   | Legacy Sidebar.tsx (73 lines) unused                          | S3       | 4.2     |
| 3  | Forms       | Lead/Account/Contact forms duplicate patterns, no shared base | S2       | 5.2     |
| 4  | Forms       | Quote wizard uses Zustand store, not RHF+Zod                  | S1       | 5.3     |
| 5  | Forms       | Email compose uses Dialog+useState, not RHF+Zod               | S2       | 5.5     |
| 6  | Tables      | No unified filter UI across tables                            | S1       | 7.3     |
| 7  | Tables      | Inconsistent bulk operation support                           | S2       | 7.3     |
| 8  | Tables      | Quotes 1000-record limit, no server-side pagination           | S1       | 7.3     |
| 9  | Dead Code   | Drawer component exists but unused                            | S3       | 3.2     |
| 10 | State       | Filter persistence varies by page                             | S2       | 7.3     |
| 11 | Performance | No debounce on page filters or global search                  | S2       | 11.3    |
| 12 | Forms       | Email validation inconsistency across forms                   | S3       | 5.5     |
| 13 | State       | Quote store uses custom reducer, others use RHF               | S1       | 5.3     |
| 14 | Design      | Modal sizes not standardized                                  | S3       | 7.4     |

### Appendix B: Files Referenced

#### Core Layout

* `src/App.tsx` — 738 lines, 148 route definitions
* `src/components/layout/DashboardLayout.tsx` — Main layout wrapper
* `src/components/layout/AppSidebar.tsx` — 200+ lines, sidebar navigation

#### UI Components (65+)

* `src/components/ui/` — All 65+ shadcn/ui components
* `tailwind.config.ts` — 127 lines, Tailwind configuration
* `src/index.css` — 162 lines, global CSS and design tokens

#### Theme System

* `src/hooks/useTheme.tsx` — 340 lines, theme provider
* `src/theme/themes.ts` — 227 lines, 35 theme presets

#### Form Components

* `src/components/crm/LeadForm.tsx` — 250+ lines
* `src/components/crm/AccountForm.tsx` — 150+ lines
* `src/components/crm/ContactForm.tsx` — Contact form
* `src/components/sales/MultiModalQuoteComposer.tsx` — 800+ lines, 4-step wizard
* `src/components/email/EmailComposeDialog.tsx` — 350+ lines

#### Dashboard & Analytics

* `src/components/dashboard/StatsCards.tsx` — KPI cards with sparklines
* `src/components/analytics/PipelineAnalytics.tsx` — 4 chart types
* `src/components/dashboard/widgets/CustomChartWidget.tsx` — Dynamic chart widget
* `src/components/dashboard/widgets/FinancialWidget.tsx` — Revenue chart
* `src/components/dashboard/widgets/VolumeWidget.tsx` — Volume chart
* `src/components/dashboard/KanbanDashboard.tsx` — Multi-entity kanban

#### Data Management

* `src/components/system/DataTable.tsx` — Generic data table
* `src/components/system/DataImportExport.tsx` — CSV/Excel import/export
* `src/pages/dashboard/LeadsImportExport.tsx` — Leads import config

#### Hooks

* `src/hooks/useCRM.tsx` — CRM context provider
* `src/hooks/useAuth.tsx` — Auth context provider
* `src/hooks/use-mobile.tsx` — Mobile detection
* `src/hooks/useDebounce.ts` — Debounce utility
* `src/hooks/useLeadsViewState.tsx` — Leads filter persistence

### Appendix C: WCAG 2.1 AA Criteria Status

| #      | Criterion                 | Level | Status  |
| ------ | ------------------------- | ----- | ------- |
| 1.1.1  | Non-text Content          | A     | FAIL    |
| 1.2.1  | Audio-only and Video-only | A     | N/A     |
| 1.3.1  | Info and Relationships    | A     | PARTIAL |
| 1.3.2  | Meaningful Sequence       | A     | PASS    |
| 1.3.3  | Sensory Characteristics   | A     | PARTIAL |
| 1.4.1  | Use of Color              | A     | PARTIAL |
| 1.4.3  | Contrast (Minimum)        | AA    | PASS    |
| 1.4.4  | Resize Text               | AA    | PASS    |
| 1.4.10 | Reflow                    | AA    | PASS    |
| 1.4.11 | Non-text Contrast         | AA    | PASS    |
| 1.4.12 | Text Spacing              | AA    | PASS    |
| 1.4.13 | Content on Hover          | AA    | PASS    |
| 2.1.1  | Keyboard                  | A     | PARTIAL |
| 2.1.2  | No Keyboard Trap          | A     | PASS    |
| 2.1.4  | Character Key Shortcuts   | A     | PASS    |
| 2.2.1  | Timing Adjustable         | A     | PASS    |
| 2.3.1  | Three Flashes             | A     | PASS    |
| 2.4.1  | Bypass Blocks             | A     | FAIL    |
| 2.4.2  | Page Titled               | A     | PASS    |
| 2.4.3  | Focus Order               | A     | PASS    |
| 2.4.4  | Link Purpose              | A     | PASS    |
| 2.4.5  | Multiple Ways             | AA    | PASS    |
| 2.4.6  | Headings and Labels       | AA    | PARTIAL |
| 2.4.7  | Focus Visible             | AA    | PASS    |
| 2.5.1  | Pointer Gestures          | A     | PASS    |
| 2.5.3  | Label in Name             | A     | PARTIAL |
| 3.1.1  | Language of Page          | A     | PASS    |
| 3.2.1  | On Focus                  | A     | PASS    |
| 3.2.2  | On Input                  | A     | PASS    |
| 3.2.3  | Consistent Navigation     | AA    | PARTIAL |
| 3.2.4  | Consistent Identification | AA    | PASS    |
| 3.3.1  | Error Identification      | A     | PASS    |
| 3.3.2  | Labels or Instructions    | A     | PASS    |
| 3.3.3  | Error Suggestion          | AA    | PASS    |
| 3.3.4  | Error Prevention          | AA    | PARTIAL |
| 4.1.1  | Parsing                   | A     | PASS    |
| 4.1.2  | Name, Role, Value         | A     | PARTIAL |
| 4.1.3  | Status Messages           | AA    | PASS    |

### Appendix D: Technology Dependencies

| Package                  | Version | Purpose                                |
| ------------------------ | ------- | -------------------------------------- |
| react                    | 18.3.1  | UI framework                           |
| typescript               | 5.8.3   | Type safety                            |
| tailwindcss              | 3.4.17  | Utility-first CSS                      |
| @radix-ui/\*             | Various | Accessible UI primitives (27 packages) |
| react-hook-form          | 7.61.1  | Form state management                  |
| zod                      | 3.25.76 | Schema validation                      |
| @tanstack/react-query    | 5.83.0  | Data fetching/caching                  |
| recharts                 | 2.x     | Data visualization                     |
| @dnd-kit/\*              | Various | Drag and drop                          |
| lucide-react             | Latest  | Icon library                           |
| sonner                   | Latest  | Toast notifications                    |
| cmdk                     | Latest  | Command palette                        |
| embla-carousel-react     | Latest  | Carousel                               |
| react-day-picker         | Latest  | Date picker                            |
| date-fns                 | Latest  | Date utilities                         |
| class-variance-authority | Latest  | Component variant management           |
| tailwindcss-animate      | Latest  | CSS animations                         |
| @sentry/react            | 10.32.1 | Error tracking                         |
| posthog-js               | 1.313.0 | Product analytics                      |
| i18next                  | Latest  | Internationalization                   |
| vite                     | 5.4.19  | Build tool                             |
| vitest                   | 4.0.16  | Unit testing                           |
| @playwright/test         | 1.57.0  | E2E testing                            |
| @storybook/\*            | 8.6.15  | Component documentation                |

***

***

## Appendix E: Codebase Verification & Corrections (v2.0)

> **Added:** 2026-02-17 | **Method:** Automated codebase analysis (Grep, Glob, file inspection) against every claim in v1.0

### E.1 Audit Accuracy Summary

| Category | Claims Verified | Accurate | Corrected | New Findings |
| --- | --- | --- | --- | --- |
| Component Library | 12 | 10 | 2 | 5 |
| Accessibility | 18 | 14 | 4 | 3 |
| Performance | 9 | 7 | 2 | 4 |
| Navigation & IA | 6 | 4 | 2 | 2 |
| Data Management | 5 | 3 | 0 | 6 |
| **Total** | **50** | **38 (76%)** | **10 (20%)** | **20** |

### E.2 Critical Corrections

#### CORRECTION 1: Error Boundaries EXIST (was: "No error boundaries — S0 Critical")

**Original claim (Section 8.5):** "No `<ErrorBoundary>` component wrapping any route or feature module"

**Actual finding:** **3 ErrorBoundary implementations exist:**

| # | File | Scope | Lines |
| --- | --- | --- | --- |
| 1 | `src/components/GlobalErrorBoundary.tsx` | App-wide wrapper in `main.tsx` | Global |
| 2 | `src/components/sales/quote-form/QuoteErrorBoundary.tsx` | Quote form isolation | Feature |
| 3 | `src/components/sales/composer/ErrorBoundary.tsx` | Quote composer isolation | Feature |

**Severity adjustment:** S0 → **S2** (coverage exists but incomplete — not all routes/features wrapped)

**Remaining gap:** ErrorBoundary not applied to: email client, dashboard widgets, data tables, logistics modules, admin pages

#### CORRECTION 2: Breadcrumbs Used in 8 Pages (was: "only 1-2 pages")

**Original claim (Section 4.3, Appendix A #1):** "Breadcrumbs only on 1-2 pages"

**Actual finding:** Breadcrumb component used in **8 pages:**

1. `src/pages/dashboard/QuoteNew.tsx`
2. `src/pages/dashboard/Quotes.tsx`
3. `src/pages/dashboard/QuoteDetail.tsx`
4. `src/pages/dashboard/QuoteBookingMapper.tsx`
5. `src/pages/dashboard/RolesPermissions.tsx`
6. `src/pages/dashboard/FranchiseDetail.tsx`
7. `src/components/hts/VisualHTSBrowser.tsx`
8. `src/components/system/FirstScreenTemplate.tsx`

**Severity adjustment:** S2 → **S3** (partial — still missing from ~140 routes but foundation exists)

#### CORRECTION 3: NotificationCenter EXISTS (was: listed as "New Component #60")

**Original claim (Section 15.2):** NotificationCenter listed as new component to build

**Actual finding:** Already implemented at `src/components/crm/NotificationCenter.tsx` with:
- Storybook story at `src/stories/crm/NotificationCenter.stories.tsx`
- Documentation at `src/stories/crm/NotificationCenter.mdx`
- Integration in `src/components/email/EmailSidebar.tsx`

**Action:** Remove from "New Components" list. Enhance existing implementation instead.

#### CORRECTION 4: Keyboard Shortcuts Component EXISTS (was: "Expand to 20+")

**Original claim (Section 14.2, Phase 4):** "Expand keyboard shortcuts to 20+"

**Actual finding:** `src/components/ui/keyboard-shortcuts.tsx` already exists with:
- `?` shortcut for help modal
- Cmd+K for global search
- Cmd+B for sidebar toggle
- Integration in sidebar, global-search, inline-edit, editable-text, carousel, kanban

**Remaining gap:** Only ~6 shortcuts implemented. Still need 14+ more for enterprise parity.

### E.3 Verified Claims (Confirmed Accurate)

| # | Claim | Section | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1 | No skip-to-content link | 8.5 | **CONFIRMED** | 0 matches for skip-to-content, skipToContent, skip.*main |
| 2 | No onboarding wizard | 14.2 | **CONFIRMED** | Only vendor "onboarding" status field (not user onboarding flow) |
| 3 | No systematic undo/redo | 8.5 | **CONFIRMED** | 24 files reference "undo" but only as toast dismiss actions |
| 4 | 3 form patterns coexist | 5.2 | **CONFIRMED** | RHF+Zod, controlled useState, Zustand store (quote) |
| 5 | Quotes lack server pagination | 7.3 | **CONFIRMED** | Client-side only with 1000-record limit |
| 6 | No debounce on global search | 11.3 | **CONFIRMED** | `useDebounce` hook exists but not wired to global-search |
| 7 | 65+ UI components | 3.1 | **CONFIRMED** | Actually **69 files** in `src/components/ui/` |
| 8 | 148 lazy-loaded routes | 4.1 | **CONFIRMED** | 126 `lazy()` imports in `App.tsx` (close, not exact) |
| 9 | Drawer component unused | 3.2 | **CONFIRMED** | `drawer.tsx` exists in ui/ but 0 imports elsewhere |
| 10 | Filter persistence varies | 7.3 | **CONFIRMED** | Only `useLeadsViewState.tsx` persists, others don't |

### E.4 New Findings Not in Original Audit

#### NF-1: Dual Toast System (Redundancy)

Two notification systems coexist:
- **Sonner** (`src/components/ui/sonner.tsx`) — modern toast
- **shadcn Toast** (`src/hooks/use-toast.ts` + `src/components/ui/toast.tsx`) — reducer-based

Both are imported across the codebase. Should consolidate to Sonner (simpler, better animations).

#### NF-2: Real-Time Subscriptions (Strength Not Documented)

**13 files** use Supabase real-time channels (`supabase.channel` / `postgres_changes`):
- Quote updates, lead pipeline changes, email sync
- System logs, data flow monitoring, assignment queues
- Booking updates, activity timelines

This is a **competitive advantage** not highlighted in the audit.

#### NF-3: React Query Coverage (Moderate)

- **93 useQuery/useMutation** instances across **24 files**
- **29 invalidateQueries** calls across **12 files**
- Missing: optimistic updates (0 `onMutate` patterns found)
- Missing: query prefetching for anticipated navigation

#### NF-4: CSV/Excel Import/Export (Strength)

- **20+ files** with CSV/Excel handling
- `DataImportExport.tsx` — full import/export system
- `csvExport.ts` — utility for exports
- `import-processor.ts` — import parsing
- `DatabaseExport.tsx` — full DB export capability

#### NF-5: Web Worker for Export

`src/workers/export.worker.ts` exists for background ZIP generation. Only 1 worker — should expand for PDF generation, large data processing.

#### NF-6: AdvancedFilter Component EXISTS

`src/components/crm/AdvancedFilter.tsx` already exists (with Storybook story). The audit lists it as new component #52 to build.

**Action:** Remove from "New Components" list. Evaluate and enhance existing implementation.

### E.5 Updated Component Inventory

**Actual UI component count:** 69 (in `src/components/ui/`)

Components NOT in original audit but present:
| # | Component | File |
| --- | --- | --- |
| 1 | AppLauncher | `app-launcher.tsx` |
| 2 | AspectRatio | `aspect-ratio.tsx` |
| 3 | ContextMenu | `context-menu.tsx` |
| 4 | EnvironmentIndicator | `environment-indicator.tsx` |
| 5 | InputOTP | `input-otp.tsx` |
| 6 | Menubar | `menubar.tsx` |
| 7 | NavigationMenu | `navigation-menu.tsx` |
| 8 | RecentlyViewed | `recently-viewed.tsx` |
| 9 | RowActions | `row-actions.tsx` |
| 10 | Slider | `slider.tsx` |
| 11 | SplitView | `split-view.tsx` |
| 12 | StatusPill | `status-pill.tsx` |
| 13 | TitleStrip | `title-strip.tsx` |
| 14 | Tooltip | `tooltip.tsx` |
| 15 | Collapsible | `collapsible.tsx` |
| 16 | FileUpload | `file-upload.tsx` |
| 17 | DateRangePicker | `date-range-picker.tsx` |

**Revised total: 69 base + 20 system/feature components = ~89 reusable components**

### E.6 Updated Severity Matrix

Based on verification, here is the corrected severity matrix:

| Issue | Original Severity | Corrected Severity | Rationale |
| --- | --- | --- | --- |
| No ErrorBoundary | S0 (Critical) | **S2** (Moderate) | 3 exist, but not comprehensive |
| No skip-to-content | S0 (Critical) | **S0** (Critical) | Confirmed missing |
| 3 form patterns | S1 (High) | **S1** (High) | Confirmed |
| No undo | S1 (High) | **S1** (High) | Confirmed (toast-level only) |
| Breadcrumbs sparse | S2 (Medium) | **S3** (Low) | 8 pages, not 1-2 |
| Dual toast system | Not in v1.0 | **S2** (Medium) | NEW — redundancy risk |
| No React.memo | Not in v1.0 | **S2** (Medium) | NEW — 0 instances in 379 TSX files |
| Virtual scrolling stub | Not in v1.0 | **S1** (High) | NEW — react-window installed but unused |
| No optimistic updates | Not in v1.0 | **S2** (Medium) | NEW — all mutations wait for server |

***

## Appendix F: Enterprise-Grade Enhancement Gap Analysis (v2.0)

> **Purpose:** Identify every gap between current state and world-class enterprise CRM standards (Salesforce, HubSpot, SAP, Oracle benchmarks)

### F.1 Enterprise Readiness Scorecard

| Domain | Current Score | Enterprise Target | Gap | Priority |
| --- | --- | --- | --- | --- |
| **Component Library** | 90% | 98% | 8% | P2 |
| **Accessibility (WCAG)** | 70% | 95% | 25% | **P0** |
| **Performance** | 75% | 95% | 20% | **P1** |
| **Navigation & IA** | 85% | 95% | 10% | P2 |
| **Forms & Data Entry** | 75% | 95% | 20% | **P1** |
| **Data Management** | 70% | 90% | 20% | **P1** |
| **Real-Time Capabilities** | 80% | 95% | 15% | P2 |
| **Mobile Experience** | 60% | 90% | 30% | **P0** |
| **Internationalization** | 85% | 98% | 13% | P2 |
| **Error Handling** | 65% | 95% | 30% | **P0** |
| **Security UX** | 80% | 98% | 18% | P1 |
| **Testing Coverage** | 55% | 90% | 35% | **P0** |
| **Overall UX Maturity** | **74%** | **95%** | **21%** | — |

### F.2 Critical Enhancements (P0 — Must Fix)

#### F.2.1 Accessibility Compliance (Gap: 25%)

| # | Enhancement | Current State | Enterprise Standard | Effort | Impact |
| --- | --- | --- | --- | --- | --- |
| A1 | Skip-to-content link | Missing | Required for WCAG 2.4.1 | 0.5 day | High |
| A2 | Semantic HTML landmarks | `<div>` everywhere | `<main>`, `<nav>`, `<section>`, `<article>` | 3 days | High |
| A3 | ARIA live regions | 0 instances | Required for dynamic content | 3 days | High |
| A4 | Focus management (modals) | No focus trap/restore | Required for WCAG 2.1.2 | 3 days | High |
| A5 | Alt text on images | 75% missing | 100% required | 1 day | Medium |
| A6 | Icon-only button labels | Missing aria-labels | Required for WCAG 4.1.2 | 2 days | High |
| A7 | Chart accessibility | No aria-labels on charts | Required for screen readers | 2 days | Medium |
| A8 | Color-only status indicators | Status badges color-only | Must include text/icon | 2 days | Medium |
| A9 | prefers-reduced-motion | Not implemented | Required for vestibular sensitivity | 1 day | Medium |
| A10 | axe-core CI integration | Not in CI pipeline | Zero violations on every PR | 2 days | High |

**Total effort: ~19.5 days | Success metric: WCAG 2.1 AA score ≥ 95%**

#### F.2.2 Mobile Experience (Gap: 30%)

| # | Enhancement | Current State | Enterprise Standard | Effort | Impact |
| --- | --- | --- | --- | --- | --- |
| M1 | Responsive data tables | Horizontal scroll only | Card view on mobile | 5 days | High |
| M2 | Touch targets 44px minimum | Mixed sizes (some < 32px) | 44px per WCAG 2.5.5 | 3 days | High |
| M3 | Mobile navigation drawer | Desktop sidebar only | Slide-out mobile drawer | 3 days | High |
| M4 | Offline-first capabilities | No offline support | Service Worker + IndexedDB | 8 days | Medium |
| M5 | PWA manifest | Not implemented | Add-to-home-screen capable | 1 day | Medium |
| M6 | Mobile form optimization | Desktop-sized forms | Stacked fields, larger inputs | 3 days | High |
| M7 | Swipe gestures | Not implemented | Swipe to delete/archive | 3 days | Low |

**Total effort: ~26 days | Success metric: Mobile usability score ≥ 85 (Lighthouse)**

#### F.2.3 Error Handling & Resilience (Gap: 30%)

| # | Enhancement | Current State | Enterprise Standard | Effort | Impact |
| --- | --- | --- | --- | --- | --- |
| E1 | Route-level ErrorBoundary | Only 3 feature boundaries | Every route group wrapped | 2 days | High |
| E2 | Graceful degradation | Hard errors on failure | Fallback UI per component | 3 days | High |
| E3 | Retry logic | Only QuotesPipeline | All data fetches with retry | 2 days | High |
| E4 | Offline error messaging | Generic error messages | "You're offline" indicators | 1 day | Medium |
| E5 | Error telemetry | Sentry installed | Structured error context | 2 days | High |
| E6 | Stale data indicators | No staleness indicators | "Data from 5 min ago" badges | 1 day | Medium |

**Total effort: ~11 days | Success metric: Zero unhandled errors in production**

#### F.2.4 Testing Coverage (Gap: 35%)

| # | Enhancement | Current State | Enterprise Standard | Effort | Impact |
| --- | --- | --- | --- | --- | --- |
| T1 | Component unit tests | ~85 test files, 293 passing | ≥80% coverage on UI components | 10 days | High |
| T2 | Accessibility tests (jest-axe) | Not implemented | Every component tested | 5 days | High |
| T3 | Visual regression (Chromatic) | Storybook exists, no CI snapshots | Automated visual diff on PRs | 3 days | High |
| T4 | E2E critical paths | 1 e2e test | ≥20 covering all critical journeys | 10 days | High |
| T5 | Performance budget CI | No performance CI | Lighthouse CI on every PR | 2 days | Medium |
| T6 | Integration tests | Minimal | API integration tests | 5 days | Medium |

**Total effort: ~35 days | Success metric: ≥80% code coverage, zero visual regressions**

### F.3 High-Priority Enhancements (P1 — Should Fix)

#### F.3.1 Performance Optimization (Gap: 20%)

| # | Enhancement | Current State | Enterprise Standard | Effort | Impact |
| --- | --- | --- | --- | --- | --- |
| P1 | Virtual scrolling for lists | react-window installed, unused | All lists > 50 items virtualized | 3 days | High |
| P2 | React.memo on heavy components | 0 memoized components | Key render-heavy components wrapped | 2 days | High |
| P3 | Optimistic mutations | 0 optimistic updates | All CRUD operations optimistic | 5 days | High |
| P4 | Query prefetching | No prefetching | Prefetch on hover/focus | 2 days | Medium |
| P5 | Image lazy loading | 0 lazy-loaded images | All below-fold images lazy | 0.5 day | Low |
| P6 | Web Workers for heavy ops | 1 worker (ZIP only) | PDF gen, CSV parse, data transform | 5 days | Medium |
| P7 | Bundle size reduction | ~600KB initial | < 400KB initial | 3 days | Medium |
| P8 | Server-side pagination | Only client pagination | All tables > 100 rows server-paginated | 5 days | High |

**Total effort: ~25.5 days | Success metric: LCP < 2.0s, TTI < 2.5s, FCP < 1.2s**

#### F.3.2 Form Unification (Gap: 20%)

| # | Enhancement | Current State | Enterprise Standard | Effort | Impact |
| --- | --- | --- | --- | --- | --- |
| FU1 | Unified form pattern | 3 patterns coexist | Single pattern: RHF+Zod | 8 days | High |
| FU2 | Form autosave/draft | Not implemented | Auto-save every 30s, draft recovery | 3 days | High |
| FU3 | Multi-step form framework | Custom per wizard | Shared `useWizard` hook | 3 days | Medium |
| FU4 | Inline validation | Inconsistent | All fields validate on blur | 2 days | Medium |
| FU5 | Form analytics | Not tracked | Track abandonment, time-per-field | 2 days | Low |

**Total effort: ~18 days | Success metric: Single form pattern, < 5% form abandonment**

#### F.3.3 Data Management (Gap: 20%)

| # | Enhancement | Current State | Enterprise Standard | Effort | Impact |
| --- | --- | --- | --- | --- | --- |
| D1 | Optimistic cache updates | 0 implementations | All mutations use onMutate | 5 days | High |
| D2 | Query deduplication | Not configured | Shared queryClient config | 1 day | Medium |
| D3 | Stale-while-revalidate | Default only | Fine-tuned staleTime per entity | 2 days | Medium |
| D4 | Infinite scroll option | Not available | Alternative to pagination | 3 days | Low |
| D5 | Bulk operations | Limited | Select all, bulk delete/update/export | 5 days | High |
| D6 | Filter persistence | Only leads page | All list pages persist filters | 3 days | Medium |

**Total effort: ~19 days | Success metric: < 200ms perceived latency on mutations**

### F.4 Medium-Priority Enhancements (P2 — Nice to Have)

#### F.4.1 Navigation & Information Architecture

| # | Enhancement | Effort | Impact |
| --- | --- | --- | --- |
| N1 | Collapsible sidebar groups (reduce 60+ → 12 top-level) | 3 days | High |
| N2 | Command palette enhancements (recent items, entity search) | 3 days | Medium |
| N3 | Recently viewed entities sidebar | EXISTS (`recently-viewed.tsx`), needs data wiring | 2 days | Medium |
| N4 | Breadcrumb standardization (8 → all detail/create pages) | 3 days | Medium |
| N5 | Deep link support (share-friendly URLs with filter state) | 2 days | Medium |

#### F.4.2 Real-Time & Collaboration

| # | Enhancement | Effort | Impact |
| --- | --- | --- | --- |
| R1 | Presence indicators (who's viewing this record) | 3 days | Medium |
| R2 | Live notifications in header (leverage existing NotificationCenter) | 2 days | High |
| R3 | Collaborative editing indicators | 5 days | Low |
| R4 | Activity feed with real-time updates | 2 days | Medium |

#### F.4.3 Advanced UX Features

| # | Enhancement | Effort | Impact |
| --- | --- | --- | --- |
| U1 | Undo/redo with soft delete + Recycle Bin | 10 days | High |
| U2 | Onboarding wizard for new tenants | 5 days | High |
| U3 | Contextual help tooltips on complex fields | 3 days | Medium |
| U4 | Expand keyboard shortcuts to 20+ | 5 days | Medium |
| U5 | Dark mode audit (verify contrast in all themes) | 3 days | Medium |
| U6 | Form autosave indicator component | 1 day | Low |
| U7 | Dashboard date range filter | 2 days | Medium |
| U8 | Chart export (PNG/PDF) | 3 days | Low |

### F.5 Resource Requirements Summary

| Phase | Duration | Effort (Person-Days) | Team Size | Prerequisites |
| --- | --- | --- | --- | --- |
| **P0: Critical Fixes** | Weeks 1-4 | 91.5 days | 3 engineers | None |
| **P1: Performance & Forms** | Weeks 5-10 | 62.5 days | 2 engineers | P0 complete |
| **P2: Navigation & UX** | Weeks 11-16 | 48 days | 2 engineers | P1 complete |
| **P3: Advanced Features** | Weeks 17-22 | 32 days | 1-2 engineers | P2 complete |
| **Total** | ~22 weeks | **234 person-days** | — | — |

***

## Appendix G: Competitive Advantage Roadmap & QA Criteria (v2.0)

### G.1 Competitive Gap Analysis (Updated)

Based on codebase verification, here is the updated competitive positioning:

| Capability | Logic Nexus (Actual) | Salesforce | HubSpot | SAP CX | Oracle CX | Gap to Leader |
| --- | --- | --- | --- | --- | --- | --- |
| Component Library | 89 components | 200+ | 100+ | 150+ | 120+ | Moderate |
| Accessibility | 70% WCAG | 95%+ | 92%+ | 90%+ | 88%+ | **Critical** |
| Mobile Experience | 60% | 95% | 98% | 85% | 80% | **Critical** |
| Real-Time Updates | 13 live channels | Full | Full | Full | Partial | Moderate |
| Offline Support | None | Full | Partial | Full | Partial | **Critical** |
| Testing Coverage | ~55% | 95%+ | 90%+ | 95%+ | 90%+ | **Critical** |
| Form Autosave | None | Yes | Yes | Yes | Yes | **High** |
| Virtual Scrolling | Stub only | Yes | Yes | Yes | Yes | **High** |
| Error Recovery | Partial | Full | Full | Full | Partial | High |
| i18n | Extensive | Full | Full | Full | Full | Low |
| Keyboard Shortcuts | 6 | 30+ | 20+ | 15+ | 10+ | Moderate |
| Import/Export | CSV/Excel/DB | Full | Full | Full | Full | Low |
| Analytics Integration | PostHog | Einstein | HubSpot AI | SAP Analytics | Oracle BI | Moderate |
| Design System | 40+ tokens, 35 presets | Lightning | Canvas | Fiori | Redwood | Low |

### G.2 Unique Competitive Advantages (Existing Strengths)

These strengths should be **preserved and amplified**:

1. **Multi-tenancy with franchise hierarchy** — 3-tier (Platform > Tenant > Franchise) is more flexible than competitor flat models
2. **13 real-time subscription channels** — Already exceeds some competitors
3. **35 theme presets** with HSL token system — Best-in-class customization
4. **Route-level code splitting** — 126 lazy-loaded routes (enterprise-grade)
5. **Dual-layer security** — RLS + app-level ScopedDataAccess (defense-in-depth)
6. **Full DB export** with background worker — Unique differentiator
7. **Multi-modal quote composer** — 4-step wizard with event sourcing
8. **CSV/Excel import with validation** — Robust data pipeline

### G.3 Differentiator Roadmap (Features That Put Logic Nexus Ahead)

| Quarter | Differentiator | Why It Matters | Effort |
| --- | --- | --- | --- |
| Q1 2026 | AI-powered quote suggestions | Auto-fill based on historical data; competitors charge premium | 15 days |
| Q1 2026 | Franchise-aware dashboards | Per-franchise KPIs not available in flat-model CRMs | 8 days |
| Q2 2026 | Offline-first mobile PWA | Field sales reps in areas with poor connectivity | 12 days |
| Q2 2026 | Real-time collaborative editing | Multiple users on same quote simultaneously | 10 days |
| Q3 2026 | Natural language search | "Show me all quotes above $50K from last month" | 12 days |
| Q3 2026 | Automated compliance checks | One-click restricted party screening during quoting | 8 days |
| Q4 2026 | White-label portal for customers | Customer-facing quote portal with tenant branding | 15 days |

### G.4 Quality Assurance Criteria

#### G.4.1 Definition of Done (Per Enhancement)

Every enhancement must meet ALL criteria before merge:

| # | Criterion | Measurement | Required |
| --- | --- | --- | --- |
| 1 | Unit tests | ≥80% line coverage for changed files | Yes |
| 2 | Accessibility test | jest-axe passes with 0 violations | Yes |
| 3 | Visual regression | Chromatic snapshot approved | Yes |
| 4 | TypeScript strict | Zero `any` types, no `@ts-ignore` | Yes |
| 5 | Bundle impact | < 5KB increase per feature (gzipped) | Yes |
| 6 | Performance | No Lighthouse regression > 2 points | Yes |
| 7 | Mobile verified | Tested on iPhone SE (375px) and iPad (768px) | Yes |
| 8 | Keyboard navigable | Full task completion via keyboard only | Yes |
| 9 | Screen reader tested | VoiceOver task completion verified | For P0 items |
| 10 | Documentation | Storybook story with all variants | For new components |

#### G.4.2 Automated Quality Gates (CI/CD)

| Gate | Tool | Threshold | When |
| --- | --- | --- | --- |
| Type checking | `tsc --noEmit` | 0 errors | Every PR |
| Lint | ESLint + eslint-plugin-jsx-a11y | 0 warnings | Every PR |
| Unit tests | Vitest | 100% pass, ≥80% coverage | Every PR |
| Accessibility | axe-core (jest-axe) | 0 critical/serious violations | Every PR |
| Visual regression | Chromatic | 0 unreviewed changes | Every PR |
| Bundle size | bundlesize | < 500KB initial JS | Every PR |
| Lighthouse | Lighthouse CI | Performance ≥ 85, a11y ≥ 95 | Nightly |
| E2E | Playwright | 100% pass on critical paths | Nightly |
| Dependency audit | `npm audit` | 0 high/critical vulnerabilities | Weekly |

#### G.4.3 Performance Budgets

| Metric | Current (Estimated) | Phase 1 Target | Phase 2 Target | Enterprise Target |
| --- | --- | --- | --- | --- |
| FCP | ~2.0s | < 1.8s | < 1.5s | < 1.2s |
| LCP | ~3.0s | < 2.8s | < 2.5s | < 2.0s |
| TTI | ~3.5s | < 3.2s | < 3.0s | < 2.5s |
| CLS | ~0.05 | < 0.05 | < 0.03 | < 0.01 |
| Initial JS | ~600KB | < 550KB | < 500KB | < 400KB |
| Route transition | ~500ms | < 400ms | < 300ms | < 200ms |

#### G.4.4 Accessibility Compliance Targets

| Phase | axe-core Critical | axe-core Serious | WCAG AA Score | Keyboard Navigation |
| --- | --- | --- | --- | --- |
| Phase 0 (Week 4) | 0 | ≤ 3 | ≥ 80% | Core workflows |
| Phase 1 (Week 10) | 0 | 0 | ≥ 85% | All CRUD operations |
| Phase 2 (Week 16) | 0 | 0 | ≥ 90% | All features |
| GA (Week 22) | 0 | 0 | ≥ 95% | 100% of features |

### G.5 Monitoring & Measurement Plan

| Metric | Tool | Frequency | Owner |
| --- | --- | --- | --- |
| Task completion rate | PostHog funnel analysis | Weekly | UX Lead |
| System Usability Scale (SUS) | In-app survey (Typeform) | Monthly | Product |
| WCAG compliance score | axe-core automated | Every PR | Engineering |
| Lighthouse performance | Lighthouse CI | Nightly | Engineering |
| Error rate (unhandled) | Sentry dashboard | Real-time | Engineering |
| Feature adoption | PostHog event tracking | Weekly | Product |
| Mobile usage % | PostHog device analytics | Weekly | Product |
| Support ticket volume | Help desk metrics | Weekly | Support |
| Customer satisfaction (CSAT) | Post-interaction survey | Continuous | Product |
| Time to first value | PostHog session recordings | Monthly | UX Lead |

### G.6 Risk Register

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| P0 accessibility fixes break existing UI | Medium | High | Visual regression tests before/after |
| Form unification causes data loss | Low | Critical | Feature flags, gradual rollout, draft preservation |
| Bundle size increases with new features | High | Medium | Bundle budgets in CI, tree-shaking audit |
| Mobile redesign delays desktop features | Medium | Medium | Parallel tracks with separate teams |
| Test coverage slows development velocity | Medium | Low | Invest in test infrastructure upfront, then amortize |
| React 19 upgrade required mid-project | Low | High | Decouple from React version, use stable APIs only |

***

*End of Document*

*Document ID: NEXUS-UIUX-2026-001 | Version 2.0 | Classification: Internal — Strategic*
