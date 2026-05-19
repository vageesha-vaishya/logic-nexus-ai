import { Target } from "lucide-react";

import { useRiskProfile } from "../hooks/useRiskProfile";

/**
 * Goals tab — stub for Phase 1 Addendum tasks T8b (goal calculator + inflation)
 * and T7 extensions (target SIP / lumpsum solver). Until those land we just
 * surface the goal list captured during onboarding so the user can verify
 * what was saved.
 */
export default function RetailGoalsPage() {
  const { data: profile } = useRiskProfile();
  const goals = profile?.goals ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <header>
        <h2 className="text-lg font-semibold">Goals</h2>
        <p className="text-xs text-muted-foreground">
          What you&apos;re investing for. Inflation-adjusted projections coming
          in a later release.
        </p>
      </header>

      {goals.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No goals selected during onboarding. You can update them from More →
          Settings.
        </div>
      ) : (
        <ul className="space-y-2">
          {goals.map((g) => (
            <li
              key={g.goal}
              className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="capitalize">{g.goal.replace(/_/g, " ")}</span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {g.years}y
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
