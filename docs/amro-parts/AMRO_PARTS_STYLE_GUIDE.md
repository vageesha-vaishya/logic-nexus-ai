# AMRO Parts Style Guide

## Design Tokens
Primary source: `src/index.css`

### Color Tokens
- `--primary`, `--secondary`, `--accent`, `--muted`, `--destructive`
- Semantic utility:
  - success: `--success`
  - warning: `--warning`
- Surfaces:
  - `--background`, `--card`, `--popover`
- Borders/inputs:
  - `--border`, `--input`, `--ring`

### Typography
- Base app typography:
  - family: `Inter`, `Segoe UI`, `Roboto`, `Arial`
  - base size: `14px`
  - line-height: `1.4`
- Module titles: `text-base font-semibold`
- Supporting copy: `text-xs text-muted-foreground`
- Metadata badges: `text-[10px] uppercase`

### Spacing
- Tight spacing: `gap-2`, `p-2`
- Standard spacing: `gap-3`, `p-3`
- Page spacing: `p-4` desktop baseline

### Radius and Shadow
- Card/control radius aligned to `--radius` (`0.5rem`)
- Primary surface: subtle `shadow-sm`
- Use stronger shadow only for active or elevation states

### Motion
- Transition token: `--transition-smooth`
- Keep interactions under 200ms perceived response budget

## Layout Standards
- Desktop:
  - navigation + content split where needed
- Tablet/Mobile:
  - collapse to single-column with drawer menu
- Module surfaces use unified shell component.

## Component Standards
- Use:
  - `AmroModuleSurface`
  - `AmroStandardToolbar`
  - `AmroKpiGrid`
- Avoid ad-hoc container patterns unless module-specific constraints require exceptions.

## Accessibility (WCAG 2.1 AA)
- Ensure focus visible for all interactive controls.
- Maintain keyboard operability for nav/menu actions.
- Keep active states and badges with AA contrast.
- Provide `aria-current` for active module and `aria-live` for dynamic content region updates.

## Responsive Breakpoints
- Mobile: `< 768px`
- Tablet: `768px - 1023px`
- Desktop: `>= 1024px`

## Usage Policy
- New AMRO Parts UI work must include:
  - Storybook story entry
  - usage documentation update
  - role visibility validation if navigation-related.
