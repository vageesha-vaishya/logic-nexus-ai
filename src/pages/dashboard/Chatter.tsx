import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function Chatter() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Chatter</h1>
        <p className="text-muted-foreground">Collaboration feed</p>
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Placeholder feed; integrate comments and mentions here.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}