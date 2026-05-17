/**
 * PlanGate — Renders an upgrade prompt when the plan doesn't allow a feature.
 *
 * Modes:
 *   "hide"    — hide children completely, show only nudge card (default)
 *   "disable" — render children but disabled (pointer-events-none), nudge below
 *   "overlay" — render children with a semi-transparent lock card on top
 *   "inline"  — render children + small amber upgrade banner below
 *
 * While loading, always renders children as-is (fail open).
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

import { Button } from "@/design-system";
import { usePlanGate, type PlanFeature } from "@/hooks/usePlanGate";

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlanGateProps {
  feature:      PlanFeature;
  children:     React.ReactNode;
  mode?:        "hide" | "disable" | "overlay" | "inline";
  reason?:      string;
  upgradeText?: string;
}

// ── Upgrade nudge ─────────────────────────────────────────────────────────────

interface NudgeProps {
  reason?:      string;
  upgradeSlug?: string;
  upgradeText?: string;
}

function UpgradeNudge({ reason, upgradeSlug, upgradeText }: NudgeProps) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-sm">
      <Lock className="h-4 w-4 text-amber-600 shrink-0" />
      <span className="text-amber-800 dark:text-amber-300">
        {reason ?? "Upgrade your plan to unlock this feature"}
      </span>
      {upgradeSlug && (
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 text-xs border-amber-300"
          onClick={() => navigate("/dashboard/billing")}
        >
          {upgradeText ?? "Upgrade"}
        </Button>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlanGate({
  feature,
  children,
  mode = "hide",
  reason,
  upgradeText,
}: PlanGateProps) {
  const gate = usePlanGate(feature);

  // While loading, fail open — never block
  if (gate.isLoading || gate.allowed) {
    return <>{children}</>;
  }

  // Feature blocked — render based on mode
  const nudgeReason = reason ?? gate.reason;

  if (mode === "hide") {
    return (
      <UpgradeNudge
        reason={nudgeReason}
        upgradeSlug={gate.upgradeSlug}
        upgradeText={upgradeText}
      />
    );
  }

  if (mode === "disable") {
    return (
      <div className="space-y-2">
        <div className="pointer-events-none opacity-50 select-none">
          {children}
        </div>
        <UpgradeNudge
          reason={nudgeReason}
          upgradeSlug={gate.upgradeSlug}
          upgradeText={upgradeText}
        />
      </div>
    );
  }

  if (mode === "overlay") {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/80 backdrop-blur-sm">
          <div className="max-w-sm w-full px-4">
            <UpgradeNudge
              reason={nudgeReason}
              upgradeSlug={gate.upgradeSlug}
              upgradeText={upgradeText}
            />
          </div>
        </div>
      </div>
    );
  }

  // "inline"
  return (
    <div className="space-y-2">
      {children}
      <UpgradeNudge
        reason={nudgeReason}
        upgradeSlug={gate.upgradeSlug}
        upgradeText={upgradeText}
      />
    </div>
  );
}
