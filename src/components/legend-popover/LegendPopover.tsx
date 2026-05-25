import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type LegendItem = {
  /** Stable identifier (used as React key + data attribute). */
  id: string;
  /** Visual swatch shown to the left of the label — colored dot, pill, icon, etc. */
  swatch: React.ReactNode;
  /** Short label (e.g. "P1 — Critical"). */
  label: string;
  /** Optional one-line explanation (e.g. "Aircraft on-ground; immediate action"). */
  description?: string;
};

export type LegendSection = {
  /** Section heading (e.g. "Status", "Priority"). */
  title: string;
  items: LegendItem[];
};

export interface LegendPopoverProps {
  /** One or more named sections. Single-section is the common case. */
  sections: LegendSection[];
  /** Trigger label. Defaults to "Legend". */
  triggerLabel?: string;
  /**
   * When provided, replaces the default outline help-icon trigger. Must be a
   * focusable element (Button, anchor) so keyboard users can open the popover.
   */
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * Inline color-key for status/priority/urgency badges. Solves the audit's
 * cross-cutting #5: "Color-coded semantics (status badges, priority labels)
 * lack visible legends" — new users had to learn the color mapping by trial.
 *
 * Place beside the grid title or table header. Supports multiple sections so
 * a single popover can document Status + Priority together.
 */
export function LegendPopover({
  sections,
  triggerLabel = "Legend",
  trigger,
  align = "end",
  className,
}: LegendPopoverProps): JSX.Element {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              className,
            )}
            aria-label={`${triggerLabel} — open guide`}
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {triggerLabel}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80" data-testid="legend-popover">
        <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <ul className="space-y-2" role="list">
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2.5 text-sm"
                    data-legend-id={item.id}
                  >
                    <span className="mt-0.5 shrink-0">{item.swatch}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{item.label}</p>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
