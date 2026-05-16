/**
 * Markets — Strategies page.
 * Full CRUD: list, create (sheet), edit (sheet), delete (dialog).
 * Also supports "Run Backtest" dialog per strategy.
 */

import { useState } from "react";
import { format, subYears } from "date-fns";
import {
  BarChart3,
  Edit2,
  GitBranch,
  Loader2,
  MoreHorizontal,
  Plus,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
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
  SkeletonCard,
} from "@/design-system";

import {
  useStrategies,
  useCreateStrategy,
  useUpdateStrategy,
  useDeleteStrategy,
  type UpdateStrategyInput,
} from "../hooks/useStrategies";
import { useRunBacktest } from "../hooks/useBacktests";
import type { CreateStrategyInput, Strategy, StrategyLifecycle, StrategyUniverse } from "../types";

// ─── NSE symbol universe ──────────────────────────────────────────────────

const NSE_SYMBOLS = [
  "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK",
  "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE", "BHARTIARTL", "BPCL",
  "BRITANNIA", "CIPLA", "COALINDIA", "DIVISLAB", "DRREDDY",
  "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", "HDFCLIFE",
  "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK",
  "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", "LT",
  "M&M", "MARUTI", "NESTLEIND", "NTPC", "ONGC",
  "POWERGRID", "RELIANCE", "SBIN", "SUNPHARMA", "TATAMOTORS",
  "TATASTEEL", "TCS", "TECHM", "TITAN", "ULTRACEMCO",
  "UPL", "WIPRO",
];

// ─── Lifecycle badge config ───────────────────────────────────────────────

const LIFECYCLE_CONFIG: Record<
  StrategyLifecycle,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  draft:    { label: "Draft",    variant: "secondary" },
  active:   { label: "Active",   variant: "default"   },
  archived: { label: "Archived", variant: "outline"   },
};

// ─── Page ─────────────────────────────────────────────────────────────────

export default function StrategiesPage() {
  const strategies = useStrategies();

  const [createOpen,      setCreateOpen]      = useState(false);
  const [editStrategy,    setEditStrategy]    = useState<Strategy | null>(null);
  const [deleteStrategy,  setDeleteStrategy]  = useState<Strategy | null>(null);
  const [backtestStrategy, setBacktestStrategy] = useState<Strategy | null>(null);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <GitBranch className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Strategies
            </h1>
            <p className="text-sm text-muted-foreground">
              Define and manage rule-based or AI-driven trading strategies.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Strategy
          </Button>
        </header>

        {/* Content */}
        {strategies.isPending && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
          </div>
        )}

        {strategies.isError && (
          <ErrorState
            title="Failed to load strategies"
            message={strategies.error?.message ?? "Unknown error"}
            onRetry={() => strategies.refetch()}
          />
        )}

        {strategies.isSuccess && strategies.data.length === 0 && (
          <EmptyState
            icon={<GitBranch className="h-10 w-10" />}
            title="No strategies yet"
            description="Create your first strategy to define entry/exit rules, a symbol universe, and backtestable logic."
            actionLabel="Create your first strategy"
            onAction={() => setCreateOpen(true)}
          />
        )}

        {strategies.isSuccess && strategies.data.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {strategies.data.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                onEdit={() => setEditStrategy(s)}
                onDelete={() => setDeleteStrategy(s)}
                onRunBacktest={() => setBacktestStrategy(s)}
              />
            ))}
          </div>
        )}

        {/* Create sheet */}
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create a strategy</SheetTitle>
            </SheetHeader>
            <StrategyFormSheet
              mode="create"
              onSuccess={() => setCreateOpen(false)}
              onCancel={() => setCreateOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Edit sheet */}
        <Sheet open={Boolean(editStrategy)} onOpenChange={(o) => { if (!o) setEditStrategy(null); }}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Edit strategy</SheetTitle>
            </SheetHeader>
            {editStrategy && (
              <StrategyFormSheet
                mode="edit"
                strategy={editStrategy}
                onSuccess={() => setEditStrategy(null)}
                onCancel={() => setEditStrategy(null)}
              />
            )}
          </SheetContent>
        </Sheet>

        {/* Run backtest dialog */}
        {backtestStrategy && (
          <RunBacktestDialog
            strategy={backtestStrategy}
            onClose={() => setBacktestStrategy(null)}
          />
        )}

        {/* Delete confirmation */}
        <DeleteStrategyDialog
          strategy={deleteStrategy}
          onClose={() => setDeleteStrategy(null)}
        />
      </div>
    </DashboardLayout>
  );
}

// ─── Strategy card ────────────────────────────────────────────────────────

