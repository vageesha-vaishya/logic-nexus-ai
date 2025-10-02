import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function Files() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Files</h1>
        <p className="text-muted-foreground">Documents and attachments</p>
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Placeholder screen aligned with menu; wire your storage integration here.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}