# Design System for Enterprise Platform

## Principles
- Clean, sharp, intuitive UI
- Consistent patterns across modules
- Accessible by default (WCAG 2.1 AA)
- Responsive from mobile to desktop

## Visual Consistency
- Color palettes with usage rules:
  - Primary #2563eb for main actions and highlights
  - Secondary #64748b for secondary actions and subdued elements
  - Accent #10b981 for success and positive emphasis
  - Danger #ef4444 for destructive actions and errors
  - Warning #f59e0b for cautionary messages
  - Success #22c55e for confirmations
  - Info #0ea5e9 for informational notices
  - Foreground and muted-foreground for text hierarchy
- Typography hierarchy:
  - H1 (3rem/700), H2 (2.25rem/700), H3 (1.5rem/600)
  - Body (1rem/400) and Small (0.875rem/400)
  - Inter as base font
- Spacing and layout:
  - 8px baseline grid: xs 4, sm 8, md 16, lg 24, xl 32
  - Grid gutters: 16px on desktop, 8px on mobile
- Iconography standards:
  - Sizes: 14, 16, 20, 24, 32
  - Use consistent sizes per context (16 for inline, 24 for buttons)

## Layouts
- First-screen template with title, description, breadcrumbs, actions, and view toggle (Card, Grid, List)
- Card layout patterns:
  - Consistent padding (16px) and margins with elevation on hover
  - Adaptive content blocks for title, subtitle, meta, tags
  - Grid system with responsive columns (1/2/3) and 16px gutters
- CRUD form layout with standardized header and bottom-right actions

## Components
- FirstScreenTemplate: Standardized first page header and actions
- EntityCard: Responsive card with visual hierarchy and tags
- CrudFormLayout: Consistent forms with Save/Cancel placement
- FormSection: Logical field grouping with titles and descriptions
- FormStepper: Multi-step navigation with Back/Next actions
- FileOperationModal: Reusable import/export modal with progress, errors, templates
- EmptyState: Unified empty-state visuals and actions
- Breadcrumbs: Standardized navigation trail

## Interaction Patterns
- Hover, focus, active states match button variants
- Loading indicators via Progress and spinners
- Empty states and skeletons for loading feedback
- Notifications via Toaster; alerts follow info/success/warning/error hierarchy

## Import/Export
- Modal initiation with supported file types and template download
- Progress indicator with percentage
- Uniform error reporting with actionable steps
- Batch operations supported
- Supported file indicators and templates per module

## Accessibility
- WCAG 2.1 AA baseline
- Keyboard navigation: All interactive components operable via keyboard
- Screen reader support via roles and ARIA where applicable
- Focus rings and visible states for interactive elements
- Color contrast guidelines for buttons, links, text

## Usage Guidelines
- Use FirstScreenTemplate for list/index pages with Card/Grid/List modes
- Use EntityCard for card-based entity previews
- Use CrudFormLayout with FormSection and FormStepper for complex forms
- Use FileOperationModal for all file operations
- Use Breadcrumbs to reflect module navigation paths

## Reference Implementations
- Franchises list uses FirstScreenTemplate with Card/Grid/List views
- Franchise detail uses breadcrumbs and export pattern

## QA and Testing
- Cross-browser testing matrix: Chromium, Firefox, WebKit
- Device responsiveness: Mobile, tablet, desktop breakpoints
- User flow validation: Import/Export, Create/Edit, Navigation
- Visual regression: Playwright screenshots for key pages
- Accessibility checks: Keyboard navigation, focus order, ARIA
- Performance benchmarks: FPS on heavy lists, lazy-loading guidelines

## Implementation Standards
- Component composition: Prefer small, reusable pieces (layout + content)
- Theming: Use design tokens; theme overrides via Tailwind or CSS variables
- State patterns: Local state for UI, React Query for data
- CSS: Utility-first (Tailwind) with optional CSS modules for complex overrides
- Storybook: Primary source for component documentation and development

## Storybook Guide
- **Run Development Server**: `npm run storybook`
- **Build Static Documentation**: `npm run build-storybook`
- **Testing**: `npm run test:storybook` (runs accessibility and interaction tests)
- **Writing Stories**:
  - Create `Component.stories.tsx` alongside component file
  - Use CSF 3.0 format
  - Include `Default` and specific use-case variants
  - Document props with JSDoc in component interface

## Versioning and Contributions
- Document changes with semantic versioning for the design system
- Contribution standards: PR checklist includes accessibility, responsiveness, tests
