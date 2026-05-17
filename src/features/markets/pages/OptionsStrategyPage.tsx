/**
 * OptionsStrategyPage — route: /dashboard/markets/options-payoff
 *
 * Standalone, fully client-side options strategy payoff builder.
 * No live data or backend required — all math is pure client-side.
 *
 * Features:
 *  - Underlying / spot / lot size controls
 *  - 10 preset strategy buttons (loads legs with default premiums)
 *  - Custom leg builder (add/edit/delete legs inline)
 *  - Price range controls (spotMin / spotMax) with auto-track
 *  - Recharts payoff-at-expiry diagram with breakeven & spot reference lines
 *  - 4 metric cards: Max Profit, Max Loss, Net Premium, Breakevens
 *  - Per-leg summary table
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Calculator, Plus, Trash2, Info } from 'lucide-react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/design-system';
import { cn } from '@/lib/utils';

import {
  type Leg,
  type OptionType,
  type OptionSide,
  legPayoff,
  payoffCurve,
  strategyMetrics,
  STRATEGY_PRESETS,
  PRESET_NAMES,
} from '../utils/optionsPayoff';

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtINRFull(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtPrice(v: number): string {
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** Format large P&L numbers on Y axis as "+1.5k" / "-3k" */
function fmtYAxis(v: number): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '−';
  if (abs >= 100_000) return `${sign}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)   return `${sign}${(abs / 1_000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  return `${v >= 0 ? '+' : '−'}${abs}`;
}

// ── Preset category colors ────────────────────────────────────────────────────

const PRESET_CATEGORY_COLORS: Record<string, string> = {
  'Long Call':       'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  'Long Put':        'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  'Bull Call Spread':'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  'Bear Put Spread': 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  'Long Straddle':   'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  'Short Straddle':  'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  'Long Strangle':   'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  'Iron Condor':     'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  'Iron Butterfly':  'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  'Covered Call':    'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700',
  'Protective Put':  'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700',
};

// ── Custom Recharts Tooltip ───────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { price: number; pnl: number } }>;
  label?: number;
}

function PayoffTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const pnl = payload.find((p) => 'pnl' in p.payload)?.payload?.pnl ?? 0;
  const isProfit = pnl >= 0;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-sm min-w-[140px]">
      <p className="text-muted-foreground text-xs mb-1">
        Price: {fmtPrice(Number(label))}
      </p>
      <p
        className={cn(
          'font-semibold tabular-nums',
          isProfit
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400',
        )}
      >
        P&amp;L: {isProfit ? '+' : ''}{fmtINRFull(pnl)}
      </p>
    </div>
  );
}

// ── Leg row in the builder table ──────────────────────────────────────────────

interface LegRowProps {
  leg: Leg;
  onChange: (updated: Leg) => void;
  onDelete: () => void;
}

