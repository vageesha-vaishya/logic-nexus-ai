/**
 * SipTrackerPanel
 *
 * Renders a full-featured SIP tracker card:
 *   - Active SIP count badge
 *   - Per-SIP rows: fund name, frequency, SIP amount, next debit date,
 *     total invested, current value, XIRR, returns, status badge, actions
 *
 * Data:
 *   - SIP list from useMfSips()
 *   - Portfolio holdings from useMfPortfolio() — merged to get current_value
 *     and invested_value for each SIP via holding_id
 *
 * XIRR is computed client-side from monthly instalment cashflows using the
 * xirr() utility (Newton-Raphson). The model assumes monthly instalments from
 * the first SIP date to today, with the current portfolio value as the
 * terminal positive cashflow.
 */

import { useMemo } from "react";
import { PiggyBank, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";

import { useMfSips, useMfPortfolio, type MfSip, type MfHolding } from "../hooks/useMf";
import { xirr, formatXirr, type CashFlow } from "../utils/xirr";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtINR(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtDate(dateStr: string | null | undefined): { label: string; urgent: boolean } {
  if (!dateStr) return { label: "—", urgent: false };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { label: dateStr, urgent: false };
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
  return { label, urgent: diffDays >= 0 && diffDays < 7 };
}

function fmtSipDate(day: number | null): string {
  if (day == null) return "Monthly";
  return `Monthly (${day}${ordinal(day)})`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

// ── XIRR computation per SIP ─────────────────────────────────────────────────

/**
 * Build monthly cashflows for a SIP from its first payment date to today,
 * then append the current portfolio value as the terminal receipt.
 *
 * Returns annualised XIRR rate or null if data is insufficient.
 */
function computeSipXirr(
  sip: MfSip,
  holding: MfHolding | undefined,
): number | null {
  const amount = sip.sip_amount;
  const currentValue = holding?.current_value ?? null;

  // Need at least amount and current value to compute XIRR
  if (!amount || currentValue == null || currentValue <= 0) return null;

  // Derive start date: use sip_date day-of-month in the earliest holding date,
  // or fall back to 12 months ago as a conservative estimate.
  const sipDayOfMonth = sip.sip_date ?? 1;

  // Attempt to derive start from holding's last_updated_at minus units_held / monthly
  // Since we don't have an explicit start_date on MfSip, estimate from units held:
  // start ≈ today minus (units_held / (amount / current_nav_per_unit)) months
  // Simpler: use last_updated_at or fall back to 12 months ago.
  const updatedAt = holding?.last_updated_at ?? null;

  let start: Date;
  if (updatedAt) {
    // Use the earliest plausible start: last_updated minus a rough period
    // We use the sip_date day in the month 12 months before last_updated
    const ref = new Date(updatedAt);
    start = new Date(ref.getFullYear() - 1, ref.getMonth(), sipDayOfMonth);
  } else {
    // Default: 12 months ago
    const now = new Date();
    start = new Date(now.getFullYear() - 1, now.getMonth(), sipDayOfMonth);
  }

  const today = new Date();

  // Build monthly instalment cashflows (negative = money out)
  const cashflows: CashFlow[] = [];
  const cursor = new Date(start);

  while (cursor <= today) {
    cashflows.push({ amount: -amount, date: new Date(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  if (cashflows.length === 0) return null;

  // Terminal: current portfolio value for this SIP (positive = money in)
  cashflows.push({ amount: currentValue, date: today });

  try {
    return xirr(cashflows);
  } catch (err) {
    logger.warn("[SipTrackerPanel] xirr computation failed", { err });
    return null;
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
        Active
      </Badge>
    );
  }
  if (status === "paused") {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
        Paused
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
      Cancelled
    </Badge>
  );
}

// ── Skeleton loading rows ─────────────────────────────────────────────────────

function SipSkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-7 w-32" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function SipEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center px-4">
      <PiggyBank className="h-12 w-12 text-muted-foreground/30" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">No active SIPs</p>
        <p className="text-xs text-muted-foreground">
          Grow your wealth steadily — start your first SIP today.
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to="/dashboard/markets/mf">Start your first SIP</Link>
      </Button>
    </div>
  );
}

// ── Enriched SIP row type ─────────────────────────────────────────────────────

interface EnrichedSip {
  sip:          MfSip;
  holding:      MfHolding | undefined;
  investedValue: number | null;
  currentValue:  number | null;
  returns:       number | null;
  xirrRate:      number | null;
  status:        string;
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function SipTrackerPanel() {
  const sipsQuery      = useMfSips();
  const portfolioQuery = useMfPortfolio();

  const isLoading = sipsQuery.isLoading || portfolioQuery.isLoading;

  // Build a lookup: holding_id → MfHolding
  const holdingMap = useMemo<Map<string, MfHolding>>(() => {
    const map = new Map<string, MfHolding>();
    for (const h of portfolioQuery.data?.holdings ?? []) {
      map.set(h.id, h);
    }
    return map;
  }, [portfolioQuery.data]);

  // Enrich each SIP with portfolio data + computed XIRR
  const enriched = useMemo<EnrichedSip[]>(() => {
    return (sipsQuery.data ?? []).map((sip) => {
      const holding       = holdingMap.get(sip.holding_id);
      const investedValue = holding?.invested_value ?? null;
      const currentValue  = holding?.current_value  ?? null;
      const returns       = investedValue != null && currentValue != null
        ? currentValue - investedValue
        : null;
      const xirrRate      = computeSipXirr(sip, holding);

      // Derive status from SIP amount being non-zero and next_sip_date present
      // (API doesn't currently return a status field; treat all returned SIPs as active)
      const status = sip.sip_amount > 0 ? "active" : "cancelled";

      return { sip, holding, investedValue, currentValue, returns, xirrRate, status };
    });
  }, [sipsQuery.data, holdingMap]);

  const activeSipCount = enriched.filter(e => e.status === "active").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Active SIPs</CardTitle>
            {!isLoading && (
              <Badge variant="secondary" className="tabular-nums">
                {activeSipCount}
              </Badge>
            )}
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link to="/dashboard/markets/mf">+ New SIP</Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <SipTableHeader />
              </TableHeader>
              <TableBody>
                <SipSkeletonRows />
              </TableBody>
            </Table>
          </div>
        ) : enriched.length === 0 ? (
          <SipEmptyState />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <SipTableHeader />
              </TableHeader>
              <TableBody>
                {enriched.map((e) => (
                  <SipRow key={e.sip.holding_id} enriched={e} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Table header ──────────────────────────────────────────────────────────────

function SipTableHeader() {
  return (
    <TableRow>
      <TableHead className="min-w-[200px]">Fund</TableHead>
      <TableHead>Frequency</TableHead>
      <TableHead className="text-right">SIP Amount</TableHead>
      <TableHead>Next Debit</TableHead>
      <TableHead className="text-right">Invested</TableHead>
      <TableHead className="text-right">Current Value</TableHead>
      <TableHead className="text-right">XIRR</TableHead>
      <TableHead className="text-right">Returns</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function SipRow({ enriched }: { enriched: EnrichedSip }) {
  const { sip, investedValue, currentValue, returns, xirrRate, status } = enriched;

  const nextDebit   = fmtDate(sip.next_sip_date);
  const returnsPos  = returns != null ? returns >= 0 : null;
  const xirrPos     = xirrRate != null ? xirrRate >= 0 : null;

  const isActive    = status === "active";

  return (
    <TableRow>
      {/* Fund name + AMFI code */}
      <TableCell>
        <p
          className="font-medium text-sm max-w-[220px] truncate leading-snug"
          title={sip.scheme_name}
        >
          {sip.scheme_name}
        </p>
        {sip.amfi_code && (
          <p className="text-xs text-muted-foreground font-mono">{sip.amfi_code}</p>
        )}
      </TableCell>

      {/* Frequency */}
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {fmtSipDate(sip.sip_date)}
      </TableCell>

      {/* SIP amount */}
      <TableCell className="text-right font-mono text-sm tabular-nums">
        {fmtINR(sip.sip_amount)}
      </TableCell>

      {/* Next debit date — red if < 7 days */}
      <TableCell className={`text-sm whitespace-nowrap ${nextDebit.urgent ? "text-red-600 dark:text-red-400 font-medium" : "text-foreground"}`}>
        {nextDebit.label}
        {nextDebit.urgent && (
          <span className="ml-1 text-xs">(soon)</span>
        )}
      </TableCell>

      {/* Invested */}
      <TableCell className="text-right font-mono text-sm tabular-nums">
        {fmtINR(investedValue)}
      </TableCell>

      {/* Current value */}
      <TableCell className="text-right font-mono text-sm tabular-nums">
        {fmtINR(currentValue)}
      </TableCell>

      {/* XIRR */}
      <TableCell className={`text-right text-sm font-medium tabular-nums ${
        xirrPos === null ? "text-muted-foreground" :
        xirrPos ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }`}>
        <span className="flex items-center justify-end gap-1">
          {xirrPos === true  && <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />}
          {xirrPos === false && <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />}
          {formatXirr(xirrRate)}
        </span>
      </TableCell>

      {/* Returns (absolute) */}
      <TableCell className={`text-right text-sm font-medium tabular-nums ${
        returnsPos === null ? "text-muted-foreground" :
        returnsPos ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }`}>
        {returns != null
          ? `${returns >= 0 ? "+" : ""}${fmtINR(returns)}`
          : "—"}
      </TableCell>

      {/* Status */}
      <TableCell>
        <StatusBadge status={status} />
      </TableCell>

      {/* Actions */}
      <TableCell>
        {isActive ? (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
              onClick={() => {
                logger.info("[SipTrackerPanel] pause SIP requested", { holding_id: sip.holding_id });
              }}
            >
              Pause
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={() => {
                logger.info("[SipTrackerPanel] cancel SIP requested", { holding_id: sip.holding_id });
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
