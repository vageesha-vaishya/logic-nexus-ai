/**
 * OptionsPnLPanel — live P&L, Greeks, moneyness and theta decay for option positions.
 *
 * Props: { portfolioId: string }
 *
 * Layout:
 *   ┌─ Options Positions ──────────────────────────────────────────────────┐
 *   │  N active positions | Net Greeks: Δ ±X · Γ ±X · Θ -₹X/day          │
 *   │  Table: Symbol │ Strike │ Exp │ DTE │ P&L │ Δ │ Θ/day │ IV         │
 *   │  Theta Decay Timeline (AreaChart)                                    │
 *   └──────────────────────────────────────────────────────────────────────┘
 */

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Badge,
  Card, CardContent, CardHeader, CardTitle,
  EmptyState, SkeletonRow,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/design-system";
import { useOptionsPositions } from "../hooks/useOptionsPositions";
import type { OptionPosition } from "../hooks/useOptionsPositions";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtInr(val: number | null, sign = false): string {
  if (val === null || val === undefined) return "—";
  const abs = Math.abs(val);
  const prefix = sign ? (val >= 0 ? "+" : "-") : val < 0 ? "-" : "";
  if (abs >= 1_00_000) return `${prefix}₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000)   return `${prefix}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return `${prefix}₹${abs.toFixed(2)}`;
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

function fmtGreek(val: number | null, decimals = 4): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(decimals);
}

