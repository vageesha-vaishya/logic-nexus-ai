/**
 * Markets — Economic Calendar page.
 *
 * Route: /dashboard/markets/calendar
 *
 * Layout:
 *   - Month navigation (prev/next)
 *   - Calendar grid (Mon–Sun, 7 cols) with event dots
 *   - Right panel: Upcoming Events list (next 10 events)
 *
 * Event type colors:
 *   rbi_mpc  → red
 *   earnings → blue
 *   macro    → amber
 *   holiday  → gray
 *   ipo      → purple
 */

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameMonth } from "date-fns";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  SkeletonCard,
} from "@/design-system";

import { useEconomicCalendar, type CalendarEvent, type EventType, type EventImportance } from "../hooks/useEconomicCalendar";

// ── Helpers ────────────────────────────────────────────────────────────────────

function eventTypeColor(type: EventType): string {
  switch (type) {
    case "rbi_mpc":  return "bg-red-500";
    case "earnings": return "bg-blue-500";
    case "macro":    return "bg-amber-500";
    case "holiday":  return "bg-gray-400";
    case "ipo":      return "bg-purple-500";
    default:         return "bg-gray-400";
  }
}

function eventTypeBadgeVariant(type: EventType): "destructive" | "default" | "secondary" | "outline" {
  switch (type) {
    case "rbi_mpc":  return "destructive";
    case "earnings": return "default";
    case "macro":    return "outline";
    default:         return "secondary";
  }
}

function eventTypeLabel(type: EventType): string {
  switch (type) {
    case "rbi_mpc":  return "RBI MPC";
    case "earnings": return "Earnings";
    case "macro":    return "Macro";
    case "holiday":  return "Holiday";
    case "ipo":      return "IPO";
    default:         return type;
  }
}

function importanceDotColor(importance: EventImportance): string {
  switch (importance) {
    case "high":   return "bg-red-500";
    case "medium": return "bg-amber-400";
    case "low":    return "bg-gray-400";
    default:       return "bg-gray-400";
  }
}

function groupEventsByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const map: Record<string, CalendarEvent[]> = {};
  for (const evt of events) {
    if (!map[evt.date]) map[evt.date] = [];
    map[evt.date].push(evt);
  }
  return map;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface EventCardProps {
  event: CalendarEvent;
}

function EventCard({ event }: EventCardProps) {
  return (
    <div className="border rounded-lg p-3 space-y-1 bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{event.title}</span>
        <Badge variant={eventTypeBadgeVariant(event.type)} className="shrink-0 text-xs">
          {eventTypeLabel(event.type)}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{format(new Date(event.date + "T00:00:00"), "EEE, MMM d, yyyy")}</p>
      {event.end_date && event.end_date !== event.date && (
        <p className="text-xs text-muted-foreground">
          — {format(new Date(event.end_date + "T00:00:00"), "EEE, MMM d")}
        </p>
      )}
      <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function EconomicCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch a window: current month - 1 to current month + 3 (to support prev nav)
  const windowFrom = format(subMonths(startOfMonth(currentMonth), 1), "yyyy-MM-dd");
  const windowTo   = format(endOfMonth(addMonths(currentMonth, 2)), "yyyy-MM-dd");

  const { data, isLoading, isError, error } = useEconomicCalendar(windowFrom, windowTo);

  const allEvents = data?.events ?? [];

  // Group events by ISO date string for the calendar grid
  const eventsByDate = useMemo(() => groupEventsByDate(allEvents), [allEvents]);

  // Build calendar grid days for current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Monday-first offset (getDay returns 0=Sun, so Mon=1..Sat=6,Sun=0)
  const startWeekday = getDay(monthStart); // 0=Sun
  const offset = startWeekday === 0 ? 6 : startWeekday - 1;

  // Upcoming 10 events from today
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcomingEvents = useMemo(
    () => allEvents.filter((e) => e.date >= todayStr).slice(0, 10),
    [allEvents, todayStr],
  );

  // Selected date events for detail popover
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Economic Calendar</h1>
            <p className="text-sm text-muted-foreground">
              RBI MPC meetings, macro data releases, earnings events
            </p>
          </div>
        </div>

        {isError && (
          <ErrorState
            title="Failed to load calendar"
            description={(error as Error)?.message}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Calendar Grid ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-3">
            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold text-base">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {isLoading ? (
              <SkeletonCard />
            ) : (
              <Card>
                <CardContent className="p-3">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {DAY_HEADERS.map((d) => (
                      <div
                        key={d}
                        className="text-center text-xs font-medium text-muted-foreground py-1"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                    {/* Leading empty cells */}
                    {Array.from({ length: offset }).map((_, i) => (
                      <div key={`empty-${i}`} className="bg-background min-h-[70px]" />
                    ))}

                    {daysInMonth.map((day) => {
                      const iso = format(day, "yyyy-MM-dd");
                      const dayEvents = eventsByDate[iso] ?? [];
                      const today = isToday(day);
                      const inMonth = isSameMonth(day, currentMonth);
                      const isSelected = selectedDate === iso;

                      return (
                        <button
                          key={iso}
                          onClick={() => setSelectedDate(isSelected ? null : iso)}
                          className={[
                            "bg-background min-h-[70px] p-1 text-left flex flex-col gap-0.5",
                            "hover:bg-accent/50 transition-colors",
                            today ? "ring-2 ring-inset ring-primary" : "",
                            isSelected ? "bg-accent" : "",
                            !inMonth ? "opacity-40" : "",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "text-xs font-medium self-end px-1",
                              today ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[11px]" : "",
                            ].join(" ")}
                          >
                            {format(day, "d")}
                          </span>

                          {/* Event dots — up to 3 visible */}
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {dayEvents.slice(0, 3).map((evt) => (
                              <span
                                key={evt.id}
                                className={[
                                  "w-1.5 h-1.5 rounded-full",
                                  importanceDotColor(evt.importance),
                                ].join(" ")}
                                title={evt.title}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[9px] text-muted-foreground">
                                +{dayEvents.length - 3}
                              </span>
                            )}
                          </div>

                          {/* Show first event title on larger cells */}
                          {dayEvents[0] && (
                            <span className="text-[9px] text-muted-foreground truncate w-full leading-tight hidden sm:block">
                              {dayEvents[0].title}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected date detail */}
            {selectedDate && selectedEvents.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {format(new Date(selectedDate + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedEvents.map((evt) => (
                    <EventCard key={evt.id} event={evt} />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Upcoming Events ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide px-1">
              Upcoming Events
            </h2>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : upcomingEvents.length === 0 ? (
              <EmptyState
                title="No upcoming events"
                description="No events found in the selected range."
              />
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((evt) => (
                  <EventCard key={evt.id} event={evt} />
                ))}
              </div>
            )}

            {/* Legend */}
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground uppercase">Legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {(["rbi_mpc", "earnings", "macro", "holiday"] as EventType[]).map((type) => (
                  <div key={type} className="flex items-center gap-2 text-xs">
                    <span className={["w-2 h-2 rounded-full", eventTypeColor(type)].join(" ")} />
                    <span>{eventTypeLabel(type)}</span>
                  </div>
                ))}
                <div className="border-t pt-1.5 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Importance dots:</p>
                  {(["high", "medium", "low"] as EventImportance[]).map((imp) => (
                    <div key={imp} className="flex items-center gap-2 text-xs">
                      <span className={["w-2 h-2 rounded-full", importanceDotColor(imp)].join(" ")} />
                      <span className="capitalize">{imp}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
