import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon, User, Bell, Shield, Database, CreditCard, Palette, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { useCRM } from '@/hooks/useCRM';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function Settings() {
  const { profile, roles } = useAuth();
  const navigate = useNavigate();
  const { toggleDark } = useTheme();
  const { context } = useCRM();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and application settings</p>
        </div>

        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <div className="md:col-span-2 lg:col-span-3">
                <div className="flex items-center">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Appearance</h2>
                  <div className="ml-4 flex-1 h-px bg-border"></div>
                </div>
              </div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Theme Management</CardTitle>
              </div>
              <CardDescription>Customize colors, gradients, and presets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-4">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">Open the theme manager to create, save, and apply themes.</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="secondary" onClick={() => toggleDark(true)}>Enable Dark</Button>
                    <Button variant="secondary" onClick={() => toggleDark(false)}>Disable Dark</Button>
                  </div>
                </div>
                <Button className="w-full md:w-auto" variant="default" onClick={() => navigate('/dashboard/themes')}>
                  Open Manager
                </Button>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium">Quick Access by Scope</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => navigate('/dashboard/themes?scope=user')}>User Themes</Button>
                  <Button variant="outline" disabled={!context.isFranchiseAdmin} onClick={() => navigate('/dashboard/themes?scope=franchise')}>Franchise Themes</Button>
                  <Button variant="outline" disabled={!context.isTenantAdmin} onClick={() => navigate('/dashboard/themes?scope=tenant')}>Tenant Themes</Button>
                  <Button variant="outline" disabled={!context.isPlatformAdmin} onClick={() => navigate('/dashboard/themes?scope=platform')}>Platform Themes</Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Buttons enable based on your admin permissions.</p>
              </div>
            </CardContent>
          </Card>
              <div className="md:col-span-2 lg:col-span-3">
                <div className="flex items-center">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Account</h2>
                  <div className="ml-4 flex-1 h-px bg-border"></div>
                </div>
              </div>
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
                <CardTitle className="flex items-center gap-2">
                  Notifications
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center cursor-help">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Configure notification preferences</p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
              </div>
              
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Notification settings coming soon</p>
            </CardContent>
          </Card>

              <div className="md:col-span-2 lg:col-span-3">
                <div className="flex items-center">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Data</h2>
                  <div className="ml-4 flex-1 h-px bg-border"></div>
                </div>
              </div>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    <CardTitle className="flex items-center gap-2">
                      Data Management Options
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center cursor-help">
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Database insights and data tools</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button className="whitespace-nowrap" variant="outline" onClick={() => navigate('/dashboard/security-overview?tab=data-management')}>
                      Data Management
                    </Button>
                    <Button className="whitespace-nowrap" variant="outline" onClick={() => navigate('/dashboard/settings/master-data')}>
                      Master Data (Geography)
                    </Button>
                    <Button className="whitespace-nowrap" variant="outline" onClick={() => navigate('/dashboard/settings/master-data-hts')}>
                      Master Data (HTS Codes)
                    </Button>
                  </div>
                </CardContent>
              </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="flex items-center gap-2">
                  Subscription
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center cursor-help">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Manage your plan and usage</p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">View current plan, switch tiers, and track usage.</p>
              <Button variant="default" onClick={() => navigate('/dashboard/settings/subscription')}>
                Manage
              </Button>
            </CardContent>
          </Card>
            </div>
          </TabsContent>

          
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