function LegRow({ leg, onChange, onDelete }: LegRowProps) {
  function set<K extends keyof Leg>(field: K, value: Leg[K]) {
    onChange({ ...leg, [field]: value });
  }

  const isLong = leg.side === 'long';
  const isCall = leg.type === 'call';

  return (
    <TableRow>
      {/* Type */}
      <TableCell className="px-2 py-1.5">
        <Select
          value={leg.type}
          onValueChange={(v) => set('type', v as OptionType)}
        >
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="call">
              <span className="text-green-700 dark:text-green-400 font-medium">CE / Call</span>
            </SelectItem>
            <SelectItem value="put">
              <span className="text-orange-600 dark:text-orange-400 font-medium">PE / Put</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      {/* Side */}
      <TableCell className="px-2 py-1.5">
        <Select
          value={leg.side}
          onValueChange={(v) => set('side', v as OptionSide)}
        >
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="long">
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Long ↑</span>
            </SelectItem>
            <SelectItem value="short">
              <span className="text-rose-600 dark:text-rose-400 font-medium">Short ↓</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      {/* Strike */}
      <TableCell className="px-2 py-1.5">
        <Input
          type="number"
          value={leg.strike}
          onChange={(e) => set('strike', Number(e.target.value) || 0)}
          className="h-7 w-24 text-xs tabular-nums"
          min={0}
          step={50}
        />
      </TableCell>

      {/* Premium */}
      <TableCell className="px-2 py-1.5">
        <Input
          type="number"
          value={leg.premium}
          onChange={(e) => set('premium', Number(e.target.value) || 0)}
          className="h-7 w-20 text-xs tabular-nums"
          min={0}
          step={1}
        />
      </TableCell>

      {/* Lots */}
      <TableCell className="px-2 py-1.5">
        <Input
          type="number"
          value={leg.lots}
          onChange={(e) => set('lots', Math.max(1, Number(e.target.value) || 1))}
          className="h-7 w-16 text-xs tabular-nums"
          min={1}
        />
      </TableCell>

      {/* Lot Size */}
      <TableCell className="px-2 py-1.5">
        <Input
          type="number"
          value={leg.lotSize}
          onChange={(e) => set('lotSize', Math.max(1, Number(e.target.value) || 1))}
          className="h-7 w-16 text-xs tabular-nums"
          min={1}
        />
      </TableCell>

      {/* Cost badge */}
      <TableCell className="px-2 py-1.5 text-right">
        <span
          className={cn(
            'text-xs font-medium tabular-nums',
            isLong
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {isLong ? '−' : '+'}{fmtINR(leg.premium * leg.lots * leg.lotSize)}
        </span>
      </TableCell>

      {/* Row label badge */}
      <TableCell className="px-2 py-1.5">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0',
            isLong && isCall && 'border-green-400 text-green-700 dark:text-green-400',
            isLong && !isCall && 'border-orange-400 text-orange-700 dark:text-orange-400',
            !isLong && isCall && 'border-rose-400 text-rose-600 dark:text-rose-400',
            !isLong && !isCall && 'border-amber-400 text-amber-700 dark:text-amber-400',
          )}
        >
          {isLong ? 'L' : 'S'}-{isCall ? 'CE' : 'PE'}
        </Badge>
      </TableCell>

      {/* Delete */}
      <TableCell className="px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          aria-label="Remove leg"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}

function MetricCard({ label, value, sub, colorClass }: MetricCardProps) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={cn('text-base font-bold tabular-nums leading-tight', colorClass ?? 'text-foreground')}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── UNLIMITED threshold ────────────────────────────────────────────────────────

/** Show "Unlimited" for profit/loss if it exceeds 5× net premium magnitude */
function profitLabel(maxProfit: number, netPremium: number): string {
  const threshold = Math.abs(netPremium) * 5;
  if (netPremium !== 0 && maxProfit > threshold) return 'Unlimited';
  return fmtINR(maxProfit);
}

function lossLabel(maxLoss: number, netPremium: number): string {
  const threshold = Math.abs(netPremium) * 5;
  if (netPremium !== 0 && Math.abs(maxLoss) > threshold) return 'Unlimited';
  return fmtINR(Math.abs(maxLoss));
}

// ── Default Iron Condor legs factory ─────────────────────────────────────────

const DEFAULT_SPOT = 22000;
const DEFAULT_LOT_SIZE = 50;

function makeDefaultLegs(): Leg[] {
  return (STRATEGY_PRESETS['Iron Condor'](DEFAULT_SPOT, DEFAULT_LOT_SIZE) as Omit<Leg, 'id'>[]).map(
    (l) => ({ ...l, id: uuidv4() }),
  );
}

// ── Page component ────────────────────────────────────────────────────────────

export default function OptionsStrategyPage() {
  // ── Underlying controls ──────────────────────────────────────────────────
  const [symbol, setSymbol]   = useState('NIFTY');
  const [spot, setSpot]       = useState(DEFAULT_SPOT);
  const [lotSize, setLotSize] = useState(DEFAULT_LOT_SIZE);

  // ── Legs ─────────────────────────────────────────────────────────────────
  const [legs, setLegs] = useState<Leg[]>(makeDefaultLegs);

  // ── Price range ───────────────────────────────────────────────────────────
  const [spotMin, setSpotMin] = useState(Math.round(DEFAULT_SPOT * 0.75));
  const [spotMax, setSpotMax] = useState(Math.round(DEFAULT_SPOT * 1.25));
  const rangeOverridden = useRef(false);

  // ── Handlers: spot change ─────────────────────────────────────────────────
  function handleSpotChange(newSpot: number) {
    setSpot(newSpot);
    if (!rangeOverridden.current) {
      setSpotMin(Math.round(newSpot * 0.75));
      setSpotMax(Math.round(newSpot * 1.25));
    }
  }

  function handleSpotMinChange(v: number) {
    rangeOverridden.current = true;
    setSpotMin(v);
  }

  function handleSpotMaxChange(v: number) {
    rangeOverridden.current = true;
    setSpotMax(v);
  }

  // ── Preset handler ────────────────────────────────────────────────────────
  const applyPreset = useCallback(
    (name: string) => {
      const factory = STRATEGY_PRESETS[name];
      if (!factory) return;
      const rawLegs = factory(spot, lotSize) as Omit<Leg, 'id'>[];
      setLegs(rawLegs.map((l) => ({ ...l, id: uuidv4() })));
    },
    [spot, lotSize],
  );

  // ── Leg operations ────────────────────────────────────────────────────────
  function addLeg() {
    const atm = Math.round(spot / 50) * 50;
    setLegs((prev) => [
      ...prev,
      {
        id: uuidv4(),
        type: 'call',
        side: 'long',
        strike: atm,
        premium: 100,
        lots: 1,
        lotSize,
      },
    ]);
  }

  function updateLeg(id: string, updated: Leg) {
    setLegs((prev) => prev.map((l) => (l.id === id ? updated : l)));
  }

  function deleteLeg(id: string) {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }

  function clearLegs() {
    setLegs([]);
  }

  // ── Derived: payoff curve & metrics ───────────────────────────────────────
  const safeMin = Math.min(spotMin, spotMax - 1);
  const safeMax = Math.max(spotMax, spotMin + 1);

  const curve = useMemo(
    () => (legs.length > 0 ? payoffCurve(legs, safeMin, safeMax, 200) : []),
    [legs, safeMin, safeMax],
  );

  const metrics = useMemo(
    () =>
      legs.length > 0
        ? strategyMetrics(legs, safeMin, safeMax)
        : { maxProfit: 0, maxLoss: 0, netPremium: 0, breakevenPoints: [] },
    [legs, safeMin, safeMax],
  );

  // Y-axis padding
  const pnlValues = curve.map((p) => p.pnl);
  const yMin = pnlValues.length > 0 ? Math.min(...pnlValues) : -5000;
  const yMax = pnlValues.length > 0 ? Math.max(...pnlValues) : 5000;
  const yPad = Math.max(Math.abs(yMax - yMin) * 0.08, 500);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-screen-2xl space-y-5 p-4 sm:p-6">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Options Strategy Builder
              </h1>
              <p className="text-sm text-muted-foreground">
                Build multi-leg strategies · payoff at expiry · breakevens · max profit/loss
              </p>
            </div>
          </div>
        </header>

        {/* ── Main layout: left panel + right chart ────────────────────────── */}
        <div className="flex flex-col gap-5 xl:flex-row">

          {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
          <div className="w-full space-y-4 xl:w-[380px] xl:flex-shrink-0">

            {/* Underlying controls */}
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Underlying</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Symbol</Label>
                    <Input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      className="h-8 text-sm font-mono uppercase"
                      placeholder="NIFTY"
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Spot Price</Label>
                    <Input
                      type="number"
                      value={spot}
                      onChange={(e) => handleSpotChange(Number(e.target.value) || 0)}
                      className="h-8 text-sm tabular-nums"
                      min={1}
                      step={50}
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Lot Size</Label>
                    <Input
                      type="number"
                      value={lotSize}
                      onChange={(e) => setLotSize(Math.max(1, Number(e.target.value) || 1))}
                      className="h-8 text-sm tabular-nums"
                      min={1}
                    />
                  </div>
                </div>

                {/* Price range */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">Show range</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Range Min</Label>
                      <Input
                        type="number"
                        value={spotMin}
                        onChange={(e) => handleSpotMinChange(Number(e.target.value) || 0)}
                        className="h-7 text-xs tabular-nums"
                        step={100}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Range Max</Label>
                      <Input
                        type="number"
                        value={spotMax}
                        onChange={(e) => handleSpotMaxChange(Number(e.target.value) || 0)}
                        className="h-7 text-xs tabular-nums"
                        step={100}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preset strategy grid */}
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Preset Strategies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_NAMES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => applyPreset(name)}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-[11px] font-medium leading-tight transition-all hover:opacity-80 active:scale-95 cursor-pointer text-center',
                        PRESET_CATEGORY_COLORS[name] ??
                          'bg-muted text-muted-foreground border-border',
                      )}
                      title={`Apply ${name} preset`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Click a preset to auto-fill legs based on current spot &amp; lot size.
                </p>
              </CardContent>
            </Card>

            {/* Custom legs builder */}
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold">
                  Strategy Legs
                  {legs.length > 0 && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {legs.length}
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1">
                  {legs.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearLegs}
                      className="h-7 text-xs text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addLeg}
                    className="h-7 gap-1 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    Add Leg
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {legs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                    <Calculator className="h-8 w-8 opacity-20" />
                    <p className="text-sm">
                      Pick a preset above or add legs manually.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-2 text-[10px]">Type</TableHead>
                          <TableHead className="px-2 text-[10px]">Side</TableHead>
                          <TableHead className="px-2 text-[10px]">Strike</TableHead>
                          <TableHead className="px-2 text-[10px]">Premium</TableHead>
                          <TableHead className="px-2 text-[10px]">Lots</TableHead>
                          <TableHead className="px-2 text-[10px]">Lot Sz</TableHead>
                          <TableHead className="px-2 text-[10px] text-right">Cost</TableHead>
                          <TableHead className="px-2 text-[10px]" />
                          <TableHead className="px-2 w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {legs.map((leg) => (
                          <LegRow
                            key={leg.id}
                            leg={leg}
                            onChange={(updated) => updateLeg(leg.id, updated)}
                            onDelete={() => deleteLeg(leg.id)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-4">

            {/* Payoff Chart */}
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  Payoff at Expiry
                  {symbol && (
                    <span className="text-xs font-normal text-muted-foreground">
                      — {symbol} · Spot: {fmtPrice(spot)}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {curve.length === 0 ? (
                  <div className="flex h-[320px] items-center justify-center text-muted-foreground">
                    <div className="text-center space-y-2">
                      <Calculator className="mx-auto h-10 w-10 opacity-20" />
                      <p className="text-sm">Add legs to see the payoff diagram</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart
                      data={curve}
                      margin={{ top: 10, right: 20, bottom: 8, left: 16 }}
                    >
                      <defs>
                        <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.02} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.5}
                      />

                      <XAxis
                        dataKey="price"
                        type="number"
                        domain={[safeMin, safeMax]}
                        tickCount={6}
                        tickFormatter={fmtPrice}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                      />

                      <YAxis
                        tickFormatter={fmtYAxis}
                        domain={[yMin - yPad, yMax + yPad]}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        width={56}
                      />

                      <RechartsTooltip
                        content={<PayoffTooltip />}
                        cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '4 4' }}
                      />

                      {/* Profit area (pnl >= 0) */}
                      <Area
                        type="monotone"
                        dataKey="pnl"
                        stroke="none"
                        fill="url(#profitGradient)"
                        baseLine={0}
                        baseValue={0}
                        isAnimationActive={false}
                        // Only show positive fill
                        connectNulls
                      />

                      {/* Zero reference line */}
                      <ReferenceLine
                        y={0}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                      />

                      {/* Spot (CMP) reference */}
                      {spot >= safeMin && spot <= safeMax && (
                        <ReferenceLine
                          x={spot}
                          stroke="#3b82f6"
                          strokeDasharray="5 3"
                          strokeWidth={1.5}
                          label={{
                            value: `Spot`,
                            position: 'insideTopRight',
                            fontSize: 10,
                            fill: '#3b82f6',
                          }}
                        />
                      )}

                      {/* Breakeven reference lines */}
                      {metrics.breakevenPoints.map((be) => (
                        <ReferenceLine
                          key={be}
                          x={be}
                          stroke="#10b981"
                          strokeDasharray="4 3"
                          strokeWidth={1.5}
                          label={{
                            value: `BE ₹${be.toLocaleString('en-IN')}`,
                            position: 'insideTopLeft',
                            fontSize: 9,
                            fill: '#10b981',
                          }}
                        />
                      ))}

                      {/* P&L line */}
                      <Line
                        type="monotone"
                        dataKey="pnl"
                        dot={false}
                        strokeWidth={2.5}
                        stroke="#6366f1"
                        activeDot={{ r: 4, strokeWidth: 0, fill: '#6366f1' }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Metrics bar */}
            {legs.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard
                  label="Max Profit"
                  value={profitLabel(metrics.maxProfit, metrics.netPremium)}
                  colorClass="text-emerald-600 dark:text-emerald-400"
                />
                <MetricCard
                  label="Max Loss"
                  value={lossLabel(metrics.maxLoss, metrics.netPremium)}
                  colorClass="text-rose-600 dark:text-rose-400"
                />
                <MetricCard
                  label="Net Premium"
                  value={
                    metrics.netPremium === 0
                      ? '₹0'
                      : metrics.netPremium < 0
                      ? `Credit ${fmtINR(metrics.netPremium)}`
                      : `Debit ${fmtINR(metrics.netPremium)}`
                  }
                  colorClass={
                    metrics.netPremium < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : metrics.netPremium > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-foreground'
                  }
                />
                <MetricCard
                  label="Breakeven(s)"
                  value={
                    metrics.breakevenPoints.length === 0
                      ? 'None'
                      : metrics.breakevenPoints
                          .map((be) => `₹${be.toLocaleString('en-IN')}`)
                          .join(', ')
                  }
                  colorClass="text-amber-600 dark:text-amber-400"
                />
              </div>
            )}

            {/* Per-leg summary table */}
            {legs.length > 0 && (
              <Card className="rounded-xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Legs Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4 text-xs">#</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Side</TableHead>
                          <TableHead className="text-xs text-right">Strike</TableHead>
                          <TableHead className="text-xs text-right">Premium</TableHead>
                          <TableHead className="text-xs text-right">Lots×Sz</TableHead>
                          <TableHead className="text-xs text-right">Net Cost</TableHead>
                          <TableHead className="text-xs text-right">Max P&amp;L @ Range</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {legs.map((leg, idx) => {
                          const cost =
                            (leg.side === 'long' ? -1 : 1) *
                            leg.premium *
                            leg.lots *
                            leg.lotSize;
                          // Max individual leg payoff over the range
                          const legMax = Math.max(
                            legPayoff(leg, safeMin),
                            legPayoff(leg, safeMax),
                            leg.side === 'long'
                              ? legPayoff(leg, leg.type === 'call' ? safeMax : safeMin)
                              : 0,
                          );
                          const legMin = Math.min(
                            legPayoff(leg, safeMin),
                            legPayoff(leg, safeMax),
                            leg.side === 'long'
                              ? -leg.premium * leg.lots * leg.lotSize
                              : legPayoff(leg, leg.type === 'call' ? safeMax : safeMin),
                          );
                          const isCall = leg.type === 'call';
                          const isLong = leg.side === 'long';

                          return (
                            <TableRow key={leg.id}>
                              <TableCell className="pl-4 text-xs text-muted-foreground">
                                {idx + 1}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px] px-1.5',
                                    isCall
                                      ? 'border-green-400 text-green-700 dark:text-green-400'
                                      : 'border-orange-400 text-orange-700 dark:text-orange-400',
                                  )}
                                >
                                  {isCall ? 'CE / Call' : 'PE / Put'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    'text-xs font-medium',
                                    isLong
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400',
                                  )}
                                >
                                  {isLong ? '↑ Long' : '↓ Short'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs tabular-nums">
                                {leg.strike.toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs tabular-nums">
                                {leg.premium.toLocaleString('en-IN', {
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                                {leg.lots} × {leg.lotSize}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right font-mono text-xs tabular-nums font-medium',
                                  cost < 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400',
                                )}
                              >
                                {cost >= 0 ? '−' : '+'}{fmtINR(cost)}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  +{fmtINR(Math.max(legMax, 0))}
                                </span>
                                <span className="text-muted-foreground mx-1">/</span>
                                <span className="text-rose-600 dark:text-rose-400">
                                  −{fmtINR(Math.abs(Math.min(legMin, 0)))}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Disclaimer */}
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Educational / indicative only.</strong> Payoff calculations assume
                holding to expiry with the entered premiums. Real P&amp;L will vary with
                time decay (theta), implied volatility, bid-ask spreads, slippage, and
                exchange fees. Always verify with your broker before placing orders.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
