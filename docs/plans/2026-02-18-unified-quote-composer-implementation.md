# Unified Quote Composer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace two overlapping quote creation UIs (QuickQuoteModal + MultiModalQuoteComposer) with a single progressive-disclosure page: form on top, results below, inline finalize after selection.

**Architecture:** Extract shared logic into hooks (useRateFetching, useDraftAutoSave), build three UI zones (FormZone, ResultsZone, FinalizeSection), wire them together in UnifiedQuoteComposer. Entry points (QuoteNew, QuoteDetail, Quotes, QuotesPipeline) all route to the unified component. Old components deleted after migration.

**Tech Stack:** React 18, TypeScript, react-hook-form + zod, Supabase (save_quote_atomic RPC), useAiAdvisor hook, PricingService, Vitest

---

## Current State (as of 2026-02-18)

Phases 1–3 are **complete** — 6 new files created (1,943 lines), QuoteNew.tsx and QuoteDetail.tsx migrated. Phase 4 (cleanup + tests) is **pending**. The plan below covers only the remaining work.

### Files already created:
- `src/hooks/useRateFetching.ts` — rate fetching extracted from QuickQuoteModalContent
- `src/hooks/useDraftAutoSave.ts` — debounced 30s auto-save via save_quote_atomic
- `src/components/sales/unified-composer/FormZone.tsx` — mode tabs, origin/dest, cargo, collapsible options
- `src/components/sales/unified-composer/ResultsZone.tsx` — list/compare views wrapping QuoteResultsList/ComparisonView
- `src/components/sales/unified-composer/FinalizeSection.tsx` — charges editor, margin, save/PDF
- `src/components/sales/unified-composer/UnifiedQuoteComposer.tsx` — orchestrator

### Files already modified:
- `src/pages/dashboard/QuoteNew.tsx` — gutted to breadcrumbs + UnifiedQuoteComposer
- `src/pages/dashboard/QuoteDetail.tsx` — swapped QuoteForm for UnifiedQuoteComposer

---

## Task 1: Replace QuickQuoteModal in Quotes.tsx

**Depends on:** nothing
**Files:**
- Modify: `src/pages/dashboard/Quotes.tsx:23,375-387`

**Step 1: Read the file and identify the QuickQuoteModal usage**

Lines to change:
- Line 23: `import { QuickQuoteModal } from '@/components/sales/quick-quote/QuickQuoteModal';`
- Lines 375-387: `<QuoteErrorBoundary><QuickQuoteModal>...</QuickQuoteModal></QuoteErrorBoundary>` + separate "Create Detailed Quote" button

**Step 2: Remove the QuickQuoteModal import**

Replace line 23:
```tsx
// DELETE this line:
import { QuickQuoteModal } from '@/components/sales/quick-quote/QuickQuoteModal';
```

**Step 3: Replace QuickQuoteModal + Create button with a single "New Quote" button**

Replace lines 375-387 (the `<QuoteErrorBoundary>` block through the Create button):
```tsx
            <QuoteErrorBoundary>
            </QuoteErrorBoundary>
            <Button onClick={() => navigate('/dashboard/quotes/new')} className="shadow-lg shadow-primary/20 gap-2 min-w-[140px]">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Quote</span>
                <span className="sm:hidden">New Quote</span>
            </Button>
```

The `Sparkles` icon import on line 20 can also be removed if no other usage exists (grep first).

**Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "Quotes.tsx" | head -5`
Expected: no errors from this file

**Step 5: Commit**

```bash
git add src/pages/dashboard/Quotes.tsx
git commit -m "refactor(quotes): replace QuickQuoteModal with navigation to /quotes/new"
```

---

## Task 2: Replace QuickQuoteModal in QuotesPipeline.tsx

**Depends on:** nothing (can run parallel with Task 1)
**Files:**
- Modify: `src/pages/dashboard/QuotesPipeline.tsx:17,632-635`

**Step 1: Remove the QuickQuoteModal import**

Delete line 17:
```tsx
// DELETE:
import { QuickQuoteModal } from "@/components/sales/quick-quote/QuickQuoteModal";
```

**Step 2: Replace `<QuickQuoteModal />` with a navigation button**

Replace lines 632-635:
```tsx
// BEFORE:
            <QuickQuoteModal />
            <Button onClick={() => navigate('/dashboard/quotes/new')} className="shadow-lg shadow-primary/20 gap-2 min-w-[140px]">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Detailed Quote</span>

