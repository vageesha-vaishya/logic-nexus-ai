import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Shield, Users, Lock } from 'lucide-react';

export default function More() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">More</h1>
        <p className="text-muted-foreground">Additional tools and shortcuts</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                <CardTitle>Roles & Permissions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <CardDescription>View the read-only matrix of role capabilities.</CardDescription>
              <Button asChild className="w-full">
                <Link to="/dashboard/permissions">View Matrix</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle>Custom Roles</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <CardDescription>Create and manage custom roles with specific permissions.</CardDescription>
              <Button asChild className="w-full">
                <Link to="/dashboard/custom-roles">Manage Roles</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <CardTitle>Manage Users</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <CardDescription>Assign roles to users for access control.</CardDescription>
              <Button asChild variant="secondary" className="w-full">
                <Link to="/dashboard/users">Manage Users</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}