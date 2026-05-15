/**
 * Markets — Portfolio Detail Page (T1 — with Transactions tab).
 *
 * Tabs: Holdings | Transactions | Briefs
 * Transactions tab: list + inline "Add Transaction" sheet.
 */

import { useRef, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Brain, Loader2, Newspaper, Plus, Trash2, Upload,
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

  const latestBrief    = briefs.data?.[0];
  const previousBriefs = briefs.data?.slice(1) ?? [];

  const placeholderSeries = useMemo(() => {
    const len = 30; const seed = id ? id.charCodeAt(0) : 7;
    return Array.from({ length: len }).map((_, i) => {
      const t = i / (len - 1);
      return 100 + Math.sin((seed + i) * 0.7) * 5 + t * 6;
    });
  }, [id]);

  if (portfolio.isPending) return <div className="mx-auto max-w-7xl p-6"><SkeletonCard withHeader lines={5} /></div>;
  if (portfolio.isError)   return <div className="mx-auto max-w-7xl p-6"><ErrorState title="Failed to load portfolio" message={portfolio.error?.message ?? "Unknown error"} onRetry={() => portfolio.refetch()} /></div>;
  if (!portfolio.data)     return <div className="mx-auto max-w-7xl p-6"><EmptyState title="Portfolio not found" description="This portfolio doesn't exist or you don't have access." actionLabel="Back to portfolios" onAction={() => { window.location.href = "/dashboard/markets/portfolios"; }} /></div>;

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
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Back nav */}
      <Link to="/dashboard/markets/portfolios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />
        All portfolios
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
            <Badge variant={p.mode === "live" ? "default" : "secondary"} className="capitalize">{p.mode}</Badge>
            <Badge variant="outline" className="text-xs">{p.base_currency}</Badge>
          </div>
          {p.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{p.description}</p>}
        </div>
        <Button onClick={onGenerate} disabled={generateBrief.isPending} size="lg">
          <Brain className="mr-2 h-4 w-4" />
          {generateBrief.isPending ? "Generating…" : "Generate AI brief"}
        </Button>
      </header>

      {/* KPI strip */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
          <KpiCell label="NAV">
            <Numeric value={holdings.data?.nav ?? 0} format="currency" currency={p.base_currency} className="text-2xl font-semibold" />
          </KpiCell>
          <KpiCell label="Today P&L">
            <Numeric value={holdings.data?.todayPnl ?? 0} format="pnl" currency={p.base_currency} colorBySign withArrow className="text-xl font-semibold" />
          </KpiCell>
          <KpiCell label="Since inception">
            <Numeric value={holdings.data?.sinceInceptionPct ?? 0} format="percent" colorBySign withArrow className="text-xl font-semibold" />
          </KpiCell>
          <KpiCell label="Transactions">
            <span className="text-2xl font-semibold">{transactions.data?.length ?? 0}</span>
          </KpiCell>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="holdings">
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto">
          {(["holdings","transactions","briefs"] as const).map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 capitalize data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t === "holdings" ? "Holdings" : t === "transactions" ? "Transactions" : "AI Briefs"}
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
            <Card>
              <CardHeader><CardTitle className="text-base">Current positions</CardTitle></CardHeader>
              <CardContent>
                <HoldingsTable holdings={holdings.data.holdings} currency={p.base_currency} />
              </CardContent>
            </Card>
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
    </div>
  );
}

// ─── Holdings table ────────────────────────────────────────────────────────

function KpiCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function HoldingsTable({ holdings, currency }: { holdings: HoldingWithPrice[]; currency: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Symbol</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Avg cost</TableHead>
          <TableHead className="text-right">LTP</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="text-right">P&amp;L</TableHead>
          <TableHead className="text-right">P&amp;L %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map((h) => {
          const ltp   = h.last_price ?? h.avg_cost;
          const value = h.qty * ltp;
          const pnl   = h.qty * (ltp - h.avg_cost);
          const pnlPct = h.avg_cost > 0 ? ((ltp - h.avg_cost) / h.avg_cost) * 100 : 0;
          const sign  = pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
          return (
            <TableRow key={h.id}>
              <TableCell className="font-mono font-medium">
                <div className="flex items-center gap-2">
                  {h.instrument?.symbol ?? "—"}
                  <Badge variant="secondary" className="text-xs">{h.instrument?.exchange ?? "—"}</Badge>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{h.qty}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                <Numeric value={h.avg_cost} format="currency" currency={currency} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {h.last_price != null
                  ? <Numeric value={h.last_price} format="currency" currency={currency} />
                  : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                <Numeric value={value} format="currency" currency={currency} />
              </TableCell>
              <TableCell className={`text-right tabular-nums ${sign}`}>
                <Numeric value={pnl} format="pnl" currency={currency} colorBySign />
              </TableCell>
              <TableCell className={`text-right tabular-nums ${sign}`}>
                <Numeric value={pnlPct} format="percent" colorBySign withArrow />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ─── Transactions table ────────────────────────────────────────────────────

import type { Transaction } from "../types";

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
