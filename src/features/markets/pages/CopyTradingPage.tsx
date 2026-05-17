/**
 * CopyTradingPage — /dashboard/markets/copy-trading
 *
 * Three tabs:
 *   1. Following  — your active copy trades
 *   2. Leaderboard — discover traders to copy
 *   3. Executions — copy execution history
 */

import { useState } from "react";
import { format } from "date-fns";
import {
  Copy,
  Loader2,
  Pause,
  Play,
  Search,
  Trophy,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  SkeletonCard,
  SkeletonRow,
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
  useCopyTrades,
  useCopyExecutions,
  useUpdateCopyTrade,
  useStopCopying,
  useTraderLeaderboard,
  type CopyTrade,
  type TraderLeaderboard,
} from "../hooks/useCopyTrades";
import { CopyTradeSetupModal } from "../components/CopyTradeSetupModal";

// ─── Helpers ──────────────────────────────────────────────────────────────

function traderHandle(userId: string): string {
  return `@trader_${userId.slice(-8)}`;
}

function avatarColors(userId: string): string {
  const palette = [
    "bg-rose-500", "bg-orange-500", "bg-amber-500",
    "bg-emerald-500", "bg-teal-500", "bg-cyan-500",
    "bg-blue-500", "bg-violet-500", "bg-pink-500",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

// ─── StatusBadge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CopyTrade["status"] }) {
  if (status === "active")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
        Active
      </Badge>
    );
  if (status === "paused")
    return (
      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
        Paused
      </Badge>
    );
  return <Badge variant="secondary">Stopped</Badge>;
}

// ─── AllocationEditor ─────────────────────────────────────────────────────

