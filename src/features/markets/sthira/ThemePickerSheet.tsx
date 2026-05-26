/**
 * ThemePickerSheet — bottom sheet that lets the user pick one of the 4
 * Sthira palettes. Tap a card → applies + persists + closes the sheet.
 *
 * Swatches are inline hex (not tokens) so each card always previews its
 * own palette, regardless of which theme is currently active.
 */
import { Check } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { STHIRA_THEMES, type SthiraThemeId } from "./themes";
import { useSthiraTheme } from "./useSthiraTheme";

interface ThemePickerSheetProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemePickerSheet({ open, onOpenChange }: ThemePickerSheetProps) {
  const { theme, setTheme } = useSthiraTheme();

  const handlePick = (id: SthiraThemeId) => {
    setTheme(id);
    // Brief delay so the user sees the new palette apply before the sheet
    // animates away — feels more responsive than instant dismissal.
    window.setTimeout(() => onOpenChange(false), 200);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Appearance</SheetTitle>
          <SheetDescription>
            Choose a theme. Changes apply across the Sthira app and persist
            on this device.
          </SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3 pt-4 pb-2">
          {STHIRA_THEMES.map((t) => {
            const active = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handlePick(t.id)}
                className={cn(
                  "group relative flex flex-col gap-3 rounded-xl border p-3 text-left",
                  "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-foreground" : "border-border hover:border-foreground/40",
                )}
                aria-pressed={active}
              >
                <div
                  className="flex h-20 items-end overflow-hidden rounded-lg p-3"
                  style={{ backgroundColor: t.swatches.background, color: t.swatches.ink }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-6 w-6 rounded-full border border-black/10"
                      style={{ backgroundColor: t.swatches.accent }}
                      aria-hidden="true"
                    />
                    <span
                      className="text-xl font-semibold leading-none"
                      style={{ fontFamily: "var(--font-sthira-serif, ui-serif, Georgia, serif)" }}
                    >
                      Aa
                    </span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t.name}</span>
                    {active && <Check className="h-4 w-4 text-foreground" aria-hidden="true" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
