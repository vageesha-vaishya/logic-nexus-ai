import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AllocationLine = {
  /** Stable identifier (ISIN, symbol, sleeve id). Used as React key. */
  id: string;
  label: string;
  /** Allocation as a percentage of the portfolio (0–100). */
  percent: number;
};

export type RebalanceDiff = {
  /** Allocation BEFORE the proposed rebalance. */
  from: AllocationLine[];
  /** Allocation AFTER the proposed rebalance. */
  to: AllocationLine[];
  /** Plain-language reason. Layman-readable. */
  reason: string;
  /**
   * If set, the rebalance auto-approves at this Date. Card shows a
   * countdown; user can approve early, deny, or pause.
   */
  autoApproveAt?: Date | string | null;
};

export interface RebalanceApprovalCardProps {
  rebalance: RebalanceDiff;
  onApprove: () => void;
  onDeny: () => void;
  onPause?: () => void;
  /** Disable all CTAs (e.g., while a mutation is in flight). */
  busy?: boolean;
  className?: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Approving now";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0
      ? `${days}d ${remainingHours}h`
      : `${days}d`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (totalMinutes > 0) return `${totalMinutes}m`;
  return "<1m";
}

function buildDiff(
  from: AllocationLine[],
  to: AllocationLine[],
): Array<{ id: string; label: string; from: number; to: number; delta: number }> {
  const fromMap = new Map(from.map((line) => [line.id, line]));
  const toMap = new Map(to.map((line) => [line.id, line]));
  const ids = new Set<string>([...fromMap.keys(), ...toMap.keys()]);
  return Array.from(ids)
    .map((id) => {
      const f = fromMap.get(id)?.percent ?? 0;
      const t = toMap.get(id)?.percent ?? 0;
      const label = toMap.get(id)?.label ?? fromMap.get(id)!.label;
      return { id, label, from: f, to: t, delta: t - f };
    })
    .filter((row) => Math.abs(row.delta) >= 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/**
 * Smallcase-pattern "approval moment" card for Tier-2 pre-authorised drift
 * rebalancing. Even when the underlying action is pre-authorised, the user
 * sees this card and either approves now or lets the timer auto-approve.
 * That visible approval moment is the trust contract that separates
 * advisory from discretionary trading.
 */
export function RebalanceApprovalCard({
  rebalance,
  onApprove,
  onDeny,
  onPause,
  busy = false,
  className,
}: RebalanceApprovalCardProps): JSX.Element {
  const autoApproveDate = useMemo(() => {
    if (!rebalance.autoApproveAt) return null;
    const d =
      rebalance.autoApproveAt instanceof Date
        ? rebalance.autoApproveAt
        : new Date(rebalance.autoApproveAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [rebalance.autoApproveAt]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!autoApproveDate) return;
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, [autoApproveDate]);

  const remainingMs = autoApproveDate ? autoApproveDate.getTime() - now : null;
  const diff = useMemo(
    () => buildDiff(rebalance.from, rebalance.to),
    [rebalance.from, rebalance.to],
  );

  return (
    <Card
      className={cn(
        "border-amber-200 dark:border-amber-900/50",
        className,
      )}
      data-testid="rebalance-approval-card"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-amber-600" aria-hidden="true" />
          Rebalance ready for your approval
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{rebalance.reason}</p>

        <div className="rounded-md border bg-muted/30">
          <p className="border-b px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            Proposed changes
          </p>
          {diff.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No allocation changes.
            </p>
          ) : (
            <ul className="divide-y" role="list">
              {diff.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">
                    {row.label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <span className="text-muted-foreground">
                      {row.from.toFixed(1)}%
                    </span>
                    <ArrowRight
                      className="h-3 w-3 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="font-semibold">{row.to.toFixed(1)}%</span>
                    <span
                      className={cn(
                        "ml-1 text-xs",
                        row.delta > 0
                          ? "text-emerald-600"
                          : "text-red-600",
                      )}
                    >
                      {row.delta > 0 ? "+" : ""}
                      {row.delta.toFixed(1)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {remainingMs != null && (
          <p
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Auto-approves in <span className="font-medium tabular-nums">{formatRemaining(remainingMs)}</span>.
            You can approve now, deny, or pause this cycle.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onApprove} disabled={busy}>
            Approve now
          </Button>
          <Button variant="outline" onClick={onDeny} disabled={busy}>
            Deny
          </Button>
          {onPause && (
            <Button variant="ghost" onClick={onPause} disabled={busy}>
              Pause this cycle
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
