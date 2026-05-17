/**
 * Markets — Risk Controls page.
 *
 * Route: /dashboard/markets/risk
 *
 * Kill switch, segment toggles, and daily-loss limit management.
 * Also shows when controls were last updated.
 */

import { ShieldAlert } from "lucide-react";
import { format } from "date-fns";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/design-system";

import { RiskControlsPanel } from "../components/RiskControlsPanel";
import { useRiskControls } from "../hooks/useRiskControls";

// ─── Last-updated card ────────────────────────────────────────────────────────

function LastUpdatedCard() {
  const { data: controls } = useRiskControls();

  if (!controls) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Last Updated
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Updated at</span>
            <span className="font-mono font-medium">
              {format(new Date(controls.updated_at), "dd MMM yyyy, HH:mm")}
            </span>
          </div>
          <div className="flex justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Kill switch</span>
            <span className={controls.kill_switch_active ? "font-semibold text-destructive" : "text-green-600 font-semibold"}>
              {controls.kill_switch_active ? "ACTIVE" : "Off"}
            </span>
          </div>
          <div className="flex justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Daily loss limit</span>
            <span className="font-mono font-medium">
              {controls.daily_loss_limit_inr != null
                ? `₹${Number(controls.daily_loss_limit_inr).toLocaleString("en-IN")}`
                : "No limit"}
            </span>
          </div>
          <div className="flex justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Max position</span>
            <span className="font-mono font-medium">
              {controls.max_position_pct}%
            </span>
          </div>
          <div className="flex justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Segments enabled</span>
            <span className="font-medium">
              {[
                controls.equity_enabled && "Equity",
                controls.fno_enabled    && "F&O",
                controls.mf_enabled     && "MF",
              ]
                .filter(Boolean)
                .join(", ") || "None"}
            </span>
          </div>
          {controls.kill_switch_reason && (
            <div className="sm:col-span-2 flex justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
              <span className="text-muted-foreground">Kill switch reason</span>
              <span className="font-medium text-right">{controls.kill_switch_reason}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RiskControlsPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Header */}
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldAlert className="h-6 w-6" />
            Risk Controls
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set a daily loss limit, disable trading segments, or trigger the master
            kill switch to halt all new orders immediately.
          </p>
        </header>

        <RiskControlsPanel />

        <LastUpdatedCard />
      </div>
    </DashboardLayout>
  );
}
