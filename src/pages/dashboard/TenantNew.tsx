import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TenantForm } from '@/components/admin/TenantForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function TenantNew() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">New Tenant</h1>
          <p className="text-muted-foreground">Create a new organization tenant</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Tenant Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TenantForm />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
