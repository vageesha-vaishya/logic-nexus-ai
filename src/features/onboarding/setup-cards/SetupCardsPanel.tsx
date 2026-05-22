/**
 * SetupCardsPanel — "Get set up" panel for the new-tenant Home dashboard.
 *
 * Renders the active task list from useSetupCards. Self-hides when:
 *   - the active membership is retail (Sthira has its own coach-marked tour)
 *   - the active membership has no domain (legacy users)
 *   - all visible cards are completed or dismissed (panel disappears)
 *
 * Auto-collapses after the user has completed half of the cards so it
 * stays out of the way of regular work but is one click away.
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useSetupCards, type SetupCardWithState } from "./useSetupCards";

const COLLAPSE_AT_PCT = 50;

export function SetupCardsPanel({ className }: { className?: string }) {
  const {
    cards,
    pendingCount,
    completedCount,
    progressPct,
    isLoading,
    isMutating,
    markComplete,
    dismiss,
    isB2B,
  } = useSetupCards();

  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse once the user is past the halfway mark, but only the
  // first time we cross the threshold — let the user override after.
  const [autoCollapseLatched, setAutoCollapseLatched] = useState(false);
  useEffect(() => {
    if (!autoCollapseLatched && progressPct >= COLLAPSE_AT_PCT && progressPct < 100) {
      setCollapsed(true);
      setAutoCollapseLatched(true);
    }
  }, [progressPct, autoCollapseLatched]);

  if (!isB2B) return null;
  if (isLoading) return null;
  if (cards.length === 0) return null;

  const visible = cards.filter((c) => c.status !== "dismissed");
  if (visible.length === 0) return null;

  const allDone = pendingCount === 0 && completedCount > 0;
  if (allDone) return null; // disappear once everything's completed

  return (
    <Card className={cn("border-primary/30 bg-primary/[0.02]", className)}>
      <CardContent className="space-y-4 p-4 md:p-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Get set up</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedCount} of {completedCount + pendingCount}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand setup panel" : "Collapse setup panel"}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </header>

        <Progress value={progressPct} className="h-1.5" />

        {!collapsed && (
          <ul className="space-y-2 pt-1">
            {visible.map((c) => (
              <SetupCardItem
                key={c.def.key}
                card={c}
                disabled={isMutating}
                onComplete={() => void markComplete(c.def.key)}
                onDismiss={() => void dismiss(c.def.key)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface ItemProps {
  card:        SetupCardWithState;
  disabled:    boolean;
  onComplete:  () => void;
  onDismiss:   () => void;
}

function SetupCardItem({ card, disabled, onComplete, onDismiss }: ItemProps) {
  const { def, status } = card;
  const Icon = def.icon;
  const done = status === "completed";

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 transition-opacity",
        done ? "bg-muted/40 opacity-60" : "bg-card",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 items-center justify-center rounded-md shrink-0",
          done ? "bg-primary/10 text-primary" : "bg-primary/15 text-primary",
        )}
      >
        {done
          ? <CheckCircle2 className="h-4 w-4" />
          : <Icon className="h-4 w-4" aria-hidden="true" />}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn("text-sm font-medium leading-tight", done && "line-through")}>
          {def.title}
        </p>
        <p className="text-xs leading-snug text-muted-foreground">{def.body}</p>
        {def.unlocks && !done && (
          <p className="text-[11px] text-muted-foreground/80">
            <span className="font-medium">Unlocks:</span> {def.unlocks}
          </p>
        )}

        {!done && (
          <div className="pt-1.5 flex flex-wrap items-center gap-2">
            {def.ctaTo ? (
              <Button asChild size="sm" disabled={disabled}>
                <Link to={def.ctaTo}>{def.ctaLabel}</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={onComplete} disabled={disabled}>
                {def.ctaLabel}
              </Button>
            )}
            {def.ctaTo && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onComplete}
                disabled={disabled}
                className="text-muted-foreground"
              >
                Mark done
              </Button>
            )}
          </div>
        )}
      </div>

      {!done && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label={`Dismiss ${def.title}`}
          onClick={onDismiss}
          disabled={disabled}
        >
          {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </Button>
      )}
    </li>
  );
}
