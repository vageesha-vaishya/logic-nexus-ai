# Smart Quote Workspace - Visual & Layout Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/dashboard/quotes/smart-quote` a distinctive, fixed visual identity (color/type tokens) and a new card-based results view, replacing the current stock Shadcn look and Browse/Compare tab toggle.

**Architecture:** Extract a shared route-leg normalization util so the new card and the existing shared component both use one implementation. Build a page-scoped CSS token file (light + `.dark` overrides) and two new presentational components (`SmartQuoteRateCard`, `ShipmentRecapStrip`). Integrate everything into `SmartQuoteWorkspace.tsx`, replacing its theme-preset call, its Browse/Compare tabs, and its results rendering — while leaving `QuoteResultsList`, `QuoteComparisonView`, `QuoteDetailView`, and `QuickQuoteHistory` (all shared with `UnifiedQuoteComposer`) internally untouched.

**Tech Stack:** React 18 + TypeScript + Vite, react-hook-form + Zod (untouched), Tailwind CSS for layout, plain CSS custom properties for the new token system, `@fontsource/*` npm packages for self-hosted fonts (the codebase's existing convention — see the Sthira module's `@fontsource/source-serif-pro` / `@fontsource/inter` in `src/main.tsx`), Vitest + `@testing-library/react` for tests.

**Design spec:** `docs/superpowers/specs/2026-08-20-smart-quote-visual-refresh-design.md` — read it once for full rationale; this plan does not repeat the "why," only the "what" and "how."

## Global Constraints

- No new AI/NLP capability, no functional `⌘K`, no changes to `UnifiedQuoteComposer`/`QuoteNew.tsx`/the in-composer Smart Quote Mode toggle. (spec §2)
- `QuoteResultsList`, `QuoteComparisonView`, `QuoteDetailView`, `QuickQuoteHistory` keep their current runtime behavior. The only permitted change to any of them is the pure extraction in Task 1. (spec §2, §5)
- Color and font values live only in `--sq-*` CSS custom properties, defined once in `src/components/quotation/smart-quote/smart-quote-identity.css`. No new hardcoded hex values or literal Tailwind palette classes (`bg-purple-600`, `text-green-700`, etc.) anywhere else in this feature's new code — reference the token via inline `style` (e.g. `style={{ color: 'var(--sq-ink)' }}`). Tailwind utility classes are used only for layout/spacing/sizing, never color, in the new components.
- Dark mode is a manually-toggled `.dark` class on `document.documentElement` (`src/hooks/useTheme.tsx`'s `toggleDark`) — verified against `tailwind.config.ts`'s `darkMode: ["class"]`. Dark token values are defined under a `.dark .smart-quote-identity { ... }` selector, never a `prefers-color-scheme` media query or a `data-theme` attribute (neither exists in this codebase).
- `RateOption.name`, `.transitTime`, and `.tier` are typed as required strings but are not guaranteed present at runtime (the existing hand-off tests pass minimal fixtures via `as any`). Every new component reading these fields must degrade gracefully (omit the element, or fall back to a placeholder) rather than throw or render `"undefined"`.
- All existing `data-testid` attributes on retained interactive elements (at minimum `smart-mode-switch`) must be preserved exactly through the restyle.
- New copy is hardcoded English, matching this page's existing (non-`useTranslation`) precedent — do not introduce a partial i18n boundary.
- Every new interactive element gets a visible keyboard-focus state. Any animated/pulsing indicator respects `prefers-reduced-motion`.
- Run `npm run typecheck` and the relevant `npx vitest run <path>` after every task before committing.

---

### Task 1: Extract shared route-leg normalization into `src/lib/quote-legs.ts`

**Files:**
- Create: `src/lib/quote-legs.ts`
- Test: `src/lib/__tests__/quote-legs.test.ts`
- Modify: `src/components/quotation/shared/QuoteResultsList.tsx`

**Interfaces:**
- Produces: `normalizePoint(value: unknown): string` and `mapLegsForVisualizer(legs: TransportLeg[] | undefined, route?: { origin?: string; destination?: string }): VisualizerLeg[]`, where `VisualizerLeg = { from: string; to: string; mode: string; carrier: string; transit_time?: string; origin: string; destination: string }`. Both exported from `src/lib/quote-legs.ts`.
- Consumed by: Task 3 (`SmartQuoteRateCard`) and `QuoteResultsList.tsx` (this task).

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/quote-legs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapLegsForVisualizer, normalizePoint } from '../quote-legs';

describe('normalizePoint', () => {
  it('trims whitespace', () => {
    expect(normalizePoint('  CNSHA  ')).toBe('CNSHA');
  });

  it('returns empty string for the literal placeholders "origin" and "destination"', () => {
    expect(normalizePoint('origin')).toBe('');
    expect(normalizePoint('Destination')).toBe('');
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(normalizePoint(null)).toBe('');
    expect(normalizePoint(undefined)).toBe('');
    expect(normalizePoint('')).toBe('');
  });
});

