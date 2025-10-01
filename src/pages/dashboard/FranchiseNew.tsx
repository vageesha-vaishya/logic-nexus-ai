import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FranchiseForm } from '@/components/admin/FranchiseForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store } from 'lucide-react';

export default function FranchiseNew() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">New Franchise</h1>
          <p className="text-muted-foreground">Create a new franchise location</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Franchise Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FranchiseForm />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
