/**
 * RebalancingRulesPanel — Configure and monitor portfolio weight bounds.
 *
 * Shows each holding with its rule (target %, min/max band) and current
 * weight, with a visual bar and ON TARGET / OVER / UNDER status badge.
 * Also surfaces triggered rebalancing alerts.
 */

import { useState } from "react";
import { Plus, Trash2, Bell, BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Label,
  Switch,
  EmptyState,
  SkeletonCard,
} from "@/design-system";

import type { HoldingWithPrice } from "../types";
import {
  useRebalancingRules,
  useUpsertRebalancingRule,
  useDeleteRebalancingRule,
  useRebalancingAlerts,
  useAcknowledgeAlert,
  type RebalancingRule,
  type RebalancingAlert,
} from "../hooks/useRebalancing";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(1) + "%";
}

// ── WeightBar ─────────────────────────────────────────────────────────────────

interface WeightBarProps {
  current:   number;   // current weight %
  min:       number;
  max:       number;
  target:    number;
}

function WeightBar({ current, min, max, target }: WeightBarProps) {
  // Map weights into [0, 100] display space using a ±50% buffer around [min,max]
  const lo    = Math.max(0,   min   - (max - min) * 0.5);
  const hi    = Math.min(100, max   + (max - min) * 0.5);
  const range = hi - lo || 1;

  const toPct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / range) * 100));

  const targetPos  = toPct(target);
  const minPos     = toPct(min);
  const maxPos     = toPct(max);
  const currentPos = toPct(current);

  const isOver  = current > max;
  const isUnder = current < min;
  const dotColor = isOver
    ? "bg-red-500"
    : isUnder
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div className="relative h-3 rounded-full bg-muted overflow-visible mx-1 my-1">
      {/* Green zone: min → max */}
      <div
        className="absolute top-0 h-full rounded-full bg-emerald-200 dark:bg-emerald-900/50"
        style={{ left: `${minPos}%`, width: `${Math.max(0, maxPos - minPos)}%` }}
      />
      {/* Target line */}
      <div
        className="absolute top-[-2px] bottom-[-2px] w-px bg-emerald-600 dark:bg-emerald-400"
        style={{ left: `${targetPos}%` }}
      />
      {/* Current position dot */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-white dark:border-background shadow ${dotColor}`}
        style={{ left: `calc(${currentPos}% - 6px)` }}
        title={`Current: ${fmtPct(current)}`}
      />
    </div>
  );
}

// ── Inline Add/Edit form ──────────────────────────────────────────────────────

interface RuleFormProps {
  portfolioId:  string;
  instrumentId: string;
  symbol:       string;
  existing?:    RebalancingRule;
  onDone:       () => void;
}

function RuleForm({ portfolioId, instrumentId, symbol, existing, onDone }: RuleFormProps) {
  const upsert = useUpsertRebalancingRule();

  const [target,       setTarget]       = useState(String(existing?.target_weight ?? ""));
  const [min,          setMin]          = useState(String(existing?.min_weight ?? ""));
  const [max,          setMax]          = useState(String(existing?.max_weight ?? ""));
  const [alertEnabled, setAlertEnabled] = useState(existing?.alert_enabled ?? true);

  async function handleSave() {
    const t = Number(target);
    const lo = Number(min) || (t - 2);
    const hi = Number(max) || (t + 2);

    if (!t || t <= 0 || t > 100) {
      toast.error("Target weight must be between 0 and 100.");
      return;
    }

    try {
      await upsert.mutateAsync({
        portfolio_id:  portfolioId,
        instrument_id: instrumentId,
        symbol,
        target_weight: t,
        min_weight:    lo,
        max_weight:    hi,
        alert_enabled: alertEnabled,
      });
      toast.success(`Rule saved for ${symbol}`);
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save rule");
    }
  }

  return (
    <div className="space-y-3 pt-2 pb-1">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Target %</Label>
          <Input
            type="number" min={0} max={100} step={0.5} placeholder="10"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              const t = Number(e.target.value);
              if (t > 0 && !existing) {
                setMin(String((t - 2).toFixed(1)));
                setMax(String((t + 2).toFixed(1)));
              }
            }}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Min %</Label>
          <Input
            type="number" min={0} max={100} step={0.5} placeholder="8"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max %</Label>
          <Input
            type="number" min={0} max={100} step={0.5} placeholder="12"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id={`alert-${instrumentId}`}
          checked={alertEnabled}
          onCheckedChange={setAlertEnabled}
        />
        <Label htmlFor={`alert-${instrumentId}`} className="text-xs cursor-pointer">
          Alert when out of band
        </Label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={upsert.isPending} className="h-7 text-xs">
          {upsert.isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="h-7 text-xs">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── AlertBanner ───────────────────────────────────────────────────────────────

function AlertBanner({ alert, portfolioId }: { alert: RebalancingAlert; portfolioId: string }) {
  const ack = useAcknowledgeAlert();

  return (
    <div className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs border ${
      alert.direction === "over"
        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
    }`}>
      <span className="font-mono font-semibold">{alert.symbol}</span>
      <span>
        {alert.direction === "over" ? "overweight" : "underweight"} at {fmtPct(alert.current_weight)}
        {alert.target_weight != null && ` (target: ${fmtPct(alert.target_weight)})`}
      </span>
      <button
        type="button"
        className="ml-auto flex items-center gap-1 opacity-60 hover:opacity-100"
        onClick={() => ack.mutate({ alertId: alert.id, portfolioId })}
        aria-label="Acknowledge alert"
      >
        <CheckCheck className="h-3.5 w-3.5" />
        Dismiss
      </button>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface RebalancingRulesPanelProps {
  portfolioId: string;
  holdings:    HoldingWithPrice[];
}

