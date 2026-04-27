# AMRO Aircraft → Create Work Package UI/UX Audit & Enhancement Plan

**Date:** 2026-04-12  
**Component:** `AircraftWorkOrderCreateDialog.tsx` (905 lines)  
**Location:** `src/features/module-amro/settings/pages/amro-settings-master-data/components/`

---

## 🔍 Critical UI/UX Issues Identified

### 1. **Dialog Size & Overwhelming Scale** ❌ CRITICAL
**Current:** `h-[96vh] w-[98.5vw] max-w-[1840px]` — takes up 98.5% of screen width!
**Impact:** Users feel overwhelmed, loses context of parent page
**Fix:** Use standard dialog sizes (`max-w-4xl` or `max-w-6xl`)

### 2. **Tiny, Unreadable Text** ❌ CRITICAL
**Current:** Font sizes `text-[10px]`, `text-[11px]`, `text-[12px]` throughout
**Impact:** Accessibility violation (WCAG requires min 12px, recommended 14px+)
**Fix:** Use `text-sm` (14px) minimum, `text-base` (16px) for body

### 3. **Cramped Input Fields** ❌ CRITICAL
**Current:** `h-[26px]` inputs with `px-2` padding — too small for touch/mouse
**Impact:** Difficult to click, not mobile-friendly, violates 44x44px touch target guideline
**Fix:** Use `h-9` (36px) or `h-10` (40px) minimum

### 4. **5 Confusing Tabs** ❌ HIGH
**Current:** `new-wp`, `existing-wp`, `non-performed-tasks`, `selected-task`, `all-tasks`
**Impact:** Users don't understand tab purpose, workflow is fragmented across tabs
**Fix:** Consolidate into single-page wizard or logical 2-tab flow

### 5. **Manual Date Entry** ❌ HIGH
**Current:** Date fields are `type="text"` with placeholder `yyyy-mm-dd` — no date picker!
**Impact:** Error-prone, poor UX, users must remember format
**Fix:** Use `type="date"` or shadcn Calendar component

### 6. **No Form Validation Feedback** ❌ HIGH
**Current:** Errors shown as `<p className="mdm-template-danger">` — inconsistent styling
**Impact:** Users miss validation errors, unclear what needs fixing
**Fix:** Use shadcn `Form` components with consistent error styling

### 7. **Hardcoded Placeholder Values** ❌ MEDIUM
**Current:** `"406.30 hours"`, `"145"`, `"2"`, `"400 Hour Inspection"`
**Impact:** Confusing for new users, looks like pre-filled data
**Fix:** Use descriptive placeholders like `"e.g., 406.30"`

### 8. **No Aircraft Selection** ❌ CRITICAL
**Current:** No aircraft selection field in WP creation dialog!
**Impact:** Users can't specify which aircraft the WP is for
**Fix:** Add aircraft dropdown as first required field

### 9. **Inconsistent Design System** ❌ HIGH
**Current:** Mix of `rounded-none`, custom colors (`#4c4c4c`, `#efefef`, `#12aeb1`)
**Impact:** Doesn't match AMRO unified design system, looks outdated
**Fix:** Use shadcn/ui components with AMRO theme tokens

### 10. **Redundant Fields** ❌ MEDIUM
**Current:** 15+ date fields, many never used (transmission date, maintenance release date, work report number)
**Impact:** Form fatigue, users skip important fields
**Fix:** Show only essential fields, use "Advanced" section for optional fields

### 11. **No Creation Path Selection** ❌ HIGH
**Current:** No Scheduled vs Non-Scheduled vs Emergency path
**Impact:** Doesn't align with enterprise MRO workflows (TRAX, AMOS)
**Fix:** Add creation path selector at top (Scheduled / Non-Scheduled / Emergency)

### 12. **Task Table UX Issues** ❌ MEDIUM
**Current:** Static table with fake data, no real task loading
**Impact:** Users can't see actual tasks
**Fix:** Integrate with new template version API

### 13. **No Progress Indicator** ❌ MEDIUM
**Current:** No indication of required vs optional fields
**Impact:** Users don't know what's needed to submit
**Fix:** Add progress bar, required field indicators

### 14. **Action Buttons Missing** ❌ HIGH
**Current:** Submit handlers exist but no visible action buttons in dialog footer
**Impact:** Users can't create work packages!
**Fix:** Add clear Save Draft / Create / Cancel footer

### 15. **Poor Information Architecture** ❌ HIGH
**Current:** Work Package details mixed with task selection
**Impact:** Cognitive overload, unclear workflow
**Fix:** Step-by-step wizard: Aircraft → Details → Tasks → Review

---

## 📊 Severity Summary

| Severity | Count | Issues |
|----------|-------|--------|
| **CRITICAL** | 4 | Dialog size, tiny text, no aircraft selection, cramped inputs |
| **HIGH** | 7 | Tabs confusion, no date picker, no validation, inconsistent design, no creation path, missing actions, poor IA |
| **MEDIUM** | 4 | Hardcoded placeholders, redundant fields, task table UX, no progress indicator |

**Total Issues:** 15  
**Critical + High:** 11 (73% of issues are severe)

---

## ✅ Enhancement Strategy

### Phase 1: Quick Wins (Fix Immediately)
1. ✅ Resize dialog to `max-w-4xl`
2. ✅ Increase font sizes to `text-sm` minimum
3. ✅ Increase input heights to `h-10`
4. ✅ Replace text inputs with date pickers
5. ✅ Add aircraft selection dropdown
6. ✅ Add creation path selector (Scheduled / Non-Scheduled / Emergency)
7. ✅ Add proper form footer with actions

### Phase 2: Structural Redesign (This Week)
8. ✅ Convert to step-by-step wizard
9. ✅ Remove redundant fields
10. ✅ Integrate with new template version API
11. ✅ Add validation with shadcn Form
12. ✅ Add progress indicator

### Phase 3: Design System Alignment (Next Week)
13. ✅ Use AMRO unified components
14. ✅ Apply consistent color tokens
15. ✅ Add accessibility improvements

---

## 🎯 Target UX Flow

### New Wizard Structure (4 Steps)

**Step 1: Aircraft & Path Selection**
- Aircraft dropdown (required)
- Creation path: Scheduled / Non-Scheduled / Emergency
- If Scheduled: Template selector
- If Non-Scheduled: Defect description, urgency
- If Emergency: Rapid form (aircraft, type, reason)

**Step 2: Work Package Details**
- Title (required)
- Description
- Maintenance type
- Priority
- Planned start/end dates (with calendar)
- Station
- Scope items (optional)

**Step 3: Task Selection**
- Template tasks (if scheduled)
- Custom task addition
- Task table with checkboxes
- Estimated labor hours

**Step 4: Review & Create**
- Summary of all fields
- Validation check
- Actions: Save Draft / Create / Cancel

---

## 📁 Implementation Plan

**New File:** `src/features/module-amro/components/work-orders/AmroWorkOrderCreateWizard.tsx`

**Features:**
- Follows AMRO design system (AmroModuleSurface, AmroStandardToolbar, etc.)
- 4-step wizard with progress indicator
- Creation path support (Scheduled / Non-Scheduled / Emergency)
- Integrates with new React Query hooks
- Full validation with shadcn Form
- Accessible (WCAG 2.1 AA)
- Mobile-responsive

**Hooks Used:**
- `useCreateWorkOrder` (existing)
- `useListTemplateVersions` (new)
- `useCreateEmergencyWP` (new)
- `useConvertNonScheduledTaskToWP` (new)

---

**Next Step:** Build enhanced `AmroWorkOrderCreateWizard.tsx` component
