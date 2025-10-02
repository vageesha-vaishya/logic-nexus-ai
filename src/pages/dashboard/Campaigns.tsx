import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function Campaigns() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <p className="text-muted-foreground">Marketing campaigns management</p>
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Placeholder screen aligned with menu; add lists and performance here.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}