// AFTER:
            <Button onClick={() => navigate('/dashboard/quotes/new')} className="shadow-lg shadow-primary/20 gap-2 min-w-[140px]">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Quote</span>
```

**Step 3: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "QuotesPipeline.tsx" | head -5`
Expected: no errors

**Step 4: Commit**

```bash
git add src/pages/dashboard/QuotesPipeline.tsx
git commit -m "refactor(pipeline): replace QuickQuoteModal with navigation to /quotes/new"
```

---

## Task 3: Update QuoteFormRefactored.tsx to use UnifiedQuoteComposer

**Depends on:** nothing
**Files:**
- Modify: `src/components/sales/quote-form/QuoteFormRefactored.tsx:14,282-286`

`QuoteFormRefactored` renders `<MultiModalQuoteComposer>` when `viewMode === 'composer'`. This must be swapped.

**Step 1: Replace the import**

```tsx
// BEFORE (line 14):
import { MultiModalQuoteComposer } from '@/components/sales/MultiModalQuoteComposer';

// AFTER:
import { UnifiedQuoteComposer } from '@/components/sales/unified-composer/UnifiedQuoteComposer';
```

**Step 2: Replace the JSX render (lines 282-286)**

```tsx
// BEFORE:
                <MultiModalQuoteComposer
                    quoteId={quoteId}
                    versionId={versionId}
                    tenantId={resolvedTenantId || undefined}
                />

// AFTER:
                <UnifiedQuoteComposer
                    quoteId={quoteId}
                    versionId={versionId}
                />
```

Note: `UnifiedQuoteComposer` does not take a `tenantId` prop — it resolves tenant internally.

