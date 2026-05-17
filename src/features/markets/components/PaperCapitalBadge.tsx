/**
 * PaperCapitalBadge — inline badge showing available paper cash for a portfolio.
 *
 * Shows: "Paper: ₹8,23,450 available" with a flask icon.
 * While loading: renders a skeleton.
 */

import { FlaskConical } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaperCapital } from "../hooks/usePaperTrading";

interface PaperCapitalBadgeProps {
  portfolioId: string;
}

function fmtINR(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function PaperCapitalBadge({ portfolioId }: PaperCapitalBadgeProps) {
  const { data, isPending, isError } = usePaperCapital(portfolioId);

  if (isPending) {
    return <Skeleton className="h-6 w-40 rounded-full" />;
  }

  if (isError) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300">
        <FlaskConical className="h-3 w-3" />
        Paper capital not seeded — open "Paper Trade" to start
      </span>
    );
  }

  if (!data) {
    return null;
  }

  const returnPositive = data.return_pct >= 0;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" />
      <span>
        Paper: ₹{fmtINR(data.available_cash)} available
      </span>
      {data.used_capital > 0 && (
        <span
          className={
            returnPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500 dark:text-red-400"
          }
        >
          ({returnPositive ? "+" : ""}
          {data.return_pct.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}
