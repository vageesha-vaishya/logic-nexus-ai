import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MarginRulesManager } from "@/components/finance/MarginRulesManager";

export default function MarginRulesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Margin Rules</h1>
          <p className="text-muted-foreground">Manage dynamic pricing adjustments and margin policies.</p>
        </div>
        <MarginRulesManager />
      </div>
    </DashboardLayout>
  );
}
