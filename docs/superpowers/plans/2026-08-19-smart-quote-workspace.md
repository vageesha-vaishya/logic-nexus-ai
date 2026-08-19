# Smart Quote Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revive the deleted standalone Smart/Quick Quote module as an independent page (`/dashboard/quotes/smart-quote`) that generates AI-ranked rate options and hands off the selected one into the existing `QuoteNew.tsx` → `quotes`/`quote_versions` pipeline, coexisting with today's in-composer "Smart Quote Mode" toggle.

**Architecture:** A new page, `SmartQuoteWorkspace.tsx`, ports the form/generation logic from the deleted `src/components/sales/quick-quote/QuickQuoteModal.tsx` (commit `a98b136c^`) out of its `Dialog` wrapper into a full page. It calls the *current* `useRateFetching()` hook (the same one `UnifiedQuoteComposer` already uses — it supersedes the old modal's raw `supabase.functions.invoke` calls with combined legacy+AI+simulation-fallback+ranking logic) and renders results via the already-live `QuoteResultsList`/`QuoteComparisonView` shared components. Selecting an option validates a `QuoteTransferSchema` payload and navigates to `/dashboard/quotes/new` with router state, exactly like the original module did. A gap discovered during research — `UnifiedQuoteComposer` receives that state today but only pre-fills form fields, silently dropping `selectedRates` — is closed in Task 6 so arriving from Smart Quote actually shows the already-chosen option instead of forcing re-generation.

**Tech Stack:** React 18, TypeScript, react-hook-form + zod, React Router v6, TanStack patterns already used in this codebase, Supabase Edge Functions (`rate-engine`, `ai-advisor` via `useAiAdvisor`).

## Global Constraints

- Follow existing `src/pages/dashboard/*.tsx` conventions: `DashboardLayout` wrapper, `themeStyleFromPreset(theme)` on the content div, breadcrumbs via whatever pattern the target page uses (`DetailScreenTemplate` for `QuoteNew.tsx`-style pages).
- Do not modify `useRateFetching.ts`, `rate-engine`/`ai-advisor` edge functions, or `QuoteTransferSchema` — all confirmed live and unchanged; the new page must call them as-is.
- Do not revive `MultiModalQuoteComposer.tsx` — fully superseded by `UnifiedQuoteComposer`, out of scope.
- Do not remove or alter the in-composer "Smart Quote Mode" toggle added earlier in `UnifiedQuoteComposer.tsx`/`FormZone.tsx` — both entry points coexist per approved design.
- `git show a98b136c^:<path>` is the canonical source for porting old code; always diff against current equivalents before assuming a signature is unchanged.

---

### Task 1: Route + page shell for SmartQuoteWorkspace

**Files:**
- Create: `src/pages/dashboard/SmartQuoteWorkspace.tsx`
- Modify: `src/App.tsx:169` (add lazy import after `QuoteNew`), `src/App.tsx:887` (add route after `/dashboard/quotes/pipeline`)
- Test: `src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx`

**Interfaces:**
- Produces: `export default function SmartQuoteWorkspace()` — a page component with no props (matches `QuoteNew`/`Quotes` pattern), rendered at route `/dashboard/quotes/smart-quote`.

- [ ] **Step 1: Write the failing smoke test**

```tsx
// src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SmartQuoteWorkspace from '../SmartQuoteWorkspace';

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: { functions: { invoke: vi.fn() }, from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }), auth: { getUser: () => Promise.resolve({ data: { user: null } }) } },
    context: { tenantId: 'tenant-1' },
    scopedDb: { from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) },
  }),
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn().mockResolvedValue({ data: null, error: null }) }),
}));

describe('SmartQuoteWorkspace', () => {
  it('renders the Smart Quote form and an empty results placeholder', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/quotes/smart-quote']}>
        <SmartQuoteWorkspace />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /smart quote/i })).toBeInTheDocument();
    expect(screen.getByText(/fill out the form to generate quotes/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx`
Expected: FAIL with "Cannot find module '../SmartQuoteWorkspace'"

- [ ] **Step 3: Create the page shell**

```tsx
// src/pages/dashboard/SmartQuoteWorkspace.tsx
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package, Sparkles } from 'lucide-react';

export default function SmartQuoteWorkspace() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
        <div className="flex-none flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quotes/pipeline')} aria-label="Back to Quotes">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Smart Quote
              </h1>
              <p className="text-sm text-muted-foreground">
                Generate instant quotes with AI-powered market analysis and route optimization.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden gap-6">
          <div className="w-[400px] shrink-0 bg-muted/30 p-6 border rounded-lg overflow-y-auto">
            {/* Task 2 adds the form here */}
          </div>
          <div className="flex-1 p-6 bg-background border rounded-lg overflow-y-auto">
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Package className="w-12 h-12 mb-4 opacity-20" />
              <p>Fill out the form to generate quotes</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire the route in App.tsx**

In `src/App.tsx`, add the lazy import right after line 169 (`const QuoteNew = lazy(...)`):

```tsx
const SmartQuoteWorkspace = lazy(() => import("./pages/dashboard/SmartQuoteWorkspace"));
```

Add the route right after the `/dashboard/quotes/pipeline` route (after the closing `/>` that follows line 886):

```tsx
<Route
  path="/dashboard/quotes/smart-quote"
  element={
    <ProtectedRoute requiredPermissions={["quotes.view"]}>
      <SmartQuoteWorkspace />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 6: Verify the route resolves**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/dashboard/SmartQuoteWorkspace.tsx src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx src/App.tsx
git commit -m "feat(quote): add SmartQuoteWorkspace page shell and route"
```

---

### Task 2: Port the shipment form

**Files:**
- Modify: `src/pages/dashboard/SmartQuoteWorkspace.tsx`
- Test: `src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx` (extend)

**Interfaces:**
- Consumes: `useContainerRefs()` from `@/hooks/useContainerRefs` → `{ containerTypes, containerSizes }` (both arrays of `{ id, name, code?, iso_code?, type_id? }`, confirmed live). Called here at the page level — separately from `SharedCargoInput`'s own internal call to the same hook — because Task 3's `containerResolver` (passed to `useRateFetching.fetchRates()`) needs this reference data too; `FormZone.tsx:137` calls the hook at its own top level for the identical reason even though `SharedCargoInput` also calls it internally, so this duplication is the established pattern, not a mistake.
- Consumes: `LocationAutocomplete` from `@/components/common/LocationAutocomplete`, confirmed props at `LocationAutocomplete.tsx:43-51`: `{ value?: string, onChange: (value: string, location?: Location) => void, placeholder?: string, className?: string, disabled?: boolean, preloadedLocations?: Location[], error?: boolean | string }` — no `mode` prop exists; `Location` (`LocationAutocomplete.tsx:24-31`) has `{ id, location_name, location_code, location_type, country, city }` only (no `state_province`).
- Consumes: `SharedCargoInput` from `@/components/quotation/shared/SharedCargoInput`, confirmed props at `SharedCargoInput.tsx:19-27`: `{ value: CargoItem, onChange: (value: CargoItem) => void, onCommodityChange?: (value: string) => void, onRemove?: () => void, className?: string, errors?: any, disableMultiContainer?: boolean }`. It manages container types/sizes internally via its own `useContainerRefs()` call — do not pass `containerTypes`/`containerSizes`/`mode` to it.
- Consumes: `CargoItem` type from `@/types/cargo` (confirmed shape at `src/types/cargo.ts:28-57`: `{ id?, type: 'loose'|'container'|'unit', quantity: number, dimensions: {l,w,h,unit}, volume?: number, containerDetails?: {typeId,sizeId,...}, containerCombos?: Array<{id?,typeId,sizeId,quantity}>, weight: {value,unit}, stackable: boolean, hazmat?: {...}, commodity?: {description,hts_code?,id?,aes_hts_id?} }`).
- Produces: local component state `cargoItem: CargoItem`, `form` (react-hook-form, fields: mode/origin/destination), `originDetails`/`destinationDetails` state, `containerTypes`/`containerSizes` (from `useContainerRefs()`), and `smartMode: boolean` (defaults `true`). Task 3's `deriveSharedPayload()` helper turns this state into the flat shape `useRateFetching.fetchRates()` and `QuoteTransferSchema` (Task 4) expect.

- [ ] **Step 1: Read the exact form JSX to port**

Run: `git show a98b136c^:src/components/sales/quick-quote/QuickQuoteModal.tsx > /tmp/old-quick-quote-modal.tsx`

Read lines 795–1084 of that file (the `<form onSubmit=...>` block inside the old left panel) for the Transport Mode tabs layout and origin/destination field placement — the old modal predates `SharedCargoInput`/`CargoItem` (those were introduced later, when `UnifiedQuoteComposer`/`FormZone` were built), so the cargo/container portion is NOT ported from this old file; it's built fresh against today's `CargoItem` API per Step 2-3 below, following the pattern in `FormZone.tsx:169-177` (initial state) and `FormZone.tsx:395-434` (deriving flat fields from `cargoItem`).

- [ ] **Step 2: Add form state to SmartQuoteWorkspace**

Add to the top of the component (above the `return`):

```tsx
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Plane, Ship, Truck, Train } from 'lucide-react';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import { SharedCargoInput } from '@/components/quotation/shared/SharedCargoInput';
import { CargoItem } from '@/types/cargo';

const smartQuoteFormSchema = z.object({
  mode: z.enum(['air', 'ocean', 'road', 'rail']),
  origin: z.string().min(2, 'Origin is required'),
  destination: z.string().min(2, 'Destination is required'),
});

type SmartQuoteFormValues = z.infer<typeof smartQuoteFormSchema>;

const INITIAL_CARGO_ITEM: CargoItem = {
  id: '1',
  type: 'container',
  quantity: 1,
  dimensions: { l: 0, w: 0, h: 0, unit: 'cm' },
  weight: { value: 0, unit: 'kg' },
  stackable: false,
  containerDetails: { typeId: '', sizeId: '' },
};
```

Inside the component body:

```tsx
  const { containerTypes, containerSizes } = useContainerRefs();
  const [smartMode, setSmartMode] = useState(true);
  const [cargoItem, setCargoItem] = useState<CargoItem>(INITIAL_CARGO_ITEM);
  const [originDetails, setOriginDetails] = useState<any>(null);
  const [destinationDetails, setDestinationDetails] = useState<any>(null);

  const form = useForm<SmartQuoteFormValues>({
    resolver: zodResolver(smartQuoteFormSchema),
    defaultValues: { mode: 'ocean' },
  });
  const mode = form.watch('mode');
```

- [ ] **Step 3: Replace the left panel placeholder with the real form**

Replace the `{/* Task 2 adds the form here */}` comment with:

```tsx
            <form className="space-y-6">
              <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/30 p-3 rounded-md border border-purple-100 dark:border-purple-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-purple-900 dark:text-purple-200">Smart Quote Mode</span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400">AI-optimized routes & pricing</span>
                  </div>
                </div>
                <Switch checked={smartMode} onCheckedChange={setSmartMode} data-testid="smart-mode-switch" />
              </div>

              <div className="space-y-2">
                <Label>Transport Mode</Label>
                <Tabs value={mode} onValueChange={(v) => form.setValue('mode', v as SmartQuoteFormValues['mode'])} className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="ocean"><Ship className="w-4 h-4 mr-2" />Ocean</TabsTrigger>
                    <TabsTrigger value="air"><Plane className="w-4 h-4 mr-2" />Air</TabsTrigger>
                    <TabsTrigger value="road"><Truck className="w-4 h-4 mr-2" />Road</TabsTrigger>
                    <TabsTrigger value="rail"><Train className="w-4 h-4 mr-2" />Rail</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label>Origin</Label>
                <LocationAutocomplete
                  value={form.watch('origin') || ''}
                  onChange={(value: string, location?: any) => {
                    form.setValue('origin', value);
                    if (location) {
                      setOriginDetails({
                        id: location.id,
                        name: location.location_name,
                        formatted_address: [location.city, location.country].filter(Boolean).join(', '),
                        code: location.location_code,
                      });
                    }
                  }}
                  placeholder="Origin port, airport, or city"
                />
              </div>

              <div className="space-y-2">
                <Label>Destination</Label>
                <LocationAutocomplete
                  value={form.watch('destination') || ''}
                  onChange={(value: string, location?: any) => {
                    form.setValue('destination', value);
                    if (location) {
                      setDestinationDetails({
                        id: location.id,
                        name: location.location_name,
                        formatted_address: [location.city, location.country].filter(Boolean).join(', '),
                        code: location.location_code,
                      });
                    }
                  }}
                  placeholder="Destination port, airport, or city"
                />
              </div>

              <SharedCargoInput
                value={cargoItem}
                onChange={setCargoItem}
              />
            </form>
```

`SharedCargoInput` already renders its own commodity/HTS lookup, weight/volume fields, and (for container-type cargo) container type/size/quantity combo editor internally — this replaces the old modal's separate commodity `<Input>` and container-combo UI entirely.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Extend the smoke test**

```tsx
  it('lets the user pick a transport mode and enter origin/destination', async () => {
    const { getByText, getByLabelText } = render(
      <MemoryRouter initialEntries={['/dashboard/quotes/smart-quote']}>
        <SmartQuoteWorkspace />
      </MemoryRouter>
    );
    expect(getByText('Ocean')).toBeInTheDocument();
    expect(getByText('Air')).toBeInTheDocument();
  });
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/pages/dashboard/SmartQuoteWorkspace.tsx src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx
git commit -m "feat(quote): add shipment form to SmartQuoteWorkspace"
```

---

### Task 3: Wire rate generation and results rendering

**Files:**
- Modify: `src/pages/dashboard/SmartQuoteWorkspace.tsx`
- Test: `src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx` (extend)

**Interfaces:**
- Consumes: `useRateFetching()` from `@/hooks/useRateFetching` → `{ results: RateOption[] | null, loading: boolean, error: string | null, marketAnalysis: string | null, confidenceScore: number | null, anomalies: string[], fetchRates: (params: RateFetchParams, containerResolver: ContainerResolver) => Promise<RateOption[]>, clearResults: () => void }` (confirmed current signature in `src/hooks/useRateFetching.ts:394-403`).
- Consumes: `QuoteResultsList` from `@/components/quotation/shared/QuoteResultsList` → props `{ results, onSelect, selectedIds?, onToggleSelection?, onGenerateSmartOptions?, marketAnalysis?, confidenceScore?, anomalies? }` (confirmed at `QuoteResultsList.tsx:74-85`).
- Consumes: `QuoteComparisonView` from `@/components/quotation/shared/QuoteComparisonView` → props `{ options, onSelect, selectedIds?, onToggleSelection?, onGenerateSmartOptions? }` (confirmed at `QuoteComparisonView.tsx:24-30`).
- Produces: `selectedIds: string[]` state, `viewMode: 'list' | 'compare'` state, `rateFetching: RateFetchingResult` (from `useRateFetching()`), `containerResolver` (memoized `ContainerResolver`), `handleGenerate: () => Promise<void>`, and the module-level helpers `deriveSharedPayload(values, cargoItem, originDetails, destinationDetails)` / `formatCommodityDisplay(commodity)` — all consumed by Task 4's hand-off logic.

- [ ] **Step 1: Add the container resolver and generate handler**

Add inside the component, after the `form` declaration from Task 2:

```tsx
  const containerResolver = useMemo(() => ({
    resolveContainerInfo: (typeId: string, sizeId: string) => {
      const typeObj = containerTypes.find((t: any) => t.id === typeId);
      const sizeObj = containerSizes.find((s: any) => s.id === sizeId);
      return {
        type: typeObj?.code || typeObj?.name || typeId,
        size: sizeObj?.name || sizeId,
        iso_code: sizeObj?.iso_code,
      };
    },
  }), [containerTypes, containerSizes]);

  const rateFetching = useRateFetching();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'compare'>('list');

  const handleGenerate = form.handleSubmit(async (values) => {
    setSelectedIds([]);
    const shared = deriveSharedPayload(values, cargoItem, originDetails, destinationDetails);
    await rateFetching.fetchRates(
      { ...shared, smartMode, account_id: undefined } as any,
      containerResolver
    );
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
```

Add the import: `import { useRateFetching } from '@/hooks/useRateFetching';`

Add this module-level helper above the component (it turns the page's `cargoItem`-based state into the flat field shape both `useRateFetching.fetchRates()` and `QuoteTransferSchema` — Task 4 — expect; mirrors the derivation `FormZone.tsx:395-434` does continuously for the general composer, but computed once at generate-time here since this page has no persistent multi-tab form context to keep in sync):

```tsx
function formatCommodityDisplay(commodity?: { description?: string; hts_code?: string }): string {
  if (!commodity) return '';
  const description = (commodity.description || '').trim();
  const htsCode = (commodity.hts_code || '').trim();
  if (description && htsCode) return `${description} - ${htsCode}`;
  return description || htsCode;
}

function deriveSharedPayload(
  values: SmartQuoteFormValues,
  cargoItem: CargoItem,
  originDetails: any,
  destinationDetails: any
) {
  const containerCombos =
    cargoItem.type === 'container'
      ? (cargoItem.containerCombos && cargoItem.containerCombos.length > 0
          ? cargoItem.containerCombos.map((c) => ({ type: c.typeId, size: c.sizeId, qty: c.quantity }))
          : cargoItem.containerDetails?.typeId && cargoItem.containerDetails?.sizeId
            ? [{ type: cargoItem.containerDetails.typeId, size: cargoItem.containerDetails.sizeId, qty: cargoItem.quantity }]
            : [])
      : [];

  return {
    mode: values.mode,
    origin: values.origin,
    destination: values.destination,
    commodity: formatCommodityDisplay(cargoItem.commodity),
    commodity_description: cargoItem.commodity?.description || '',
    htsCode: cargoItem.commodity?.hts_code || '',
    weight: String(cargoItem.weight.value || 0),
    volume: String(cargoItem.volume || 0),
    containerType: containerCombos[0]?.type || '',
    containerSize: containerCombos[0]?.size || '',
    containerQty: String(containerCombos[0]?.qty || cargoItem.quantity || 1),
    containerCombos,
    dangerousGoods: !!cargoItem.hazmat,
    originDetails,
    destinationDetails,
  };
}
```

- [ ] **Step 2: Wire the Generate button and results panel**

At the end of the `<form>` (after `SharedCargoInput`), add:

```tsx
              <Button type="button" onClick={handleGenerate} disabled={rateFetching.loading} className="w-full">
                {rateFetching.loading ? 'Generating...' : 'Generate Smart Quotes'}
              </Button>
```

Replace the right-panel placeholder (`{/* results panel */}` block from Task 1) with:

```tsx
          <div className="flex-1 p-6 bg-background border rounded-lg overflow-y-auto">
            {!rateFetching.results ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p>Fill out the form to generate quotes</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">Rate Options</h3>
                    <Badge variant="outline" className="text-xs">{rateFetching.results.length} Options</Badge>
                  </div>
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'compare')} className="w-auto">
                    <TabsList className="h-8">
                      <TabsTrigger value="list" className="text-xs h-7 px-2">Browse</TabsTrigger>
                      <TabsTrigger value="compare" className="text-xs h-7 px-2">Compare</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                {viewMode === 'list' ? (
                  <QuoteResultsList
                    results={rateFetching.results}
                    onSelect={handleConvertToQuote}
                    selectedIds={selectedIds}
                    onToggleSelection={toggleSelection}
                    onGenerateSmartOptions={smartMode ? handleGenerate : undefined}
                    marketAnalysis={rateFetching.marketAnalysis}
                    confidenceScore={rateFetching.confidenceScore}
                    anomalies={rateFetching.anomalies}
                  />
                ) : (
                  <QuoteComparisonView
                    options={rateFetching.results}
                    onSelect={handleConvertToQuote}
                    selectedIds={selectedIds}
                    onToggleSelection={toggleSelection}
                    onGenerateSmartOptions={smartMode ? handleGenerate : undefined}
                  />
                )}
              </div>
            )}
          </div>
