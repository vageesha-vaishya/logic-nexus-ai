import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function Dashboards() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboards</h1>
        <p className="text-muted-foreground">Visual dashboards and KPI tracking</p>
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Placeholder; add widgets, charts, and filters here.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}