describe('mapLegsForVisualizer', () => {
  it('returns an empty array when legs is undefined', () => {
    expect(mapLegsForVisualizer(undefined)).toEqual([]);
  });

  it('fills the first leg origin and last leg destination from the route when missing', () => {
    const legs = [
      { id: 'l1', mode: 'ocean', origin: '', destination: 'KRPUS' } as any,
      { id: 'l2', mode: 'ocean', origin: 'KRPUS', destination: '' } as any,
    ];
    const result = mapLegsForVisualizer(legs, { origin: 'CNSHA', destination: 'USLAX' });
    expect(result[0].from).toBe('CNSHA');
    expect(result[0].to).toBe('KRPUS');
    expect(result[1].from).toBe('KRPUS');
    expect(result[1].to).toBe('USLAX');
  });

  it('fills continuity between legs when an inner leg is missing an endpoint', () => {
    const legs = [
      { id: 'l1', mode: 'ocean', origin: 'CNSHA', destination: 'KRPUS' } as any,
      { id: 'l2', mode: 'ocean', origin: '', destination: 'USLAX' } as any,
    ];
    const result = mapLegsForVisualizer(legs);
    expect(result[1].from).toBe('KRPUS');
  });

  it('defaults carrier to "Unknown Carrier" when missing', () => {
    const legs = [{ id: 'l1', mode: 'ocean', origin: 'CNSHA', destination: 'USLAX' } as any];
    const result = mapLegsForVisualizer(legs);
    expect(result[0].carrier).toBe('Unknown Carrier');
  });

  it('falls back to "Origin"/"Destination" when nothing resolves an endpoint', () => {
    const legs = [{ id: 'l1', mode: 'ocean', origin: '', destination: '' } as any];
    const result = mapLegsForVisualizer(legs);
    expect(result[0].from).toBe('Origin');
    expect(result[0].to).toBe('Destination');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/quote-legs.test.ts`
Expected: FAIL — `Cannot find module '../quote-legs'` (or similar resolution error).

- [ ] **Step 3: Create the module**

Create `src/lib/quote-legs.ts` — moved verbatim from `QuoteResultsList.tsx` (previously module-local, lines 208-257), now exported:

```ts
import { TransportLeg } from '@/types/quote-breakdown';

export interface VisualizerLeg {
  from: string;
  to: string;
  mode: string;
  carrier: string;
  transit_time?: string;
  origin: string;
  destination: string;
}

export const normalizePoint = (value: unknown): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.toLowerCase() === 'origin') return '';
  if (normalized.toLowerCase() === 'destination') return '';
  return normalized;
};

export const mapLegsForVisualizer = (
  legs: TransportLeg[] | undefined,
  route?: { origin?: string; destination?: string }
): VisualizerLeg[] => {
  if (!legs) return [];
  const normalized = legs.map((leg) => ({
    ...leg,
    origin: normalizePoint((leg as any).origin || (leg as any).from),
    destination: normalizePoint((leg as any).destination || (leg as any).to),
  }));
  if (normalized.length > 0) {
    if (!normalized[0].origin) normalized[0].origin = normalizePoint(route?.origin);
    if (!normalized[normalized.length - 1].destination) {
      normalized[normalized.length - 1].destination = normalizePoint(route?.destination);
    }
  }
  for (let i = 1; i < normalized.length; i += 1) {
    if (!normalized[i].origin && normalized[i - 1].destination) {
      normalized[i].origin = normalized[i - 1].destination;
    }
  }
  for (let i = normalized.length - 2; i >= 0; i -= 1) {
    if (!normalized[i].destination && normalized[i + 1].origin) {
      normalized[i].destination = normalized[i + 1].origin;
    }
  }
  for (let i = 0; i < normalized.length; i += 1) {
    const previousDestination = i > 0 ? normalized[i - 1].destination : normalizePoint(route?.origin);
    const nextOrigin = i < normalized.length - 1 ? normalized[i + 1].origin : normalizePoint(route?.destination);
    if (!normalized[i].origin) normalized[i].origin = previousDestination || normalizePoint(route?.origin) || 'Origin';
    if (!normalized[i].destination) normalized[i].destination = nextOrigin || normalizePoint(route?.destination) || 'Destination';
  }
  return normalized.map((leg) => ({
    from: leg.origin,
    to: leg.destination,
    mode: leg.mode,
    carrier: leg.carrier || 'Unknown Carrier',
    transit_time: leg.transit_time,
    origin: leg.origin,
    destination: leg.destination,
  }));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/quote-legs.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Update `QuoteResultsList.tsx` to import instead of define**

In `src/components/quotation/shared/QuoteResultsList.tsx`:
- Remove the `normalizePoint` and `mapLegsForVisualizer` `const` declarations (the block currently at lines 208-257).
- Add to the import section: `import { mapLegsForVisualizer } from '@/lib/quote-legs';` (only `mapLegsForVisualizer` is used inside this file — `normalizePoint` was only an internal helper for it).

- [ ] **Step 6: Run QuoteResultsList's existing tests to confirm unchanged behavior**

Run: `npx vitest run src/components/quotation/shared/__tests__/QuoteResultsList.badge.test.tsx src/components/quotation/shared/__tests__/QuoteResultsList.remove.test.tsx`
Expected: PASS, identical to before the extraction (this is the regression guard proving the move didn't change behavior).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/quote-legs.ts src/lib/__tests__/quote-legs.test.ts src/components/quotation/shared/QuoteResultsList.tsx
git commit -m "refactor(quotation): extract route-leg normalization into shared quote-legs util"
```

---

### Task 2: Visual identity tokens (`smart-quote-identity.css` + fonts)

**Files:**
- Create: `src/components/quotation/smart-quote/smart-quote-identity.css`
- Test: `src/components/quotation/smart-quote/__tests__/smart-quote-identity.css.test.ts`
- Modify: `package.json` (add `@fontsource/big-shoulders-display`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`)

**Interfaces:**
- Produces: a `.smart-quote-identity` wrapper class (and its `.dark .smart-quote-identity` override) defining these custom properties, consumed by Task 3, Task 4, and Task 5:
  `--sq-ink`, `--sq-bg`, `--sq-surface`, `--sq-border`, `--sq-accent`, `--sq-accent-ink`, `--sq-tide`, `--sq-good`, `--sq-rust`, `--sq-font-display`, `--sq-font-body`, `--sq-font-mono`.

- [ ] **Step 1: Install the font packages**

Run: `npm install @fontsource/big-shoulders-display @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono`

(Verified to exist on the npm registry — `@fontsource/big-shoulders-display@5.3.0`, `@fontsource/ibm-plex-sans@5.3.0`, `@fontsource/ibm-plex-mono@5.3.0` at time of writing.)

- [ ] **Step 2: Write the failing test**

Create `src/components/quotation/smart-quote/__tests__/smart-quote-identity.css.test.ts`. This reads the raw CSS file (Node `fs`, not jsdom — this repo's Vitest setup does not process CSS during tests, so a computed-style assertion would be unreliable) and asserts every required token is defined in both the light and dark blocks, catching typos or an accidentally-omitted token before any component starts depending on it:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '../smart-quote-identity.css'), 'utf-8');

const REQUIRED_TOKENS = [
  '--sq-ink',
  '--sq-bg',
  '--sq-surface',
  '--sq-border',
  '--sq-accent',
  '--sq-accent-ink',
  '--sq-tide',
  '--sq-good',
  '--sq-rust',
];

function block(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const openBrace = source.indexOf('{', start);
  const closeBrace = source.indexOf('}', openBrace);
  return source.slice(openBrace, closeBrace);
}

describe('smart-quote-identity.css', () => {
  const lightBlock = block(css, '.smart-quote-identity');
  const darkBlock = block(css, '.dark .smart-quote-identity');

  it.each(REQUIRED_TOKENS)('defines %s in the light block', (token) => {
    expect(lightBlock).toContain(`${token}:`);
  });

  it.each(REQUIRED_TOKENS)('defines %s in the dark block', (token) => {
    expect(darkBlock).toContain(`${token}:`);
  });

  it('defines all three font-role tokens', () => {
    expect(lightBlock).toContain('--sq-font-display:');
    expect(lightBlock).toContain('--sq-font-body:');
    expect(lightBlock).toContain('--sq-font-mono:');
  });

  it('does not redefine font tokens in the dark block (fonts do not change with theme)', () => {
    expect(darkBlock).not.toContain('--sq-font-');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/quotation/smart-quote/__tests__/smart-quote-identity.css.test.ts`
Expected: FAIL — `ENOENT` (file doesn't exist yet).

- [ ] **Step 4: Create the CSS file**

Create `src/components/quotation/smart-quote/smart-quote-identity.css`:

```css
.smart-quote-identity {
  --sq-ink: #0E2430;
  --sq-bg: #EEF2F1;
  --sq-surface: #FFFFFF;
  --sq-border: #D3DCDA;
  --sq-accent: #C97F1C;
  --sq-accent-ink: #1A1103;
  --sq-tide: #1B8F86;
  --sq-good: #2F8F5B;
  --sq-rust: #B23A24;

  --sq-font-display: 'Big Shoulders Display', 'Arial Narrow', sans-serif;
  --sq-font-body: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif;
  --sq-font-mono: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;

  background: var(--sq-bg);
  color: var(--sq-ink);
  font-family: var(--sq-font-body);
}

.dark .smart-quote-identity {
  --sq-ink: #EAF1EF;
  --sq-bg: #0E2430;
  --sq-surface: #15303D;
  --sq-border: #2B4652;
  --sq-accent: #E3A64A;
  --sq-accent-ink: #1A1103;
  --sq-tide: #4FC9BE;
  --sq-good: #5CC48D;
  --sq-rust: #E4826A;
}

.smart-quote-identity :focus-visible {
  outline: 2px solid var(--sq-tide);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/quotation/smart-quote/__tests__/smart-quote-identity.css.test.ts`
Expected: PASS (20 tests: 9 `it.each` light-block checks + 9 `it.each` dark-block checks + 1 font-role check + 1 dark-does-not-redefine-fonts check).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/quotation/smart-quote/smart-quote-identity.css src/components/quotation/smart-quote/__tests__/smart-quote-identity.css.test.ts
git commit -m "feat(quotation): add SmartQuoteWorkspace visual identity tokens (color + fonts)"
```

---

### Task 3: `SmartQuoteRateCard` component

**Files:**
- Create: `src/components/quotation/smart-quote/SmartQuoteRateCard.tsx`
- Test: `src/components/quotation/smart-quote/__tests__/SmartQuoteRateCard.test.tsx`

**Interfaces:**
- Consumes: `mapLegsForVisualizer` from `src/lib/quote-legs.ts` (Task 1), `--sq-*` tokens from Task 2 (applied by an ancestor `.smart-quote-identity` wrapper — this component does not apply the wrapper itself, only references the tokens), `getModeIcon` from `src/components/quotation/shared/quote-badges.tsx`, `formatCurrency`/`cn` from `src/lib/utils.ts`, `formatContainerSize` from `src/lib/container-utils.ts`, `RateOption` from `src/types/quote-breakdown.ts`.
- Produces: `export function SmartQuoteRateCard(props: SmartQuoteRateCardProps): JSX.Element`, where
  ```ts
  export interface SmartQuoteRateCardProps {
    option: RateOption;
    isSelected: boolean;
    onToggleSelection: () => void;
    onSelect: () => void;
    onViewDetails: () => void;
  }
  ```
  Consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

Create `src/components/quotation/smart-quote/__tests__/SmartQuoteRateCard.test.tsx`:

```tsx
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SmartQuoteRateCard } from '../SmartQuoteRateCard';
import { RateOption } from '@/types/quote-breakdown';

const FULL_OPTION: RateOption = {
  id: 'opt-1',
  carrier: 'Pacific Crown Line',
  name: '2x 40HC FCL',
  price: 4180,
  currency: 'USD',
  transitTime: '27 days',
  tier: 'best_value',
  transport_mode: 'ocean',
  source_attribution: 'AI Smart Engine',
  verified: true,
  verificationTimestamp: '2026-08-20T10:00:00.000Z',
  reliability: { score: 9, on_time_performance: '96%' },
  co2_kg: 820,
  ai_explanation: 'Best balance of cost and transit time for this lane.',
  markupPercent: 15,
  marginAmount: 540,
  legs: [
    { id: 'l1', mode: 'ocean', carrier: 'Pacific Crown Line', origin: 'CNSHA', destination: 'KRPUS' },
    { id: 'l2', mode: 'ocean', carrier: 'Pacific Crown Line', origin: 'KRPUS', destination: 'USLAX' },
  ],
};

// Mirrors the real hand-off fixture (SmartQuoteWorkspace.handoff.test.tsx's OPTION_WITH_LEG_CHARGES) —
// only id/carrier/price/currency/legs are set, exercising the "typed as required but absent at
// runtime" case for name/transitTime/tier called out in this plan's Global Constraints.
const MINIMAL_OPTION = {
  id: 'opt-2',
  carrier: 'Maersk',
  price: 1200,
  currency: 'USD',
  legs: [{ id: 'l1', mode: 'ocean', carrier: 'Maersk', origin: 'CNSHA', destination: 'USLAX' }],
} as unknown as RateOption;

function renderCard(option: RateOption, overrides: Partial<Parameters<typeof SmartQuoteRateCard>[0]> = {}) {
  const props = {
    option,
    isSelected: false,
    onToggleSelection: vi.fn(),
    onSelect: vi.fn(),
    onViewDetails: vi.fn(),
    ...overrides,
  };
  render(<SmartQuoteRateCard {...props} />);
  return props;
}

describe('SmartQuoteRateCard', () => {
  it('renders carrier, tier badge, source badge, and formatted price', () => {
    renderCard(FULL_OPTION);
    expect(screen.getByText('Pacific Crown Line')).toBeInTheDocument();
    expect(screen.getByText('Best Value')).toBeInTheDocument();
    expect(screen.getByText('AI Generated')).toBeInTheDocument();
    expect(screen.getByText(/4,180/)).toBeInTheDocument();
  });

  it('renders verified indicator, reliability, CO2, markup, margin, and AI explanation when present', () => {
    renderCard(FULL_OPTION);
    expect(screen.getByText(/Verified/)).toBeInTheDocument();
    expect(screen.getByText(/Reliability 9\/10/)).toBeInTheDocument();
    expect(screen.getByText(/820 kg/)).toBeInTheDocument();
    expect(screen.getByText(/15% mkp/)).toBeInTheDocument();
    expect(screen.getByText(/540/)).toBeInTheDocument();
    expect(screen.getByText(/Best balance of cost/)).toBeInTheDocument();
  });

  it('renders one route-leg dot per leg', () => {
    renderCard(FULL_OPTION);
    expect(screen.getByLabelText('Route').children).toHaveLength(2);
  });

  it('calls onToggleSelection when the checkbox is toggled', () => {
    const props = renderCard(FULL_OPTION);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(props.onToggleSelection).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when Select is clicked, and onViewDetails when Details is clicked', () => {
    const props = renderCard(FULL_OPTION);
    fireEvent.click(screen.getByRole('button', { name: /select/i }));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(props.onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('does not throw and omits tier/verified/reliability/CO2/AI-note when a minimal option is given', () => {
    renderCard(MINIMAL_OPTION);
    expect(screen.getByText('Maersk')).toBeInTheDocument();
    expect(screen.queryByText(/Verified/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reliability/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Route').children).toHaveLength(1);
  });

  it('marks the card selected via a data attribute when isSelected is true', () => {
    renderCard(FULL_OPTION, { isSelected: true });
    expect(screen.getByTestId('smart-quote-rate-card-opt-1')).toHaveAttribute('data-selected', 'true');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/quotation/smart-quote/__tests__/SmartQuoteRateCard.test.tsx`
Expected: FAIL — `Cannot find module '../SmartQuoteRateCard'`.

- [ ] **Step 3: Implement the component**

Create `src/components/quotation/smart-quote/SmartQuoteRateCard.tsx`:

```tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { getModeIcon } from '@/components/quotation/shared/quote-badges';
import { mapLegsForVisualizer } from '@/lib/quote-legs';
import { formatCurrency, cn } from '@/lib/utils';
import { formatContainerSize } from '@/lib/container-utils';
import { RateOption } from '@/types/quote-breakdown';

export interface SmartQuoteRateCardProps {
  option: RateOption;
  isSelected: boolean;
  onToggleSelection: () => void;
  onSelect: () => void;
  onViewDetails: () => void;
}

const TIER_LABELS: Record<string, string> = {
  contract: 'Contract',
  spot: 'Spot',
  best_value: 'Best Value',
  cheapest: 'Cheapest',
  fastest: 'Fastest',
  greenest: 'Greenest',
  reliable: 'Reliable',
};

function tierLabel(tier?: string): string | null {
  if (!tier) return null;
  return TIER_LABELS[tier] || tier.replace(/_/g, ' ');
}

function sourceBadge(option: RateOption): { label: string; tone: 'tide' | 'neutral' } {
  const source = option.source_attribution || '';
  if (source.includes('AI')) return { label: 'AI Generated', tone: 'tide' };
  if (option.is_manual || source.includes('Manual')) return { label: 'Manual', tone: 'neutral' };
  return { label: 'Market Rate', tone: 'neutral' };
}

function reliabilityTone(score: number): string {
  if (score >= 9) return 'var(--sq-good)';
  if (score >= 7) return 'var(--sq-tide)';
  if (score >= 5) return 'var(--sq-accent)';
  return 'var(--sq-rust)';
}

export function SmartQuoteRateCard({ option, isSelected, onToggleSelection, onSelect, onViewDetails }: SmartQuoteRateCardProps) {
  const tier = tierLabel(option.tier);
  const source = sourceBadge(option);
  const legs = option.legs && option.legs.length > 0
    ? mapLegsForVisualizer(option.legs, { origin: (option as any).origin, destination: (option as any).destination })
    : [];
  const carrierName = option.carrier || option.name || 'Unknown Carrier';

  return (
    <div
      data-testid={`smart-quote-rate-card-${option.id}`}
      data-selected={isSelected}
      className={cn('flex flex-col gap-3 rounded-lg border p-4 transition-colors')}
      style={{
        borderColor: isSelected ? 'var(--sq-accent)' : 'var(--sq-border)',
        background: 'var(--sq-surface)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelection} aria-label={`Select ${carrierName}`} />
        <span style={{ color: 'var(--sq-ink)' }}>{getModeIcon(option.transport_mode || 'ocean')}</span>
        <span className="font-semibold" style={{ fontFamily: 'var(--sq-font-body)', color: 'var(--sq-ink)' }}>
          {carrierName}
        </span>
        {tier && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: 'var(--sq-accent)', color: 'var(--sq-accent-ink)' }}
          >
            {tier}
          </span>
        )}
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: source.tone === 'tide' ? 'var(--sq-tide)' : 'var(--sq-border)',
            color: source.tone === 'tide' ? 'var(--sq-accent-ink)' : 'var(--sq-ink)',
          }}
        >
          {source.label}
        </span>
      </div>

      {option.name && (
        <p className="truncate text-sm" style={{ color: 'var(--sq-ink)', opacity: 0.7 }}>
          {formatContainerSize(option.name)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--sq-ink)' }}>
        <span style={{ fontFamily: 'var(--sq-font-mono)' }}>{option.transitTime || '—'}</span>
        {option.verified && (
          <span style={{ color: 'var(--sq-good)' }}>
            Verified
            {option.verificationTimestamp
              ? ` ${new Date(option.verificationTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </span>
        )}
      </div>

      {legs.length > 0 && (
        <div aria-label="Route" className="flex items-center gap-1">
          {legs.map((leg, i) => (
            <span
              key={i}
              title={`${leg.from} → ${leg.to}`}
              className="h-2 w-2 rounded-full"
              style={{ background: 'var(--sq-border)' }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {option.reliability && (
          <span style={{ color: reliabilityTone(option.reliability.score) }}>
            Reliability {option.reliability.score}/10
          </span>
        )}
        {(option.co2_kg || option.environmental) && (
          <span style={{ color: 'var(--sq-good)' }}>
            {option.co2_kg ? `${option.co2_kg} kg CO2` : option.environmental?.co2_emissions}
          </span>
        )}
      </div>

      {option.ai_explanation && (
        <p
          className="rounded-md p-2 text-xs"
          style={{ background: 'color-mix(in srgb, var(--sq-tide) 12%, transparent)', color: 'var(--sq-tide)' }}
        >
          {option.ai_explanation}
        </p>
      )}

      <div className="flex items-baseline gap-3" style={{ fontFamily: 'var(--sq-font-mono)' }}>
        <span className="text-xl font-semibold" style={{ color: 'var(--sq-ink)', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(option.price, option.currency)}
        </span>
        {option.markupPercent !== undefined && (
          <span className="text-xs" style={{ color: 'var(--sq-good)' }}>
            {option.markupPercent}% mkp
          </span>
        )}
        {option.marginAmount !== undefined && (
          <span className="text-xs" style={{ color: 'var(--sq-good)' }}>
            +{formatCurrency(option.marginAmount, option.currency)}
          </span>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onViewDetails}>
          Details
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSelect}
          style={{ background: 'var(--sq-accent)', color: 'var(--sq-accent-ink)' }}
        >
          Select
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/quotation/smart-quote/__tests__/SmartQuoteRateCard.test.tsx`
Expected: PASS (7 tests). If the `color-mix()` CSS function or any specific assertion fails in jsdom, adjust the implementation, not the test — the test encodes the spec's required fields (design spec §5).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/quotation/smart-quote/SmartQuoteRateCard.tsx src/components/quotation/smart-quote/__tests__/SmartQuoteRateCard.test.tsx
git commit -m "feat(quotation): add SmartQuoteRateCard component"
```

---

### Task 4: `ShipmentRecapStrip` component

**Files:**
- Create: `src/components/quotation/smart-quote/ShipmentRecapStrip.tsx`
- Test: `src/components/quotation/smart-quote/__tests__/ShipmentRecapStrip.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface ShipmentRecapStripProps {
    mode: string;
    origin: string;
    destination: string;
    cargoSummary: string; // e.g. "2 x 40HC" — already formatted by the caller (Task 5), this
                           // component does no cargo-shape interpretation of its own
  }
  export function ShipmentRecapStrip(props: ShipmentRecapStripProps): JSX.Element | null;
  ```
  Consumed by Task 5. Renders `null` until both `origin` and `destination` are non-empty (design spec §3, §5) — real derived data only, never fabricated route/leg information.

- [ ] **Step 1: Write the failing tests**

Create `src/components/quotation/smart-quote/__tests__/ShipmentRecapStrip.test.tsx`:

```tsx
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ShipmentRecapStrip } from '../ShipmentRecapStrip';

describe('ShipmentRecapStrip', () => {
  it('renders nothing when origin is empty', () => {
    const { container } = render(
      <ShipmentRecapStrip mode="ocean" origin="" destination="USLAX" cargoSummary="2 x 40HC" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when destination is empty', () => {
    const { container } = render(
      <ShipmentRecapStrip mode="ocean" origin="CNSHA" destination="" cargoSummary="2 x 40HC" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders mode, origin, destination, and cargo chips once both endpoints are set', () => {
    render(<ShipmentRecapStrip mode="ocean" origin="CNSHA" destination="USLAX" cargoSummary="2 x 40HC" />);
    expect(screen.getByText('ocean')).toBeInTheDocument();
    expect(screen.getByText('CNSHA')).toBeInTheDocument();
    expect(screen.getByText('USLAX')).toBeInTheDocument();
    expect(screen.getByText('2 x 40HC')).toBeInTheDocument();
  });

  it('omits the cargo chip when cargoSummary is empty', () => {
    render(<ShipmentRecapStrip mode="ocean" origin="CNSHA" destination="USLAX" cargoSummary="" />);
    expect(screen.getByText('CNSHA')).toBeInTheDocument();
    expect(screen.queryByText('2 x 40HC')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/quotation/smart-quote/__tests__/ShipmentRecapStrip.test.tsx`
Expected: FAIL — `Cannot find module '../ShipmentRecapStrip'`.

- [ ] **Step 3: Implement the component**

Create `src/components/quotation/smart-quote/ShipmentRecapStrip.tsx`:

```tsx
export interface ShipmentRecapStripProps {
  mode: string;
  origin: string;
  destination: string;
  cargoSummary: string;
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
      style={{ borderColor: 'var(--sq-border)', background: 'var(--sq-bg)', color: 'var(--sq-ink)' }}
    >
      <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--sq-ink)', opacity: 0.6 }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--sq-font-mono)' }}>{value}</span>
    </span>
  );
}

export function ShipmentRecapStrip({ mode, origin, destination, cargoSummary }: ShipmentRecapStripProps) {
  if (!origin || !destination) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="shipment-recap-strip">
      <Chip label="Mode" value={mode} />
      <Chip label="Origin" value={origin} />
      <Chip label="Dest" value={destination} />
      {cargoSummary && <Chip label="Cargo" value={cargoSummary} />}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/quotation/smart-quote/__tests__/ShipmentRecapStrip.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/quotation/smart-quote/ShipmentRecapStrip.tsx src/components/quotation/smart-quote/__tests__/ShipmentRecapStrip.test.tsx
git commit -m "feat(quotation): add ShipmentRecapStrip component"
```

---

### Task 5: Integrate into `SmartQuoteWorkspace.tsx`

This is the highest-risk task — it touches the page every existing test in `SmartQuoteWorkspace.test.tsx` and `SmartQuoteWorkspace.handoff.test.tsx` renders, and it's where the loading/error states (design spec §3) that don't exist anywhere today get built.

**Files:**
- Modify: `src/pages/dashboard/SmartQuoteWorkspace.tsx`
- Modify: `src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx`
- Modify: `src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx`

**Interfaces:**
- Consumes: `SmartQuoteRateCard` (Task 3), `ShipmentRecapStrip` (Task 4), `.smart-quote-identity` + `@fontsource/*` (Task 2).
- No new exports — this is a page component.

**Note on `Badge` (Shadcn primitive, reused as-is for the small "N Options"/"N selected" count badges):** its internal styling reads the app's global `--secondary`/`--border` Shadcn CSS variables, not the new `--sq-*` tokens (which are deliberately namespaced separately, per §4 of the spec, to avoid colliding with the app-wide theme). Since this page no longer applies a tenant preset, `Badge` here falls back to the app's default root-level values rather than the new identity or any tenant color. This is an intentional, disclosed exception — not worth a bespoke token-driven badge for two small count indicators — rather than a silently missed spot.

- [ ] **Step 1: Update `SmartQuoteWorkspace.test.tsx` for the new markup first**

The current suite mocks `QuoteResultsList`/`QuoteComparisonView` and asserts a Browse/Compare tab toggle — none of that exists after this task. Replace the mocks and the tab-toggle test. Full replacement of `src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx`:

```tsx
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SmartQuoteWorkspace from '../SmartQuoteWorkspace';
import { useRateFetching } from '@/hooks/useRateFetching';

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

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>
}));

const defaultRateFetchingResult = {
  results: null as any,
  loading: false,
  error: null as string | null,
  marketAnalysis: null,
  confidenceScore: null,
  anomalies: [] as string[],
  fetchRates: vi.fn().mockResolvedValue([]),
  clearResults: vi.fn(),
};

vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: vi.fn(),
}));

vi.mock('@/components/common/LocationAutocomplete', () => ({
  LocationAutocomplete: ({ value, onChange, placeholder }: any) => (
    <input
      aria-label={placeholder}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/quotes/smart-quote']}>
        <SmartQuoteWorkspace />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SmartQuoteWorkspace', () => {
  beforeEach(() => {
    vi.mocked(useRateFetching).mockReturnValue({ ...defaultRateFetchingResult });
  });

  it('renders the Smart Quote form and an empty results placeholder', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /smart quote/i })).toBeInTheDocument();
    expect(screen.getByText(/fill out the form to generate quotes/i)).toBeInTheDocument();
  });

  it('lets the user pick a transport mode and enter origin/destination', async () => {
    renderPage();
    expect(screen.getByText('Ocean')).toBeInTheDocument();
    expect(screen.getByText('Air')).toBeInTheDocument();
  });

  it('calls fetchRates with the derived shared payload when Generate is clicked', async () => {
    const fetchRates = vi.fn().mockResolvedValue([]);
    vi.mocked(useRateFetching).mockReturnValue({ ...defaultRateFetchingResult, fetchRates });

    renderPage();

    fireEvent.change(screen.getByLabelText('Origin port, airport, or city'), { target: { value: 'Los Angeles' } });
    fireEvent.change(screen.getByLabelText('Destination port, airport, or city'), { target: { value: 'Shanghai' } });
    fireEvent.click(screen.getByRole('button', { name: /generate smart quotes/i }));

    await waitFor(() => expect(fetchRates).toHaveBeenCalledTimes(1));

    const [payload, containerResolver] = fetchRates.mock.calls[0];
    expect(payload).toMatchObject({
      mode: 'ocean',
      origin: 'Los Angeles',
      destination: 'Shanghai',
      commodity: '',
      weight: '0',
      dangerousGoods: false,
      smartMode: true,
    });
    expect(Array.isArray(payload.containerCombos)).toBe(true);
    expect(containerResolver).toHaveProperty('resolveContainerInfo');
  });

  it('shows the shipment recap strip once origin and destination are both filled', () => {
    renderPage();
    expect(screen.queryByTestId('shipment-recap-strip')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Origin port, airport, or city'), { target: { value: 'CNSHA' } });
    fireEvent.change(screen.getByLabelText('Destination port, airport, or city'), { target: { value: 'USLAX' } });

    expect(screen.getByTestId('shipment-recap-strip')).toBeInTheDocument();
  });

  it('shows a loading state in the results panel while a request is in flight', () => {
    // Regex is scoped to "ranking carriers" (the results-panel copy), not a broader
    // /generating|ranking/ pattern — the Generate button also reads "Generating..." while
    // loading, and a broader pattern would match both elements and make getByText throw.
    vi.mocked(useRateFetching).mockReturnValue({ ...defaultRateFetchingResult, loading: true });
    renderPage();
    expect(screen.getByText(/ranking carriers/i)).toBeInTheDocument();
  });

  it('shows an inline error state in the results panel when the fetch fails', () => {
    vi.mocked(useRateFetching).mockReturnValue({ ...defaultRateFetchingResult, error: 'No quotes available.' });
    renderPage();
    expect(screen.getByText('No quotes available.')).toBeInTheDocument();
  });

  it('renders a SmartQuoteRateCard per result once options are available, with no Browse/Compare tabs', async () => {
    vi.mocked(useRateFetching).mockReturnValue({
      ...defaultRateFetchingResult,
      results: [
        { id: 'opt-1', carrier: 'Carrier One', price: 100, currency: 'USD', transitTime: '10 days', tier: 'cheapest' },
        { id: 'opt-2', carrier: 'Carrier Two', price: 200, currency: 'USD', transitTime: '5 days', tier: 'fastest' },
      ] as any,
    });

    renderPage();

    expect(screen.getByTestId('smart-quote-rate-card-opt-1')).toBeInTheDocument();
    expect(screen.getByTestId('smart-quote-rate-card-opt-2')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /compare/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /browse/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the updated test to verify it fails against the current page**

Run: `npx vitest run src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx`
Expected: FAIL on the new assertions (no `shipment-recap-strip` testid, no loading/error text, no `smart-quote-rate-card-*` testids, tabs still present) — the old behavior is still in place.

- [ ] **Step 3: Update `SmartQuoteWorkspace.handoff.test.tsx` for the new results rendering**

The hand-off suite's `QuoteResultsList` mock wired a fake "Select opt-1" button through `onSelect`. After this task, `QuoteResultsList` is no longer rendered by this page at all — the real `SmartQuoteRateCard`'s own "Select" button is what must be clicked. Remove the `QuoteResultsList`/`QuoteComparisonView` mocks entirely (they're unused once this page stops importing them) and change the click target. In `src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx`:

Remove these two `vi.mock` blocks:
```tsx
vi.mock('@/components/quotation/shared/QuoteResultsList', () => ({ /* ... */ }));
vi.mock('@/components/quotation/shared/QuoteComparisonView', () => ({ /* ... */ }));
```

Replace the click target in both `it(...)` blocks under `describe('SmartQuoteWorkspace navigation state (Critical #2 regression)', ...)` — `SmartQuoteRateCard`'s Select button has visible text "Select", scoped to its card via `within` so it's unambiguous when multiple cards are present:
```diff
- fireEvent.click(screen.getByRole('button', { name: /select opt-1/i }));
+ fireEvent.click(within(screen.getByTestId('smart-quote-rate-card-opt-1')).getByRole('button', { name: /^select$/i }));
```
Add `within` to the `@testing-library/react` import at the top of the file.

`OPTION_WITH_LEG_CHARGES` (missing `name`/`transitTime`/`tier`) already exercises the minimal-fields path `SmartQuoteRateCard` was built to handle in Task 3 — no fixture changes needed.

- [ ] **Step 4: Run the handoff test to verify it fails against the current page**

Run: `npx vitest run src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx`
Expected: FAIL — `getByTestId('smart-quote-rate-card-opt-1')` not found (page still renders the old `QuoteResultsList`).

- [ ] **Step 5: Rewrite `SmartQuoteWorkspace.tsx`**

Full replacement of `src/pages/dashboard/SmartQuoteWorkspace.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Compass, Package, Sparkles, Plane, Ship, Truck, Train } from 'lucide-react';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { useRateFetching } from '@/hooks/useRateFetching';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import { SharedCargoInput } from '@/components/quotation/shared/SharedCargoInput';
import { QuoteDetailView } from '@/components/quotation/shared/QuoteDetailView';
import { QuickQuoteHistory } from '@/components/quotation/shared/QuickQuoteHistory';
import { SmartQuoteRateCard } from '@/components/quotation/smart-quote/SmartQuoteRateCard';
import { ShipmentRecapStrip } from '@/components/quotation/smart-quote/ShipmentRecapStrip';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { CargoItem } from '@/types/cargo';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { RateOption } from '@/types/quote-breakdown';

import '@fontsource/big-shoulders-display/600.css';
import '@fontsource/big-shoulders-display/700.css';
import '@fontsource/big-shoulders-display/800.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@/components/quotation/smart-quote/smart-quote-identity.css';

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

function formatCommodityDisplay(commodity?: { description?: string; hts_code?: string }): string {
  if (!commodity) return '';
  const description = (commodity.description || '').trim();
  const htsCode = (commodity.hts_code || '').trim();
  if (description && htsCode) return `${description} - ${htsCode}`;
  return description || htsCode;
}

function summarizeCargo(cargoItem: CargoItem): string {
  if (cargoItem.type !== 'container') return cargoItem.commodity?.description || '';
  const combo = cargoItem.containerCombos?.[0];
  const typeId = combo?.typeId || cargoItem.containerDetails?.typeId;
  const sizeId = combo?.sizeId || cargoItem.containerDetails?.sizeId;
  const qty = combo?.quantity || cargoItem.quantity || 1;
  if (!typeId && !sizeId) return '';
  return `${qty} x ${[sizeId, typeId].filter(Boolean).join(' ')}`.trim();
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

export default function SmartQuoteWorkspace() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { containerTypes, containerSizes } = useContainerRefs();
  const [smartMode, setSmartMode] = useState(true);
  const [cargoItem, setCargoItem] = useState<CargoItem>(INITIAL_CARGO_ITEM);
  const [originDetails, setOriginDetails] = useState<any>(null);
  const [destinationDetails, setDestinationDetails] = useState<any>(null);
  const [viewDetailsId, setViewDetailsId] = useState<string | null>(null);

  const form = useForm<SmartQuoteFormValues>({
    resolver: zodResolver(smartQuoteFormSchema),
    defaultValues: { mode: 'ocean' },
  });
  const mode = form.watch('mode');
  const origin = form.watch('origin') || '';
  const destination = form.watch('destination') || '';

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

  const handleGenerate = form.handleSubmit(
    async (values) => {
      setSelectedIds([]);
      const shared = deriveSharedPayload(values, cargoItem, originDetails, destinationDetails);
      await rateFetching.fetchRates(
        { ...shared, smartMode, account_id: undefined } as any,
        containerResolver
      );
    },
    (errors) => {
      const messages = Object.values(errors)
        .map((err: any) => err?.message)
        .filter((message): message is string => typeof message === 'string' && message.length > 0);
      toast({
        title: 'Missing shipment details',
        description: messages.length > 0 ? messages.join('\n') : 'Please complete the required fields before generating quotes.',
        variant: 'destructive',
      });
    }
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleConvertToQuote = (option: RateOption | RateOption[]) => {
    const selectedOptions = Array.isArray(option) ? option : [option];
    const values = form.getValues();
    const shared = deriveSharedPayload(values, cargoItem, originDetails, destinationDetails);
    const transferPayload = {
      ...shared,
      originDetails: shared.originDetails ?? undefined,
      destinationDetails: shared.destinationDetails ?? undefined,
      selectedRates: selectedOptions,
      marketAnalysis: typeof rateFetching.marketAnalysis === 'string' ? rateFetching.marketAnalysis : null,
      confidenceScore:
        typeof rateFetching.confidenceScore === 'number' && Number.isFinite(rateFetching.confidenceScore)
          ? rateFetching.confidenceScore
          : null,
      anomalies: Array.isArray(rateFetching.anomalies)
        ? rateFetching.anomalies.filter((anomaly): anomaly is string => typeof anomaly === 'string')
        : [],
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
        state: { ...validatedData, selectedRates: selectedOptions, selectedRate: selectedOptions[0] },
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

  const manualQuoteLabel = 'Manual Quotation';
  const viewDetailsOption = rateFetching.results?.find((r) => r.id === viewDetailsId) || null;

  return (
    <DashboardLayout>
      <div className="smart-quote-identity flex flex-col h-[calc(100vh-140px)] gap-4 transition-colors duration-300 p-4 rounded-lg">
        <Breadcrumb className="flex-none">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/dashboard">Dashboard</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/dashboard/quotes">Quotes</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Smart Quote</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex-none flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quotes/pipeline')} aria-label="Back to Quotes">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1
                className="text-2xl font-bold tracking-tight flex items-center gap-2"
                style={{ fontFamily: 'var(--sq-font-display)', color: 'var(--sq-ink)' }}
              >
                <Compass className="h-5 w-5" style={{ color: 'var(--sq-tide)' }} />
                Smart Quote
              </h1>
              <p className="text-sm" style={{ color: 'var(--sq-ink)', opacity: 0.65 }}>
                Generate instant quotes with AI-powered market analysis and route optimization.
              </p>
            </div>
          </div>
          <QuickQuoteHistory
            className="border-[color:var(--sq-border)] text-[color:var(--sq-ink)]"
            onSelect={(payload) => navigate('/dashboard/quotes/new', { state: payload })}
          />
        </div>

        <div className="flex flex-1 overflow-hidden gap-6">
          <div
            className="w-[400px] shrink-0 p-6 border rounded-lg overflow-y-auto"
            style={{ background: 'var(--sq-bg)', borderColor: 'var(--sq-border)' }}
          >
            <form className="space-y-6" onSubmit={handleGenerate}>
              <div
                className="flex items-center justify-between p-3 rounded-md border"
                style={{ background: 'color-mix(in srgb, var(--sq-tide) 10%, transparent)', borderColor: 'var(--sq-tide)' }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--sq-tide)' }} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium" style={{ color: 'var(--sq-ink)' }}>Smart Quote Mode</span>
                    <span className="text-[10px]" style={{ color: 'var(--sq-tide)' }}>AI-optimized routes & pricing</span>
                  </div>
                </div>
                <Switch checked={smartMode} onCheckedChange={setSmartMode} data-testid="smart-mode-switch" />
              </div>

              <div className="space-y-2">
                <Label style={{ color: 'var(--sq-ink)' }}>Transport Mode</Label>
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
                <Label style={{ color: 'var(--sq-ink)' }}>Origin</Label>
                <LocationAutocomplete
                  value={origin}
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
                <Label style={{ color: 'var(--sq-ink)' }}>Destination</Label>
                <LocationAutocomplete
                  value={destination}
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

              <SharedCargoInput value={cargoItem} onChange={setCargoItem} />

              <ShipmentRecapStrip mode={mode} origin={origin} destination={destination} cargoSummary={summarizeCargo(cargoItem)} />

              <Button
                type="button"
                onClick={handleGenerate}
                disabled={rateFetching.loading}
                className="w-full"
                style={{ background: 'var(--sq-accent)', color: 'var(--sq-accent-ink)' }}
              >
                {rateFetching.loading ? 'Generating...' : 'Generate Smart Quotes'}
              </Button>
            </form>
          </div>

          <div
            className="flex-1 p-6 border rounded-lg overflow-y-auto"
            style={{ background: 'var(--sq-surface)', borderColor: 'var(--sq-border)' }}
          >
            {rateFetching.loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3" style={{ color: 'var(--sq-tide)' }}>
                <span
                  className="h-2.5 w-2.5 rounded-full motion-safe:animate-pulse"
                  style={{ background: 'var(--sq-tide)' }}
                  aria-hidden="true"
                />
                <p>Ranking carriers on cost, transit time, and reliability&hellip;</p>
              </div>
            ) : rateFetching.error ? (
              <div className="h-full flex flex-col items-center justify-center gap-2" style={{ color: 'var(--sq-rust)' }}>
                <p className="font-medium">{rateFetching.error}</p>
                <p className="text-sm" style={{ opacity: 0.8 }}>Adjust the shipment details and try again.</p>
              </div>
            ) : !rateFetching.results ? (
              <div className="h-full flex flex-col items-center justify-center" style={{ color: 'var(--sq-ink)', opacity: 0.5 }}>
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p>Fill out the form to generate quotes</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg" style={{ fontFamily: 'var(--sq-font-display)', color: 'var(--sq-ink)' }}>
                      Rate Options
                    </h3>
                    <Badge variant="outline" className="text-xs">{rateFetching.results.length} Options</Badge>
                  </div>
                  {smartMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      style={{ borderColor: 'var(--sq-tide)', color: 'var(--sq-tide)' }}
                      onClick={handleGenerate}
                    >
                      <Sparkles className="h-3 w-3" />
                      Generate Smart Options
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {rateFetching.results.map((option) => (
                    <SmartQuoteRateCard
                      key={option.id}
                      option={option}
                      isSelected={selectedIds.includes(option.id)}
                      onToggleSelection={() => toggleSelection(option.id)}
                      onSelect={() => handleConvertToQuote(option)}
                      onViewDetails={() => setViewDetailsId(option.id)}
                    />
                  ))}
                </div>

                {selectedIds.length > 0 && (
                  <div
                    className="sticky bottom-0 left-0 right-0 p-4 border-t shadow-lg flex justify-between items-center"
                    style={{ background: 'var(--sq-surface)', borderColor: 'var(--sq-border)' }}
                  >
                    <div className="text-sm font-medium" style={{ color: 'var(--sq-ink)' }}>
                      <Badge variant="secondary" className="mr-2">{selectedIds.length}</Badge>
                      options selected
                    </div>
                    <Button
                      onClick={handleConvertSelected}
                      className="gap-2"
                      style={{ background: 'var(--sq-accent)', color: 'var(--sq-accent-ink)' }}
                    >
                      Create Quote with Selected <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!viewDetailsId} onOpenChange={(open) => !open && setViewDetailsId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewDetailsOption?.carrier || manualQuoteLabel}{viewDetailsOption?.name ? ` - ${viewDetailsOption.name}` : ''}</DialogTitle>
          </DialogHeader>
          {viewDetailsOption && (
            <div className="py-4">
              <QuoteDetailView
                quote={mapOptionToQuote(viewDetailsOption)}
                defaultAnalysisView={viewDetailsOption.source_attribution === 'AI Smart Engine' ? 'mode' : 'category'}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
```

This removes the page's `useCRMModuleNavigationState('quotes', ...)` / `themeStyleFromPreset(theme)` usage entirely (design spec §4) — neither is imported nor referenced anywhere in the file above.

- [ ] **Step 6: Run both test files to verify they pass**

Run: `npx vitest run src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx`
Expected: PASS, all tests in both files.

- [ ] **Step 7: Run the full quotation-related suite plus the extracted-util and new-component suites together**

Run: `npx vitest run src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx src/components/quotation/shared/__tests__/QuoteResultsList.badge.test.tsx src/components/quotation/shared/__tests__/QuoteResultsList.remove.test.tsx src/lib/__tests__/quote-legs.test.ts src/components/quotation/smart-quote`
Expected: PASS across all files — this is the regression guard proving `QuoteResultsList`'s own tests (and by extension its behavior inside `UnifiedQuoteComposer`) are unaffected.

- [ ] **Step 8: Manual/visual check against `UnifiedQuoteComposer`**

Start the dev server (`npm run dev:vite`), navigate to `/dashboard/quotes/new`, toggle Smart Quote Mode, generate a quote, and confirm the results view (Grid/Table/Compare, badge colors) renders exactly as it did before this plan — since it still uses the untouched `QuoteResultsList`/`QuoteComparisonView`. Then navigate to `/dashboard/quotes/smart-quote` and confirm the new identity (fonts, amber/tide palette, cards, loading state via a slow network throttle, recap strip) renders as designed, in both light mode and with the dark-mode toggle (wherever it lives in the app's UI — check `useTheme`'s consumer, e.g. a settings/theme switcher) enabled.

- [ ] **Step 9: Typecheck and lint**

Run: `npm run typecheck`
Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 10: Commit**

```bash
git add src/pages/dashboard/SmartQuoteWorkspace.tsx src/pages/dashboard/__tests__/SmartQuoteWorkspace.test.tsx src/pages/dashboard/__tests__/SmartQuoteWorkspace.handoff.test.tsx
git commit -m "feat(quotation): give SmartQuoteWorkspace a distinctive visual identity and card-based results view"
```

---

## Post-Plan

After Task 5, use `superpowers:finishing-a-development-branch` (if working in an isolated worktree/branch per `superpowers:using-git-worktrees`) to run the final whole-branch review and merge/PR flow — that review is where cross-task concerns spanning the whole diff (not just one task) get caught, per `superpowers:subagent-driven-development`.
