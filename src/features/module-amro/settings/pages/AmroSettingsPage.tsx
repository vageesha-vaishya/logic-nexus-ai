import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Settings2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';

export function AmroSettingsPage() {
  const { context } = useCRM();

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">AMRO Settings</h1>
            <p className="text-sm text-muted-foreground">
              Consolidated AMRO configuration surfaces with tenant-scoped controls and governed access.
            </p>
          </div>
          <Badge variant="secondary">Tenant: {context.tenantId || 'unscoped'}</Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-primary/30">
            <CardHeader className="space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <CardTitle>Master Data</CardTitle>
              <CardDescription>
                Manage aircraft, parts inventory, suppliers, maintenance facilities, work centers, and skill codes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/dashboard/amro/settings/master-data">Open Master Data</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Settings2 className="h-5 w-5" />
              </div>
              <CardTitle>Module Configuration</CardTitle>
              <CardDescription>
                Use this area to centralize additional AMRO configuration surfaces as they are introduced.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Extensible settings catalog</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AmroSettingsPage;
