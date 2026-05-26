/**
 * ActivePortfolioPicker — small Select dropdown for switching the
 * currently-viewed portfolio. Hides itself when the user owns ≤ 1
 * portfolio (no point picking from a list of one).
 *
 * Backed by useActivePortfolio() which persists the choice in
 * localStorage so it survives page reloads within the same browser /
 * mobile WebView session.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";

import { useActivePortfolio } from "../hooks/useActivePortfolio";

export interface ActivePortfolioPickerProps {
  /** Tailwind classes applied to the trigger. */
  className?: string;
  /** When true (default), renders nothing if user has only one portfolio. */
  hideWhenSingle?: boolean;
}

export function ActivePortfolioPicker({
  className,
  hideWhenSingle = true,
}: ActivePortfolioPickerProps) {
  const { portfolios, activePortfolioId, setActivePortfolioId, hasMultiple } =
    useActivePortfolio();

  if (hideWhenSingle && !hasMultiple) return null;
  if (portfolios.length === 0) return null;

  return (
    <Select
      value={activePortfolioId ?? undefined}
      onValueChange={(v) => setActivePortfolioId(v)}
    >
      <SelectTrigger className={className ?? "h-7 text-xs w-auto min-w-[140px]"}>
        <SelectValue placeholder="Pick portfolio" />
      </SelectTrigger>
      <SelectContent>
        {portfolios.map((p) => (
          <SelectItem key={p.id} value={p.id} className="text-xs">
            <span className="flex items-center gap-1.5">
              <span className="truncate">{p.name}</span>
              {p.mode === "paper" && (
                <span className="text-[9px] text-amber-600">paper</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
