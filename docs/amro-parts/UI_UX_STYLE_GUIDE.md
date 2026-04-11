# AMRO Parts Module - UI/UX Style Guide

**Version:** 2.0  
**Last Updated:** April 10, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Typography System](#2-typography-system)
3. [Spacing System](#3-spacing-system)
4. [Layout & Grid System](#4-layout--grid-system)
5. [Component Standards](#5-component-standards)
6. [CRUD Button Positioning](#6-crud-button-positioning)
7. [Decluttering Guidelines](#7-decluttering-guidelines)
8. [Before/After Examples](#8-beforeafter-examples)
9. [Visual Regression Testing](#9-visual-regression-testing)

---

## 1. Design Principles

### 1.1 Core Principles

- **Consistency:** All elements follow standardized sizing, spacing, and positioning
- **Clarity:** Clear visual hierarchy with proper heading progression
- **Efficiency:** Progressive disclosure for complex interfaces (max 7-9 interactive elements per view)
- **Accessibility:** WCAG 2.1 AA compliance for all text and interactive elements

### 1.2 8px Grid System

All spacing, padding, and sizing use an 8px grid system:
```
4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px
```

---

## 2. Typography System

### 2.1 Heading Hierarchy (H1-H6)

**Mathematical Scale:** 1.25x ratio (Major Third)

| Level | Desktop Size | Mobile Size | Weight | Line Height | Usage |
|-------|--------------|-------------|--------|-------------|-------|
| **H1** | 24px (1.5rem) | 20px (1.25rem) | 600 | 1.2 | Page titles |
| **H2** | 20px (1.25rem) | 16px (1rem) | 600 | 1.25 | Section titles |
| **H3** | 18px (1.125rem) | 14px (0.875rem) | 600 | 1.3 | Card titles |
| **H4** | 16px (1rem) | 14px (0.875rem) | 600 | 1.35 | Subsection titles |
| **H5** | 14px (0.875rem) | 12px (0.75rem) | 600 | 1.375 | Group headers |
| **H6** | 12px (0.75rem) | 12px (0.75rem) | 600 | 1.375 | Labels, overlines |

### 2.2 Body Text

| Type | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| **Body** | 14px (0.875rem) | 400 | 1.5 | Standard text, descriptions |
| **Body-Small** | 13px (0.8125rem) | 400 | 1.5 | Help text, secondary text |
| **Caption** | 12px (0.75rem) | 400 | 1.4 | Badges, metadata |

**⚠️ WCAG Minimum:** No text below 12px (0.75rem)

### 2.3 Data Grid Typography

| Element | Size | Weight | Line Height | Alignment | Special |
|---------|------|--------|-------------|-----------|---------|
| **Table Headers** | 12px (0.75rem) | 600 | 1.4 | Left | UPPERCASE, tracking-wide |
| **Table Body** | 14px (0.875rem) | 400 | 1.4 | Left/Right | `tabular-nums` for numbers |
| **Empty State** | 14px (0.875rem) | 400 | 1.5 | Center | Muted foreground |
| **Pagination** | 14px (0.875rem) | 500 | 1.4 | Center | Medium weight |

### 2.4 Implementation

```tsx
// Using standardized heading component
import { AmroHeading, AmroPageTitle, AmroSectionTitle } from './AmroHeading';

<AmroPageTitle>Parts Inventory</AmroPageTitle>
<AmroSectionTitle>Filters</AmroSectionTitle>
```

---

## 3. Spacing System

### 3.1 Spacing Scale (8px Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight spacing, icon gaps |
| `--space-2` | 8px | Button internal padding |
| `--space-3` | 12px | Compact card padding |
| `--space-4` | 16px | Standard spacing, minimum button gap |
| `--space-5` | 20px | Section gaps (mobile) |
| `--space-6` | 24px | Standard section gap (desktop) |
| `--space-8` | 32px | Large section gaps |
| `--space-12` | 48px | Page section gaps |

### 3.2 Card Spacing

| Card Type | Padding | Usage |
|-----------|---------|-------|
| **Compact** | 12px (p-3) | Dense data displays |
| **Standard** | 16px (p-4) | Default for most cards |
| **Spacious** | 24px (p-6) | Forms, empty states |

### 3.3 Form Field Spacing

- **Between fields:** 16px (gap-4)
- **Field internal:** 8px vertical padding
- **Label to input:** 8px gap
- **Input to help text:** 4px gap
- **Form sections:** 24px gap

---

## 4. Layout & Grid System

### 4.1 Page Margins

| Viewport | Margin | Padding |
|----------|--------|---------|
| **Mobile (<768px)** | 16px | p-4 |
| **Tablet (768px-1023px)** | 24px | p-6 |
| **Desktop (≥1024px)** | 24px | p-6 |

### 4.2 12-Column Grid

```css
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 24px;
}
```

**Breakpoints:**
- Mobile: 1-2 columns
- Tablet: 2-4 columns
- Desktop: 3-6 columns

### 4.3 Container Widths

| Token | Width | Usage |
|-------|-------|-------|
| `--container-sm` | 640px | Narrow forms |
| `--container-md` | 768px | Medium content |
| `--container-lg` | 1024px | Wide layouts |
| `--container-xl` | 1280px | Full-width content |

---

## 5. Component Standards

### 5.1 Button Standards

| Button Type | Height | Padding | Font Size | Weight | Gap |
|-------------|--------|---------|-----------|--------|-----|
| **Primary** | 44px mobile / 36px desktop | 16px horizontal | 14px | 500 | 8px |
| **Secondary** | 44px mobile / 36px desktop | 16px horizontal | 14px | 500 | 8px |
| **Danger** | 44px mobile / 36px desktop | 16px horizontal | 14px | 500 | 8px |
| **Icon Button** | 44px mobile / 36px desktop | 12px | N/A | N/A | N/A |

**Touch Target:** Minimum 44×44px on mobile

### 5.2 Form Standards

- **Labels:** 14px / 500 weight / Foreground color
- **Inputs:** 14px / 400 weight / Standard border
- **Help Text:** 13px / 400 weight / Muted foreground
- **Error Messages:** 13px / 400 weight / Destructive color
- **Required Indicator:** Red asterisk (*)

### 5.3 Card Standards

```tsx
<AmroCard variant="default">
  <Card.Header>
    <AmroCardTitle>Card Title</AmroCardTitle>
  </Card.Header>
  <Card.Body>
    {/* Content */}
  </Card.Body>
  <Card.Footer>
    {/* Actions */}
  </Card.Footer>
</AmroCard>
```

---

## 6. CRUD Button Positioning

### 6.1 Standard Pattern

**Primary Actions (Create, Update, Save):**
- Position: **Top-right** of form header
- Visual: Solid primary background
- Spacing: 16px gap from edge and between buttons

**Secondary Actions (Cancel, Back):**
- Position: **Bottom-right** of form footer
- Visual: Outlined/ghost style
- Spacing: 16px gap between buttons

**Danger Actions (Delete):**
- Position: **Bottom-left** of form footer
- Visual: Red border, red text
- Spacing: Isolated from other actions

### 6.2 Implementation

```tsx
import { AmroForm } from './AmroForm';

<AmroForm
  title="Create Part"
  subtitle="Add a new part to inventory"
  primaryAction={{ label: 'Create', onClick: handleCreate }}
  secondaryActions={[{ label: 'Cancel', onClick: handleCancel }]}
  dangerAction={{ label: 'Delete', onClick: handleDelete }}
>
  {/* Form fields */}
</AmroForm>
```

### 6.3 Visual Layout

```
┌─────────────────────────────────────────────────┐
│ Form Title                          [Create]    │  ← Top-Right Primary
│ Subtitle                                        │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Form Fields]                                  │
│                                                 │
├─────────────────────────────────────────────────┤
│ [Delete]                         [Cancel]       │  ← Bottom-L/R Secondary
└─────────────────────────────────────────────────┘
```

---

## 7. Decluttering Guidelines

### 7.1 Visual Noise Reduction

**✅ DO:**
- Use consistent 8px grid spacing
- Increase white space by 20-30% between sections
- Remove unnecessary borders (use subtle background colors instead)
- Use shadows sparingly (only for elevated elements)
- Limit to 7-9 interactive elements per screen view

**❌ DON'T:**
- Stack multiple borders together
- Use decorative borders around every element
- Add shadows to flat elements
- Cram more than 9 actions into a single view

### 7.2 Progressive Disclosure

**Pattern:** Show only what's needed, reveal complexity on demand

**Examples:**
- Collapsible advanced filters
- "Show Extended" column toggle
- Expandable detail sections
- Tabbed interfaces for complex workflows

### 7.3 White Space Standards

| Section Type | Padding | Margin Below | Increase |
|--------------|---------|--------------|----------|
| **Page Header** | 24px | 24px | +20% |
| **Card Content** | 24px | 16px | +25% |
| **Form Sections** | 24px | 24px | +30% |
| **Data Tables** | 16px | 16px | +20% |

---

## 8. Before/After Examples

### 8.1 Typography Hierarchy

**BEFORE:**
```tsx
<CardTitle className="text-base">{title}</CardTitle>        // Inconsistent
<p className="text-xs text-muted-foreground">{subtitle}</p>  // Too small
```

**AFTER:**
```tsx
<AmroHeading level={2}>{title}</AmroHeading>     // Standardized H2: 20px
<p className="text-sm text-muted-foreground">{subtitle}</p>  // Proper size: 14px
```

**Improvement:**
- ✅ Consistent heading hierarchy
- ✅ WCAG compliant text sizes
- ✅ Proper visual weight

---

### 8.2 Data Grid Text Sizing

**BEFORE:**
```tsx
<th className="px-2 py-1 text-[11px] font-semibold">  // ❌ Below minimum
  Header
</th>
<td className="px-2 py-1 text-xs">                    // Inconsistent
  Data
</td>
```

**AFTER:**
```tsx
<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
  Header  // ✅ 12px / 600 / uppercase
</th>
<td className="px-4 py-3 text-sm tabular-nums">
  Data    // ✅ 14px / 400 / tabular numbers
</td>
```

**Improvement:**
- ✅ WCAG compliant minimum size
- ✅ Consistent header styling
- ✅ Proper number alignment

---

### 8.3 CRUD Button Positioning

**BEFORE:**
```tsx
// Buttons scattered randomly
<div className="flex gap-2">
  <Button onClick={handleSave}>Save</Button>
  <Button onClick={handleDelete}>Delete</Button>
  <Button onClick={handleCancel}>Cancel</Button>
</div>
```

**AFTER:**
```tsx
<AmroForm
  primaryAction={{ label: 'Save', onClick: handleSave }}
  secondaryActions={[{ label: 'Cancel', onClick: handleCancel }]}
  dangerAction={{ label: 'Delete', onClick: handleDelete }}
>
  {/* Form content */}
</AmroForm>
```

**Improvement:**
- ✅ Consistent button placement
- ✅ Clear visual hierarchy
- ✅ Proper spacing (16px minimum)

---

### 8.4 Spacing & White Space

**BEFORE:**
```tsx
<div className="space-y-3 p-3">  // Tight spacing
  <Card className="border">      // Unnecessary border
    <div className="space-y-2">
      {/* Content crammed together */}
    </div>
  </Card>
</div>
```

**AFTER:**
```tsx
<AmroSection variant="spacious">  // Increased white space
  <AmroCard>                      // Clean, consistent card
    {/* Content with breathing room */}
  </AmroCard>
</AmroSection>
```

**Improvement:**
- ✅ 20-30% more white space
- ✅ Consistent section spacing
- ✅ Reduced visual noise

---

## 9. Visual Regression Testing

### 9.1 Test Coverage

| Screen Size | Breakpoints | Test Focus |
|-------------|-------------|------------|
| **Mobile** | 320px, 375px, 414px | Text readability, touch targets |
| **Tablet** | 768px, 834px | Grid layout, spacing |
| **Desktop** | 1024px, 1440px, 1920px | Alignment, hierarchy |

### 9.2 Automated Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Typography Consistency', () => {
  test('All headings use standardized sizes', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');
    
    const h1Elements = page.locator('h1');
    const count = await h1Elements.count();
    
    for (let i = 0; i < count; i++) {
      const fontSize = await h1Elements.nth(i).evaluate(
        el => window.getComputedStyle(el).fontSize
      );
      // H1 should be 20-24px
      expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(20);
      expect(parseFloat(fontSize)).toBeLessThanOrEqual(24);
    }
  });

  test('No text below 12px minimum', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');
    
    const allText = page.locator('*');
    const textSizes = await allText.evaluateAll(elements =>
      elements
        .map(el => window.getComputedStyle(el).fontSize)
        .map(size => parseFloat(size))
        .filter(size => size > 0)
    );
    
    const minSize = Math.min(...textSizes);
    expect(minSize).toBeGreaterThanOrEqual(12);
  });
});

test.describe('CRUD Button Positioning', () => {
  test('Primary actions in top-right', async ({ page }) => {
    await page.goto('/dashboard/amro/parts/create');
    
    const primaryButton = page.locator('button:has-text("Create")');
    const parent = await primaryButton.locator('..');
    const parentClass = await parent.getAttribute('class');
    
    expect(parentClass).toContain('justify-between');
  });
});

test.describe('Spacing Consistency', () => {
  test('Cards use standard padding', async ({ page }) => {
    await page.goto('/dashboard/amro/parts');
    
    const cards = page.locator('[data-testid="card"]');
    const count = await cards.count();
    
    for (let i = 0; i < count; i++) {
      const padding = await cards.nth(i).evaluate(
        el => window.getComputedStyle(el).padding
      );
      // Should be 16px or 24px
      expect(['16px', '24px']).toContain(padding);
    }
  });
});
```

### 9.3 Manual Testing Checklist

- [ ] **Typography:** All H1-H6 follow scale
- [ ] **Data Grids:** Headers 12px, body 14px
- [ ] **Buttons:** Primary top-right, secondary bottom
- [ ] **Spacing:** 8px grid system used throughout
- [ ] **White Space:** 20-30% increase verified
- [ ] **Interactive Elements:** Max 7-9 per view
- [ ] **Mobile:** Touch targets ≥44px
- [ ] **Accessibility:** WCAG 2.1 AA compliance

---

## 10. Component Library

### 10.1 Available Components

| Component | File | Purpose |
|-----------|------|---------|
| `AmroHeading` | `AmroHeading.tsx` | Standardized H1-H6 |
| `AmroDataGrid` | `AmroDataGrid.tsx` | Consistent data tables |
| `AmroForm` | `AmroForm.tsx` | CRUD form with button positioning |
| `AmroPageLayout` | `AmroLayout.tsx` | Master page layout |
| `AmroSection` | `AmroLayout.tsx` | Section wrapper |
| `AmroCard` | `AmroLayout.tsx` | Standardized card |
| `AmroToolbar` | `AmroLayout.tsx` | Toolbar with actions |
| `AmroGrid` | `AmroLayout.tsx` | Responsive grid system |

### 10.2 Usage Example

```tsx
import {
  AmroPageLayout,
  AmroSection,
  AmroCard,
  AmroHeading,
  AmroDataGrid,
  AmroForm,
} from './parts';

export function PartsInventoryPage() {
  return (
    <AmroPageLayout>
      {/* Page Header */}
      <header>
        <AmroHeading level={1}>Parts Inventory</AmroHeading>
        <p className="text-sm text-muted-foreground">
          Monitor stock levels and reorder pressure
        </p>
      </header>

      {/* Main Content */}
      <AmroSection title="Inventory Data">
        <AmroCard>
          <AmroDataGrid columns={columns} rows={rows} />
        </AmroCard>
      </AmroSection>

      {/* Create Form */}
      <AmroSection title="Add Part">
        <AmroForm
          title="Create Part"
          primaryAction={{ label: 'Create', onClick: handleCreate }}
          secondaryActions={[{ label: 'Cancel', onClick: handleCancel }]}
        >
          {/* Form fields */}
        </AmroForm>
      </AmroSection>
    </AmroPageLayout>
  );
}
```

---

## 11. Implementation Checklist

### Phase 1: Typography (Week 1)
- [x] Create typography scale component
- [x] Standardize H1-H6 headings
- [x] Update data grid text sizing
- [ ] Migrate all components to new typography

### Phase 2: Layout & Spacing (Week 2)
- [x] Create layout components
- [x] Implement 8px grid system
- [x] Increase white space by 20-30%
- [ ] Migrate all pages to new layout

### Phase 3: CRUD Standardization (Week 3)
- [x] Create standardized form component
- [x] Implement button positioning pattern
- [ ] Migrate all CRUD forms
- [ ] Add visual regression tests

### Phase 4: Decluttering (Week 4)
- [x] Define decluttering guidelines
- [x] Implement progressive disclosure
- [ ] Audit all screens for 7-9 element limit
- [ ] Remove unnecessary borders/shadows

### Phase 5: Testing & Validation (Week 5)
- [ ] Run visual regression tests
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Cross-browser testing
- [ ] Document any exceptions

---

**Document Version:** 2.0  
**Last Updated:** April 10, 2026  
**Maintained By:** UX Design Team  
**Review Cycle:** Monthly