**Step 3: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "QuoteFormRefactored" | head -5`
Expected: no errors

**Step 4: Commit**

```bash
git add src/components/sales/quote-form/QuoteFormRefactored.tsx
git commit -m "refactor(quote-form): swap MultiModalQuoteComposer for UnifiedQuoteComposer"
```

---

## Task 4: Remove multi-modal route from App.tsx

**Depends on:** Task 3
**Files:**
- Modify: `src/App.tsx:104,534-537`

**Step 1: Remove the lazy import (line 104)**

```tsx
// DELETE:
const MultiModalQuote = lazy(() => import("./pages/dashboard/MultiModalQuote"));
```

**Step 2: Remove the route (lines 534-537)**

```tsx
// DELETE these lines:
              path="/dashboard/quotes/multi-modal"
              element={
                <ProtectedRoute>
                  <MultiModalQuote />
```

Also delete the closing `</ProtectedRoute>` and `/>` that go with this route element.

**Step 3: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "App.tsx" | head -5`
Expected: no errors

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(routes): remove /quotes/multi-modal route"
```

---

## Task 5: Move shared display components to shared/ directory

**Depends on:** Tasks 1, 2
**Files:**
- Move: `src/components/sales/quick-quote/QuoteResultsList.tsx` → `src/components/sales/shared/QuoteResultsList.tsx`
- Move: `src/components/sales/quick-quote/QuoteComparisonView.tsx` → `src/components/sales/shared/QuoteComparisonView.tsx`
- Move: `src/components/sales/quick-quote/QuoteLegsVisualizer.tsx` → `src/components/sales/shared/QuoteLegsVisualizer.tsx` (imported by QuoteResultsList)
- Move: `src/components/sales/quick-quote/QuoteMapVisualizer.tsx` → `src/components/sales/shared/QuoteMapVisualizer.tsx` (imported by QuoteResultsList)
- Move: `src/components/sales/quick-quote/QuoteDetailView.tsx` → `src/components/sales/shared/QuoteDetailView.tsx` (imported by QuoteResultsList)
- Update: `src/components/sales/unified-composer/ResultsZone.tsx` — fix imports

**Step 1: Move files with git mv**

```bash
git mv src/components/sales/quick-quote/QuoteResultsList.tsx src/components/sales/shared/QuoteResultsList.tsx
git mv src/components/sales/quick-quote/QuoteComparisonView.tsx src/components/sales/shared/QuoteComparisonView.tsx
git mv src/components/sales/quick-quote/QuoteLegsVisualizer.tsx src/components/sales/shared/QuoteLegsVisualizer.tsx
git mv src/components/sales/quick-quote/QuoteMapVisualizer.tsx src/components/sales/shared/QuoteMapVisualizer.tsx
git mv src/components/sales/quick-quote/QuoteDetailView.tsx src/components/sales/shared/QuoteDetailView.tsx
```

**Step 2: Update imports in moved files**

In `QuoteResultsList.tsx`, fix relative imports:
```tsx
// BEFORE:
import { QuoteLegsVisualizer } from './QuoteLegsVisualizer';
import { QuoteMapVisualizer } from './QuoteMapVisualizer';
import { QuoteDetailView } from './QuoteDetailView';
// AFTER (unchanged — still relative in same dir):
// No change needed since they're all in the same shared/ dir now
```

**Step 3: Update import in ResultsZone.tsx**

```tsx
// BEFORE:
import { QuoteResultsList } from '@/components/sales/quick-quote/QuoteResultsList';
import { QuoteComparisonView } from '@/components/sales/quick-quote/QuoteComparisonView';

// AFTER:
import { QuoteResultsList } from '@/components/sales/shared/QuoteResultsList';
import { QuoteComparisonView } from '@/components/sales/shared/QuoteComparisonView';
```

**Step 4: Grep for any remaining imports of these files from quick-quote path**

Run: `grep -rn "quick-quote/QuoteResultsList\|quick-quote/QuoteComparisonView\|quick-quote/QuoteLegsVisualizer\|quick-quote/QuoteMapVisualizer\|quick-quote/QuoteDetailView" src/ --include="*.tsx" --include="*.ts"`

Fix any remaining imports found.

**Step 5: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors related to moved files

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(shared): move display components from quick-quote/ to shared/"
```

---

## Task 6: Delete deprecated components

**Depends on:** Tasks 1, 2, 3, 4, 5
**Files:**
- Delete: `src/components/sales/quick-quote/QuickQuoteModal.tsx`
- Delete: `src/components/sales/quick-quote/QuickQuoteModalContent.tsx`
- Delete: `src/components/sales/quick-quote/QuickQuoteHistory.tsx` (check usage first)
- Delete: `src/pages/dashboard/MultiModalQuote.tsx`
- Keep: `src/components/sales/MultiModalQuoteComposer.tsx` — only delete after confirming no remaining imports

**Step 1: Verify no remaining imports of QuickQuoteModal**

Run: `grep -rn "QuickQuoteModal" src/ --include="*.tsx" --include="*.ts" | grep -v "__tests__" | grep -v "node_modules"`

Expected: 0 results (all replaced in Tasks 1-2)

**Step 2: Verify no remaining imports of QuickQuoteModalContent**

Run: `grep -rn "QuickQuoteModalContent" src/ --include="*.tsx" --include="*.ts" | grep -v "__tests__" | grep -v "node_modules"`

Expected: only the file itself (0 external imports)

**Step 3: Check QuickQuoteHistory usage**

Run: `grep -rn "QuickQuoteHistory" src/ --include="*.tsx" --include="*.ts" | grep -v "__tests__"`

If used only by deleted QuoteNew.tsx (old), safe to delete. If used elsewhere, keep.

**Step 4: Verify no remaining imports of MultiModalQuoteComposer**

Run: `grep -rn "MultiModalQuoteComposer" src/ --include="*.tsx" --include="*.ts" | grep -v "__tests__" | grep -v "node_modules"`

Expected: 0 results after Tasks 3-4

**Step 5: Delete the files**

```bash
rm src/components/sales/quick-quote/QuickQuoteModal.tsx
rm src/components/sales/quick-quote/QuickQuoteModalContent.tsx
rm src/pages/dashboard/MultiModalQuote.tsx
rm src/components/sales/MultiModalQuoteComposer.tsx
# Only if confirmed safe:
rm src/components/sales/quick-quote/QuickQuoteHistory.tsx
```

If `src/components/sales/quick-quote/` is now empty (all display files moved in Task 5), delete the directory:
```bash
rmdir src/components/sales/quick-quote/ 2>/dev/null || echo "Directory not empty — check remaining files"
```

**Step 6: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors related to deleted files

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove QuickQuoteModal, MultiModalQuoteComposer, and MultiModalQuote page"
```

---

## Task 7: Delete old QuickQuoteModal tests

**Depends on:** Task 6
**Files:**
- Delete: `src/components/sales/quick-quote/__tests__/QuickQuoteModal.test.tsx`
- Delete: `src/components/sales/quick-quote/__tests__/QuickQuoteSubmissionFlow.test.tsx`
- Delete: `src/components/sales/quick-quote/__tests__/QuickQuoteLocationIntegration.test.tsx`
- Delete: `src/components/sales/quick-quote/__tests__/QuickQuoteFallback.test.tsx`
- Delete: `src/components/sales/quick-quote/__tests__/QuickQuoteLogging.test.tsx`
- Delete: `src/components/sales/quick-quote/__tests__/QuickQuoteValidation.test.tsx`

**Step 1: Delete all test files**

```bash
rm -rf src/components/sales/quick-quote/__tests__/
```

**Step 2: Verify test suite runs**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: no import errors from deleted files

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove QuickQuoteModal test suite (replaced by unified-composer tests)"
```

---

## Task 8: Write UnifiedQuoteComposer tests

**Depends on:** Task 7
**Files:**
- Create: `src/components/sales/unified-composer/__tests__/UnifiedQuoteComposer.test.tsx`

**Step 1: Write the test file**

The test file should use the same mock patterns as existing tests (see `test/setup.ts` for globals):

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';

// Mock Radix Pointer capture
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock supabase functions invoke (rate-engine)
const mockInvoke = vi.fn().mockResolvedValue({
  data: { options: [] },
  error: null,
});

const mockRpc = vi.fn().mockResolvedValue({ data: 'test-quote-id', error: null });

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      functions: { invoke: mockInvoke },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'test' }, error: null }) }) }),
      }),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    },
    context: { tenantId: 'tenant-1' },
    scopedDb: {
      from: () => ({
        select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'opt-1' }, error: null }) }) }),
      }),
      rpc: mockRpc,
      client: { auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) } },
    },
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, session: { access_token: 'tok' }, isPlatformAdmin: () => false, roles: [] }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn().mockResolvedValue({ data: null, error: null }) }),
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