```

Add imports: `import { QuoteResultsList } from '@/components/quotation/shared/QuoteResultsList';`, `import { QuoteComparisonView } from '@/components/quotation/shared/QuoteComparisonView';`, `import { Badge } from '@/components/ui/badge';`

`handleConvertToQuote` is defined in Task 4 — for now, add a temporary stub so this compiles: `const handleConvertToQuote = (option: any) => { console.log('select', option); };` (Task 4 replaces this).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev:vite`, navigate to `/dashboard/quotes/smart-quote`, pick a transport mode, fill in origin/destination, enter a commodity description and weight in the `SharedCargoInput` panel, click "Generate Smart Quotes". Confirm results render in the right panel and the List/Compare toggle works.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard/SmartQuoteWorkspace.tsx
git commit -m "feat(quote): wire rate generation and results rendering in SmartQuoteWorkspace"
```

---

### Task 4: Selection hand-off to QuoteNew

**Files:**
- Modify: `src/pages/dashboard/SmartQuoteWorkspace.tsx`
- Test: `src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx`

**Interfaces:**
- Consumes: `QuoteTransferSchema` from `@/lib/schemas/quote-transfer` — `.parse(payload)` throws `z.ZodError` on invalid data; on success returns `QuoteTransferData` (confirmed shape in `src/lib/schemas/quote-transfer.ts:104-144`, requires `origin`, `destination`, `mode`, `selectedRates` (min 1 item) at minimum).
- Produces: `handleConvertToQuote(option: RateOption | RateOption[])` — replaces Task 3's stub. Calling it with a valid option navigates to `/dashboard/quotes/new` with `location.state` shaped as `QuoteTransferData & { selectedRate: RateOption }`. This is exactly what Task 6 reads on the receiving side.

- [ ] **Step 1: Write the failing hand-off contract test**

```tsx
// src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';

