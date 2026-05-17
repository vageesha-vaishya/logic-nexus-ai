/**
 * RiskControlsPanel
 *
 * Settings panel for markets risk controls:
 *   - Master kill switch
 *   - Per-segment toggles (Equity / F&O / MF)
 *   - Daily loss limit (₹)
 *   - Max single-position size (% of portfolio)
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ShieldAlert, ShieldOff, Loader2 } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  SkeletonCard,
  Alert,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/design-system";

import { useRiskControls, useUpsertRiskControls } from "../hooks/useRiskControls";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LimitFormValues {
  daily_loss_limit_inr: string;
  max_position_pct: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RiskControlsPanel({ portfolioId }: { portfolioId?: string }) {
  const { data: controls, isPending, isError, error } = useRiskControls(portfolioId);
  const upsert = useUpsertRiskControls();

  // Kill-switch confirmation dialog state
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [killReason, setKillReason] = useState("");

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<LimitFormValues>({
    defaultValues: { daily_loss_limit_inr: "", max_position_pct: "10" },
  });

  // Sync form to loaded controls
  useEffect(() => {
    if (controls) {
      reset({
        daily_loss_limit_inr: controls.daily_loss_limit_inr != null
          ? String(controls.daily_loss_limit_inr)
          : "",
        max_position_pct: controls.max_position_pct != null
          ? String(controls.max_position_pct)
          : "10",
      });
    }
  }, [controls, reset]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function basePayload() {
    return {
      portfolio_id: portfolioId ?? null,
      // preserve existing values as defaults
      equity_enabled: controls?.equity_enabled ?? true,
      fno_enabled:    controls?.fno_enabled    ?? true,
      mf_enabled:     controls?.mf_enabled     ?? true,
      kill_switch_active: controls?.kill_switch_active ?? false,
      kill_switch_reason: controls?.kill_switch_reason ?? null,
      daily_loss_limit_inr: controls?.daily_loss_limit_inr ?? null,
      max_position_pct: controls?.max_position_pct ?? 10,
    };
  }

  function toggleSegment(field: "equity_enabled" | "fno_enabled" | "mf_enabled", value: boolean) {
    upsert.mutate(
      { ...basePayload(), [field]: value },
      {
        onSuccess: () => toast.success("Segment setting saved"),
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function onKillSwitchToggle(checked: boolean) {
    if (checked) {
      // Activating — need confirmation + reason
      setKillReason("");
      setKillConfirmOpen(true);
    } else {
      // Deactivating — immediate
      upsert.mutate(
        { ...basePayload(), kill_switch_active: false, kill_switch_reason: null },
        {
          onSuccess: () => toast.success("Kill switch deactivated — trading resumed"),
          onError: (err) => toast.error(err.message),
        }
      );
    }
  }

  function confirmKillSwitch() {
    upsert.mutate(
      {
        ...basePayload(),
        kill_switch_active: true,
        kill_switch_reason: killReason.trim() || "Manually activated",
      },
      {
        onSuccess: () => {
          setKillConfirmOpen(false);
          toast.warning("Kill switch activated — all new orders blocked");
        },
        onError: (err) => {
          toast.error(err.message);
          setKillConfirmOpen(false);
        },
      }
    );
  }

  function onSaveLimits(values: LimitFormValues) {
    const daily = values.daily_loss_limit_inr.trim()
      ? parseFloat(values.daily_loss_limit_inr)
      : null;
    const maxPct = parseFloat(values.max_position_pct) || 10;

    if (daily !== null && (isNaN(daily) || daily <= 0)) {
      toast.error("Daily loss limit must be a positive number");
      return;
    }
    if (isNaN(maxPct) || maxPct <= 0 || maxPct > 100) {
      toast.error("Max position size must be between 1 and 100");
      return;
    }

    upsert.mutate(
      { ...basePayload(), daily_loss_limit_inr: daily, max_position_pct: maxPct },
      {
        onSuccess: () => {
          toast.success("Limits saved");
          reset(values); // clear dirty state
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (isPending) {
    return <SkeletonCard withHeader lines={4} />;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load risk controls: {error?.message}
        </AlertDescription>
      </Alert>
    );
  }

  // Use sensible defaults if no record yet
  const ctrl = controls ?? {
    kill_switch_active: false,
    kill_switch_reason: null,
    equity_enabled:     true,
    fno_enabled:        true,
    mf_enabled:         true,
  };

  const isKillActive = ctrl.kill_switch_active;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Kill-switch confirmation dialog */}
      <Dialog open={killConfirmOpen} onOpenChange={setKillConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" />
              Stop all trading?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will prevent any new orders until you disable the kill switch.
              Existing open positions are not affected.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="kill-reason">Reason (optional)</Label>
              <Input
                id="kill-reason"
                placeholder="e.g. High volatility — pausing manually"
                value={killReason}
                onChange={(e) => setKillReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setKillConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmKillSwitch}
              disabled={upsert.isPending}
            >
              {upsert.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldOff className="mr-2 h-4 w-4" />
              )}
              Halt Trading
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            Risk Controls
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Kill switch active banner */}
          {isKillActive && (
            <Alert variant="destructive" className="border-destructive bg-destructive/10">
              <ShieldOff className="h-4 w-4" />
              <AlertDescription className="font-semibold">
                TRADING HALTED — Kill switch is active. All new orders are blocked.
                {ctrl.kill_switch_reason && (
                  <span className="block mt-0.5 font-normal text-xs opacity-80">
                    Reason: {ctrl.kill_switch_reason}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* ── Kill switch toggle ────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <ShieldOff className="h-4 w-4 text-destructive" />
                Kill Switch
              </div>
              <p className="text-sm text-muted-foreground">
                Halts all new orders immediately
              </p>
            </div>
            <Switch
              checked={isKillActive}
              onCheckedChange={onKillSwitchToggle}
              disabled={upsert.isPending}
              className={isKillActive ? "data-[state=checked]:bg-destructive" : ""}
            />
          </div>

          {/* ── Segment controls ──────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Segment Controls
            </p>

            <div className="flex items-center justify-between rounded-md border px-4 py-3">
              <Label htmlFor="equity-toggle" className="cursor-pointer font-medium">
                Equity trading
              </Label>
              <Switch
                id="equity-toggle"
                checked={ctrl.equity_enabled}
                onCheckedChange={(v) => toggleSegment("equity_enabled", v)}
                disabled={upsert.isPending}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-4 py-3">
              <Label htmlFor="fno-toggle" className="cursor-pointer font-medium">
                F&amp;O trading
              </Label>
              <Switch
                id="fno-toggle"
                checked={ctrl.fno_enabled}
                onCheckedChange={(v) => toggleSegment("fno_enabled", v)}
                disabled={upsert.isPending}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-4 py-3">
              <Label htmlFor="mf-toggle" className="cursor-pointer font-medium">
                Mutual Funds
              </Label>
              <Switch
                id="mf-toggle"
                checked={ctrl.mf_enabled}
                onCheckedChange={(v) => toggleSegment("mf_enabled", v)}
                disabled={upsert.isPending}
              />
            </div>
          </div>

          {/* ── Loss limits form ──────────────────────────────────────────── */}
          <form onSubmit={handleSubmit(onSaveLimits)} className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Loss Limits
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="daily-loss">Daily loss limit</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground text-sm">
                    ₹
                  </span>
                  <Input
                    id="daily-loss"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="No limit"
                    className="pl-7"
                    {...register("daily_loss_limit_inr")}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Leave blank for no limit
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max-pos">Max position size</Label>
                <div className="relative">
                  <Input
                    id="max-pos"
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    className="pr-8"
                    {...register("max_position_pct")}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground text-sm">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  % of total portfolio value
                </p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={upsert.isPending || !isDirty}
              className="w-full sm:w-auto"
            >
              {upsert.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
