/**
 * SipTrackerPanel
 *
 * Renders a full-featured SIP tracker card with two sections:
 *
 *   1. "Scheduled SIPs" — managed SIP schedules from markets.sip_schedules
 *      (CRUD via /v1/mf/sip-schedules). Supports Pause / Resume / Cancel and
 *      a "New SIP" creation dialog.
 *
 *   2. "Broker SIPs" — legacy view: holdings with sip_amount > 0, enriched with
 *      current_value / XIRR from the portfolio query (read-only).
 *
 * XIRR is computed client-side from monthly instalment cashflows using the
 * xirr() utility (Newton-Raphson). The model assumes monthly instalments from
 * the first SIP date to today, with the current portfolio value as the
 * terminal positive cashflow.
 */

import { useMemo, useState } from "react";
import { PiggyBank, TrendingUp, TrendingDown, Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import { logger } from "@/lib/logger";

import {
  useMfSips,
  useMfPortfolio,
  useSipSchedules,
  useCreateSipSchedule,
  usePatchSipSchedule,
  useDeleteSipSchedule,
  type MfSip,
  type MfHolding,
  type SipSchedule,
} from "../hooks/useMf";
import { usePortfolios } from "../hooks/usePortfolios";
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

function fmtNextRun(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr ?? "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtLastRun(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
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

function computeSipXirr(
  sip: MfSip,
  holding: MfHolding | undefined,
): number | null {
  const amount = sip.sip_amount;
  const currentValue = holding?.current_value ?? null;

  if (!amount || currentValue == null || currentValue <= 0) return null;

  const sipDayOfMonth = sip.sip_date ?? 1;
  const updatedAt = holding?.last_updated_at ?? null;

  let start: Date;
  if (updatedAt) {
    const ref = new Date(updatedAt);
    start = new Date(ref.getFullYear() - 1, ref.getMonth(), sipDayOfMonth);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear() - 1, now.getMonth(), sipDayOfMonth);
  }

  const today = new Date();
  const cashflows: CashFlow[] = [];
  const cursor = new Date(start);

  while (cursor <= today) {
    cashflows.push({ amount: -amount, date: new Date(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  if (cashflows.length === 0) return null;
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

function SipSkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function SipEmptyState({ onNew }: { onNew?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center px-4">
      <PiggyBank className="h-12 w-12 text-muted-foreground/30" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">No active SIPs</p>
        <p className="text-xs text-muted-foreground">
          Grow your wealth steadily — start your first SIP today.
        </p>
      </div>
      {onNew ? (
        <Button size="sm" variant="outline" onClick={onNew}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          New SIP
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link to="/dashboard/markets/mf">Start your first SIP</Link>
        </Button>
      )}
    </div>
  );
}

// ── Enriched legacy SIP row type ──────────────────────────────────────────────

interface EnrichedSip {
  sip:           MfSip;
  holding:       MfHolding | undefined;
  investedValue: number | null;
  currentValue:  number | null;
  returns:       number | null;
  xirrRate:      number | null;
  status:        string;
}

// ── New SIP Dialog ────────────────────────────────────────────────────────────

interface NewSipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function NewSipDialog({ open, onOpenChange }: NewSipDialogProps) {
  const portfoliosQuery = usePortfolios();
  const createSip = useCreateSipSchedule();

  const [portfolioId, setPortfolioId] = useState("");
  const [schemeName, setSchemeName] = useState("");
  const [schemeCode, setSchemeCode] = useState("");
  const [amount, setAmount] = useState("");
  const [sipDay, setSipDay] = useState("5");

  function reset() {
    setPortfolioId("");
    setSchemeName("");
    setSchemeCode("");
    setAmount("");
    setSipDay("5");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    const sipDayNum = parseInt(sipDay, 10);

    if (!portfolioId) return toast.error("Please select a portfolio");
    if (!schemeName.trim()) return toast.error("Scheme name is required");
    if (isNaN(amountNum) || amountNum <= 0) return toast.error("Enter a valid amount");
    if (isNaN(sipDayNum) || sipDayNum < 1 || sipDayNum > 28) return toast.error("SIP day must be 1–28");

    try {
      await createSip.mutateAsync({
        portfolio_id: portfolioId,
        scheme_code:  schemeCode.trim() || schemeName.trim(),
        scheme_name:  schemeName.trim(),
        amount:       amountNum,
        sip_day:      sipDayNum,
      });
      toast.success("SIP schedule created");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to create SIP");
    }
  }

  const portfolios = portfoliosQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New SIP Schedule</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Portfolio */}
          <div className="space-y-1.5">
            <Label htmlFor="sip-portfolio">Portfolio</Label>
            {portfoliosQuery.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={portfolioId} onValueChange={setPortfolioId}>
                <SelectTrigger id="sip-portfolio">
                  <SelectValue placeholder="Select portfolio…" />
                </SelectTrigger>
                <SelectContent>
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  {portfolios.length === 0 && (
                    <SelectItem value="__none__" disabled>No portfolios found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Scheme name */}
          <div className="space-y-1.5">
            <Label htmlFor="sip-scheme-name">Scheme Name</Label>
            <Input
              id="sip-scheme-name"
              placeholder="e.g. Axis Bluechip Fund – Direct Growth"
              value={schemeName}
              onChange={(e) => setSchemeName(e.target.value)}
            />
          </div>

          {/* Scheme code (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="sip-scheme-code">
              AMFI Code <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="sip-scheme-code"
              placeholder="e.g. 120503"
              value={schemeCode}
              onChange={(e) => setSchemeCode(e.target.value)}
            />
          </div>

          {/* Amount + SIP day */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sip-amount">Amount (₹)</Label>
              <Input
                id="sip-amount"
                type="number"
                min={100}
                step={100}
                placeholder="5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sip-day">SIP Day</Label>
              <Select value={sipDay} onValueChange={setSipDay}>
                <SelectTrigger id="sip-day">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}{ordinal(d)} of month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
              disabled={createSip.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createSip.isPending}>
              {createSip.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create SIP
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Scheduled SIP row ─────────────────────────────────────────────────────────

function ScheduledSipRow({ sip }: { sip: SipSchedule }) {
  const patchSip  = usePatchSipSchedule();
  const deleteSip = useDeleteSipSchedule();

  const isActive = sip.status === "active";
  const isPaused = sip.status === "paused";

  const nextRun  = fmtNextRun(sip.next_run_date);
  const lastRun  = fmtLastRun(sip.last_executed_at);
  const nextDate = fmtDate(sip.next_run_date);

  async function handlePause() {
    try {
      await patchSip.mutateAsync({ id: sip.id, patch: { status: "paused" } });
      toast.success("SIP paused");
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to pause SIP");
    }
  }

  async function handleResume() {
    try {
      await patchSip.mutateAsync({ id: sip.id, patch: { status: "active" } });
      toast.success("SIP resumed");
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to resume SIP");
    }
  }

  async function handleCancel() {
    if (!window.confirm(`Cancel SIP for "${sip.scheme_name}"? This cannot be undone.`)) return;
    try {
      await deleteSip.mutateAsync(sip.id);
      toast.success("SIP cancelled");
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to cancel SIP");
    }
  }

  const isMutating = patchSip.isPending || deleteSip.isPending;

  return (
    <TableRow>
      {/* Fund */}
      <TableCell>
        <p className="font-medium text-sm max-w-[220px] truncate leading-snug" title={sip.scheme_name}>
          {sip.scheme_name}
        </p>
        {sip.scheme_code && (
          <p className="text-xs text-muted-foreground font-mono">{sip.scheme_code}</p>
        )}
      </TableCell>

      {/* Frequency */}
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {fmtSipDate(sip.sip_day)}
      </TableCell>

      {/* Amount */}
      <TableCell className="text-right font-mono text-sm tabular-nums">
        {fmtINR(sip.amount)}
      </TableCell>

      {/* Next run */}
      <TableCell className={`text-sm whitespace-nowrap ${nextDate.urgent ? "text-red-600 dark:text-red-400 font-medium" : "text-foreground"}`}>
        {nextRun}
        {nextDate.urgent && <span className="ml-1 text-xs">(soon)</span>}
      </TableCell>

      {/* Executions */}
      <TableCell className="text-sm tabular-nums text-center">
        {sip.execution_count}
      </TableCell>

      {/* Last run */}
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {lastRun}
      </TableCell>

      {/* Status */}
      <TableCell>
        <StatusBadge status={sip.status} />
      </TableCell>

      {/* Actions */}
      <TableCell>
        <div className="flex items-center gap-1.5">
          {isActive && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={isMutating}
              onClick={handlePause}
            >
              {patchSip.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pause"}
            </Button>
          )}
          {isPaused && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
              disabled={isMutating}
              onClick={handleResume}
            >
              {patchSip.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resume"}
            </Button>
          )}
          {(isActive || isPaused) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              disabled={isMutating}
              onClick={handleCancel}
            >
              {deleteSip.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cancel"}
            </Button>
          )}
          {!isActive && !isPaused && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Scheduled SIPs table ──────────────────────────────────────────────────────

function ScheduledSipsTable({
  schedules,
  isLoading,
  onNew,
}: {
  schedules: SipSchedule[];
  isLoading: boolean;
  onNew: () => void;
}) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Fund</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead className="text-center">Runs</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SipSkeletonRows cols={8} />
          </TableBody>
        </Table>
      </div>
    );
  }

  if (schedules.length === 0) {
    return <SipEmptyState onNew={onNew} />;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Fund</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Next Run</TableHead>
            <TableHead className="text-center">Runs</TableHead>
            <TableHead>Last Run</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((s) => (
            <ScheduledSipRow key={s.id} sip={s} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Legacy broker SIP table header ───────────────────────────────────────────

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

// ── Legacy broker SIP row ─────────────────────────────────────────────────────

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
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center justify-end gap-1 cursor-default">
              {xirrPos === true  && <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />}
              {xirrPos === false && <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />}
              {formatXirr(xirrRate)}
              <span className="text-xs text-muted-foreground font-normal">(estimated)</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            XIRR estimated from SIP amount × months since creation. Accuracy improves when actual transaction history is available.
          </TooltipContent>
        </Tooltip>
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

      {/* Actions — broker SIPs are read-only via this panel */}
      <TableCell>
        {isActive ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground">Managed by broker</span>
            </TooltipTrigger>
            <TooltipContent>To pause or cancel broker SIPs, use the Scheduled SIPs tab or contact your broker directly.</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function SipTrackerPanel() {
  const [newSipOpen, setNewSipOpen]  = useState(false);

  // Scheduled SIPs (new)
  const schedulesQuery = useSipSchedules();

  // Legacy broker SIPs
  const sipsQuery      = useMfSips();
  const portfolioQuery = useMfPortfolio();

  const scheduledLoading = schedulesQuery.isLoading;
  const brokerLoading    = sipsQuery.isLoading || portfolioQuery.isLoading;

  const schedules = schedulesQuery.data ?? [];
  const activeSchedulesCount = schedules.filter(s => s.status === "active").length;

  // Build a lookup: holding_id → MfHolding
  const holdingMap = useMemo<Map<string, MfHolding>>(() => {
    const map = new Map<string, MfHolding>();
    for (const h of portfolioQuery.data?.holdings ?? []) {
      map.set(h.id, h);
    }
    return map;
  }, [portfolioQuery.data]);

  // Enrich legacy broker SIPs
  const enriched = useMemo<EnrichedSip[]>(() => {
    return (sipsQuery.data ?? []).map((sip) => {
      const holding       = holdingMap.get(sip.holding_id);
      const investedValue = holding?.invested_value ?? null;
      const currentValue  = holding?.current_value  ?? null;
      const returns       = investedValue != null && currentValue != null
        ? currentValue - investedValue
        : null;
      const xirrRate      = computeSipXirr(sip, holding);
      const status        = sip.sip_amount > 0 ? "active" : "cancelled";
      return { sip, holding, investedValue, currentValue, returns, xirrRate, status };
    });
  }, [sipsQuery.data, holdingMap]);

  const activeBrokerSipCount = enriched.filter(e => e.status === "active").length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">SIP Tracker</CardTitle>
              {!scheduledLoading && (
                <Badge variant="secondary" className="tabular-nums">
                  {activeSchedulesCount + activeBrokerSipCount}
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setNewSipOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New SIP
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs defaultValue="scheduled" className="w-full">
            <div className="px-4 pb-2 border-b">
              <TabsList className="h-8">
                <TabsTrigger value="scheduled" className="text-xs h-7">
                  Scheduled
                  {!scheduledLoading && schedules.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 tabular-nums">
                      {schedules.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="broker" className="text-xs h-7">
                  Broker SIPs
                  {!brokerLoading && enriched.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 tabular-nums">
                      {enriched.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Scheduled SIPs tab ── */}
            <TabsContent value="scheduled" className="mt-0">
              <ScheduledSipsTable
                schedules={schedules}
                isLoading={scheduledLoading}
                onNew={() => setNewSipOpen(true)}
              />
            </TabsContent>

            {/* ── Broker SIPs tab (legacy) ── */}
            <TabsContent value="broker" className="mt-0">
              {brokerLoading ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <SipTableHeader />
                    </TableHeader>
                    <TableBody>
                      <SipSkeletonRows cols={10} />
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <NewSipDialog open={newSipOpen} onOpenChange={setNewSipOpen} />
    </>
  );
}
