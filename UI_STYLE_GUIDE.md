# UI Style Guide: Rate Option Details

## 1. Design Philosophy
- **Modern & Clean**: Minimalist aesthetic with high whitespace to reduce cognitive load.
- **Hierarchy-First**: Price, Carrier, and Transit Time are primary. Secondary details are accessible via interaction.
- **Visual Cues**: Use color and iconography to distinguish Rate Sources (AI vs Market) and Status (Verified).

## 2. Typography
- **Font Family**: Inter (System Default)
- **Headings**:
  - H1 (Carrier): `text-lg font-bold tracking-tight`
  - H2 (Price): `text-2xl font-bold text-primary`
  - H3 (Section Titles): `text-sm font-semibold uppercase text-muted-foreground tracking-wide`
- **Body**:
  - Standard: `text-sm text-foreground`
  - Secondary: `text-xs text-muted-foreground`
  - Data: `font-mono text-sm` (for numbers/codes)

## 3. Color Palette & Semantics
### Primary Actions
- **Primary**: `bg-primary text-primary-foreground` (Brand Color)
- **Secondary**: `bg-secondary text-secondary-foreground`

### Status Indicators
- **AI Generated**: 
  - Badge: `bg-green-100 text-green-700 border-green-200`
  - Icon: `Sparkles` (Lucide)
- **Market Rate**: 
  - Badge: `bg-blue-100 text-blue-700 border-blue-200`
  - Icon: `ShieldCheck` (Lucide)
- **Error/Restriction**: `text-red-600 bg-red-50`
- **Success/Margin**: `text-green-600`

## 4. Components & Interaction
### Cards
- **Container**: `rounded-lg border bg-card text-card-foreground shadow-sm`
- **Hover**: `hover:shadow-md transition-shadow duration-200`
- **Active/Selected**: `ring-2 ring-primary border-primary bg-primary/5`

### Animations
- **Transitions**: `transition-all duration-200 ease-in-out`
- **Enter**: `animate-in fade-in zoom-in-95 duration-200`
- **Expand**: `data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up`

## 5. Accessibility (WCAG 2.1)
- **Contrast**: Ensure text on colored badges meets 4.5:1 ratio.
- **Focus**: Visible focus rings on all interactive elements.
- **Screen Readers**: Use `aria-label` for icon-only buttons.
- **Keyboard**: Full tab navigation support for Tabs and Accordions.
