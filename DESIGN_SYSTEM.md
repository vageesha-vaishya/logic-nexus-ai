# Logic Nexus Design System

This document outlines the visual design language, component hierarchy, and implementation standards for the Logic Nexus-AI platform.

## 1. Design Philosophy
The "Enterprise" design system mimics high-density, data-rich ERP interfaces (inspired by modern enterprise tools) to maximize information density while maintaining readability.

**Core Principles:**
- **Information Density**: Use screen real estate efficiently.
- **Contextual Actions**: Actions should be close to the data they affect.
- **Split Views**: Use split panels (Sheet vs. Activity) for complex entities.

## 2. Color Palette

### Base Colors
- **Background**: `#f9fafb` (Light Gray) for the main canvas.
- **Surface**: `#ffffff` (White) for cards, sheets, and input backgrounds.
- **Primary**: Inherited from Tailwind `primary` (typically a deep blue or brand color).
- **Text**: 
  - Primary: `gray-900`
  - Secondary: `muted-foreground`

### Semantic Colors
- **Status Badges**:
  - Success: `bg-green-100 text-green-800`
  - Warning: `bg-yellow-100 text-yellow-800`
  - Error: `bg-red-100 text-red-800`
  - Neutral: `bg-gray-100 text-gray-800`

## 3. Typography
- **Font Family**: Inter (default sans).
- **Headings**:
  - H1 (Page Title): `text-3xl font-bold`
  - H2 (Section Title): `text-lg font-semibold`
  - H3 (Card Title): `text-sm font-semibold uppercase tracking-wider`
- **Body**: `text-sm` is the standard size for all form inputs and labels.

## 4. Component Library (`src/components/ui/enterprise`)

### `EnterpriseFormLayout`
The main wrapper for detail pages.
- **Props**: `title`, `breadcrumbs`, `actions`, `status`.
- **Layout**: Fixed header with breadcrumbs/actions, scrollable body.

### `EnterpriseSheet`
The central "paper" element containing the record's data.
- **Style**: White background, `rounded-lg`, `shadow-sm`, `border`.
- **Structure**:
  - **Header**: Logo, Title, Key Metadata, Smart Buttons.
  - **Notebook (Tabs)**: Navigation for sub-sections.

### `EnterpriseField`
Standardized key-value display.
- **Layout**: Label (top/left) and Value (bottom/right).
- **Style**: `text-sm`, label in `muted-foreground`.

### `EnterpriseStatButton` (Smart Button)
Quick access stats in the header.
- **Style**: Boxed button with icon and count.
- **Interaction**: Navigates to related list views.

### `EnterpriseActivityFeed`
Right-hand sidebar for history and communication.
- **Features**: Log notes, send messages, view audit trail.
- **Style**: Gray background (`bg-muted/10`), border-left.

## 5. Spacing & Layout
- **Page Padding**: `p-4` or `p-6` depending on viewport.
- **Gap**: Standard gap is `gap-6` (1.5rem).
- **Grid**: Use `grid-cols-1 md:grid-cols-2` for form fields.

## 6. Implementation Guide

To migrate a module to this system:

1.  **Import Components**:
    ```typescript
    import { EnterpriseFormLayout } from '@/components/ui/enterprise/EnterpriseFormLayout';
    import { EnterpriseSheet, EnterpriseField } from '@/components/ui/enterprise/EnterpriseComponents';
    ```

2.  **Structure**:
    ```tsx
    <EnterpriseFormLayout title="...">
      <EnterpriseSheet header={...}>
        <EnterpriseNotebook>
           <EnterpriseTab label="Tab 1">...</EnterpriseTab>
        </EnterpriseNotebook>
      </EnterpriseSheet>
      <EnterpriseActivityFeed />
    </EnterpriseFormLayout>
    ```

3.  **Data Binding**: Ensure `ScopedDataAccess` is used for all data fetching.

## 7. Responsiveness
- **Desktop (xl)**: Sheet (Left) + Activity Feed (Right).
- **Tablet/Mobile (<xl)**: Activity Feed hides or stacks (currently hidden on mobile, need to implement stacking if required).
