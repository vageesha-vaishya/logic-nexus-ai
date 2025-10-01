import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserForm } from '@/components/admin/UserForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users2 } from 'lucide-react';

export default function UserNew() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">New User</h1>
          <p className="text-muted-foreground">Create a new user account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UserForm />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