describe('SmartQuoteWorkspace hand-off payload', () => {
  it('produces a payload that satisfies QuoteTransferSchema', () => {
    const formValues = { mode: 'ocean', origin: 'CNSHA', destination: 'USLAX', commodity: 'General Cargo' };
    const extendedData = { containerType: 'dry', containerSize: '20ft', containerQty: '1', htsCode: '', dangerousGoods: false, specialHandling: '', vehicleType: 'van', pickupDate: '', deliveryDeadline: '', originDetails: null, destinationDetails: null };
    const selectedOption = { id: 'opt-1', carrier: 'Maersk', price: 1200, currency: 'USD' };

    const transferPayload = {
      ...formValues,
      ...extendedData,
      containerCombos: [{ type: 'dry', size: '20ft', qty: 1 }],
      selectedRates: [selectedOption],
    };

    expect(() => QuoteTransferSchema.parse(transferPayload)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx`
Expected: This particular test should actually PASS as written since it only exercises the schema (already live) — this step confirms the schema accepts the shape the page will build. If it fails, the field names in the payload above are wrong; fix them before Step 3.

- [ ] **Step 3: Replace the Task 3 stub with the real handler**

Add these imports (`useNavigate` is already imported from Task 1 — do not add it a second time, that's a duplicate-identifier compile error):

```tsx
  import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';
  import { useToast } from '@/hooks/use-toast';
  import { logger } from '@/lib/logger';
  import type { RateOption } from '@/types/quote-breakdown';
```

```tsx
  // inside the component:
  const { toast } = useToast();

  const handleConvertToQuote = (option: RateOption | RateOption[]) => {
    const selectedOptions = Array.isArray(option) ? option : [option];
    const values = form.getValues();
    const shared = deriveSharedPayload(values, cargoItem, originDetails, destinationDetails);
    const transferPayload = {
      ...shared,
      selectedRates: selectedOptions,
      marketAnalysis: rateFetching.marketAnalysis,
      confidenceScore: rateFetching.confidenceScore,
      anomalies: rateFetching.anomalies,
    };

    try {
      const validatedData = QuoteTransferSchema.parse(transferPayload);
      logger.info('Smart Quote hand-off to New Quote', {
        origin: validatedData.origin,
        destination: validatedData.destination,
        mode: validatedData.mode,
        optionsCount: validatedData.selectedRates.length,
      });
      navigate('/dashboard/quotes/new', {
        state: { ...validatedData, selectedRate: selectedOptions[0] },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('\n');
        toast({ title: 'Data Validation Error', description: `Cannot proceed. Missing or invalid fields:\n${errorMessages}`, variant: 'destructive' });
      } else {
        toast({ title: 'Transfer Error', description: 'An unexpected error occurred preparing the quote.', variant: 'destructive' });
      }
    }
  };

  const handleConvertSelected = () => {
    if (!rateFetching.results) return;
    const selectedOptions = rateFetching.results.filter((r) => selectedIds.includes(r.id));
    if (selectedOptions.length > 0) handleConvertToQuote(selectedOptions);
  };
```

- [ ] **Step 4: Add the floating "Create Quote with Selected" footer**

Inside the results panel, after the `QuoteResultsList`/`QuoteComparisonView` conditional block:

```tsx
                {selectedIds.length > 0 && (
                  <div className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg flex justify-between items-center">
                    <div className="text-sm font-medium">
                      <Badge variant="secondary" className="mr-2">{selectedIds.length}</Badge>
                      options selected
                    </div>
                    <Button onClick={handleConvertSelected} className="gap-2">
                      Create Quote with Selected <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
```

Add `ArrowRight` to the lucide-react import list.

- [ ] **Step 5: Typecheck and run tests**

Run: `npm run typecheck && npx vitest run src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx`
Expected: PASS

- [ ] **Step 6: Manual end-to-end verification**

Run `npm run dev:vite`, navigate to `/dashboard/quotes/smart-quote`, generate quotes, select one, click it. Confirm the browser navigates to `/dashboard/quotes/new` and the "General Information" tab's origin/destination/mode fields are pre-filled (this part already works today per Task 6's baseline — Task 6 adds the missing "selected rate" pre-population).

- [ ] **Step 7: Commit**

```bash
git add src/pages/dashboard/SmartQuoteWorkspace.tsx src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx
git commit -m "feat(quote): wire selection hand-off from SmartQuoteWorkspace to QuoteNew"
```

---

### Task 5: Add Quick Quote History to the workspace

**Files:**
- Modify: `src/pages/dashboard/SmartQuoteWorkspace.tsx`

**Interfaces:**
- Consumes: `QuickQuoteHistory` from `@/components/quotation/shared/QuickQuoteHistory` → props `{ onSelect: (data: any) => void, className?: string }` (confirmed unchanged at `QuickQuoteHistory.tsx:22-25`). It is a self-contained `Dialog` + trigger `Button` — no layout wrapper needed beyond placing it.

- [ ] **Step 1: Add the history button next to the page title**

In the header row from Task 1 (next to the back button / title), add:

```tsx
          <QuickQuoteHistory
            onSelect={(payload) => {
              navigate('/dashboard/quotes/new', { state: payload });
            }}
          />
```

Add the import: `import { QuickQuoteHistory } from '@/components/quotation/shared/QuickQuoteHistory';`

This mirrors exactly how the deleted `QuoteNew.tsx` wired it before (`git show a98b136c^:src/pages/dashboard/QuoteNew.tsx` lines 558-580, 807) — `onSelect` receives a payload already shaped with `request_payload` spread + `selectedRates`/`historyId`, and just re-navigates to `/dashboard/quotes/new` with it as state.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev:vite`, navigate to `/dashboard/quotes/smart-quote`, generate at least one quote (so `ai_quote_requests` has a row), reload, click "AI Quote History", confirm the generated request appears and clicking it navigates to `/dashboard/quotes/new` with pre-filled data.

- [ ] **Step 4: Commit**

```bash
git add src/pages/dashboard/SmartQuoteWorkspace.tsx
git commit -m "feat(quote): add Quick Quote History to SmartQuoteWorkspace"
```

---

### Task 6: Close the receiving-side gap — pre-populate selected rate in UnifiedQuoteComposer

**Files:**
- Modify: `src/components/quotation/unified-composer/UnifiedQuoteComposer.tsx:2280-2334` (the `initialData` pre-population effect)
- Test: `src/components/quotation/unified-composer/__tests__/UnifiedQuoteComposer.smart-quote-handoff.test.tsx`

**Context:** Research confirmed `QuoteNew.tsx` already passes `location.state` through as `initialData` to `UnifiedQuoteComposer`, and the schema (`QuoteTransferSchema`) requires `selectedRates` — but the composer's pre-population `useEffect` (currently only sets `initialFormValues`/`initialExtended`/`form.reset`) never reads `initialData.selectedRates`, so a user arriving from Smart Quote sees a pre-filled form but has to re-click "Get Rates" instead of seeing their already-chosen option. This task closes that gap using the composer's existing `manualOptions`/`selectedOption`/`activeComposerSection` state (the same mechanism already used elsewhere for manually-added/edited options — see `UnifiedQuoteComposer.tsx:139,2383`), so no changes to the shared `useRateFetching` hook are needed.

**Interfaces:**
- Consumes: `setManualOptions: (options: RateOption[]) => void` (existing state setter, `UnifiedQuoteComposer.tsx:139`), `setSelectedOption: (option: RateOption | null) => void` (existing, `UnifiedQuoteComposer.tsx:132`), `setActiveComposerSection: (section: ComposerSection) => void` (existing, `UnifiedQuoteComposer.tsx:148`, values are `'form' | 'results' | ...` — confirm exact `ComposerSection` union before using; `'results'` is confirmed valid from the existing `TabsContent value="results"` usage at line ~4014).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/quotation/unified-composer/__tests__/UnifiedQuoteComposer.smart-quote-handoff.test.tsx
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';

// Reuse the existing mock setup from UnifiedQuoteComposer.test.tsx for useCRM/useAuth/etc.
// (copy the vi.mock blocks from that file's top rather than duplicating logic here)

describe('UnifiedQuoteComposer Smart Quote hand-off', () => {
  it('pre-populates the selected rate and switches to the results tab when initialData.selectedRates is present', () => {
    const initialData = {
      mode: 'ocean',
      origin: 'CNSHA',
      destination: 'USLAX',
      commodity: 'General Cargo',
      selectedRates: [{ id: 'opt-1', carrier: 'Maersk', price: 1200, currency: 'USD', name: 'Best Value' }],
    };

    render(
      <MemoryRouter>
        <UnifiedQuoteComposer initialData={initialData} />
      </MemoryRouter>
    );

    expect(screen.getByText('Quotation Composer')).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Maersk')).toBeInTheDocument();
  });
});
```

> **Note for implementer:** copy the exact `vi.mock` boilerplate (useCRM, useAuth, useDomain, supabase client, etc.) from the top of `src/components/quotation/unified-composer/UnifiedQuoteComposer.test.tsx` into this new file rather than reinventing it — that file already has a working mock setup for rendering this component in isolation.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/quotation/unified-composer/__tests__/UnifiedQuoteComposer.smart-quote-handoff.test.tsx`
Expected: FAIL — results tab not active, "Maersk" not found.

- [ ] **Step 3: Extend the pre-population effect**

In `UnifiedQuoteComposer.tsx`, add to the end of the `useEffect` at line 2283-2334 (inside the same effect, after the existing `if (initialData.containerType || ...)` block, still within `if (!initialData) return;`):

```tsx
    if (Array.isArray(initialData.selectedRates) && initialData.selectedRates.length > 0) {
      setManualOptions(initialData.selectedRates);
      setSelectedOption(initialData.selectedRates[0]);
      setActiveComposerSection('results');
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/quotation/unified-composer/__tests__/UnifiedQuoteComposer.smart-quote-handoff.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full existing UnifiedQuoteComposer test suite to check for regressions**

Run: `npx vitest run src/components/quotation/unified-composer/`
Expected: PASS (no existing test should have depended on `selectedRates` being ignored).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Manual end-to-end verification**

Run `npm run dev:vite`, go through Smart Quote → generate → select an option. Confirm `/dashboard/quotes/new` lands directly on the "Quotation Composer" tab with the selected option already visible, instead of the empty "General Information" tab.

- [ ] **Step 8: Commit**

```bash
git add src/components/quotation/unified-composer/UnifiedQuoteComposer.tsx src/components/quotation/unified-composer/__tests__/UnifiedQuoteComposer.smart-quote-handoff.test.tsx
git commit -m "fix(quote): pre-populate selected rate when arriving from Smart Quote hand-off"
```

---

### Task 7: Repoint the Smart Quote buttons to the new workspace

**Files:**
- Modify: `src/pages/dashboard/QuotationManager.tsx` (the "Smart Quote" button added in prior work, currently `onClick={() => navigate("/dashboard/quotes/new")}`)
- Modify: `src/pages/dashboard/Quotes.tsx` (same button, currently `onClick={() => navigate('/dashboard/quotes/new')}`)

**Interfaces:**
- Consumes: route `/dashboard/quotes/smart-quote` from Task 1.

- [ ] **Step 1: Update QuotationManager.tsx**

Find the "Smart Quote" `<Button>` (added earlier, has `title="Smart Quote"`) and change its `onClick` from `() => navigate("/dashboard/quotes/new")` to `() => navigate("/dashboard/quotes/smart-quote")`.

- [ ] **Step 2: Update Quotes.tsx**

Same change: find the "Smart Quote" `<Button>` (`title="Smart Quote"`) and change `onClick={() => navigate('/dashboard/quotes/new')}` to `onClick={() => navigate('/dashboard/quotes/smart-quote')}`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev:vite`, click the sidebar "Quotes" link (goes to `/dashboard/quotes/pipeline` → `QuotationManager`), click "Smart Quote" — confirm it now lands on `/dashboard/quotes/smart-quote` instead of `/dashboard/quotes/new`. Repeat from `/dashboard/quotes` (`Quotes.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard/QuotationManager.tsx src/pages/dashboard/Quotes.tsx
git commit -m "feat(quote): repoint Smart Quote buttons to the standalone SmartQuoteWorkspace"
```

---

## Self-Review Notes (for whoever executes this plan)

- `SharedCargoInput`'s props (`value: CargoItem`, `onChange`, `onCommodityChange?`, `onRemove?`, `className?`, `errors?`, `disableMultiContainer?`) and `LocationAutocomplete`'s props (`value?`, `onChange: (value, location?: Location) => void`, `placeholder?`, `className?`, `disabled?`, `preloadedLocations?`, `error?`) were both read directly from source (`SharedCargoInput.tsx:19-27`, `LocationAutocomplete.tsx:43-51`) and the plan's JSX in Task 2 was corrected to match — including removing an invalid `mode` prop this plan initially guessed at (neither component accepts one) and correcting `Location`'s fields (no `state_province`; only `id/location_name/location_code/location_type/country/city`).
- `ComposerSection` (`UnifiedQuoteComposer.tsx:77`) is `'form' | 'results' | 'finalize'` — confirmed `'results'` is valid for Task 6's `setActiveComposerSection('results')` call.
- Known residual gap after this plan: `rateFetching.marketAnalysis`/`confidenceScore`/`anomalies` are not restored when arriving via `QuickQuoteHistory` (Task 5) or the Smart Quote hand-off (Task 6) — only the selected rate itself is. Restoring the analysis text would require exposing setters from `useRateFetching`, which this plan deliberately avoids touching (see Global Constraints). Flag to the user as a possible fast-follow if they notice it.
