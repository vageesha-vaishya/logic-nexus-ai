/**
 * StrategyBuilder — multi-leg option strategy builder with real-time payoff diagram.
 *
 * Props: underlying symbol, current spot price, expiry string.
 * Lets users add option legs (CE/PE, buy/sell, strike, qty, premium) and renders
 * a recharts payoff-at-expiry curve with max profit/loss, breakevens, and net premium.
 */

import { useState, useMemo } from "react";
import { Trash2, Plus, GitBranch } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { cn } from "@/lib/utils";

import { useOptionChain } from "../hooks/useFno";
import {
  type StrategyLeg,
  type OptionType,
  type TradeDirection,
  generatePayoffCurve,
  computeMetrics,
} from "../utils/options-payoff";
import {
  STRATEGY_TEMPLATES,
  type TemplateParams,
} from "../utils/strategy-templates";

// ── Helpers ───────────────────────────────────────────────────────────────────

const INR = (v: number) =>
  `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function getNearestATM(spot: number, stepSize: number): number {
  return Math.round(spot / stepSize) * stepSize;
}

function getStepSize(symbol: string): number {
  if (symbol === "BANKNIFTY") return 100;
  return 50;
}

const CATEGORY_COLORS: Record<string, string> = {
  bullish: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-700",
  bearish: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",
  neutral: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  volatile: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700",
};

function legRowColor(leg: StrategyLeg): string {
  if (leg.optionType === "CE" && leg.direction === "buy")
    return "text-green-700 dark:text-green-400";
  if (leg.optionType === "CE" && leg.direction === "sell")
    return "text-orange-600 dark:text-orange-400";
  if (leg.optionType === "PE" && leg.direction === "buy")
    return "text-orange-700 dark:text-orange-400";
  // PE sell
  return "text-green-600 dark:text-green-400";
}

// ── Custom recharts tooltip ───────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
}

function PayoffTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const pnl = payload[0].value;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="text-muted-foreground">
        Spot: ₹{Number(label).toLocaleString("en-IN")}
      </p>
      <p className={cn("font-semibold", pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
        P&amp;L: {pnl >= 0 ? "+" : ""}{INR(pnl)}
      </p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface StrategyBuilderProps {
  underlying: string;
  spot: number;
  expiry: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export function StrategyBuilder({ underlying, spot, expiry }: StrategyBuilderProps) {
  const [legs, setLegs] = useState<StrategyLeg[]>([]);

  // Manual leg form state
  const [formType, setFormType]       = useState<OptionType>("CE");
  const [formDir, setFormDir]         = useState<TradeDirection>("buy");
  const [formStrike, setFormStrike]   = useState("");
  const [formPremium, setFormPremium] = useState("");
  const [formQty, setFormQty]         = useState("1");

  // Option chain data — used for template auto-fill
  const chainQuery = useOptionChain(underlying, expiry);
  const chain = chainQuery.data;
  const lotSize = chain?.lot_size ?? 50;
  const chainDataReady = !chainQuery?.isPending && !chainQuery?.isError && Boolean(chainQuery?.data);

  // ── Payoff computation ────────────────────────────────────────────────────

  const payoffCurve = useMemo(
    () => generatePayoffCurve(legs, spot > 0 ? spot : 20000),
    [legs, spot],
  );

  const metrics = useMemo(
    () => computeMetrics(legs, payoffCurve, spot > 0 ? spot : 20000),
    [legs, payoffCurve, spot],
  );

  // ── Template helpers ──────────────────────────────────────────────────────

  function buildTemplateParams(): TemplateParams {
    const step = getStepSize(underlying);
    const atm = getNearestATM(spot > 0 ? spot : 20000, step);
    const otm1 = atm + step;
    const otm2 = atm + step * 2;
    const itm1 = atm - step;

    // Look up premiums from option chain if available
    function findPremium(strike: number, type: "CE" | "PE"): number {
      if (!chain?.strikes) return 0;
      const s = chain.strikes.find(st => st.strike === strike);
      if (!s) return 0;
      const leg = type === "CE" ? s.ce : s.pe;
      return leg?.ltp ?? 0;
    }

    return {
      spot,
      atm,
      otm1,
      otm2,
      itm1,
      atmCePremium:   findPremium(atm, "CE"),
      atmPePremium:   findPremium(atm, "PE"),
      otm1CePremium:  findPremium(otm1, "CE"),
      otm1PePremium:  findPremium(itm1, "PE"),
      lotSize,
    };
  }

  function applyTemplate(idx: number) {
    const template = STRATEGY_TEMPLATES[idx];
    const params = buildTemplateParams();
    const templateLegs = template.legs(params);
    const now = Date.now();
    const newLegs: StrategyLeg[] = templateLegs.map((l, i) => ({
      ...l,
      id: `${now}-${i}`,
      expiry,
    }));
    setLegs(newLegs);
  }

  // ── Leg management ────────────────────────────────────────────────────────

  function addLeg() {
    const strike  = parseFloat(formStrike);
    const premium = parseFloat(formPremium);
    const qty     = parseInt(formQty, 10);
    if (!strike || !premium || !qty || qty < 1) return;

    const newLeg: StrategyLeg = {
      id: Date.now().toString(),
      optionType: formType,
      direction: formDir,
      strike,
      premium,
      qty,
      lotSize,
      expiry,
    };
    setLegs(prev => [...prev, newLeg]);
    setFormStrike("");
    setFormPremium("");
    setFormQty("1");
  }

  function removeLeg(id: string) {
    setLegs(prev => prev.filter(l => l.id !== id));
  }

  // ── Chart helpers ─────────────────────────────────────────────────────────

  const chartMin = spot > 0 ? spot * 0.6 : 12000;
  const chartMax = spot > 0 ? spot * 1.4 : 28000;

  const pnlMin = payoffCurve.length > 0
    ? Math.min(...payoffCurve.map(p => p.pnl))
    : -10000;
  const pnlMax = payoffCurve.length > 0
    ? Math.max(...payoffCurve.map(p => p.pnl))
    : 10000;
  const yPad = Math.max(Math.abs(pnlMax - pnlMin) * 0.1, 500);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

      {/* ── Left column — Leg Builder ─────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Strategy template buttons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              Strategy Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {STRATEGY_TEMPLATES.map((t, i) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => applyTemplate(i)}
                  disabled={!chainDataReady}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                    CATEGORY_COLORS[t.category],
                  )}
                  title={t.description}
                >
                  {t.name}
                </button>
              ))}
            </div>
            {!chainDataReady && (
              <p className="text-xs text-muted-foreground mt-1">
                Select an underlying and expiry to enable strategy templates with live premiums.
              </p>
            )}
            {chainDataReady && (
              <p className="text-xs text-muted-foreground mt-2">
                Click a template to auto-fill legs from live option chain data.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Manual leg form */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Add Leg Manually</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-2">

              {/* CE / PE toggle */}
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <div className="flex rounded-md overflow-hidden border text-xs font-medium">
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 transition-colors",
                      formType === "CE"
                        ? "bg-green-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                    onClick={() => setFormType("CE")}
                  >
                    CE
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 transition-colors",
                      formType === "PE"
                        ? "bg-orange-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                    onClick={() => setFormType("PE")}
                  >
                    PE
                  </button>
                </div>
              </div>

              {/* BUY / SELL toggle */}
              <div className="space-y-1">
                <Label className="text-xs">Direction</Label>
                <div className="flex rounded-md overflow-hidden border text-xs font-medium">
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 transition-colors",
                      formDir === "buy"
                        ? "bg-green-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                    onClick={() => setFormDir("buy")}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 transition-colors",
                      formDir === "sell"
                        ? "bg-red-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                    onClick={() => setFormDir("sell")}
                  >
                    SELL
                  </button>
                </div>
              </div>

              {/* Strike */}
              <div className="space-y-1">
                <Label className="text-xs">Strike</Label>
                <Input
                  type="number"
                  placeholder="e.g. 24500"
                  value={formStrike}
                  onChange={e => setFormStrike(e.target.value)}
                  className="w-28 h-8 text-sm"
                />
              </div>

              {/* Premium */}
              <div className="space-y-1">
                <Label className="text-xs">Premium</Label>
                <Input
                  type="number"
                  placeholder="e.g. 150"
                  value={formPremium}
                  onChange={e => setFormPremium(e.target.value)}
                  className="w-24 h-8 text-sm"
                />
              </div>

              {/* Qty (lots) */}
              <div className="space-y-1">
                <Label className="text-xs">Lots</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={formQty}
                  onChange={e => setFormQty(e.target.value)}
                  className="w-16 h-8 text-sm"
                />
              </div>

              <Button
                size="sm"
                onClick={addLeg}
                className="h-8"
                disabled={!formStrike || !formPremium}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Lot size: <span className="font-medium">{lotSize}</span> units
            </p>
          </CardContent>
        </Card>

        {/* Active legs table */}
        {legs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Strategy Legs</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setLegs([])}
                >
                  Clear all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs pl-4">Type</TableHead>
                    <TableHead className="text-xs">Dir</TableHead>
                    <TableHead className="text-xs text-right">Strike</TableHead>
                    <TableHead className="text-xs text-right">Premium</TableHead>
                    <TableHead className="text-xs text-right">Lots</TableHead>
                    <TableHead className="text-xs text-right">Cost (₹)</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {legs.map(leg => {
                    const cost = leg.premium * leg.qty * leg.lotSize;
                    const isDebit = leg.direction === "buy";
                    return (
                      <TableRow key={leg.id}>
                        <TableCell className={cn("text-xs font-semibold pl-4", legRowColor(leg))}>
                          {leg.optionType}
                        </TableCell>
                        <TableCell className={cn("text-xs uppercase", legRowColor(leg))}>
                          {leg.direction}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {leg.strike.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {leg.premium.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {leg.qty}
                        </TableCell>
                        <TableCell className={cn("text-xs text-right tabular-nums font-medium", isDebit ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
                          {isDebit ? "-" : "+"}{INR(cost)}
                        </TableCell>
                        <TableCell className="pr-3">
                          <button
                            type="button"
                            onClick={() => removeLeg(leg.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Remove leg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Strategy metrics summary */}
        {legs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Strategy Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricTile
                  label="Net Premium"
                  value={
                    metrics.netPremiumPaid === 0
                      ? "₹0"
                      : `${metrics.netPremiumPaid > 0 ? "Paid " : "Rcvd "}${INR(metrics.netPremiumPaid)}`
                  }
                  color={metrics.netPremiumPaid > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}
                />
                <MetricTile
                  label="Max Profit"
                  value={metrics.maxProfit === null ? "Unlimited" : INR(metrics.maxProfit)}
                  color="text-green-600 dark:text-green-400"
                />
                <MetricTile
                  label="Max Loss"
                  value={metrics.maxLoss === null ? "Unlimited" : INR(Math.abs(metrics.maxLoss))}
                  color="text-red-600 dark:text-red-400"
                />
                <MetricTile
                  label="Current P&L"
                  value={`${metrics.currentPnL >= 0 ? "+" : ""}${INR(metrics.currentPnL)}`}
                  color={metrics.currentPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
                />
              </div>
              {metrics.breakevens.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Breakeven{metrics.breakevens.length > 1 ? "s" : ""}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {metrics.breakevens.map(be => (
                      <Badge key={be} variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-400 dark:border-amber-600 tabular-nums text-xs">
                        ₹{be.toLocaleString("en-IN")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {legs.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <GitBranch className="mx-auto h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm">Pick a template or add legs manually to start building your strategy.</p>
          </div>
        )}
      </div>

      {/* ── Right column — Payoff Chart ───────────────────────────────────── */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Payoff at Expiry
              {underlying && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {underlying} · {expiry || "no expiry set"}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payoffCurve.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
                Add legs to see the payoff diagram
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={payoffCurve}
                  margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="spot"
                    type="number"
                    domain={[chartMin, chartMax]}
                    tickCount={6}
                    tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tickFormatter={(v: number) =>
                      v === 0 ? "0" : `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(1)}k`
                    }
                    domain={[pnlMin - yPad, pnlMax + yPad]}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    width={60}
                  />
                  <RechartsTooltip content={<PayoffTooltip />} />

                  {/* Zero reference */}
                  <ReferenceLine
                    y={0}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />

                  {/* CMP reference */}
                  {spot > 0 && (
                    <ReferenceLine
                      x={spot}
                      stroke="#3b82f6"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: "CMP", position: "top", fontSize: 11, fill: "#3b82f6" }}
                    />
                  )}

                  {/* Breakeven references */}
                  {metrics.breakevens.map(be => (
                    <ReferenceLine
                      key={be}
                      x={be}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: `BE`, position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }}
                    />
                  ))}

                  <Line
                    type="monotone"
                    dataKey="pnl"
                    dot={false}
                    strokeWidth={2}
                    stroke="#6366f1"
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Greeks placeholder — shown when legs exist */}
        {legs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Aggregate Greeks</CardTitle>
            </CardHeader>
            <CardContent>
              <GreeksPanel legs={legs} chain={chain} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border p-3 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums", color)}>{value}</p>
    </div>
  );
}

interface GreeksPanelProps {
  legs: StrategyLeg[];
  chain: ReturnType<typeof useOptionChain>["data"];
}

function GreeksPanel({ legs, chain }: GreeksPanelProps) {
  const aggregates = useMemo(() => {
    let delta = 0, gamma = 0, theta = 0, vega = 0;
    if (!chain?.strikes) return null;

    for (const leg of legs) {
      const strikeData = chain.strikes.find(s => s.strike === leg.strike);
      if (!strikeData) continue;
      const optLeg = leg.optionType === "CE" ? strikeData.ce : strikeData.pe;
      if (!optLeg) continue;
      const sign = leg.direction === "buy" ? 1 : -1;
      const units = leg.qty * leg.lotSize;
      delta += (optLeg.delta ?? 0) * sign * units;
      gamma += (optLeg.gamma ?? 0) * sign * units;
      theta += (optLeg.theta ?? 0) * sign * units;
      vega  += (optLeg.vega  ?? 0) * sign * units;
    }
    return { delta, gamma, theta, vega };
  }, [legs, chain]);

  if (!aggregates) {
    return (
      <p className="text-xs text-muted-foreground">
        Greeks are shown when live option chain data is available.
      </p>
    );
  }

  const fmt = (v: number) =>
    v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="grid grid-cols-4 gap-3">
      {(
        [
          { name: "Δ Delta", val: aggregates.delta },
          { name: "Γ Gamma", val: aggregates.gamma },
          { name: "Θ Theta/day", val: aggregates.theta },
          { name: "V Vega", val: aggregates.vega },
        ] as const
      ).map(({ name, val }) => (
        <div key={name} className="rounded-md border p-2 text-center">
          <p className="text-xs text-muted-foreground">{name}</p>
          <p className={cn(
            "text-sm font-medium tabular-nums mt-0.5",
            val > 0 ? "text-green-600 dark:text-green-400" : val < 0 ? "text-red-600 dark:text-red-400" : "",
          )}>
            {val >= 0 ? "+" : ""}{fmt(val)}
          </p>
        </div>
      ))}
    </div>
  );
}