export function RebalancingRulesPanel({ portfolioId, holdings }: RebalancingRulesPanelProps) {
  const rules      = useRebalancingRules(portfolioId);
  const alerts     = useRebalancingAlerts(portfolioId);
  const deleteRule = useDeleteRebalancingRule();
  const upsert     = useUpsertRebalancingRule();

  // Track which holding is in "add rule" edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  // Total portfolio value (using last_price, fallback to avg_cost)
  const totalValue = holdings.reduce(
    (sum, h) => sum + h.qty * (h.last_price ?? h.avg_cost),
    0,
  );

  if (rules.isPending) return <SkeletonCard lines={4} />;
  if (rules.isError)   return (
    <p className="text-sm text-destructive">Failed to load rules: {rules.error?.message}</p>
  );

  const ruleMap = new Map<string, RebalancingRule>(
    (rules.data ?? []).map((r) => [r.instrument_id ?? "", r]),
  );

  const activeAlerts = (alerts.data ?? []).filter((a) => !a.acknowledged);

  async function handleToggleAlert(rule: RebalancingRule) {
    try {
      await upsert.mutateAsync({
        portfolio_id:  rule.portfolio_id,
        instrument_id: rule.instrument_id ?? "",
        symbol:        rule.symbol ?? "",
        target_weight: rule.target_weight ?? 0,
        min_weight:    rule.min_weight ?? 0,
        max_weight:    rule.max_weight ?? 100,
        alert_enabled: !rule.alert_enabled,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update rule");
    }
  }

  async function handleDelete(rule: RebalancingRule) {
    try {
      await deleteRule.mutateAsync({ ruleId: rule.id, portfolioId });
      toast.success(`Rule removed for ${rule.symbol}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete rule");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Rebalancing Rules</h2>
          <p className="text-xs text-muted-foreground">
            Configure target weights and get alerts when positions drift out of band.
          </p>
        </div>
      </div>

      {/* Active alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Triggered Alerts ({activeAlerts.length})
          </p>
          {activeAlerts.map((a) => (
            <AlertBanner key={a.id} alert={a} portfolioId={portfolioId} />
          ))}
        </div>
      )}

      {/* Holdings list */}
      {holdings.length === 0 ? (
        <EmptyState
          title="No holdings yet"
          description="Add holdings to your portfolio to configure rebalancing rules."
        />
      ) : (
        <div className="space-y-2">
          {holdings.map((h) => {
            const symbol  = h.instrument?.symbol ?? "—";
            const instId  = h.instrument_id;
            const rule    = ruleMap.get(instId);
            const hValue  = h.qty * (h.last_price ?? h.avg_cost);
            const weight  = totalValue > 0 ? (hValue / totalValue) * 100 : 0;
            const isEditing = editingId === instId;

            let status: "on_target" | "over" | "under" = "on_target";
            if (rule) {
              if (rule.max_weight != null && weight > rule.max_weight)        status = "over";
              else if (rule.min_weight != null && weight < rule.min_weight)   status = "under";
            }

            return (
              <Card key={h.id} className="overflow-hidden">
                <CardContent className="p-3 space-y-2">
                  {/* Row: symbol + weight + status + actions */}
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold w-24 truncate">{symbol}</span>

                    <div className="text-xs tabular-nums text-muted-foreground">
                      {fmtPct(weight)}
                    </div>

                    {rule && (
                      <div className="text-xs text-muted-foreground">
                        <span className="text-muted-foreground/60">target</span>{" "}
                        {fmtPct(rule.target_weight)}
                        <span className="mx-1 text-muted-foreground/40">|</span>
                        {fmtPct(rule.min_weight)}–{fmtPct(rule.max_weight)}
                      </div>
                    )}

                    <div className="ml-auto flex items-center gap-1.5">
                      {rule && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            status === "over"
                              ? "border-red-300 text-red-600 bg-red-50 dark:bg-red-900/20"
                              : status === "under"
                                ? "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-900/20"
                                : "border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                          }`}
                        >
                          {status === "over" ? "OVER" : status === "under" ? "UNDER" : "ON TARGET"}
                        </Badge>
                      )}

                      {rule ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleAlert(rule)}
                            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title={rule.alert_enabled ? "Disable alert" : "Enable alert"}
                            aria-label={rule.alert_enabled ? "Disable alert" : "Enable alert"}
                          >
                            {rule.alert_enabled
                              ? <Bell className="h-3.5 w-3.5" />
                              : <BellOff className="h-3.5 w-3.5" />
                            }
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(isEditing ? null : instId)}
                            className="rounded p-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label="Edit rule"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(rule)}
                            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted"
                            aria-label="Delete rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingId(isEditing ? null : instId)}
                          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
                        >
                          <Plus className="h-3 w-3" />
                          Add rule
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual weight bar (only when rule is configured) */}
                  {rule && rule.target_weight != null && rule.min_weight != null && rule.max_weight != null && (
                    <WeightBar
                      current={weight}
                      min={rule.min_weight}
                      max={rule.max_weight}
                      target={rule.target_weight}
                    />
                  )}

                  {/* Add / edit form (inline) */}
                  {isEditing && (
                    <RuleForm
                      portfolioId={portfolioId}
                      instrumentId={instId}
                      symbol={symbol}
                      existing={rule}
                      onDone={() => setEditingId(null)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {holdings.length > 0 && (
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Weight bar legend
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded bg-emerald-200 dark:bg-emerald-900/50" />
                Min–Max band
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-px bg-emerald-600" />
                Target
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                On target
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                Over
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                Under
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
