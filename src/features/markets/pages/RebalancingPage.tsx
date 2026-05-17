/**
 * Markets — Portfolio Rebalancing Page
 *
 * Route: /dashboard/markets/portfolios/:id/rebalancing
 *
 * Three sections:
 *   1. Current Allocation vs Target — horizontal gauge rows per position
 *   2. Rules Editor — table with inline add/edit/delete
 *   3. Alerts — collapsible, shown only when alerts exist
 *
 * Top-right: "Rebalance" button opens modal with full trade plan.
 */

import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Sliders,
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  SkeletonCard,
  EmptyState,
  ErrorState,
} from "@/design-system";

import {
  useRebalancingRulesWorker,
  useUpsertRule,
  useDeleteRule,
  useRebalancingAnalysis,
  useAcknowledgeAlerts,
  type Rule,
  type PositionAnalysis,
  type UpsertRuleInput,
} from "../hooks/useRebalancing";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtINR(v: number): string {
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null) return "—";
  return v.toFixed(digits) + "%";
}

// ── Status helpers ─────────────────────────────────────────────────────────────

function statusBadge(status: PositionAnalysis["status"]) {
  switch (status) {
    case "on_target":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-1.5 py-0">
          ON TARGET
        </Badge>
      );
    case "overweight":
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0">
          OVERWEIGHT
        </Badge>
      );
    case "underweight":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-1.5 py-0">
          UNDERWEIGHT
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
          NO RULE
        </Badge>
      );
  }
}

