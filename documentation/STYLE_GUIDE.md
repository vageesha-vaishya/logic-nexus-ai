# Design System & Style Guide

## 1. Design Principles
*   **Clarity**: Information comes first. Use whitespace to separate concerns.
*   **Efficiency**: Actions should be one click away.
*   **Feedback**: Every action has a reaction (visual or auditory).
*   **Consistency**: Reuse components and patterns.

## 2. Color Palette (Tailwind / Shadcn)
*   **Primary**: `bg-primary` (Deep Blue/Indigo) - Actions, Active States.
*   **Secondary**: `bg-secondary` (Slate/Gray) - Backgrounds, Borders.
*   **Success**: `text-green-600` / `bg-green-100` - Won Deals, Completed Shipments.
*   **Warning**: `text-amber-600` / `bg-amber-100` - Stalled Deals, Late Shipments.
*   **Destructive**: `text-red-600` / `bg-red-100` - Lost Deals, Errors.

## 3. Typography
*   **Font Family**: Inter (sans-serif) - Standard for high readability.
*   **Headings**:
    *   H1: `text-3xl font-bold tracking-tight`
    *   H2: `text-2xl font-semibold tracking-tight`
    *   H3: `text-xl font-semibold`
*   **Body**: `text-sm` or `text-base` (default).
*   **Labels**: `text-xs font-medium text-muted-foreground uppercase tracking-wider`.

## 4. Component: Kanban Card
*   **Container**: `bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow rounded-lg border`.
*   **Padding**: `p-4`.
*   **Gap**: `space-y-3`.

## 5. Animation Guidelines (Framer Motion)
*   **Duration**: 0.2s - 0.3s (Snappy).
*   **Easing**: `ease-out` (Natural).
*   **Drag**: Scale up (1.05) and add shadow (`shadow-xl`) on lift.

## 6. Accessibility Checklist
*   [ ] All interactive elements have `aria-label` or visible text.
*   [ ] Color is not the only conveyor of information (use icons/text too).
*   [ ] Focus states are visible (`ring-2 ring-ring`).