vi.mock('@/hooks/useIncoterms', () => ({
  useIncoterms: () => ({ incoterms: [], loading: false }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/sales/quick-quote/QuoteResultsList', () => ({
  QuoteResultsList: () => <div data-testid="results-list">Results</div>,
}));

vi.mock('@/components/sales/quick-quote/QuoteComparisonView', () => ({
  QuoteComparisonView: () => <div data-testid="comparison-view">Compare</div>,
}));

vi.mock('@/components/common/LocationAutocomplete', () => ({
  LocationAutocomplete: ({ value, onChange, ...props }: any) => (
    <input
      data-testid={props['data-testid'] || 'location-input'}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/components/sales/shared/SharedCargoInput', () => ({
  SharedCargoInput: () => <div data-testid="cargo-input">Cargo</div>,
}));

const wrapper = ({ children }: any) => <BrowserRouter>{children}</BrowserRouter>;

describe('UnifiedQuoteComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders FormZone with mode tabs', () => {
    render(<UnifiedQuoteComposer />, { wrapper });
    expect(screen.getByText('Ocean')).toBeInTheDocument();
    expect(screen.getByText('Air')).toBeInTheDocument();
    expect(screen.getByText('Road')).toBeInTheDocument();
    expect(screen.getByText('Rail')).toBeInTheDocument();
  });

  it('renders smart mode toggle', () => {
    render(<UnifiedQuoteComposer />, { wrapper });
    expect(screen.getByText('Smart Quote Mode')).toBeInTheDocument();
    expect(screen.getByTestId('smart-mode-switch')).toBeInTheDocument();
  });

  it('shows empty state when no results yet', () => {
    render(<UnifiedQuoteComposer />, { wrapper });
    expect(screen.getByText(/Fill out the form above/i)).toBeInTheDocument();
  });

  it('shows Get Rates button', () => {
    render(<UnifiedQuoteComposer />, { wrapper });
    expect(screen.getByTestId('get-rates-btn')).toBeInTheDocument();
  });

  it('does not show finalize section initially', () => {
    render(<UnifiedQuoteComposer />, { wrapper });
    expect(screen.queryByTestId('finalize-section')).not.toBeInTheDocument();
  });
});
```

**Step 2: Run tests to confirm they pass**

Run: `npx vitest run src/components/sales/unified-composer/__tests__/UnifiedQuoteComposer.test.tsx --reporter=verbose`
Expected: 5 tests pass

**Step 3: Commit**

```bash
git add src/components/sales/unified-composer/__tests__/UnifiedQuoteComposer.test.tsx
git commit -m "test: add UnifiedQuoteComposer smoke tests"
```

---

## Task 9: Write useRateFetching tests

**Depends on:** nothing (can run parallel with Task 8)
**Files:**
- Create: `src/hooks/__tests__/useRateFetching.test.ts`

**Step 1: Write the test file**

```tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockToast = vi.fn();

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      functions: { invoke: mockInvoke },
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
      from: () => ({ insert: () => Promise.resolve({ data: null, error: null }) }),
    },
    context: { tenantId: 'tenant-1' },
  }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ session: { access_token: 'tok' } }),
}));

