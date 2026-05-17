/**
 * Markets — Portfolio Detail Page (T1 — with Transactions tab).
 *
 * Tabs: Holdings | Transactions | Briefs
 * Transactions tab: list + inline "Add Transaction" sheet.
 */

import { useRef, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Brain, Download, FlaskConical, Loader2, MoreVertical, Newspaper, Plus, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

import { usePortfolio, usePortfolioHoldings } from "../hooks/usePortfolio";
import { useBriefs, useGenerateBrief }          from "../hooks/useBriefs";
import {
  useTransactions, useCreateTransaction, useDeleteTransaction, useInstrumentSearch,
} from "../hooks/useTransactions";
import { ImportHoldingsDialog } from "../components/ImportHoldingsDialog";
import { NewsPanel } from "../components/NewsPanel";
import { PortfolioPnLChart } from "../components/PortfolioPnLChart";
import { PaperCapitalBadge } from "../components/PaperCapitalBadge";
import { PaperOrderSheet } from "../components/PaperOrderSheet";
import { SectorAllocationChart } from "../components/SectorAllocationChart";
import { PortfolioAnalyticsPanel } from "../components/PortfolioAnalyticsPanel";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Numeric, Sparkline, EmptyState, ErrorState, SkeletonCard,
  Button, Card, CardContent, CardHeader, CardTitle, Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Sheet, SheetContent, SheetHeader, SheetTitle,
  Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/design-system";
import type {
  Brief, BriefSource, HoldingWithPrice,
  AssetClass, TransactionType, CreateTransactionInput,
  ASSET_CLASS_LABELS, TXN_TYPE_LABELS, TXN_TYPES_NEED_INSTRUMENT,
} from "../types";
import {
  ASSET_CLASS_LABELS as ACL,
  TXN_TYPE_LABELS    as TTL,
  TXN_TYPES_NEED_INSTRUMENT as TTN,
} from "../types";
import type { Transaction } from "../types";

// ─── Sector map ────────────────────────────────────────────────────────────

const SECTOR_MAP: Record<string, string> = {
  EXIIND: "Auto / Auto Ancillary",
  BORGLA: "Glass / Solar",          // Borosil Renewables Ltd
  IDFBAN: "Banks", YESBAN: "Banks", KAARAD: "Technology (Micro-cap)",
  TRITUR: "Engineering / Capital Goods", NTPC: "Power", RELIND: "Energy",
  AADVEN: "Finance", JIOFIN: "Finance", REPHOM: "Finance", PENMER: "Finance",
  GLEPHA: "Pharma", AMAREM: "Pharma", GRANUL: "Pharma", MORLAB: "Pharma",
  HCLTEC: "Technology", TCS: "Technology", TECMAH: "Technology",
  GLOTEC: "Technology (Micro-cap)", TELDAT: "Technology (Micro-cap)",
  TELMAR: "Technology (Micro-cap)", TELTEC: "Technology (Micro-cap)",
  ITC: "FMCG", ASIPAI: "FMCG",
  TATSTE: "Metals & Mining",
  ITCHOT: "Hotels & Hospitality",
  TRILTD: "Textiles",               // Trident Ltd (yarn/paper)
  GOLDEX: "ETF / Gold",
  DILMED: "Media", SITCAB: "Media", ZEELEA: "Media", ZEEMED: "Media",
};

function getSector(symbol: string): string {
  return SECTOR_MAP[symbol?.toUpperCase()] ?? "Others";
}

// ─── LTCG qty computation ─────────────────────────────────────────────────

function ltcgQty(instrumentId: string, totalQty: number, transactions: Transaction[]): number {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const instTxns = transactions.filter((t) => t.instrument_id === instrumentId);
  if (!instTxns.length) return totalQty;
  const oldBuys = instTxns
    .filter((t) => ["buy", "sip", "transfer_in"].includes(t.txn_type) && new Date(t.txn_date) < oneYearAgo)
    .reduce((s, t) => s + Number(t.qty), 0);
  const oldSells = instTxns
    .filter((t) => ["sell", "redemption", "transfer_out"].includes(t.txn_type) && new Date(t.txn_date) < oneYearAgo)
    .reduce((s, t) => s + Number(t.qty), 0);
  return Math.min(Math.max(0, oldBuys - oldSells), totalQty);
}

// ─── Formatting helpers ───────────────────────────────────────────────────

function fmtINR(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(value: number): string {
  return (value * 100).toFixed(2) + "%";
}

function pnlClass(value: number): string {
  return value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400";
}

// ─── Grouping type ────────────────────────────────────────────────────────

type GroupingMode = "None" | "Sector" | "Exchange" | "Asset Class";

// ─── Page ─────────────────────────────────────────────────────────────────

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const portfolio     = usePortfolio(id);
  const holdings      = usePortfolioHoldings(id);
  const briefs        = useBriefs(id);
  const generateBrief = useGenerateBrief(id);
  const transactions  = useTransactions(id);

  const [addTxnOpen,   setAddTxnOpen]   = useState(false);
  const [deleteTxnId,  setDeleteTxnId]  = useState<string | null>(null);
  const [importOpen,   setImportOpen]   = useState(false);
  const [grouping,     setGrouping]     = useState<GroupingMode>("None");

  // Paper trading state
  const [paperOrderOpen,     setPaperOrderOpen]     = useState(false);
  const [paperInstrQuery,    setPaperInstrQuery]    = useState("");
  const [paperInstrOpen,     setPaperInstrOpen]     = useState(false);
  const [paperSelectedInstr, setPaperSelectedInstr] = useState<{
    id: string; symbol: string; exchange: string;
  } | null>(null);
  const instrSearch = useInstrumentSearch(paperInstrQuery);

  const latestBrief    = briefs.data?.[0];
  const previousBriefs = briefs.data?.slice(1) ?? [];

  const placeholderSeries = useMemo(() => {
    const len = 30; const seed = id ? id.charCodeAt(0) : 7;
    return Array.from({ length: len }).map((_, i) => {
      const t = i / (len - 1);
      return 100 + Math.sin((seed + i) * 0.7) * 5 + t * 6;
    });
  }, [id]);

  if (portfolio.isPending) return <DashboardLayout><div className="mx-auto max-w-7xl p-6"><SkeletonCard withHeader lines={5} /></div></DashboardLayout>;
  if (portfolio.isError)   return <DashboardLayout><div className="mx-auto max-w-7xl p-6"><ErrorState title="Failed to load portfolio" message={portfolio.error?.message ?? "Unknown error"} onRetry={() => portfolio.refetch()} /></div></DashboardLayout>;
  if (!portfolio.data)     return <DashboardLayout><div className="mx-auto max-w-7xl p-6"><EmptyState title="Portfolio not found" description="This portfolio doesn't exist or you don't have access." actionLabel="Back to portfolios" onAction={() => { window.location.href = "/dashboard/markets/portfolios"; }} /></div></DashboardLayout>;

  const p = portfolio.data;

  const onGenerate = async () => {
    try {
      await generateBrief.mutateAsync();
      toast.success("Brief generated");
    } catch (e: any) {
      toast.error(`Brief failed: ${e?.message ?? "Unknown error"}`);
    }
  };

  return (
    <DashboardLayout>
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Back nav */}
      <Link to="/dashboard/markets/portfolios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />
        All portfolios
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
            <Badge variant={p.mode === "live" ? "default" : "secondary"} className="capitalize">{p.mode}</Badge>
            <Badge variant="outline" className="text-xs">{p.base_currency}</Badge>
            {p.mode === "paper" && id && (
              <PaperCapitalBadge portfolioId={id} />
            )}
          </div>
          {p.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{p.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {p.mode === "paper" && (
            <div className="relative">
              <Button
                variant="outline"
                size="lg"
                onClick={() => { setPaperInstrQuery(""); setPaperInstrOpen((o) => !o); }}
              >
                <FlaskConical className="mr-2 h-4 w-4 text-amber-500" />
                Paper Trade
              </Button>
              {/* Instrument picker popover */}
              {paperInstrOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-popover shadow-xl">
                  <div className="p-3 border-b">
                    <p className="text-xs text-muted-foreground font-medium mb-2">Search instrument to trade</p>
                    <div className="relative">
                      <Input
                        autoFocus
                        placeholder="Search symbol or ISIN…"
                        value={paperInstrQuery}
                        onChange={(e) => setPaperInstrQuery(e.target.value)}
                        className="h-8 text-sm"
                      />
                      {instrSearch.isFetching && (
                        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="max-h-52 overflow-auto p-1">
                    {instrSearch.isSuccess && instrSearch.data.length === 0 && paperInstrQuery.length > 0 && (
                      <p className="px-3 py-3 text-xs text-muted-foreground">No instruments found.</p>
                    )}
                    {instrSearch.isSuccess && instrSearch.data.map((ins) => (
                      <button
                        key={ins.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded px-3 py-2 text-left hover:bg-accent"
                        onClick={() => {
                          setPaperSelectedInstr(ins);
                          setPaperInstrOpen(false);
                          setPaperInstrQuery("");
                          setPaperOrderOpen(true);
                        }}
                      >
                        <span className="font-mono text-sm font-semibold">{ins.symbol}</span>
                        <span className="text-xs text-muted-foreground">{ins.exchange}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{ins.instrument_type}</span>
                      </button>
                    ))}
                    {paperInstrQuery.length === 0 && (
                      <p className="px-3 py-3 text-xs text-muted-foreground">Type a symbol to search…</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <Button onClick={onGenerate} disabled={generateBrief.isPending} size="lg">
            <Brain className="mr-2 h-4 w-4" />
            {generateBrief.isPending ? "Generating…" : "Generate AI brief"}
          </Button>
        </div>
      </header>

      {/* KPI strip */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
          <KpiCell label="Portfolio Value">
            <Numeric value={holdings.data?.nav ?? 0} format="currency" currency={p.base_currency} className="text-2xl font-semibold" />
            {(holdings.data?.bonusValue ?? 0) > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                incl. ₹{((holdings.data?.bonusValue ?? 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })} bonus shares
              </p>
            )}
          </KpiCell>
          <KpiCell label="Invested">
            <Numeric value={holdings.data?.investedValue ?? 0} format="currency" currency={p.base_currency} className="text-xl font-semibold" />
            <p className="text-[11px] text-muted-foreground mt-0.5">cost basis (excl. bonus)</p>
          </KpiCell>
          <KpiCell label="Today P&L">
            <Numeric value={holdings.data?.todayPnl ?? 0} format="pnl" currency={p.base_currency} colorBySign withArrow className="text-xl font-semibold" />
          </KpiCell>
          <KpiCell label="Return on Invested">
            <Numeric value={holdings.data?.sinceInceptionPct ?? 0} format="percent" colorBySign withArrow className="text-xl font-semibold" />
            <p className="text-[11px] text-muted-foreground mt-0.5">purchased positions only</p>
          </KpiCell>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="holdings">
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto">
          {(["holdings","transactions","briefs","sector","analytics"] as const).map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 capitalize data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t === "holdings"
                ? "Holdings"
                : t === "transactions"
                  ? "Transactions"
                  : t === "briefs"
                    ? "AI Briefs"
                    : t === "sector"
                      ? "Sector"
                      : "Analytics"}
              {t === "transactions" && (transactions.data?.length ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {transactions.data!.length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Holdings tab ──────────────────────────────────────────────── */}
        <TabsContent value="holdings" className="mt-4 space-y-4">
          {/* P&L chart */}
          <PortfolioPnLChart portfolioId={id} />

          {/* Action bar */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 h-4 w-4" />
              Import holdings
            </Button>
            <Button size="sm" onClick={() => setAddTxnOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add transaction
            </Button>
          </div>

          {holdings.isError && (
            <ErrorState title="Could not load holdings" message={holdings.error?.message ?? "Unknown error"} onRetry={() => holdings.refetch()} />
          )}
          {holdings.isSuccess && holdings.data.holdings.length === 0 && (
            <EmptyState
              title="No holdings yet"
              description="Import from Zerodha, Groww, HDFC, Angel, or Upstox — or add transactions manually."
              actionLabel="Import holdings"
              onAction={() => setImportOpen(true)}
              secondaryActionLabel="Add transaction"
              onSecondaryAction={() => setAddTxnOpen(true)}
            />
          )}
          {holdings.isSuccess && holdings.data.holdings.length > 0 && (
            <>
              {/* Summary bar */}
              <HoldingsSummaryBar holdings={holdings.data.holdings} currency={p.base_currency} />

              {/* Grouping controls + download */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Grouping:</span>
                  <Select value={grouping} onValueChange={(v) => setGrouping(v as GroupingMode)}>
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["None", "Sector", "Exchange", "Asset Class"] as GroupingMode[]).map((g) => (
                        <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button
                  type="button"
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Download holdings"
                  aria-label="Download holdings"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>

              {/* Holdings table */}
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <HoldingsTable
                    holdings={holdings.data.holdings}
                    currency={p.base_currency}
                    transactions={transactions.data ?? []}
                    grouping={grouping}
                    onBuy={() => setAddTxnOpen(true)}
                    onSell={() => setAddTxnOpen(true)}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Transactions tab ──────────────────────────────────────────── */}
        <TabsContent value="transactions" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {transactions.data?.length ?? 0} transactions recorded
            </p>
            <Button size="sm" onClick={() => setAddTxnOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add transaction
            </Button>
          </div>

          {transactions.isError && (
            <ErrorState title="Could not load transactions" message={transactions.error?.message ?? "Unknown error"} onRetry={() => transactions.refetch()} />
          )}
          {transactions.isPending && <SkeletonCard lines={4} />}

          {transactions.isSuccess && transactions.data.length === 0 && (
            <EmptyState
              title="No transactions yet"
              description="Record your first buy, SIP, or FD to start tracking this portfolio."
              actionLabel="Add transaction"
              onAction={() => setAddTxnOpen(true)}
            />
          )}

          {transactions.isSuccess && transactions.data.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <TransactionsTable
                  transactions={transactions.data}
                  currency={p.base_currency}
                  onDelete={(txnId) => setDeleteTxnId(txnId)}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Briefs tab ────────────────────────────────────────────────── */}
        <TabsContent value="briefs" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {generateBrief.isError && (
                <ErrorState title="Brief generation failed" message={generateBrief.error?.message ?? "Unknown error"} onRetry={onGenerate} />
              )}
              {briefs.isPending && <SkeletonCard withHeader lines={5} />}
              {briefs.isSuccess && !latestBrief && (
                <EmptyState
                  icon={<Brain className="h-10 w-10" />}
                  title="No briefs yet"
                  description="Generate an AI brief — a Markdown analysis of this portfolio against the latest market news."
                  actionLabel={generateBrief.isPending ? "Generating…" : "Generate AI brief"}
                  onAction={onGenerate}
                />
              )}
              {latestBrief && <BriefCard brief={latestBrief} variant="latest" />}
              {previousBriefs.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    {previousBriefs.length} earlier {previousBriefs.length === 1 ? "brief" : "briefs"}
                  </summary>
                  <div className="mt-3 space-y-3">
                    {previousBriefs.map((b) => <BriefCard key={b.id} brief={b} variant="compact" />)}
                  </div>
                </details>
              )}
            </div>
            <aside><NewsPanel limit={8} /></aside>
          </div>
        </TabsContent>

        {/* ── Sector tab ────────────────────────────────────────────────── */}
        <TabsContent value="sector" className="mt-4">
          <SectorAllocationChart holdings={holdings.data?.holdings ?? []} />
        </TabsContent>

        {/* ── Analytics tab ─────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="mt-4">
          <PortfolioAnalyticsPanel portfolioId={id} />
        </TabsContent>
      </Tabs>

      {/* Add transaction sheet */}
      <Sheet open={addTxnOpen} onOpenChange={setAddTxnOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Add transaction</SheetTitle></SheetHeader>
          {id && (
            <AddTransactionForm
              portfolioId={id}
              baseCurrency={p.base_currency}
              onSuccess={() => setAddTxnOpen(false)}
              onCancel={() => setAddTxnOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <DeleteTransactionDialog
        txnId={deleteTxnId}
        portfolioId={id}
        onClose={() => setDeleteTxnId(null)}
      />

      {/* Import holdings dialog */}
      {id && (
        <ImportHoldingsDialog
          portfolioId={id}
          portfolioName={p.name}
          open={importOpen}
          onOpenChange={setImportOpen}
        />
      )}

      {/* Paper Order Sheet */}
      {id && paperSelectedInstr && (
        <PaperOrderSheet
          symbol={paperSelectedInstr.symbol}
          exchange={paperSelectedInstr.exchange}
          instrumentId={paperSelectedInstr.id}
          portfolioId={id}
          open={paperOrderOpen}
          onOpenChange={(o) => {
            setPaperOrderOpen(o);
            if (!o) setPaperSelectedInstr(null);
          }}
        />
      )}
    </div>
    </DashboardLayout>
  );
}

// ─── KPI Cell ──────────────────────────────────────────────────────────────

function KpiCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ─── Holdings Summary Bar ─────────────────────────────────────────────────

function HoldingsSummaryBar({ holdings, currency }: { holdings: HoldingWithPrice[]; currency: string }) {
  const amountInvested = holdings.reduce((s, h) => s + h.qty * h.avg_cost, 0);
  const currentValue   = holdings.reduce((s, h) => s + h.qty * (h.last_price ?? h.avg_cost), 0);
  const dayGainAbs     = holdings.reduce((s, h) => s + h.qty * ((h.last_price ?? 0) - (h.prev_price ?? h.last_price ?? 0)), 0);
  const dayGainPct     = currentValue > 0 ? dayGainAbs / (currentValue - dayGainAbs) : 0;
  const absReturnsPct  = amountInvested > 0 ? (currentValue - amountInvested) / amountInvested : 0;

  const withDayPct = holdings
    .filter((h) => h.last_price && h.prev_price)
    .map((h) => ({ ...h, dayPct: (h.last_price! - h.prev_price!) / h.prev_price! }));

  const maxGainer = withDayPct.length > 0
    ? withDayPct.reduce((best, h) => h.dayPct > (best?.dayPct ?? -Infinity) ? h : best, null as any)
    : null;
  const maxLoser = withDayPct.length > 0
    ? withDayPct.reduce((best, h) => h.dayPct < (best?.dayPct ?? Infinity) ? h : best, null as any)
    : null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left block */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <SummaryKpi label="Amount Invested">
              <span className="font-semibold tabular-nums">₹{fmtINR(amountInvested)}</span>
            </SummaryKpi>
            <SummaryKpi label="Current Value">
              <span className="font-semibold tabular-nums">₹{fmtINR(currentValue)}</span>
            </SummaryKpi>
            <SummaryKpi label="Day's Gain">
              <span className={`font-semibold tabular-nums ${pnlClass(dayGainAbs)}`}>
                ₹{fmtINR(dayGainAbs)}{" "}
                <span className="text-xs">({dayGainAbs >= 0 ? "+" : ""}{fmtPct(dayGainPct)})</span>
              </span>
            </SummaryKpi>
            <SummaryKpi label="Absolute Returns">
              <span className={`font-semibold tabular-nums ${pnlClass(absReturnsPct)}`}>
                {absReturnsPct >= 0 ? "+" : ""}{fmtPct(absReturnsPct)}
              </span>
            </SummaryKpi>
          </div>

          {/* Right block — Max Gainer / Max Loser */}
          {(maxGainer || maxLoser) && (
            <div className="flex gap-6 text-xs">
              {maxGainer && (
                <div>
                  <p className="text-muted-foreground mb-0.5">Max Gainer</p>
                  <p className="font-mono font-semibold text-sm">{maxGainer.instrument?.symbol ?? "—"}</p>
                  <p className="tabular-nums font-medium">₹{fmtINR(maxGainer.last_price ?? 0)}</p>
                  <p className={`tabular-nums ${pnlClass(maxGainer.dayPct)}`}>
                    +₹{fmtINR((maxGainer.last_price ?? 0) - (maxGainer.prev_price ?? 0))} ({fmtPct(maxGainer.dayPct)})
                  </p>
                </div>
              )}
              {maxLoser && maxLoser.instrument?.id !== maxGainer?.instrument?.id && (
                <div>
                  <p className="text-muted-foreground mb-0.5">Max Loser</p>
                  <p className="font-mono font-semibold text-sm">{maxLoser.instrument?.symbol ?? "—"}</p>
                  <p className="tabular-nums font-medium">₹{fmtINR(maxLoser.last_price ?? 0)}</p>
                  <p className={`tabular-nums ${pnlClass(maxLoser.dayPct)}`}>
                    ₹{fmtINR((maxLoser.last_price ?? 0) - (maxLoser.prev_price ?? 0))} ({fmtPct(maxLoser.dayPct)})
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryKpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// ─── Holdings table ────────────────────────────────────────────────────────

interface HoldingsTableProps {
  holdings: HoldingWithPrice[];
  currency: string;
  transactions: Transaction[];
  grouping: GroupingMode;
  onBuy: (h: HoldingWithPrice) => void;
  onSell: (h: HoldingWithPrice) => void;
}

function HoldingsTable({ holdings, currency, transactions, grouping, onBuy, onSell }: HoldingsTableProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Build groups
  const grouped = useMemo(() => {
    if (grouping === "None") {
      return [{ label: null, items: holdings }];
    }
    const map = new Map<string, HoldingWithPrice[]>();
    holdings.forEach((h) => {
      let key: string;
      if (grouping === "Sector") {
        key = getSector(h.instrument?.symbol ?? "");
      } else if (grouping === "Exchange") {
        key = h.instrument?.exchange ?? "Unknown";
      } else {
        // Asset Class — instrument_type as proxy
        key = h.instrument?.instrument_type ?? "Other";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    });
    // Sort groups alphabetically, "Others" last
    const entries = Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Others") return 1;
      if (b === "Others") return -1;
      return a.localeCompare(b);
    });
    return entries.map(([label, items]) => ({ label, items }));
  }, [holdings, grouping]);

  return (
    <Table>
      <TableHeader>
        <TableRow className="text-xs">
          <TableHead className="font-semibold">Stock Symbol</TableHead>
          <TableHead className="text-right font-semibold">Total Qty</TableHead>
          <TableHead className="text-right font-semibold text-blue-600 dark:text-blue-400">
            Qty &gt; 1 Yr
          </TableHead>
          <TableHead className="text-right font-semibold">Avg. Cost</TableHead>
          <TableHead className="text-right font-semibold text-blue-600 dark:text-blue-400">CMP</TableHead>
          <TableHead className="text-right font-semibold">% Change</TableHead>
          <TableHead className="text-right font-semibold">Value At Cost</TableHead>
          <TableHead className="text-right font-semibold">Value At CMP</TableHead>
          <TableHead className="text-right font-semibold">Realized P&amp;L</TableHead>
          {/* Unrealized P&L merged header */}
          <TableHead colSpan={2} className="text-center font-semibold border-l">
            Unrealized P&amp;L
          </TableHead>
          <TableHead className="text-right font-semibold">P&amp;L %</TableHead>
          <TableHead className="text-center font-semibold">Actions</TableHead>
        </TableRow>
        {/* Sub-header for Unrealized P&L columns */}
        <TableRow className="text-xs bg-muted/20">
          <TableHead colSpan={9} />
          <TableHead className="text-right text-muted-foreground font-normal border-l py-1 text-xs">Day's P&amp;L</TableHead>
          <TableHead className="text-right text-muted-foreground font-normal py-1 text-xs">Overall</TableHead>
          <TableHead colSpan={2} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {grouped.map(({ label, items }) => {
          // Group sub-totals
          const groupValueAtCost = items.reduce((s, h) => s + h.qty * h.avg_cost, 0);
          const groupValueAtCmp  = items.reduce((s, h) => s + h.qty * (h.last_price ?? h.avg_cost), 0);
          const groupRealizedPnl = items.reduce((s, h) => s + (h.realized_pnl ?? 0), 0);
          const groupDaysPnl     = items.reduce((s, h) => s + h.qty * ((h.last_price ?? 0) - (h.prev_price ?? h.last_price ?? 0)), 0);
          const groupOverallPnl  = items.reduce((s, h) => s + h.qty * ((h.last_price ?? h.avg_cost) - h.avg_cost), 0);

          return (
            <>
              {/* Group header row */}
              {label !== null && (
                <TableRow key={`group-${label}`} className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={13} className="py-1.5 font-bold text-xs text-foreground tracking-wide">
                    {label}
                  </TableCell>
                </TableRow>
              )}

              {/* Holding rows */}
              {items.map((h) => {
                const ltp         = h.last_price ?? h.avg_cost;
                const prev        = h.prev_price ?? ltp;
                const dayChangePct = prev > 0 ? (ltp - prev) / prev : 0;
                const valueAtCost = h.qty * h.avg_cost;
                const valueAtCmp  = h.qty * ltp;
                const realizedPnl = h.realized_pnl ?? 0;
                const daysPnl     = h.qty * (ltp - prev);
                const overallPnl  = h.qty * (ltp - h.avg_cost);
                const overallPct  = h.avg_cost > 0 ? (ltp - h.avg_cost) / h.avg_cost : 0;
                const ltcg        = ltcgQty(h.instrument_id, h.qty, transactions);

                return (
                  <TableRow key={h.id} className="text-xs hover:bg-muted/30">
                    {/* Symbol */}
                    <TableCell className="font-mono font-medium py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground">{h.instrument?.symbol ?? "—"}</span>
                        <span className="text-muted-foreground text-xs">{h.instrument?.exchange ?? ""}</span>
                      </div>
                    </TableCell>

                    {/* Total Qty */}
                    <TableCell className="text-right tabular-nums py-2">{h.qty}</TableCell>

                    {/* Qty > 1 Yr (LTCG) */}
                    <TableCell className="text-right tabular-nums py-2 text-blue-600 dark:text-blue-400">
                      {ltcg}
                    </TableCell>

                    {/* Avg Cost */}
                    <TableCell className="text-right tabular-nums py-2 text-muted-foreground">
                      ₹{fmtINR(h.avg_cost)}
                    </TableCell>

                    {/* CMP */}
                    <TableCell className="text-right tabular-nums py-2 text-blue-600 dark:text-blue-400 font-medium">
                      {h.last_price != null ? `₹${fmtINR(h.last_price)}` : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    {/* % Change (day) */}
                    <TableCell className={`text-right tabular-nums py-2 ${pnlClass(dayChangePct)}`}>
                      {h.last_price != null && h.prev_price != null
                        ? `${dayChangePct >= 0 ? "+" : ""}${fmtPct(dayChangePct)}`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    {/* Value At Cost */}
                    <TableCell className="text-right tabular-nums py-2">
                      ₹{fmtINR(valueAtCost)}
                    </TableCell>

                    {/* Value At CMP */}
                    <TableCell className="text-right tabular-nums py-2 font-medium">
                      ₹{fmtINR(valueAtCmp)}
                    </TableCell>

                    {/* Realized P&L */}
                    <TableCell className={`text-right tabular-nums py-2 ${pnlClass(realizedPnl)}`}>
                      ₹{fmtINR(realizedPnl)}
                    </TableCell>

                    {/* Day's P&L */}
                    <TableCell className={`text-right tabular-nums py-2 border-l ${pnlClass(daysPnl)}`}>
                      {h.last_price != null && h.prev_price != null
                        ? `${daysPnl >= 0 ? "+" : ""}₹${fmtINR(Math.abs(daysPnl))}`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    {/* Overall Unrealized P&L */}
                    <TableCell className={`text-right tabular-nums py-2 ${pnlClass(overallPnl)}`}>
                      {overallPnl >= 0 ? "+" : ""}₹{fmtINR(Math.abs(overallPnl))}
                    </TableCell>

                    {/* P&L % */}
                    <TableCell className={`text-right tabular-nums py-2 ${pnlClass(overallPct)}`}>
                      {overallPct >= 0 ? "+" : ""}{fmtPct(overallPct)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          type="button"
                          onClick={() => onBuy(h)}
                          className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                        >
                          Buy
                        </button>
                        <button
                          type="button"
                          onClick={() => onSell(h)}
                          className="rounded px-1.5 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          Sell
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setMenuOpen(menuOpen === h.id ? null : h.id)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                            aria-label="More options"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                          {menuOpen === h.id && (
                            <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-md border bg-popover shadow-md">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                                onClick={() => {
                                  setMenuOpen(null);
                                  toast.info("Use the Transactions tab to manage individual transactions");
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete holding
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Sub-total row (only when grouping is active) */}
              {label !== null && (
                <TableRow key={`subtotal-${label}`} className="bg-muted/30 font-medium text-xs">
                  <TableCell colSpan={6} className="text-right text-muted-foreground py-1.5 pr-4">
                    Sub Total :
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-1.5">
                    ₹{fmtINR(groupValueAtCost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-1.5">
                    ₹{fmtINR(groupValueAtCmp)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums py-1.5 ${pnlClass(groupRealizedPnl)}`}>
                    ₹{fmtINR(groupRealizedPnl)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums py-1.5 border-l ${pnlClass(groupDaysPnl)}`}>
                    {groupDaysPnl >= 0 ? "+" : ""}₹{fmtINR(Math.abs(groupDaysPnl))}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums py-1.5 ${pnlClass(groupOverallPnl)}`}>
                    {groupOverallPnl >= 0 ? "+" : ""}₹{fmtINR(Math.abs(groupOverallPnl))}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ─── Transactions table ────────────────────────────────────────────────────

const TXN_TYPE_COLOR: Partial<Record<TransactionType, string>> = {
  buy:          "bg-blue-100 text-blue-800",
  sip:          "bg-blue-100 text-blue-800",
  sell:         "bg-amber-100 text-amber-800",
  redemption:   "bg-amber-100 text-amber-800",
  dividend:     "bg-emerald-100 text-emerald-800",
  interest:     "bg-emerald-100 text-emerald-800",
  fd_maturity:  "bg-emerald-100 text-emerald-800",
  bonus:        "bg-purple-100 text-purple-800",
  split:        "bg-purple-100 text-purple-800",
  fee:          "bg-red-100 text-red-800",
};

function TransactionsTable({
  transactions,
  currency,
  onDelete,
}: {
  transactions: Transaction[];
  currency: string;
  onDelete: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Instrument</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((t) => {
          const amount = (t.qty * t.price) + (t.charges ?? 0);
          const isInflow = ["sell","redemption","dividend","interest","fd_maturity"].includes(t.txn_type);
          return (
            <TableRow key={t.id}>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {new Date(t.txn_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </TableCell>
              <TableCell>
                <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${TXN_TYPE_COLOR[t.txn_type] ?? "bg-gray-100 text-gray-700"}`}>
                  {TTL[t.txn_type] ?? t.txn_type}
                </span>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {t.instrument ? (
                  <span className="flex items-center gap-1.5">
                    {t.instrument.symbol}
                    <span className="text-xs text-muted-foreground">{t.instrument.exchange}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">{t.asset_class ?? "—"}</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">{t.qty}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                <Numeric value={t.price} format="currency" currency={t.currency ?? currency} />
              </TableCell>
              <TableCell className={`text-right tabular-nums text-sm font-medium ${isInflow ? "text-emerald-600" : ""}`}>
                {isInflow ? "+" : ""}
                <Numeric value={amount} format="currency" currency={t.currency ?? currency} />
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => onDelete(t.id)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Delete transaction"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ─── Add Transaction form ──────────────────────────────────────────────────

interface TxnFormValues {
  txn_type:    TransactionType;
  txn_date:    string;
  asset_class: AssetClass;
  qty:         string;
  price:       string;
  charges:     string;
  currency:    string;
  notes:       string;
  folio_number: string;
}

const ASSET_CLASSES = Object.entries(ACL) as [AssetClass, string][];

const TXN_TYPES_BY_CLASS: Record<AssetClass, TransactionType[]> = {
  equity:       ["buy","sell","dividend","bonus","split","transfer_in","transfer_out"],
  mutual_fund:  ["sip","buy","redemption","sell","dividend","transfer_in","transfer_out"],
  commodity:    ["buy","sell"],
  forex:        ["buy","sell"],
  fixed_income: ["buy","sell","interest","transfer_in","transfer_out"],
  derivative:   ["buy","sell"],
  reit:         ["buy","sell","dividend"],
  cash:         ["fd_deposit","fd_maturity","interest","fee"],
  other:        ["buy","sell","fee","adjustment"],
};

function AddTransactionForm({
  portfolioId,
  baseCurrency,
  onSuccess,
  onCancel,
}: {
  portfolioId: string;
  baseCurrency: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const createTxn  = useCreateTransaction(portfolioId);
  const [instrumentQuery, setInstrumentQuery] = useState("");
  const [selectedInstrument, setSelectedInstrument] = useState<{ id: string; symbol: string; exchange: string } | null>(null);
  const [instrOpen, setInstrOpen] = useState(false);
  const instrSearch = useInstrumentSearch(instrumentQuery);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<TxnFormValues>({
    defaultValues: {
      txn_type:    "buy",
      txn_date:    new Date().toISOString().split("T")[0],
      asset_class: "equity",
      qty:         "",
      price:       "",
      charges:     "0",
      currency:    baseCurrency,
      notes:       "",
      folio_number: "",
    },
  });

  const assetClass  = watch("asset_class");
  const txnType     = watch("txn_type");
  const needsInstrument = TTN.includes(txnType as any);

  const onSubmit = handleSubmit(async (values) => {
    if (needsInstrument && !selectedInstrument) {
      toast.error("Select an instrument for this transaction type");
      return;
    }
    const qty    = parseFloat(values.qty);
    const price  = parseFloat(values.price);
    const charges = parseFloat(values.charges ?? "0") || 0;

    if (isNaN(qty) || qty <= 0)    { toast.error("Qty must be a positive number"); return; }
    if (isNaN(price) || price < 0) { toast.error("Price must be >= 0"); return; }

    const payload: CreateTransactionInput = {
      portfolio_id:  portfolioId,
      instrument_id: selectedInstrument?.id ?? undefined,
      txn_type:      values.txn_type,
      txn_date:      values.txn_date,
      qty, price, charges,
      currency:      values.currency.toUpperCase(),
      asset_class:   values.asset_class,
      notes:         values.notes?.trim() || undefined,
      folio_number:  values.folio_number?.trim() || undefined,
    };

    try {
      await createTxn.mutateAsync(payload);
      toast.success(`Transaction recorded — ${TTL[values.txn_type]}`);
      reset();
      setSelectedInstrument(null);
      setInstrumentQuery("");
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save transaction");
    }
  });

  const availableTxnTypes = TXN_TYPES_BY_CLASS[assetClass] ?? ["buy","sell"];

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">

      {/* Asset class */}
      <div className="space-y-1.5">
        <Label>Asset class</Label>
        <Select value={assetClass} onValueChange={(v) => {
          setValue("asset_class", v as AssetClass);
          setValue("txn_type", (TXN_TYPES_BY_CLASS[v as AssetClass] ?? ["buy"])[0]);
          setSelectedInstrument(null);
          setInstrumentQuery("");
        }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ASSET_CLASSES.map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transaction type */}
      <div className="space-y-1.5">
        <Label>Transaction type</Label>
        <Select value={txnType} onValueChange={(v) => setValue("txn_type", v as TransactionType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableTxnTypes.map((t) => (
              <SelectItem key={t} value={t}>{TTL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Instrument search */}
      {needsInstrument && (
        <div className="space-y-1.5">
          <Label>Instrument <span className="text-destructive">*</span></Label>
          {selectedInstrument ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="flex-1 font-mono text-sm font-medium">{selectedInstrument.symbol}</span>
              <span className="text-xs text-muted-foreground">{selectedInstrument.exchange}</span>
              <button type="button" onClick={() => { setSelectedInstrument(null); setInstrumentQuery(""); }}
                className="rounded p-1 hover:bg-muted" aria-label="Clear">
                <span className="text-muted-foreground text-xs">✕</span>
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Search symbol or ISIN…"
                value={instrumentQuery}
                onChange={(e) => { setInstrumentQuery(e.target.value); setInstrOpen(e.target.value.length > 0); }}
                onFocus={() => { if (instrumentQuery.length > 0) setInstrOpen(true); }}
                onBlur={() => setTimeout(() => setInstrOpen(false), 150)}
                autoComplete="off"
              />
              {instrSearch.isFetching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {instrOpen && instrSearch.isSuccess && instrSearch.data.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
                  {instrSearch.data.map((ins) => (
                    <button key={ins.id} type="button"
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                      onMouseDown={(e) => { e.preventDefault(); setSelectedInstrument(ins); setInstrumentQuery(""); setInstrOpen(false); }}>
                      <span className="font-mono text-sm font-medium">{ins.symbol}</span>
                      <span className="text-xs text-muted-foreground">{ins.exchange}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{ins.instrument_type}</span>
                    </button>
                  ))}
                </div>
              )}
              {instrOpen && instrSearch.isSuccess && instrSearch.data.length === 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover px-4 py-3 shadow-md text-sm text-muted-foreground">
                  No instruments found. Try a different symbol.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Folio number — MF only */}
      {assetClass === "mutual_fund" && (
        <div className="space-y-1.5">
          <Label htmlFor="folio">Folio number (optional)</Label>
          <Input id="folio" placeholder="e.g. 12345678" {...register("folio_number")} />
        </div>
      )}

      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="txn_date">Date <span className="text-destructive">*</span></Label>
        <Input id="txn_date" type="date" {...register("txn_date", { required: "Date is required" })} />
        {errors.txn_date && <p className="text-xs text-destructive">{errors.txn_date.message}</p>}
      </div>

      {/* Qty + Price */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="qty">Qty / Units <span className="text-destructive">*</span></Label>
          <Input id="qty" type="number" step="any" min="0" placeholder="0" {...register("qty", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Price / NAV <span className="text-destructive">*</span></Label>
          <Input id="price" type="number" step="any" min="0" placeholder="0.00" {...register("price", { required: true })} />
        </div>
      </div>

      {/* Charges + Currency */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="charges">Charges / STT</Label>
          <Input id="charges" type="number" step="any" min="0" placeholder="0" {...register("charges")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" maxLength={3} className="uppercase" {...register("currency")} />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" placeholder="e.g. Monthly SIP" {...register("notes")} />
      </div>

      {createTxn.isError && (
        <p className="text-xs text-destructive">{createTxn.error?.message}</p>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={createTxn.isPending}>
          {createTxn.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save transaction"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ─── Delete confirmation ───────────────────────────────────────────────────

function DeleteTransactionDialog({
  txnId,
  portfolioId,
  onClose,
}: {
  txnId: string | null;
  portfolioId: string | undefined;
  onClose: () => void;
}) {
  const deleteTxn = useDeleteTransaction(portfolioId);

  const handleConfirm = async () => {
    if (!txnId) return;
    try {
      await deleteTxn.mutateAsync(txnId);
      toast.success("Transaction deleted");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete transaction");
    }
  };

  return (
    <AlertDialog open={Boolean(txnId)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the transaction and recalculate your holdings. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteTxn.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteTxn.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Brief components (unchanged) ─────────────────────────────────────────

function BriefCard({ brief, variant }: { brief: Brief; variant: "latest" | "compact" }) {
  const isLatest = variant === "latest";
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className={isLatest ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"} />
            {brief.title ?? "AI Brief"}
          </CardTitle>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(brief.ts)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(brief.ts)} · <span className="font-mono">{brief.llm_provider ?? "—"}</span>
          {brief.llm_model && <> · <span className="font-mono">{brief.llm_model}</span></>}
          {Number.isFinite(brief.cost_usd ?? NaN) && (brief.cost_usd ?? 0) > 0 && (
            <> · <Numeric value={brief.cost_usd ?? 0} format="currency" currency="USD" maximumFractionDigits={4} /></>
          )}
        </p>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{brief.body}</ReactMarkdown>
        {Array.isArray(brief.sources) && brief.sources.length > 0 && (
          <div className="mt-4 border-t pt-3 not-prose">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Newspaper className="h-3 w-3" />Sources
            </p>
            <ol className="space-y-1 text-xs">
              {brief.sources.slice(0, 8).map((s, i) => <SourceItem key={i} index={i + 1} source={s} />)}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceItem({ index, source }: { index: number; source: BriefSource }) {
  return (
    <li>
      <span className="mr-1 text-muted-foreground">[{index}]</span>
      {source.url
        ? <a href={source.url} target="_blank" rel="noreferrer noopener" className="text-foreground hover:underline">{source.title}</a>
        : <span>{source.title}</span>}
      <span className="ml-1 text-muted-foreground">— {source.source}, {formatRelativeTime(source.ts)}</span>
    </li>
  );
}
