import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon, User, Bell, Shield, Database, CreditCard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { profile, roles } = useAuth();
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and application settings</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Profile Information</CardTitle>
              </div>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-sm">{profile?.first_name} {profile?.last_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-sm">{profile?.email}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Roles & Permissions</CardTitle>
              </div>
              <CardDescription>Your access levels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {roles.map((role) => (
                <div key={role.role} className="text-sm">
                  <span className="font-medium capitalize">{role.role.replace('_', ' ')}</span>
                  {role.tenant_id && <span className="text-muted-foreground"> • Tenant scoped</span>}
                  {role.franchise_id && <span className="text-muted-foreground"> • Franchise scoped</span>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>Configure notification preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Notification settings coming soon</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Data Management Options</CardTitle>
              </div>
              <CardDescription>Database insights and data tools</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">View RLS status, policies, and schema details.</p>
              <Button variant="default" onClick={() => navigate('/dashboard/security-overview')}>
                Security Overview
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>Subscription</CardTitle>
              </div>
              <CardDescription>Manage your plan and usage</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">View current plan, switch tiers, and track usage.</p>
              <Button variant="default" onClick={() => navigate('/dashboard/settings/subscription')}>
                Manage
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