import { useRateFetching } from '../useRateFetching';

describe('useRateFetching', () => {
  const mockResolver = {
    resolveContainerInfo: (typeId: string, sizeId: string) => ({
      type: typeId || 'Dry',
      size: sizeId || '20ft',
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with null results and not loading', () => {
    const { result } = renderHook(() => useRateFetching());
    expect(result.current.results).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading to true during fetch', async () => {
    mockInvoke.mockResolvedValue({ data: { options: [] }, error: null });

    const { result } = renderHook(() => useRateFetching());

    let fetchPromise: Promise<any>;
    act(() => {
      fetchPromise = result.current.fetchRates(
        { mode: 'ocean', origin: 'Shanghai', destination: 'LA', commodity: 'Toys' },
        mockResolver
      );
    });

    expect(result.current.loading).toBe(true);

    await act(async () => { await fetchPromise; });

    expect(result.current.loading).toBe(false);
  });

  it('clears results when clearResults is called', async () => {
    const { result } = renderHook(() => useRateFetching());

    act(() => { result.current.clearResults(); });

    expect(result.current.results).toBeNull();
    expect(result.current.marketAnalysis).toBeNull();
    expect(result.current.confidenceScore).toBeNull();
    expect(result.current.anomalies).toEqual([]);
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/hooks/__tests__/useRateFetching.test.ts --reporter=verbose`
Expected: 3 tests pass

**Step 3: Commit**

```bash
git add src/hooks/__tests__/useRateFetching.test.ts
git commit -m "test: add useRateFetching hook tests"
```

---

## Task 10: Run full verification

**Depends on:** All previous tasks

**Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: Full test suite**

Run: `npx vitest run`
Expected: All tests pass (old QuickQuoteModal tests removed, new unified-composer tests added)

**Step 3: Production build**

Run: `npm run build`
Expected: Build succeeds, no import resolution failures

**Step 4: Grep for any dangling references**

```bash
grep -rn "QuickQuoteModal\|QuickQuoteModalContent" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "__tests__"
```

Expected: 0 results

```bash
grep -rn "MultiModalQuoteComposer" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "__tests__"
```

Expected: 0 results (the component file itself is deleted)

**Step 5: Commit (if any fixups needed)**

```bash
git add -A
git commit -m "chore: final cleanup and verification of unified quote composer migration"
```

---

## Dependency Graph

```
Task 1 (Quotes.tsx)  ──┐
Task 2 (Pipeline.tsx) ──┼── Task 5 (move shared) ── Task 6 (delete old) ── Task 7 (delete old tests) ── Task 8 (new tests) ──┐
Task 3 (QuoteForm)   ──┤                                                                                                       ├── Task 10 (verify)
Task 4 (App.tsx)     ──┘                                                                                Task 9 (hook tests) ──┘
```

**Parallelizable groups:**
- Group A (no deps): Tasks 1, 2, 3, 9
- Group B (after 1+2): Task 5
- Group C (after 3): Task 4
- Group D (after 5+4): Task 6
- Group E (after 6): Tasks 7, 8
- Group F (after all): Task 10
