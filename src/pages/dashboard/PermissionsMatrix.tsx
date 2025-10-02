import { useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ROLE_PERMISSIONS, type Permission } from '@/config/permissions';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';

// Roles in display order
const ROLES: Array<'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user'> = [
  'platform_admin',
  'tenant_admin',
  'franchise_admin',
  'user',
];

export default function PermissionsMatrix() {
  useEffect(() => {
    document.title = 'Permissions Matrix | Admin';
  }, []);

  const { modules, actionsByModule } = useMemo(() => {
    // Collect all permissions that exist across roles
    const allPerms = new Set<Permission>();
    ROLES.forEach((r) => ROLE_PERMISSIONS[r].forEach((p) => allPerms.add(p)));

    // Group by module (string before first dot)
    const byModule = new Map<string, Set<string>>();
    for (const perm of allPerms) {
      const [module, action] = perm.split('.') as [string, string];
      if (!byModule.has(module)) byModule.set(module, new Set());
      byModule.get(module)!.add(action);
    }

    const modules = Array.from(byModule.keys()).sort();
    const actionsByModule: Record<string, string[]> = {};
    modules.forEach((m) => (actionsByModule[m] = Array.from(byModule.get(m)!).sort()));

    return { modules, actionsByModule };
  }, []);

  const hasRolePermission = (role: typeof ROLES[number], perm: string) => {
    return ROLE_PERMISSIONS[role].includes(perm as Permission);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground">Read-only matrix of role capabilities across modules.</p>
          <div className="flex gap-3">
            <Button asChild variant="secondary">
              <Link to="/dashboard/users">Manage Users & Roles</Link>
            </Button>
          </div>
        </header>

        {modules.map((module) => (
          <Card key={module} className="overflow-hidden">
            <CardHeader>
              <CardTitle className="capitalize">{module}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Action</TableHead>
                      {ROLES.map((role) => (
                        <TableHead key={role} className="capitalize text-center">{role.replace('_', ' ')}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionsByModule[module].map((action) => {
                      const perm = `${module}.${action}`;
                      return (
                        <TableRow key={perm}>
                          <TableCell className="font-medium">{action.replace('_', ' ')}</TableCell>
                          {ROLES.map((role) => (
                            <TableCell key={role} className="text-center">
                              {hasRolePermission(role, perm) ? (
                                <Check className="h-4 w-4 text-primary" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