function fmtIv(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

// ── Moneyness badge ───────────────────────────────────────────────────────────

function MoneybadgeUI({ moneyness }: { moneyness: string | null }) {
  if (!moneyness) return null;
  const variant =
    moneyness === "ITM" ? "default"
    : moneyness === "ATM" ? "secondary"
    : "outline";
  const color =
    moneyness === "ITM" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : moneyness === "ATM" ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-muted-foreground";
  return (
    <Badge variant={variant} className={`text-[10px] px-1.5 py-0 ${color}`}>
      {moneyness}
    </Badge>
  );
}

// ── DTE cell (red if ≤ 5 days) ────────────────────────────────────────────────

function DteCell({ dte }: { dte: number }) {
  return (
    <span className={dte <= 5 ? "font-semibold text-destructive" : "text-muted-foreground"}>
      {dte}d
    </span>
  );
}

// ── P&L cell ──────────────────────────────────────────────────────────────────

function PnlCell({ pnl, pnlPct }: { pnl: number | null; pnlPct: number | null }) {
  if (pnl === null) return <span className="text-muted-foreground">—</span>;
  const positive = pnl >= 0;
  return (
    <span className={positive ? "text-emerald-600 font-medium" : "text-destructive font-medium"}>
      {fmtInr(pnl, true)}
      {pnlPct !== null && (
        <span className="ml-1 text-[11px] opacity-75">{fmtPct(pnlPct)}</span>
      )}
    </span>
  );
}

// ── Theta decay timeline data ─────────────────────────────────────────────────

interface ThetaPoint {
  day: number;
  theta_cost: number;
}

function buildThetaTimeline(positions: OptionPosition[]): ThetaPoint[] {
  const maxDte = Math.max(...positions.map((p) => p.days_to_expiry), 0);
  if (maxDte === 0) return [];

  const result: ThetaPoint[] = [];
  for (let day = maxDte; day >= 0; day--) {
    // Sum up theta INR for positions still alive at this DTE
    const totalTheta = positions.reduce((sum, p) => {
      if (p.days_to_expiry < day) return sum;
      return sum + (p.theta_inr_per_day ?? 0);
    }, 0);
    result.push({ day, theta_cost: Math.abs(totalTheta) });
  }
  return result;
}

// ── Net Greeks summary ────────────────────────────────────────────────────────

function NetGreeksSummary({
  delta, gamma, thetaInr, count,
}: {
  delta: number; gamma: number; thetaInr: number; count: number;
}) {
  return (
    <p className="text-xs text-muted-foreground mt-0.5">
      <span className="font-medium text-foreground">{count}</span>{" "}
      active position{count !== 1 ? "s" : ""}{" · "}
      Net Greeks:{" "}
      <span className="font-mono">Δ {delta >= 0 ? "+" : ""}{fmtGreek(delta, 2)}</span>{" · "}
      <span className="font-mono">Γ {gamma >= 0 ? "+" : ""}{fmtGreek(gamma, 4)}</span>{" · "}
      <span className="font-mono text-amber-600">
        Θ {fmtInr(thetaInr, false)}/day
      </span>
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  portfolioId: string;
}

export function OptionsPnLPanel({ portfolioId }: Props) {
  const { data, isLoading, isError, error } = useOptionsPositions(portfolioId);

  const thetaTimeline = useMemo(
    () => (data ? buildThetaTimeline(data.positions) : []),
    [data],
  );

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Options Positions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} columns={8} size="compact" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (isError) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            title="Could not load options"
            description={(error as Error)?.message ?? "Unknown error"}
          />
        </CardContent>
      </Card>
    );
  }

  const positions = data?.positions ?? [];
  const netGreeks = data?.net_greeks;

  // ── Empty state ──────────────────────────────────────────────────────────
  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Options Positions</CardTitle>
        </CardHeader>
        <CardContent className="py-10">
          <EmptyState
            title="No options positions"
            description="No options positions in this portfolio"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Options Positions</CardTitle>
        {netGreeks && (
          <NetGreeksSummary
            count={positions.length}
            delta={netGreeks.delta}
            gamma={netGreeks.gamma}
            thetaInr={netGreeks.theta_inr_per_day}
          />
        )}
      </CardHeader>

      <CardContent className="space-y-6 pb-5">
        {/* ── Positions table ─────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-[140px]">Symbol</TableHead>
                <TableHead className="text-right">Strike</TableHead>
                <TableHead className="text-right">Exp</TableHead>
                <TableHead className="text-right">DTE</TableHead>
                <TableHead className="text-right">P&amp;L</TableHead>
                <TableHead className="text-right">Delta (Δ)</TableHead>
                <TableHead className="text-right">Theta/day</TableHead>
                <TableHead className="text-right">IV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((pos) => (
                <TableRow key={pos.symbol} className="text-xs">
                  {/* Symbol + moneyness + type */}
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono font-semibold text-[11px] leading-tight">
                        {pos.underlying}{" "}
                        <span
                          className={
                            pos.option_type === "CE"
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }
                        >
                          {pos.option_type}
                        </span>
                      </span>
                      <MoneybadgeUI moneyness={pos.moneyness} />
                    </div>
                  </TableCell>

                  {/* Strike */}
                  <TableCell className="text-right font-mono">
                    {pos.strike > 0
                      ? pos.strike.toLocaleString("en-IN")
                      : "—"}
                  </TableCell>

                  {/* Expiry short label */}
                  <TableCell className="text-right text-muted-foreground">
                    {pos.expiry
                      ? new Date(pos.expiry).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </TableCell>

                  {/* Days to expiry */}
                  <TableCell className="text-right">
                    <DteCell dte={pos.days_to_expiry} />
                  </TableCell>

                  {/* P&L */}
                  <TableCell className="text-right">
                    <PnlCell pnl={pos.pnl} pnlPct={pos.pnl_pct} />
                  </TableCell>

                  {/* Delta */}
                  <TableCell className="text-right font-mono">
                    {fmtGreek(pos.delta)}
                  </TableCell>

                  {/* Theta (INR per day) */}
                  <TableCell className="text-right font-mono text-amber-600">
                    {pos.theta_inr_per_day !== null
                      ? fmtInr(pos.theta_inr_per_day)
                      : "—"}
                  </TableCell>

                  {/* IV */}
                  <TableCell className="text-right text-muted-foreground">
                    {fmtIv(pos.iv)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* ── Theta decay timeline ─────────────────────────────────────────── */}
        {thetaTimeline.length > 1 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Theta Decay Timeline — daily cost (₹) vs days to expiry
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={thetaTimeline}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="thetaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    reversed
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => `${v}d`}
                    label={{ value: "DTE", position: "insideBottomRight", offset: -4, fontSize: 10 }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => `₹${Math.round(v)}`}
                    width={56}
                  />
                  <RechartsTooltip
                    formatter={(value: number) => [`₹${Math.round(value)}`, "Theta cost"]}
                    labelFormatter={(label: number) => `${label} days to expiry`}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="theta_cost"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    fill="url(#thetaGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
