/**
 * Markets — SPAN Margin Calculator.
 *
 * Route: /dashboard/markets/span
 *
 * Lets traders build a basket of F&O positions and compute indicative
 * SPAN + exposure margins based on a simplified SEBI approximation.
 */

import { useState, useId } from "react";
import { Calculator, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
} from "@/design-system";

import { useCalculateSpan, type SpanPosition, type SpanResult } from "../hooks/useSpanCalculator";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number | null | undefined): string {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Empty position factory ────────────────────────────────────────────────────

function emptyPosition(): SpanPosition & { _key: number } {
  return {
    _key: Date.now() + Math.random(),
    symbol: "",
    exchange: "NSE",
    instrument_type: "future",
    qty: 1,
    direction: "buy",
    ltp_override: undefined,
    premium: undefined,
    strike: undefined,
    expiry: "",
  };
}

type DraftPosition = SpanPosition & { _key: number };

// ── Row component ─────────────────────────────────────────────────────────────

interface PositionRowProps {
  pos: DraftPosition;
  onChange: (updated: DraftPosition) => void;
  onRemove: () => void;
}

function PositionRow({ pos, onChange, onRemove }: PositionRowProps) {
  const id = useId();
  const isOption = pos.instrument_type === "call" || pos.instrument_type === "put";

  function set<K extends keyof DraftPosition>(field: K, value: DraftPosition[K]) {
    onChange({ ...pos, [field]: value });
  }

  return (
    <tr className="border-b last:border-0">
      {/* Symbol */}
      <td className="px-3 py-2">
        <Input
          id={`${id}-sym`}
          value={pos.symbol}
          onChange={(e) => set("symbol", e.target.value.toUpperCase())}
          placeholder="NIFTY"
          className="h-8 w-28 font-mono text-xs uppercase"
        />
      </td>

      {/* Type */}
      <td className="px-3 py-2">
        <Select
          value={pos.instrument_type}
          onValueChange={(v) => set("instrument_type", v as DraftPosition["instrument_type"])}
        >
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="future">FUT</SelectItem>
            <SelectItem value="call">CE</SelectItem>
            <SelectItem value="put">PE</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Strike (options only) */}
      <td className="px-3 py-2">
        {isOption ? (
          <Input
            id={`${id}-strike`}
            type="number"
            value={pos.strike ?? ""}
            onChange={(e) => set("strike", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="24000"
            className="h-8 w-24 text-xs"
          />
        ) : (
          <span className="px-2 text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* LTP / Price */}
      <td className="px-3 py-2">
        <Input
          id={`${id}-ltp`}
          type="number"
          value={pos.ltp_override ?? ""}
          onChange={(e) => set("ltp_override", e.target.value ? Number(e.target.value) : undefined)}
          placeholder={isOption ? "Premium" : "LTP"}
          className="h-8 w-24 text-xs"
        />
      </td>

      {/* Qty (lots) */}
      <td className="px-3 py-2">
        <Input
          id={`${id}-qty`}
          type="number"
          min={1}
          value={pos.qty}
          onChange={(e) => set("qty", Math.max(1, Number(e.target.value)))}
          className="h-8 w-16 text-xs"
        />
      </td>

      {/* Direction */}
      <td className="px-3 py-2">
        <Select
          value={pos.direction}
          onValueChange={(v) => set("direction", v as DraftPosition["direction"])}
        >
          <SelectTrigger className="h-8 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buy">Buy</SelectItem>
            <SelectItem value="sell">Sell</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Expiry */}
      <td className="px-3 py-2">
        <Input
          id={`${id}-expiry`}
          value={pos.expiry ?? ""}
          onChange={(e) => set("expiry", e.target.value)}
          placeholder="29-May-2026"
          className="h-8 w-28 text-xs"
        />
      </td>

      {/* Remove */}
      <td className="px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          aria-label="Remove position"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ result }: { result: SpanResult }) {
  const { summary } = result;
  return (
    <Card className="rounded-xl border-primary/30 bg-primary/5 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
          <Calculator className="h-4 w-4 text-primary" />
          Margin Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          <SummaryItem label="SPAN Margin" value={fmtINR(summary.span_margin)} />
          <SummaryItem label="Exposure Margin" value={fmtINR(summary.exposure_margin)} />
          <SummaryItem label="Portfolio Offset" value={`−${fmtINR(summary.portfolio_offset)}`} accent="emerald" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Net Margin Required
            </p>
            <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-foreground">
              {fmtINR(summary.net_margin)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald";
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-lg font-bold tabular-nums ${
          accent === "emerald"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ── Results table ─────────────────────────────────────────────────────────────

function ResultsTable({ result }: { result: SpanResult }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Per-Position Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Lots × Size</TableHead>
                <TableHead className="text-right">LTP Used</TableHead>
                <TableHead className="text-right">Contract Value</TableHead>
                <TableHead className="text-right">SPAN</TableHead>
                <TableHead className="text-right">Exposure</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.positions.map((p, i) => {
                const typeLabel =
                  p.instrument_type === "call"
                    ? "CE"
                    : p.instrument_type === "put"
                      ? "PE"
                      : "FUT";
                const isLong = p.direction === "buy";
                return (
                  <TableRow key={i}>
                    <TableCell className="font-mono font-semibold">{p.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {typeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-semibold ${
                          isLong
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}
                      >
                        {isLong ? "↑ BUY" : "↓ SELL"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {p.qty} × {p.lot_size}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {fmtINR(p.ltp_used)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {fmtINR(p.contract_value)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {fmtINR(p.span_margin)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {fmtINR(p.exposure_margin)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold tabular-nums">
                      {fmtINR(p.total_margin)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function SpanCalculatorPage() {
  const [positions, setPositions] = useState<DraftPosition[]>([emptyPosition()]);
  const [result, setResult] = useState<SpanResult | null>(null);
  const { mutate: calculate, isPending } = useCalculateSpan();

  function addPosition() {
    setPositions((prev) => [...prev, emptyPosition()]);
  }

  function updatePosition(key: number, updated: DraftPosition) {
    setPositions((prev) => prev.map((p) => (p._key === key ? updated : p)));
  }

  function removePosition(key: number) {
    setPositions((prev) => {
      const next = prev.filter((p) => p._key !== key);
      return next.length === 0 ? [emptyPosition()] : next;
    });
  }

  function clearAll() {
    setPositions([emptyPosition()]);
    setResult(null);
  }

  function handleCalculate() {
    const valid = positions.filter((p) => p.symbol.trim().length > 0);
    if (valid.length === 0) {
      toast.error("Add at least one position with a symbol.");
      return;
    }

    // Sanitise: set ltp_override as premium for options when not separately provided
    const payload: SpanPosition[] = valid.map(({ _key: _k, ...rest }) => ({
      ...rest,
      ltp_override: rest.ltp_override ?? undefined,
      premium:
        rest.premium ??
        (rest.instrument_type !== "future" ? rest.ltp_override : undefined),
    }));

    calculate(payload, {
      onSuccess: (data) => {
        setResult(data);
        toast.success("Margin calculated.");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-screen-xl space-y-6 p-4 sm:p-6">

        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                SPAN Margin Calculator
              </h1>
              <p className="text-sm text-muted-foreground">
                Estimate F&O margin requirements for your basket of positions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearAll} className="h-9">
              Clear All
            </Button>
            <Button size="sm" onClick={handleCalculate} disabled={isPending} className="h-9 gap-2">
              <Calculator className="h-4 w-4" />
              {isPending ? "Calculating…" : "Calculate"}
            </Button>
          </div>
        </header>

        {/* Positions builder */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">
              Positions
              <Label className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {positions.filter((p) => p.symbol).length} added
              </Label>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addPosition} className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Add Position
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Symbol
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Type
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Strike
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      LTP / Premium
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Lots
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      B/S
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Expiry
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <PositionRow
                      key={pos._key}
                      pos={pos}
                      onChange={(updated) => updatePosition(pos._key, updated)}
                      onRemove={() => removePosition(pos._key)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <>
            <SummaryCard result={result} />
            <ResultsTable result={result} />
          </>
        )}

        {/* Disclaimer */}
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Indicative margin only.</strong> This calculator uses a simplified SPAN
            approximation (10% SPAN + 3–5% exposure). Actual margins are determined by exchange
            risk parameter files published by NSE/BSE and may differ significantly, especially
            during volatile market conditions or corporate events. Always verify with your broker
            before placing orders.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}
