# Visual Regression Testing Guide

**Date:** 2026-04-10  
**Purpose:** Verify consistent design system implementation across all screens  
**Status:** ✅ Ready for Testing  

---

## 📋 Testing Checklist

### 1. Typography Verification

#### Heading Scale Testing
For each page, verify:
- [ ] Page title uses `<H1>` or `.heading-1` (30px, bold)
- [ ] Section headers use `<H2>` or `.heading-2` (24px, semibold)
- [ ] Card titles use `<H3>` or `.heading-3` (20px, semibold)
- [ ] No hardcoded `text-3xl`, `text-2xl`, etc. on headings
- [ ] All headings use semantic colors (`text-foreground`)

**Test Query:**
```bash
# Find non-compliant headings
grep -r "text-3xl font-bold" src/pages/
grep -r "text-2xl font-bold" src/pages/
```

#### Body Text Testing
- [ ] All body text uses `text-sm` (14px) as default
- [ ] No hardcoded `text-gray-900`, `text-gray-800`, etc.
- [ ] Uses semantic colors (`text-foreground`, `text-muted-foreground`)
- [ ] Form labels use `text-sm font-medium`
- [ ] Helper text uses `text-sm text-muted-foreground`

---

### 2. Data Grid Testing

#### Text Sizing Verification
For each table/grid:
- [ ] Headers use `.data-grid-header-cell` (14px semibold)
- [ ] Body cells use `.data-grid-cell` (14px normal)
- [ ] Pagination uses `.data-grid-pagination` (14px)
- [ ] Empty state uses `.data-grid-empty` (14px muted)
- [ ] No hardcoded text sizes in table cells

**Test Pages:**
- [ ] Accounts List
- [ ] Contacts List
- [ ] Leads List
- [ ] Shipments List
- [ ] Bookings List
- [ ] Carriers List
- [ ] Invoices List
- [ ] All other list pages

#### Dark Mode Testing for Tables
- [ ] Switch to dark mode
- [ ] Verify table text is readable (no `text-gray-900` on dark bg)
- [ ] Verify headers have proper contrast
- [ ] Verify row hover states work correctly
- [ ] Verify striped rows are visible

---

### 3. CRUD Button Positioning Testing

#### Top Actions Pattern
For pages with top-right buttons:
- [ ] Uses `.form-actions-top` container
- [ ] Buttons have `gap-2` spacing
- [ ] Positioned at top-right
- [ ] Maximum 3-4 primary actions visible

**Test Pages:**
- [ ] All list pages with "New" button
- [ ] All detail pages with "Edit" button
- [ ] All pages with Import/Export actions

#### Bottom Actions Pattern
For forms with submit/cancel:
- [ ] Uses `.form-actions-bottom` container
- [ ] Has border-top separator
- [ ] Has `pt-6` padding top
- [ ] Has `mt-6` margin top
- [ ] Cancel button on left, Submit on right
- [ ] Button gap is `gap-2` (8px)

**Test Pages:**
- [ ] New Account Form
- [ ] New Contact Form
- [ ] New Lead Form
- [ ] Edit Account Form
- [ ] All other CRUD forms

---

### 4. Spacing & Layout Testing

#### 8px Grid System Verification
- [ ] Section gaps use `space-y-6` (24px)
- [ ] Card padding uses `p-6` (24px)
- [ ] Form field gaps use `gap-4` (16px)
- [ ] Button gaps use `gap-2` (8px)
- [ ] No arbitrary spacing values (e.g., `mt-5`, `mb-7`)

**Visual Inspection:**
- [ ] 20-30% more white space between sections (vs. old design)
- [ ] No unnecessary borders
- [ ] No unnecessary shadows
- [ ] Cards use `.card-clean` or `.card-elevated`

---

### 5. Alignment Testing

#### Breakpoint Verification
Test each page at:
- [ ] **320px** (small mobile)
  - Single column layout
  - Stacked elements
  - Readable text (no overflow)
  
- [ ] **768px** (tablet)
  - 2-column grids where appropriate
  - Adjusted margins (16px)
  - Proper element wrapping
  
- [ ] **1024px** (laptop)
  - Full grid system active
  - Desktop margins (24px)
  - Multi-column layouts visible
  
- [ ] **1440px** (desktop)
  - Max-width container (1440px)
  - Centered content
  - No horizontal scroll

#### Grid Overlay Testing
```tsx
// Add to any page for visual alignment check
<div className="page-content grid-overlay">
  {content}
</div>
```

Verify:
- [ ] Elements align to 12-column grid
- [ ] Cards snap to grid columns
- [ ] No misaligned elements
- [ ] Consistent margins across pages

---

### 6. Dark Mode Comprehensive Testing