function tradePill(pos: PositionAnalysis) {
  if (!pos.trade_action || pos.trade_action === "HOLD" || !pos.trade_qty) return null;
  const isBuy = pos.trade_action === "BUY";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isBuy
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      }`}
    >
      {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos.trade_action} {pos.trade_qty}
      {pos.trade_value != null && ` ≈ ₹${fmtINR(Math.abs(pos.trade_value))}`}
    </span>
  );
}

// ── Section 1: Allocation Gauge Rows ──────────────────────────────────────────

interface GaugeRowProps {
  pos: PositionAnalysis;
}

function GaugeRow({ pos }: GaugeRowProps) {
  const hasRule =
    pos.target_weight != null &&
    pos.min_weight != null &&
    pos.max_weight != null;

  // Map 0–100% into bar display space with a buffer
  const lo = hasRule ? Math.max(0, pos.min_weight! - (pos.max_weight! - pos.min_weight!) * 0.4) : 0;
  const hi = hasRule ? Math.min(100, pos.max_weight! + (pos.max_weight! - pos.min_weight!) * 0.4) : 100;
  const range = hi - lo || 1;
  const toPct = (v: number) =>
    Math.min(100, Math.max(0, ((v - lo) / range) * 100));

  const currentPct = toPct(pos.current_weight);
  const targetPct = hasRule ? toPct(pos.target_weight!) : null;
  const minPct = hasRule ? toPct(pos.min_weight!) : null;
  const maxPct = hasRule ? toPct(pos.max_weight!) : null;

  const barColor =
    pos.status === "overweight"
      ? "bg-red-400 dark:bg-red-500"
      : pos.status === "underweight"
      ? "bg-amber-400 dark:bg-amber-500"
      : "bg-blue-500 dark:bg-blue-400";

  return (
    <div className="py-3 border-b last:border-b-0">
      {/* Top row: symbol, weight, status, trade */}
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono text-sm font-semibold w-28 shrink-0 truncate">
          {pos.symbol}
        </span>
        <span className="tabular-nums text-sm font-medium w-16 shrink-0">
          {fmtPct(pos.current_weight)}
        </span>
        {hasRule && (
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            target {fmtPct(pos.target_weight)} &middot; range {fmtPct(pos.min_weight)}–{fmtPct(pos.max_weight)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          {statusBadge(pos.status)}
          {tradePill(pos)}
        </div>
      </div>

      {/* Gauge bar */}
      <div className="relative h-2.5 rounded-full bg-muted overflow-visible mx-1">
        {/* Min–max band */}
        {minPct != null && maxPct != null && (
          <div
            className="absolute top-0 h-full rounded-full bg-blue-100 dark:bg-blue-900/30"
            style={{
              left: `${minPct}%`,
              width: `${Math.max(0, maxPct - minPct)}%`,
            }}
          />
        )}
        {/* Current fill */}
        <div
          className={`absolute top-0 h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${currentPct}%` }}
        />
        {/* Target marker */}
        {targetPct != null && (
          <div
            className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"
            style={{ left: `${targetPct}%` }}
            title={`Target: ${fmtPct(pos.target_weight)}`}
          />
        )}
        {/* Min marker */}
        {minPct != null && (
          <div
            className="absolute top-[-2px] bottom-[-2px] w-px bg-slate-400 dark:bg-slate-500"
            style={{ left: `${minPct}%` }}
            title={`Min: ${fmtPct(pos.min_weight)}`}
          />
        )}
        {/* Max marker */}
        {maxPct != null && (
          <div
            className="absolute top-[-2px] bottom-[-2px] w-px bg-slate-400 dark:bg-slate-500"
            style={{ left: `${maxPct}%` }}
            title={`Max: ${fmtPct(pos.max_weight)}`}
          />
        )}
      </div>

      {/* Drift note */}
      {pos.drift != null && Math.abs(pos.drift) > 0.01 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Drift:{" "}
          <span
            className={
              pos.drift > 0
                ? "text-red-600 dark:text-red-400"
                : "text-amber-600 dark:text-amber-400"
            }
          >
            {pos.drift > 0 ? "+" : ""}{fmtPct(pos.drift)}
          </span>
        </p>
      )}
    </div>
  );
}

// ── Gauge legend ──────────────────────────────────────────────────────────────

function GaugeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1 pb-1">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-4 rounded bg-blue-100 dark:bg-blue-900/30" />
        Min–Max band
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-0.5 bg-emerald-600 dark:bg-emerald-400" />
        Target
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-4 rounded bg-blue-500" />
        Current (on target)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-4 rounded bg-red-400" />
        Overweight
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-4 rounded bg-amber-400" />
        Underweight
      </span>
    </div>
  );
}

// ── Section 2: Rules Editor ────────────────────────────────────────────────────

interface AddRuleFormProps {
  portfolioId: string;
  onDone: () => void;
}

function AddRuleForm({ portfolioId, onDone }: AddRuleFormProps) {
  const upsert = useUpsertRule(portfolioId);
  const [symbol, setSymbol] = useState("");
  const [target, setTarget] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [notes, setNotes] = useState("");

  async function handleSave() {
    const t = parseFloat(target);
    const lo = parseFloat(min) || t - 2;
    const hi = parseFloat(max) || t + 2;
    if (!symbol.trim()) {
      toast.error("Symbol is required");
      return;
    }
    if (isNaN(t) || t <= 0 || t > 100) {
      toast.error("Target weight must be 0–100");
      return;
    }
    try {
      const body: UpsertRuleInput = {
        symbol: symbol.trim().toUpperCase(),
        target_weight: t,
        min_weight: lo,
        max_weight: hi,
        alert_enabled: alertEnabled,
        notes: notes.trim() || undefined,
      };
      await upsert.mutateAsync(body);
      toast.success(`Rule saved for ${symbol.toUpperCase()}`);
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save rule");
    }
  }

  return (
    <TableRow className="bg-muted/30">
      <TableCell>
        <Input
          placeholder="RELIANCE"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="h-7 w-28 text-xs font-mono"
          autoFocus
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          placeholder="15"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            const t = parseFloat(e.target.value);
            if (!isNaN(t)) {
              setMin(String((t - 2).toFixed(1)));
              setMax(String((t + 2).toFixed(1)));
            }
          }}
          className="h-7 w-20 text-xs"
          step={0.5}
          min={0}
          max={100}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="h-7 w-20 text-xs"
          step={0.5}
          min={0}
          max={100}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          className="h-7 w-20 text-xs"
          step={0.5}
          min={0}
          max={100}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={alertEnabled}
          onCheckedChange={setAlertEnabled}
          id="new-rule-alert"
        />
      </TableCell>
      <TableCell>
        <Input
          placeholder="Optional note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-7 text-xs"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={upsert.isPending}
          >
            {upsert.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={onDone}
          >
            Cancel
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface EditableRuleRowProps {
  rule: Rule;
  portfolioId: string;
}

function EditableRuleRow({ rule, portfolioId }: EditableRuleRowProps) {
  const upsert = useUpsertRule(portfolioId);
  const deleteRule = useDeleteRule(portfolioId);
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(String(rule.target_weight));
  const [min, setMin] = useState(String(rule.min_weight));
  const [max, setMax] = useState(String(rule.max_weight));
  const [alertEnabled, setAlertEnabled] = useState(rule.alert_enabled);
  const [notes, setNotes] = useState(rule.notes ?? "");

  async function handleSave() {
    try {
      await upsert.mutateAsync({
        symbol: rule.symbol,
        target_weight: parseFloat(target),
        min_weight: parseFloat(min),
        max_weight: parseFloat(max),
        alert_enabled: alertEnabled,
        notes: notes.trim() || undefined,
      });
      toast.success(`Rule updated for ${rule.symbol}`);
      setEditing(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update rule");
    }
  }

  async function handleDelete() {
    try {
      await deleteRule.mutateAsync(rule.id);
      toast.success(`Rule removed for ${rule.symbol}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete rule");
    }
  }

  if (editing) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell className="font-mono text-sm font-semibold">{rule.symbol}</TableCell>
        <TableCell>
          <Input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-7 w-20 text-xs"
            step={0.5}
            min={0}
            max={100}
            autoFocus
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="h-7 w-20 text-xs"
            step={0.5}
            min={0}
            max={100}
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="h-7 w-20 text-xs"
            step={0.5}
            min={0}
            max={100}
          />
        </TableCell>
        <TableCell>
          <Switch
            checked={alertEnabled}
            onCheckedChange={setAlertEnabled}
            id={`edit-alert-${rule.id}`}
          />
        </TableCell>
        <TableCell>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-7 text-xs"
            placeholder="Optional note"
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={upsert.isPending}
            >
              {upsert.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="text-sm">
      <TableCell className="font-mono font-semibold">{rule.symbol}</TableCell>
      <TableCell className="tabular-nums">{fmtPct(rule.target_weight)}</TableCell>
      <TableCell className="tabular-nums text-muted-foreground">{fmtPct(rule.min_weight)}</TableCell>
      <TableCell className="tabular-nums text-muted-foreground">{fmtPct(rule.max_weight)}</TableCell>
      <TableCell>
        {rule.alert_enabled ? (
          <Bell className="h-3.5 w-3.5 text-blue-500" />
        ) : (
          <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </TableCell>
      <TableCell className="text-muted-foreground max-w-[160px] truncate text-xs">
        {rule.notes || "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteRule.isPending}
            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted"
            aria-label={`Delete rule for ${rule.symbol}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Section 3: Alerts Panel ────────────────────────────────────────────────────

interface AlertsPanelProps {
  alerts: unknown[];
  portfolioId: string;
  onAcknowledge: () => void;
}

interface AlertItem {
  id?: string;
  symbol?: string;
  current_weight?: number;
  target_weight?: number | null;
  direction?: string;
  triggered_at?: string;
}

function AlertsPanel({ alerts, portfolioId, onAcknowledge }: AlertsPanelProps) {
  const ackMutation = useAcknowledgeAlerts(portfolioId);
  const [expanded, setExpanded] = useState(true);

  const typedAlerts = alerts as AlertItem[];

  async function handleAckAll() {
    const ids = typedAlerts
      .map((a) => a.id)
      .filter(Boolean) as string[];
    if (!ids.length) return;
    try {
      await ackMutation.mutateAsync({ alert_ids: ids });
      toast.success("All alerts acknowledged");
      onAcknowledge();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to acknowledge alerts");
    }
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            Triggered Alerts
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
              {alerts.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleAckAll}
              disabled={ackMutation.isPending}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Acknowledge All
            </Button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-1.5">
          {typedAlerts.map((alert, i) => (
            <div
              key={alert.id ?? i}
              className={`flex flex-wrap items-center gap-3 rounded-md px-3 py-2 text-xs border ${
                alert.direction === "over" || alert.direction === "overweight"
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
                  : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
              }`}
            >
              <span className="font-mono font-semibold">{alert.symbol ?? "—"}</span>
              <span>
                {alert.direction === "over" || alert.direction === "overweight"
                  ? "overweight"
                  : "underweight"}{" "}
                at {fmtPct(alert.current_weight)}
                {alert.target_weight != null &&
                  ` (target: ${fmtPct(alert.target_weight)})`}
              </span>
              {alert.triggered_at && (
                <span className="ml-auto text-xs opacity-70">
                  {new Date(alert.triggered_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ── Rebalance Plan Modal ───────────────────────────────────────────────────────

interface RebalancePlanModalProps {
  open: boolean;
  onClose: () => void;
  positions: PositionAnalysis[];
}

function RebalancePlanModal({ open, onClose, positions }: RebalancePlanModalProps) {
  const trades = positions.filter(
    (p) => p.trade_action && p.trade_action !== "HOLD" && p.trade_qty,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5" />
            Rebalancing Plan
          </DialogTitle>
        </DialogHeader>

        {trades.length === 0 ? (
          <div className="py-8 text-center">
            <Minus className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-medium">Portfolio is within target bands</p>
            <p className="text-xs text-muted-foreground mt-1">
              No trades required at current weights.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Symbol</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Est. Price</TableHead>
                  <TableHead className="text-right">Est. Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((pos) => {
                  const isBuy = pos.trade_action === "BUY";
                  const estPrice =
                    pos.trade_value != null && pos.trade_qty
                      ? Math.abs(pos.trade_value) / pos.trade_qty
                      : pos.current_price;
                  return (
                    <TableRow key={pos.symbol} className="text-sm">
                      <TableCell className="font-mono font-semibold">
                        {pos.symbol}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold ${
                            isBuy
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {pos.trade_action}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pos.trade_qty}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        ₹{fmtINR(estPrice)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          isBuy
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {isBuy ? "+" : "-"}₹
                        {fmtINR(Math.abs(pos.trade_value ?? 0))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <p className="text-xs text-muted-foreground border-t pt-3 mt-2">
              These are recommendations only. Execute via your broker or use
              Paper Trading to simulate the plan.
            </p>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RebalancingPage() {
  const { id: portfolioId } = useParams<{ id: string }>();

  const analysis = useRebalancingAnalysis(portfolioId);
  const rulesQuery = useRebalancingRulesWorker(portfolioId);

  const [addingRule, setAddingRule] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  // Compute total allocated weight from rules
  const allocatedWeight = useMemo(() => {
    return (rulesQuery.data ?? []).reduce(
      (sum, r) => sum + (r.target_weight ?? 0),
      0,
    );
  }, [rulesQuery.data]);

  const unallocated = 100 - allocatedWeight;
  const overAllocated = allocatedWeight > 100;

  const positions = analysis.data?.positions ?? [];
  const positionsWithRules = positions.filter((p) => p.has_rule);
  const positionsNoRule = positions.filter((p) => !p.has_rule);
  const alerts = analysis.data?.alerts ?? [];
  const hasAlerts = alerts.length > 0;

  const isLoading = analysis.isPending || rulesQuery.isPending;
  const isError = analysis.isError || rulesQuery.isError;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Back nav */}
        <Link
          to={`/dashboard/markets/portfolios/${portfolioId}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to portfolio
        </Link>

        {/* Page header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Sliders className="h-6 w-6 text-primary" />
              Portfolio Rebalancing
            </h1>
            {analysis.data && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Total value: ₹{fmtINR(analysis.data.total_value)} &middot; as
                of{" "}
                {new Date(analysis.data.as_of).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <Button
            onClick={() => setPlanOpen(true)}
            disabled={isLoading || positions.length === 0}
          >
            <Sliders className="mr-2 h-4 w-4" />
            Rebalance
          </Button>
        </header>

        {/* Loading / Error */}
        {isLoading && <SkeletonCard withHeader lines={5} />}
        {isError && !isLoading && (
          <ErrorState
            title="Failed to load rebalancing data"
            message={
              (analysis.error as Error)?.message ??
              (rulesQuery.error as Error)?.message ??
              "Unknown error"
            }
            onRetry={() => {
              analysis.refetch();
              rulesQuery.refetch();
            }}
          />
        )}

        {!isLoading && !isError && (
          <>
            {/* ── Section 1: Allocation vs Target ──────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Current Allocation vs Target
                </CardTitle>
              </CardHeader>
              <CardContent>
                {positions.length === 0 ? (
                  <EmptyState
                    title="No positions found"
                    description="Add holdings to your portfolio to see allocation analysis."
                  />
                ) : (
                  <>
                    {positionsWithRules.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          Positions with rules
                        </p>
                        {positionsWithRules.map((pos) => (
                          <GaugeRow key={pos.symbol} pos={pos} />
                        ))}
                      </div>
                    )}

                    {positionsNoRule.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          Positions without rules
                        </p>
                        {positionsNoRule.map((pos) => (
                          <GaugeRow key={pos.symbol} pos={pos} />
                        ))}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t">
                      <GaugeLegend />
                    </div>

                    {analysis.data && (
                      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                        <span>
                          Unallocated:{" "}
                          <strong>{fmtPct(analysis.data.unallocated_weight)}</strong>
                        </span>
                        {analysis.data.drift_threshold_pct > 0 && (
                          <span>
                            Drift threshold:{" "}
                            <strong>{fmtPct(analysis.data.drift_threshold_pct)}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* ── Section 2: Rules Editor ───────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Target Weight Rules</CardTitle>
                  {!addingRule && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setAddingRule(true)}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add Symbol
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {rulesQuery.data?.length === 0 && !addingRule ? (
                  <div className="px-6 py-8">
                    <EmptyState
                      title="No rules yet"
                      description="Add target weight rules for symbols to enable rebalancing analysis."
                      actionLabel="Add Symbol"
                      onAction={() => setAddingRule(true)}
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>Symbol</TableHead>
                          <TableHead>Target %</TableHead>
                          <TableHead>Min %</TableHead>
                          <TableHead>Max %</TableHead>
                          <TableHead>Alerts</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(rulesQuery.data ?? []).map((rule) => (
                          <EditableRuleRow
                            key={rule.id}
                            rule={rule}
                            portfolioId={portfolioId ?? ""}
                          />
                        ))}
                        {addingRule && portfolioId && (
                          <AddRuleForm
                            portfolioId={portfolioId}
                            onDone={() => setAddingRule(false)}
                          />
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Weight total */}
                <div
                  className={`px-4 py-3 text-xs border-t flex items-center gap-2 ${
                    overAllocated ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                  }`}
                >
                  <span>
                    Total:{" "}
                    <strong>{fmtPct(allocatedWeight)}</strong> allocated
                    {unallocated > 0 && (
                      <span className="ml-2 text-muted-foreground">
                        ({fmtPct(unallocated)} unallocated)
                      </span>
                    )}
                  </span>
                  {overAllocated && (
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      Warning: total exceeds 100%!
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Section 3: Alerts ─────────────────────────────────────────── */}
            {hasAlerts && (
              <AlertsPanel
                alerts={alerts}
                portfolioId={portfolioId ?? ""}
                onAcknowledge={() => analysis.refetch()}
              />
            )}
          </>
        )}

        {/* Rebalancing plan modal */}
        <RebalancePlanModal
          open={planOpen}
          onClose={() => setPlanOpen(false)}
          positions={positions}
        />
      </div>
    </DashboardLayout>
  );
}
