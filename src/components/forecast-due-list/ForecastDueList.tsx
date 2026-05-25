import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UrgencyDot, computeUrgency } from "@/components/urgency-dot";
import { cn } from "@/lib/utils";

export type ForecastHorizon = "7d" | "14d" | "30d" | "90d" | "all";

const HORIZON_DAYS: Record<Exclude<ForecastHorizon, "all">, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
};

const HORIZON_LABEL: Record<ForecastHorizon, string> = {
  "7d": "Next 7 days",
  "14d": "Next 14 days",
  "30d": "Next 30 days",
  "90d": "Next 90 days",
  all: "All upcoming",
};

export type ForecastItem = {
  id: string;
  label: string;
  sublabel?: string;
  /** Required for forecasting. Caller should filter out null due-dates upstream. */
  dueDate: string | Date;
  groupKey?: string;
  groupLabel?: string;
  badge?: React.ReactNode;
};

export interface ForecastDueListProps {
  items: ForecastItem[];
  horizon?: ForecastHorizon;
  onHorizonChange?: (next: ForecastHorizon) => void;
  groupBy?: "none" | "group";
  onItemClick?: (item: ForecastItem) => void;
  title?: string;
  emptyMessage?: string;
  className?: string;
  now?: Date;
}

function relativeDueLabel(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const days = Math.round(ms / oneDay);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 14) return `In ${days}d`;
  if (days < 60) return `In ${Math.round(days / 7)}w`;
  return due.toLocaleDateString();
}

export function ForecastDueList({
  items,
  horizon = "30d",
  onHorizonChange,
  groupBy = "none",
  onItemClick,
  title = "Items coming due",
  emptyMessage,
  className,
  now,
}: ForecastDueListProps): JSX.Element {
  const reference = now ?? new Date();

  const filtered = useMemo(() => {
    const horizonMs =
      horizon === "all"
        ? Number.POSITIVE_INFINITY
        : HORIZON_DAYS[horizon] * 24 * 60 * 60 * 1000;
    const cutoff = reference.getTime() + horizonMs;
    return items
      .map((item) => {
        const due =
          item.dueDate instanceof Date ? item.dueDate : new Date(item.dueDate);
        return { item, due, valid: !Number.isNaN(due.getTime()) };
      })
      .filter(({ valid, due }) => {
        if (!valid) return false;
        // Always include overdue items regardless of horizon.
        if (due.getTime() < reference.getTime()) return true;
        return due.getTime() <= cutoff;
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [items, horizon, reference]);

  const grouped = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "__all__", label: null, rows: filtered }];
    }
    const map = new Map<
      string,
      { key: string; label: string | null; rows: typeof filtered }
    >();
    for (const entry of filtered) {
      const key = entry.item.groupKey ?? "__ungrouped__";
      const label = entry.item.groupLabel ?? entry.item.groupKey ?? "Other";
      if (!map.has(key)) map.set(key, { key, label, rows: [] });
      map.get(key)!.rows.push(entry);
    }
    return Array.from(map.values());
  }, [filtered, groupBy]);

  const overdueCount = filtered.filter(
    ({ due }) => due.getTime() < reference.getTime(),
  ).length;

  return (
    <section
      className={cn("rounded-md border bg-card", className)}
      data-testid="forecast-due-list"
      aria-label={title}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
            {overdueCount > 0 && (
              <>
                {" · "}
                <span className="text-destructive font-medium">
                  {overdueCount} overdue
                </span>
              </>
            )}
          </p>
        </div>
        <Select
          value={horizon}
          onValueChange={(value) =>
            onHorizonChange?.(value as ForecastHorizon)
          }
          disabled={!onHorizonChange}
        >
          <SelectTrigger
            className="h-8 w-[160px] text-xs"
            aria-label="Forecast horizon"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(HORIZON_LABEL) as ForecastHorizon[]).map((key) => (
              <SelectItem key={key} value={key}>
                {HORIZON_LABEL[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {filtered.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {emptyMessage ?? "Nothing coming due in this window."}
        </p>
      ) : (
        <ul className="divide-y" role="list">
          {grouped.map((group) => (
            <li key={group.key}>
              {group.label && (
                <p className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              <ul className="divide-y" role="list">
                {group.rows.map(({ item, due }) => {
                  const urgency = computeUrgency(due, { now: reference });
                  const interactive = Boolean(onItemClick);
                  const Wrapper: keyof JSX.IntrinsicElements = interactive
                    ? "button"
                    : "div";
                  return (
                    <li key={item.id}>
                      <Wrapper
                        type={interactive ? "button" : undefined}
                        onClick={
                          interactive ? () => onItemClick?.(item) : undefined
                        }
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left",
                          interactive &&
                            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                        )}
                      >
                        <UrgencyDot urgency={urgency} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.label}
                          </p>
                          {item.sublabel && (
                            <p className="truncate text-xs text-muted-foreground">
                              {item.sublabel}
                            </p>
                          )}
                        </div>
                        {item.badge && (
                          <span className="shrink-0">{item.badge}</span>
                        )}
                        <span
                          className={cn(
                            "shrink-0 text-xs tabular-nums",
                            urgency === "overdue"
                              ? "text-destructive font-medium"
                              : "text-muted-foreground",
                          )}
                        >
                          {relativeDueLabel(due, reference)}
                        </span>
                      </Wrapper>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
