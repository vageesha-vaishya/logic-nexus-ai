import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/design-system";

export default function BacktestsPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Backtests
            </h1>
            <p className="text-sm text-muted-foreground">
              Run and review historical simulations of your strategies using portfolio data.
            </p>
          </div>
        </header>

        <EmptyState
          title="No backtests yet"
          description="Backtests simulate strategy performance on historical data. Results include CAGR, Sharpe ratio, max drawdown, and more. Powered by the markets worker with Polars + DuckDB."
        />
      </div>
    </DashboardLayout>
  );
}
