/**
 * TradingModeToggle — segmented control for Novice / Expert trading modes.
 *
 * Novice  (blue)  — simplified, beginner-friendly.
 * Expert  (purple) — full feature set, advanced order types.
 *
 * Placed next to DarkModeToggle in the DashboardLayout header.
 */

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/design-system";
import { useTradingMode, type TradingMode } from "@/hooks/useTradingMode";

const MODE_CONFIG: Record<
  TradingMode,
  { label: string; activeClass: string; tooltip: string }
> = {
  novice: {
    label:       "Novice",
    activeClass: "bg-blue-600 text-white border-blue-600",
    tooltip:     "Simplified view — beginner-friendly layouts and guided hints",
  },
  expert: {
    label:       "Expert",
    activeClass: "bg-purple-600 text-white border-purple-600",
    tooltip:     "Full feature set — advanced order types, Greeks, all indicators",
  },
};

export function TradingModeToggle() {
  const [mode, setMode] = useTradingMode();

  return (
    <TooltipProvider>
      <div className="flex rounded-md border overflow-hidden text-xs font-semibold">
        {(["novice", "expert"] as TradingMode[]).map((m) => {
          const cfg    = MODE_CONFIG[m];
          const active = mode === m;
          return (
            <Tooltip key={m}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={active}
                  className={`px-2.5 py-1 transition-colors border-transparent ${
                    active
                      ? cfg.activeClass
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {cfg.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-center text-xs">
                {cfg.tooltip}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
