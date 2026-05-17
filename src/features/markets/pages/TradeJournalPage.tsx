/**
 * Markets — Trade Journal.
 *
 * Route: /dashboard/markets/journal
 *
 * Record trades, track rationale, emotion, and view AI-pattern stats.
 */

import { useState, useMemo, useId } from "react";
import { format } from "date-fns";
import { BookOpen, Plus, Trash2, TrendingUp, TrendingDown, Trophy, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/design-system";

import {
  useTrades,
  useTradeStats,
  useCreateTrade,
  useDeleteTrade,
  type CreateTradeInput,
  type TradeDirection,
  type TradeEmotion,
  type TradeJournalEntry,
  type TradeOutcome,
} from "../hooks/useTradeJournal";

// ── Constants ─────────────────────────────────────────────────────────────────

const STRATEGY_TAGS = [
  "momentum", "breakout", "earnings", "reversal",
  "swing", "scalp", "positional", "hedging",
] as const;

const EMOTION_OPTIONS: TradeEmotion[] = [
  "confident", "fearful", "greedy", "disciplined", "impulsive", "neutral",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${n < 0 ? "−" : ""}₹${s}`;
}

function fmtPnl(n: number | null | undefined): string {
  if (n == null) return "—";
  const prefix = n >= 0 ? "+" : "";
  return `${prefix}${fmtINR(n)}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yy"); } catch { return d; }
}

// ── Outcome badge ──────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: TradeOutcome | null }) {
  if (!outcome) return null;
  const map: Record<TradeOutcome, { label: string; cls: string }> = {
    win:       { label: "Win",       cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
    loss:      { label: "Loss",      cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" },
    breakeven: { label: "Breakeven", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
    open:      { label: "Open",      cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  };
  const m = map[outcome];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ── Direction badge ────────────────────────────────────────────────────────────

function DirectionBadge({ direction }: { direction: TradeDirection }) {
  const isBull = direction === "buy" || direction === "cover";
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-semibold ${
        isBull
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-500 dark:text-rose-400"
      }`}
    >
      {isBull ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {direction.toUpperCase()}
    </span>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────────

function StatsBar() {
  const stats = useTradeStats();

  const winRatePct = (stats.win_rate * 100).toFixed(0);
  const pfLabel    = Number.isFinite(stats.profit_factor)
    ? stats.profit_factor.toFixed(2)
    : "∞";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatItem label="Total Trades" value={String(stats.total_trades)} />
      <StatItem
        label="Win Rate"
        value={`${winRatePct}%`}
        accent={stats.win_rate >= 0.5 ? "emerald" : "rose"}
      />
      <StatItem
        label="Avg P&L"
        value={fmtPnl(stats.avg_pnl)}
        accent={stats.avg_pnl >= 0 ? "emerald" : "rose"}
      />
      <StatItem label="Profit Factor" value={pfLabel} />
      <StatItem
        label="Best Trade"
        value={stats.best_trade ? `${stats.best_trade.symbol} ${fmtPnl(stats.best_trade.pnl)}` : "—"}
        accent="emerald"
      />
    </div>
  );
}

function StatItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "rose";
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {label}
        </p>
        <p
          className={`mt-0.5 font-mono text-base font-bold tabular-nums ${
            accent === "emerald"
              ? "text-emerald-600 dark:text-emerald-400"
              : accent === "rose"
                ? "text-rose-500 dark:text-rose-400"
                : "text-foreground"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ── New trade form (sheet) ────────────────────────────────────────────────────

interface NewTradeFormProps {
  open: boolean;
  onClose: () => void;
}

function NewTradeSheet({ open, onClose }: NewTradeFormProps) {
  const id = useId();
  const { mutate: createTrade, isPending } = useCreateTrade();

  const [form, setForm] = useState<Omit<CreateTradeInput, "entry_date" | "entry_price" | "qty" | "direction" | "symbol"> & {
    symbol:       string;
    direction:    TradeDirection;
    entry_date:   string;
    entry_price:  string;
    exit_price:   string;
    exit_date:    string;
    qty:          string;
    charges:      string;
    rationale:    string;
    exit_reason:  string;
    emotion:      TradeEmotion | "";
    tags:         string[];
  }>({
    symbol:      "",
    direction:   "buy",
    entry_date:  new Date().toISOString().slice(0, 10),
    entry_price: "",
    exit_price:  "",
    exit_date:   "",
    qty:         "",
    charges:     "",
    rationale:   "",
    exit_reason: "",
    emotion:     "",
    tags:        [],
  });

  function toggleTag(tag: string) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  }

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!form.symbol.trim()) { toast.error("Symbol is required."); return; }
    if (!form.entry_price)   { toast.error("Entry price is required."); return; }
    if (!form.qty)           { toast.error("Quantity is required."); return; }
    if (!form.entry_date)    { toast.error("Entry date is required."); return; }

    const payload: CreateTradeInput = {
      symbol:      form.symbol.toUpperCase(),
      direction:   form.direction,
      entry_date:  form.entry_date,
      entry_price: Number(form.entry_price),
      qty:         Number(form.qty),
      charges:     form.charges ? Number(form.charges) : 0,
      exit_price:  form.exit_price ? Number(form.exit_price) : null,
      exit_date:   form.exit_date || null,
      rationale:   form.rationale || null,
      exit_reason: form.exit_reason || null,
      emotion:     form.emotion || null,
      tags:        form.tags,
    };

    createTrade(payload, {
      onSuccess: () => {
        toast.success("Trade recorded.");
        onClose();
        setForm({
          symbol: "", direction: "buy",
          entry_date: new Date().toISOString().slice(0, 10),
          entry_price: "", exit_price: "", exit_date: "",
          qty: "", charges: "", rationale: "", exit_reason: "",
          emotion: "", tags: [],
        });
      },
      onError: (err) => toast.error(err.message),
    });
  }

  // Indicative P&L
  const indicativePnl = useMemo(() => {
    const ep = Number(form.entry_price);
    const xp = Number(form.exit_price);
    const q  = Number(form.qty);
    const ch = Number(form.charges) || 0;
    if (!ep || !xp || !q) return null;
    const mult = form.direction === "sell" || form.direction === "short" ? -1 : 1;
    return Math.round(((xp - ep) * q * mult - ch) * 100) / 100;
  }, [form.entry_price, form.exit_price, form.qty, form.charges, form.direction]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            New Trade
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Symbol + Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${id}-sym`} className="text-xs">Symbol *</Label>
              <Input
                id={`${id}-sym`}
                value={form.symbol}
                onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                placeholder="RELIANCE"
                className="h-8 font-mono text-xs uppercase"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-dir`} className="text-xs">Direction *</Label>
              <Select value={form.direction} onValueChange={(v) => set("direction", v as TradeDirection)}>
                <SelectTrigger id={`${id}-dir`} className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy (Long)</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="cover">Cover</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Entry date + price + qty */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${id}-edate`} className="text-xs">Entry Date *</Label>
              <Input
                id={`${id}-edate`}
                type="date"
                value={form.entry_date}
                onChange={(e) => set("entry_date", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-ep`} className="text-xs">Entry Price *</Label>
              <Input
                id={`${id}-ep`}
                type="number"
                value={form.entry_price}
                onChange={(e) => set("entry_price", e.target.value)}
                placeholder="0.00"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-qty`} className="text-xs">Qty *</Label>
              <Input
                id={`${id}-qty`}
                type="number"
                value={form.qty}
                onChange={(e) => set("qty", e.target.value)}
                placeholder="1"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Exit date + price + charges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${id}-xdate`} className="text-xs">Exit Date</Label>
              <Input
                id={`${id}-xdate`}
                type="date"
                value={form.exit_date}
                onChange={(e) => set("exit_date", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-xp`} className="text-xs">Exit Price</Label>
              <Input
                id={`${id}-xp`}
                type="number"
                value={form.exit_price}
                onChange={(e) => set("exit_price", e.target.value)}
                placeholder="0.00"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-ch`} className="text-xs">Charges</Label>
              <Input
                id={`${id}-ch`}
                type="number"
                value={form.charges}
                onChange={(e) => set("charges", e.target.value)}
                placeholder="0.00"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Indicative P&L */}
          {indicativePnl != null && (
            <div
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold ${
                indicativePnl >= 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
              }`}
            >
              {indicativePnl >= 0
                ? <Trophy className="h-3.5 w-3.5" />
                : <AlertCircle className="h-3.5 w-3.5" />}
              Indicative P&L: {fmtPnl(indicativePnl)}
            </div>
          )}

          {/* Rationale */}
          <div className="space-y-1">
            <Label htmlFor={`${id}-rat`} className="text-xs">
              Rationale <span className="text-muted-foreground">(why I entered)</span>
            </Label>
            <textarea
              id={`${id}-rat`}
              value={form.rationale}
              onChange={(e) => set("rationale", e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Breakout from consolidation above 200 DMA…"
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-right text-[10px] text-muted-foreground">
              {form.rationale.length}/500
            </p>
          </div>

          {/* Exit reason */}
          <div className="space-y-1">
            <Label htmlFor={`${id}-exitr`} className="text-xs">
              Exit Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id={`${id}-exitr`}
              value={form.exit_reason}
              onChange={(e) => set("exit_reason", e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Target hit. Booked profits at resistance."
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <Label className="text-xs">Strategy Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {STRATEGY_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                    form.tags.includes(tag)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Emotion */}
          <div className="space-y-1">
            <Label htmlFor={`${id}-emo`} className="text-xs">Emotion</Label>
            <Select
              value={form.emotion}
              onValueChange={(v) => set("emotion", v as TradeEmotion)}
            >
              <SelectTrigger id={`${id}-emo`} className="h-8 text-xs">
                <SelectValue placeholder="How did you feel?" />
              </SelectTrigger>
              <SelectContent>
                {EMOTION_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} disabled={isPending} className="w-full">
            {isPending ? "Saving…" : "Save Trade"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Trades table ───────────────────────────────────────────────────────────────

function TradesTable({ trades }: { trades: TradeJournalEntry[] }) {
  const { mutate: deleteTrade } = useDeleteTrade();

  function handleDelete(id: string, symbol: string) {
    if (!window.confirm(`Delete trade for ${symbol}?`)) return;
    deleteTrade(id, {
      onSuccess: () => toast.success("Trade deleted."),
      onError:   (err) => toast.error(err.message),
    });
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Entry</TableHead>
            <TableHead>Exit</TableHead>
            <TableHead className="text-right">Entry ₹</TableHead>
            <TableHead className="text-right">Exit ₹</TableHead>
            <TableHead className="text-right">P&L</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Emotion</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((t) => {
            const pnlPositive = (t.pnl ?? 0) >= 0;
            return (
              <TableRow key={t.id}>
                <TableCell className="font-mono font-bold">{t.symbol}</TableCell>
                <TableCell><DirectionBadge direction={t.direction} /></TableCell>
                <TableCell className="text-xs">{fmtDate(t.entry_date)}</TableCell>
                <TableCell className="text-xs">{fmtDate(t.exit_date)}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {fmtINR(t.entry_price)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {t.exit_price ? fmtINR(t.exit_price) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {t.pnl != null ? (
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        pnlPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-500 dark:text-rose-400"
                      }`}
                    >
                      {fmtPnl(t.pnl)}
                      {t.pnl_pct != null && (
                        <span className="ml-1 font-normal opacity-70">
                          ({t.pnl_pct > 0 ? "+" : ""}{t.pnl_pct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell><OutcomeBadge outcome={t.outcome} /></TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(t.tags ?? []).slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[9px]">{tag}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {t.emotion ? (
                    <span className="text-[10px] capitalize text-muted-foreground">{t.emotion}</span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(t.id, t.symbol)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    aria-label="Delete trade"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function TradeJournalPage() {
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [search, setSearch]         = useState("");
  const [activeTab, setActiveTab]   = useState<"all" | TradeOutcome>("all");

  const { data: allTrades = [], isPending } = useTrades();

  const filtered = useMemo(() => {
    let list = allTrades;
    if (activeTab !== "all")      list = list.filter((t) => t.outcome === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          (t.rationale ?? "").toLowerCase().includes(q) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [allTrades, activeTab, search]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-screen-xl space-y-6 p-4 sm:p-6">

        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Trade Journal</h1>
              <p className="text-sm text-muted-foreground">
                Record trades, track rationale, and identify patterns.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setSheetOpen(true)} className="h-9 gap-2 self-start">
            <Plus className="h-4 w-4" />
            New Trade
          </Button>
        </header>

        {/* Stats */}
        <StatsBar />

        {/* Filter + search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          >
            <TabsList className="h-8">
              <TabsTrigger value="all"       className="text-xs">All</TabsTrigger>
              <TabsTrigger value="open"      className="text-xs">Open</TabsTrigger>
              <TabsTrigger value="win"       className="text-xs">Wins</TabsTrigger>
              <TabsTrigger value="loss"      className="text-xs">Losses</TabsTrigger>
              <TabsTrigger value="breakeven" className="text-xs">Breakeven</TabsTrigger>
            </TabsList>
            {/* Render TabsContent to satisfy Radix */}
            {(["all", "open", "win", "loss", "breakeven"] as const).map((t) => (
              <TabsContent key={t} value={t} />
            ))}
          </Tabs>

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol, tag, rationale…"
            className="h-8 w-full text-xs sm:w-64"
          />
        </div>

        {/* Table */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Trades
              <Label className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {filtered.length}
              </Label>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isPending && (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading trades…</div>
            )}
            {!isPending && filtered.length === 0 && (
              <EmptyState
                icon={<BookOpen className="h-8 w-8" />}
                title="No trades yet"
                description="Record your first trade to start tracking patterns."
                action={
                  <Button size="sm" onClick={() => setSheetOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Trade
                  </Button>
                }
              />
            )}
            {!isPending && filtered.length > 0 && (
              <TradesTable trades={filtered} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Trade Sheet */}
      <NewTradeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </DashboardLayout>
  );
}
