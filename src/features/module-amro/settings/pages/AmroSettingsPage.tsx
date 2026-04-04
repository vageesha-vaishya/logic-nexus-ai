import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Package, Plane } from 'lucide-react';
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

        <div className="grid gap-4 lg:grid-cols-3">
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

          <Card className="border-primary/30">
            <CardHeader className="space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Plane className="h-5 w-5" />
              </div>
              <CardTitle>Aircraft Module</CardTitle>
              <CardDescription>
                Open the dedicated AMRO Aircraft sub-module with full CRUD, validation, filters, sorting, and exports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/dashboard/amro/aircraft">Open Aircraft Module</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </div>
              <CardTitle>Work Package Templates</CardTitle>
              <CardDescription>
                Configure reusable work package templates for aircraft maintenance planning and execution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/dashboard/amro/settings/work-package-templates">Open Work Package Templates</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AmroSettingsPage;