#### Color Verification
- [ ] No hardcoded `bg-white` (use `bg-card`)
- [ ] No hardcoded `text-gray-900` (use `text-foreground`)
- [ ] No hardcoded `border-gray-200` (use `border-border`)
- [ ] All semantic colors adapt to dark mode

#### Component Testing
- [ ] Cards display correctly in dark mode
- [ ] Tables readable in dark mode
- [ ] Forms have proper contrast
- [ ] Buttons visible and accessible
- [ ] Modals/Dialogs have proper backgrounds

---

## 🧪 Automated Testing Commands

### Type Checking
```bash
npm run type-check
# or
npx tsc --noEmit
```

### Linting
```bash
npm run lint
# or
npx eslint src/ --ext .ts,.tsx
```

### Build Verification
```bash
npm run build
```

### Development Server
```bash
npm run dev
# Opens at http://localhost:8081
```

---

## 📸 Screenshot Documentation

### Required Screenshots Per Page

For each migrated page, capture:

1. **Desktop Light Mode (1440px)**
   - Full page screenshot
   - Focus on heading hierarchy
   - Show data grid/table
   - Show form actions

2. **Desktop Dark Mode (1440px)**
   - Same view in dark mode
   - Verify semantic colors
   - Verify contrast ratios

3. **Tablet View (768px)**
   - Responsive layout
   - Grid adjustments
   - Element wrapping

4. **Mobile View (320px)**
   - Single column stack
   - Touch targets
   - Readability

### Screenshot Organization

```
screenshots/
├── before/
│   ├── accounts-list-light.png
│   ├── accounts-list-dark.png
│   └── ...
└── after/
    ├── accounts-list-light.png
    ├── accounts-list-dark.png
    └── ...
```

---

## ✅ Acceptance Criteria

A page passes visual regression testing when:

### Typography (100% compliance required)
- ✅ All headings use standardized sizes
- ✅ No hardcoded text colors
- ✅ Proper visual hierarchy
- ✅ Dark mode compatible

### Data Grids (100% compliance required)
- ✅ Consistent text sizing (14px)
- ✅ Semantic colors throughout
- ✅ Proper loading/empty states
- ✅ Dark mode compatible

### CRUD Buttons (100% compliance required)
- ✅ Correct positioning pattern
- ✅ Proper spacing (gap-2)
- ✅ Correct button order
- ✅ Maximum 7-9 interactive elements

### Spacing & Layout (95% compliance required)
- ✅ 8px grid system followed
- ✅ Consistent section gaps
- ✅ Clean cards (no unnecessary borders/shadows)
- ✅ Proper white space (20-30% increase)

### Alignment (100% compliance required)
- ✅ Responsive at all breakpoints
- ✅ Grid alignment correct
- ✅ No horizontal scroll
- ✅ Proper element wrapping

### Dark Mode (100% compliance required)
- ✅ All text readable
- ✅ All backgrounds adapt
- ✅ All borders visible
- ✅ All interactive elements visible

---

## 🐛 Common Issues to Check

### Critical Issues (Block Merge)
- ❌ Hardcoded `text-gray-900` in dark mode
- ❌ Heading sizes inconsistent
- ❌ Table text too small (< 14px) or too large (> 14px)
- ❌ Form buttons misaligned
- ❌ Horizontal scroll at any breakpoint

### Warning Issues (Should Fix)
- ⚠️ Unnecessary borders or shadows
- ⚠️ Spacing not on 8px grid
- ⚠️ Too many interactive elements (> 9)
- ⚠️ Card titles not using H3

### Informational (Nice to Have)
- 💡 Could use `.card-clean` instead of manual styling
- 💡 Could use `<Heading>` component instead of classes
- 💡 Could use `.form-actions-*` classes

---

## 📊 Testing Progress Tracker

| Module | Total Pages | Tested | Passed | Failed | % Complete |
|--------|-------------|--------|--------|--------|------------|
| AMRO | ~50 | 0 | 0 | 0 | 0% |
| CRM | ~30 | 0 | 0 | 0 | 0% |
| Logistics | ~25 | 0 | 0 | 0 | 0% |
| Platform/Admin | ~40 | 0 | 0 | 0 | 0% |
| **Total** | **~145** | **0** | **0** | **0** | **0%** |

---

## 🔧 Testing Tools

### Browser DevTools
- Chrome DevTools (Device Mode)
- Firefox Responsive Design Mode
- Safari Responsive Design Mode

### Recommended Extensions
- **Color Contrast Analyzer** (a11y)
- **PerfectPixel** (visual comparison)
- **Pesticide** (layout debugging)
- **VisBug** (design inspection)

### Automated Tools (Future)
- Playwright visual regression tests
- Percy.io integration
- Chromatic for Storybook

---

**Last Updated:** 2026-04-10  
**Tested By:** [Your Name]  
**Approved By:** Design Team Lead