function StrategyCard({
  strategy,
  onEdit,
  onDelete,
  onRunBacktest,
}: {
  strategy: Strategy;
  onEdit: () => void;
  onDelete: () => void;
  onRunBacktest: () => void;
}) {
  const updateMutation = useUpdateStrategy();
  const cfg = LIFECYCLE_CONFIG[strategy.lifecycle_state] ?? LIFECYCLE_CONFIG.draft;
  const symbols = strategy.universe?.symbols ?? [];
  const displaySymbols = symbols.slice(0, 5);
  const extraCount = symbols.length - displaySymbols.length;

  const handleToggleLifecycle = async () => {
    const next: StrategyLifecycle =
      strategy.lifecycle_state === "active" ? "draft" : "active";
    try {
      await updateMutation.mutateAsync({ id: strategy.id, lifecycle_state: next });
      toast.success(`Strategy "${strategy.name}" set to ${next}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast.error(msg);
    }
  };

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-base">
            <a href="#" className="outline-none hover:underline focus-visible:underline">
              {strategy.name}
            </a>
          </CardTitle>
          {strategy.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {strategy.description}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge variant={cfg.variant} className="text-xs">
              {cfg.label}
            </Badge>
            {strategy.version > 1 && (
              <Badge variant="outline" className="text-xs">
                v{strategy.version}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label="Strategy actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleLifecycle} disabled={updateMutation.isPending}>
              <Zap className="mr-2 h-4 w-4" />
              {strategy.lifecycle_state === "active" ? "Set to Draft" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRunBacktest}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Run Backtest
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Symbol universe */}
        {symbols.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Universe</p>
            <div className="flex flex-wrap gap-1">
              {displaySymbols.map((sym) => (
                <Badge key={sym} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                  {sym}
                </Badge>
              ))}
              {extraCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                  +{extraCount} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {strategy.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <Tag className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
            {strategy.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                {t}
              </Badge>
            ))}
          </div>
        )}

        {/* Created date */}
        <p className="text-xs text-muted-foreground">
          Created {format(new Date(strategy.created_at), "d MMM yyyy")}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Strategy form sheet (Create + Edit) ─────────────────────────────────

interface StrategyFormValues {
  name: string;
  description: string;
  lifecycle_state: StrategyLifecycle;
  dsl: string;
  tags: string;
}

function StrategyFormSheet({
  mode,
  strategy,
  onSuccess,
  onCancel,
}: {
  mode: "create" | "edit";
  strategy?: Strategy;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const createMutation = useCreateStrategy();
  const updateMutation = useUpdateStrategy();
  const isPending = mode === "create" ? createMutation.isPending : updateMutation.isPending;

  // Controlled form state
  const [name,           setName]           = useState(strategy?.name ?? "");
  const [description,    setDescription]    = useState(strategy?.description ?? "");
  const [lifecycleState, setLifecycleState] = useState<StrategyLifecycle>(
    strategy?.lifecycle_state ?? "draft",
  );
  const [dsl,  setDsl]  = useState(strategy?.dsl ?? "");
  const [tags, setTags] = useState((strategy?.tags ?? []).join(", "));

  // Symbol picker state
  const [symbolFilter,   setSymbolFilter]   = useState("");
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(
    strategy?.universe?.symbols ?? [],
  );

  const filteredSymbols = symbolFilter.trim()
    ? NSE_SYMBOLS.filter((s) => s.toLowerCase().includes(symbolFilter.toLowerCase()))
    : NSE_SYMBOLS;

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
    );
  };

  const removeSymbol = (sym: string) => {
    setSelectedSymbols((prev) => prev.filter((s) => s !== sym));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Strategy name is required");
      return;
    }

    const universe: StrategyUniverse | null =
      selectedSymbols.length > 0 ? { symbols: selectedSymbols, exchange: "NSE" } : null;

    const parsedTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (mode === "create") {
        const payload: CreateStrategyInput = {
          name:        name.trim(),
          description: description.trim() || null,
          dsl:         dsl.trim() || null,
          universe,
          tags:        parsedTags,
        };
        const created = await createMutation.mutateAsync(payload);
        toast.success(`Strategy "${created.name}" created`);
      } else {
        const payload: UpdateStrategyInput = {
          id:              strategy!.id,
          name:            name.trim(),
          description:     description.trim() || null,
          dsl:             dsl.trim() || null,
          universe,
          tags:            parsedTags,
          lifecycle_state: lifecycleState,
        };
        const updated = await updateMutation.mutateAsync(payload);
        toast.success(`Strategy "${updated.name}" updated`);
      }
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
    }
  };

  const mutationError = mode === "create" ? createMutation.error : updateMutation.error;

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="st-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="st-name"
          placeholder="e.g. Momentum long-only"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="st-desc">Description (optional)</Label>
        <Textarea
          id="st-desc"
          placeholder="What does this strategy do?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Lifecycle state (edit only) */}
      {mode === "edit" && (
        <div className="space-y-1.5">
          <Label>Lifecycle</Label>
          <Select
            value={lifecycleState}
            onValueChange={(v) => setLifecycleState(v as StrategyLifecycle)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Symbol universe picker */}
      <div className="space-y-1.5">
        <Label>Universe symbols</Label>

        {/* Selected symbols as badges */}
        {selectedSymbols.length > 0 && (
          <div className="flex flex-wrap gap-1 rounded-md border bg-muted/30 p-2">
            {selectedSymbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => removeSymbol(sym)}
                className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono hover:border-destructive hover:text-destructive transition-colors"
                aria-label={`Remove ${sym}`}
              >
                {sym}
                <span className="text-muted-foreground">×</span>
              </button>
            ))}
          </div>
        )}

        {/* Filter input */}
        <Input
          placeholder="Filter symbols…"
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="text-sm"
        />

        {/* Symbol grid */}
        <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/10 p-2">
          <div className="flex flex-wrap gap-1">
            {filteredSymbols.map((sym) => {
              const selected = selectedSymbols.includes(sym);
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => toggleSymbol(sym)}
                  className={[
                    "rounded border px-1.5 py-0.5 text-[10px] font-mono transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-primary hover:text-primary",
                  ].join(" ")}
                >
                  {sym}
                </button>
              );
            })}
          </div>
        </div>

        {selectedSymbols.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedSymbols.length} symbol{selectedSymbols.length !== 1 ? "s" : ""} selected.
            Click a selected symbol above to remove it.
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label htmlFor="st-tags">Tags (optional, comma-separated)</Label>
        <Input
          id="st-tags"
          placeholder="e.g. momentum, nifty50, long-only"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      {/* DSL / notes */}
      <div className="space-y-1.5">
        <Label htmlFor="st-dsl">Strategy rules / notes (optional)</Label>
        <Textarea
          id="st-dsl"
          placeholder={"e.g. Enter when RSI(14) > 60 and 20-day volume > 1.5× avg.\nExit when RSI < 40 or stop-loss -8%."}
          value={dsl}
          onChange={(e) => setDsl(e.target.value)}
          rows={5}
          className="resize-y font-mono text-xs"
        />
      </div>

      {mutationError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {mutationError.message}
        </p>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === "create" ? "Creating…" : "Saving…"}
            </>
          ) : (
            mode === "create" ? "Create strategy" : "Save changes"
          )}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Run Backtest dialog ──────────────────────────────────────────────────

function RunBacktestDialog({
  strategy,
  onClose,
}: {
  strategy: Strategy;
  onClose: () => void;
}) {
  const runBacktest = useRunBacktest();

  const defaultFrom = format(subYears(new Date(), 1), "yyyy-MM-dd");
  const defaultTo   = format(new Date(), "yyyy-MM-dd");

  const [periodFrom,      setPeriodFrom]      = useState(defaultFrom);
  const [periodTo,        setPeriodTo]        = useState(defaultTo);
  const [initialCapital,  setInitialCapital]  = useState("1000000");

  const handleRun = async () => {
    const capital = Number(initialCapital);
    if (!periodFrom || !periodTo) {
      toast.error("Please specify both period dates");
      return;
    }
    if (isNaN(capital) || capital <= 0) {
      toast.error("Initial capital must be a positive number");
      return;
    }

    try {
      await runBacktest.mutateAsync({
        strategy_id:     strategy.id,
        period_from:     periodFrom,
        period_to:       periodTo,
        initial_capital: capital,
      });
      toast.success("Backtest queued — check Backtests page for results");
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to queue backtest";
      toast.error(msg);
    }
  };

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Run Backtest
          </AlertDialogTitle>
          <AlertDialogDescription>
            Queues a historical simulation for <strong>"{strategy.name}"</strong> on the markets worker.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bt-from">Period from</Label>
              <input
                id="bt-from"
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bt-to">Period to</Label>
              <input
                id="bt-to"
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bt-capital">Initial capital (INR)</Label>
            <Input
              id="bt-capital"
              type="number"
              min={1000}
              step={10000}
              value={initialCapital}
              onChange={(e) => setInitialCapital(e.target.value)}
              placeholder="1000000"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={runBacktest.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRun}
            disabled={runBacktest.isPending}
            className="gap-2"
          >
            {runBacktest.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Queuing…
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4" />
                Run Backtest
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Delete confirmation dialog ───────────────────────────────────────────

function DeleteStrategyDialog({
  strategy,
  onClose,
}: {
  strategy: Strategy | null;
  onClose: () => void;
}) {
  const deleteStrategy = useDeleteStrategy();

  const handleConfirm = async () => {
    if (!strategy) return;
    try {
      await deleteStrategy.mutateAsync(strategy.id);
      toast.success(`Strategy "${strategy.name}" deleted`);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete strategy";
      toast.error(msg);
    }
  };

  return (
    <AlertDialog open={Boolean(strategy)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete strategy?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>"{strategy?.name}"</strong> will be permanently removed along with its
            configuration. Any associated backtests will remain but will lose the strategy link.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteStrategy.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteStrategy.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete strategy"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
