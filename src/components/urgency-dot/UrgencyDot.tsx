import { cn } from "@/lib/utils";

export type Urgency = "overdue" | "today" | "upcoming" | "none";

export interface UrgencyDotProps {
  urgency: Urgency;
  size?: "sm" | "md";
  srLabel?: string;
  className?: string;
}

const TONE: Record<Urgency, string> = {
  overdue: "bg-destructive",
  today: "bg-amber-500",
  upcoming: "bg-emerald-500",
  none: "bg-muted-foreground/40",
};

const DEFAULT_LABEL: Record<Urgency, string> = {
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Upcoming",
  none: "No activity scheduled",
};

export function UrgencyDot({
  urgency,
  size = "sm",
  srLabel,
  className,
}: UrgencyDotProps): JSX.Element {
  const dim = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <span
      role="img"
      aria-label={srLabel ?? DEFAULT_LABEL[urgency]}
      className={cn(
        "inline-block rounded-full shrink-0",
        dim,
        TONE[urgency],
        className,
      )}
      data-urgency={urgency}
    />
  );
}

export interface ComputeUrgencyOptions {
  now?: Date;
  upcomingWindowDays?: number;
}

/**
 * Maps a due-date to an urgency bucket. Pure function so callers stay testable.
 * - null/undefined → "none"
 * - past due → "overdue"
 * - same calendar day as `now` → "today"
 * - within `upcomingWindowDays` (default 7) → "upcoming"
 * - beyond window → "none"
 */
export function computeUrgency(
  dueDate: Date | string | null | undefined,
  options: ComputeUrgencyOptions = {},
): Urgency {
  if (!dueDate) return "none";
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(due.getTime())) return "none";

  const now = options.now ?? new Date();
  const upcomingWindowMs =
    (options.upcomingWindowDays ?? 7) * 24 * 60 * 60 * 1000;

  if (due.getTime() < now.getTime() && !isSameCalendarDay(due, now)) {
    return "overdue";
  }
  if (isSameCalendarDay(due, now)) return "today";
  if (due.getTime() - now.getTime() <= upcomingWindowMs) return "upcoming";
  return "none";
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
