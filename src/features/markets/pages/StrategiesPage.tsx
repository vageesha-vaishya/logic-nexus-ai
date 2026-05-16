import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GitBranch } from "lucide-react";
import { EmptyState } from "@/design-system";

export default function StrategiesPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <GitBranch className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Strategies
            </h1>
            <p className="text-sm text-muted-foreground">
              Define and manage rule-based or AI-driven trading strategies.
            </p>
          </div>
        </header>

        <EmptyState
          title="No strategies yet"
          description="Strategies let you define entry/exit rules, position sizing, and risk parameters. The strategy engine is powered by the markets worker."
        />
      </div>
    </DashboardLayout>
  );
}