function AllocationEditor({
  copyTrade,
}: {
  copyTrade: CopyTrade;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(copyTrade.allocation_pct);
  const update = useUpdateCopyTrade();

  const handleSave = async () => {
    const parsed = Math.min(50, Math.max(5, Math.round(draft)));
    try {
      await update.mutateAsync({ id: copyTrade.id, allocation_pct: parsed });
      toast.success("Allocation updated");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(copyTrade.allocation_pct); setEditing(true); }}
        className="text-sm font-semibold tabular-nums underline decoration-dotted hover:text-primary transition-colors"
        title="Click to edit allocation"
      >
        {copyTrade.allocation_pct}%
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={5}
        max={50}
        step={5}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        className="w-16 rounded border bg-background px-2 py-0.5 text-sm font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <span className="text-sm text-muted-foreground">%</span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs"
        onClick={handleSave}
        disabled={update.isPending}
      >
        {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
      </Button>
      <button
        onClick={() => setEditing(false)}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── CopyTradeCard ────────────────────────────────────────────────────────

function CopyTradeCard({ ct }: { ct: CopyTrade }) {
  const update = useUpdateCopyTrade();
  const stop   = useStopCopying();

  const isPaused = ct.status === "paused";
  const isStopped = ct.status === "stopped";

  const handleTogglePause = async () => {
    try {
      await update.mutateAsync({
        id: ct.id,
        status: isPaused ? "active" : "paused",
      });
      toast.success(isPaused ? "Resumed" : "Paused");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleStop = async () => {
    try {
      await stop.mutateAsync(ct.id);
      toast.success("Stopped copying");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to stop");
    }
  };

  const colorClass = avatarColors(ct.trader_id);
  const initials = ct.trader_id.slice(-2).toUpperCase();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: avatar + handle */}
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className={`${colorClass} text-white text-xs font-semibold`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {traderHandle(ct.trader_id)}
              </p>
              <div className="mt-0.5">
                <StatusBadge status={ct.status} />
              </div>
            </div>
          </div>

          {/* Right: actions */}
          {!isStopped && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={handleTogglePause}
                disabled={update.isPending}
              >
                {isPaused ? (
                  <><Play className="h-3 w-3" />Resume</>
                ) : (
                  <><Pause className="h-3 w-3" />Pause</>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 gap-1 text-xs"
                onClick={handleStop}
                disabled={stop.isPending}
              >
                {stop.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                Stop
              </Button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Allocation</span>
            <div className="mt-0.5">
              <AllocationEditor copyTrade={ct} />
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Ideas</span>
            <p className="mt-0.5 font-semibold tabular-nums">{ct.trader_idea_count}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Executions</span>
            <p className="mt-0.5 font-semibold tabular-nums">{ct.execution_count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── FollowingTab ─────────────────────────────────────────────────────────

function FollowingTab() {
  const { data = [], isLoading, isError, error } = useCopyTrades();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load copy trades"}
      </p>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Copy}
        title="Not copying anyone yet"
        description="Discover traders on the Leaderboard tab and start copying with one click."
      />
    );
  }

  return (
    <div className="space-y-3">
      {data.map((ct) => <CopyTradeCard key={ct.id} ct={ct} />)}
    </div>
  );
}

// ─── LeaderboardTab ───────────────────────────────────────────────────────

function LeaderboardRow({
  rank,
  trader,
  onCopy,
}: {
  rank: number;
  trader: TraderLeaderboard;
  onCopy: (traderId: string) => void;
}) {
  const colorClass = avatarColors(trader.user_id);
  const initials = trader.user_id.slice(-2).toUpperCase();
  const returnPct = trader.avg_potential_return_pct;
  const isPositive = returnPct >= 0;

  return (
    <TableRow>
      <TableCell className="w-10 font-semibold tabular-nums text-muted-foreground">
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className={`${colorClass} text-white text-xs font-semibold`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-sm">{traderHandle(trader.user_id)}</span>
        </div>
      </TableCell>
      <TableCell className="tabular-nums text-right">{trader.follower_count}</TableCell>
      <TableCell className="tabular-nums text-right">{trader.idea_count}</TableCell>
      <TableCell className="text-right">
        <span
          className={`inline-flex items-center gap-0.5 font-semibold tabular-nums text-sm ${
            isPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-500 dark:text-rose-400"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {isPositive ? "+" : ""}
          {returnPct.toFixed(1)}%
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={() => onCopy(trader.user_id)}
        >
          <Copy className="h-3 w-3" />
          Copy
        </Button>
      </TableCell>
    </TableRow>
  );
}

function LeaderboardTab() {
  const [search, setSearch] = useState("");
  const [minFollowers, setMinFollowers] = useState(0);
  const [setupTraderId, setSetupTraderId] = useState<string | null>(null);

  const { data = [], isLoading, isError, error } = useTraderLeaderboard();

  const filtered = data.filter((t) => {
    const matchesSearch =
      search.trim() === "" ||
      traderHandle(t.user_id).toLowerCase().includes(search.toLowerCase());
    const matchesFollowers = t.follower_count >= minFollowers;
    return matchesSearch && matchesFollowers;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search trader…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Min followers</span>
          <Input
            type="number"
            min={0}
            step={10}
            className="w-24"
            value={minFollowers || ""}
            placeholder="0"
            onChange={(e) => setMinFollowers(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load leaderboard"}
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No traders found"
          description={
            data.length === 0
              ? "The leaderboard is empty right now. Check back later."
              : "No traders match your filter criteria."
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Trader</TableHead>
                <TableHead className="text-right">Followers</TableHead>
                <TableHead className="text-right">Ideas</TableHead>
                <TableHead className="text-right">Avg Return</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((trader, idx) => (
                <LeaderboardRow
                  key={trader.user_id}
                  rank={idx + 1}
                  trader={trader}
                  onCopy={setSetupTraderId}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {setupTraderId && (
        <CopyTradeSetupModal
          open={Boolean(setupTraderId)}
          onClose={() => setSetupTraderId(null)}
          traderId={setupTraderId}
        />
      )}
    </div>
  );
}

// ─── ExecutionsTab ────────────────────────────────────────────────────────

function ExecutionsTab() {
  const { data = [], isLoading, isError, error } = useCopyExecutions();

  const sorted = [...data].sort(
    (a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime(),
  );

  const totalBuy = sorted
    .filter((e) => e.side === "BUY")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalSell = sorted
    .filter((e) => e.side === "SELL")
    .reduce((sum, e) => sum + e.amount, 0);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load executions"}
      </p>
    );
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={Copy}
        title="No copy executions yet"
        description="Executions will appear here once you start copying traders and ideas are executed."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Executions</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{sorted.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Spent (BUY)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              ₹{totalBuy.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Proceeds (SELL)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-500 dark:text-rose-400">
              ₹{totalSell.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Net Flow</p>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums ${
                totalSell - totalBuy >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              ₹{(totalSell - totalBuy).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((exec) => (
              <TableRow key={exec.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(exec.executed_at), "dd MMM yyyy, HH:mm")}
                </TableCell>
                <TableCell>
                  <span className="font-mono font-medium text-sm">{exec.symbol}</span>
                </TableCell>
                <TableCell>
                  {exec.side === "BUY" ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
                      <TrendingUp className="h-3 w-3" />
                      BUY
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1">
                      <TrendingDown className="h-3 w-3" />
                      SELL
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {exec.quantity.toLocaleString("en-IN")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ₹{exec.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  ₹{exec.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── CopyTradingPage ──────────────────────────────────────────────────────

export function CopyTradingPage() {
  const [tab, setTab] = useState("following");

  return (
    <DashboardLayout title="Copy Trading">
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Copy Trading</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow top traders and automatically replicate their trade ideas in your paper portfolio.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="following" className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Following
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="executions" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Executions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="following" className="mt-4">
            <FollowingTab />
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4">
            <LeaderboardTab />
          </TabsContent>

          <TabsContent value="executions" className="mt-4">
            <ExecutionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

export default CopyTradingPage;
