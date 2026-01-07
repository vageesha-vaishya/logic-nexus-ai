import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Save, RotateCcw, Lock, AlertTriangle } from 'lucide-react';
import { RoleService, DbRole, DbPermission } from '@/lib/api/roles';

export default function RolesPermissions() {
  const [roles, setRoles] = useState<DbRole[]>([]);
  const [permissions, setPermissions] = useState<DbPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modified, setModified] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rolesData, permsData, rolePermsMap] = await Promise.all([
        RoleService.getRoles(),
        RoleService.getPermissions(),
        RoleService.getRolePermissions()
      ]);

      if (rolesData.length === 0) {
        // Offer to seed if empty
        toast.info('No roles found. You can seed default roles.', {
          action: {
            label: 'Seed Defaults',
            onClick: seedDefaults
          }
        });
      }

      setRoles(rolesData);
      setPermissions(permsData);
      setRolePermissions(rolePermsMap);
      if (rolesData.length > 0 && !selectedRole) {
        setSelectedRole(rolesData[0].id);
      }
    } catch (error) {
      console.error('Failed to load roles data:', error);
      toast.error('Failed to load roles and permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const seedDefaults = async () => {
    try {
      await RoleService.seedFromConfig();
      toast.success('Database seeded with default roles and permissions');
      loadData();
    } catch (error) {
      console.error('Seeding failed:', error);
      toast.error('Failed to seed database');
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    if (!selectedRole) return;

    setRolePermissions(prev => {
      const current = prev[selectedRole] || [];
      const isSelected = current.includes(permissionId);
      const updated = isSelected
        ? current.filter(p => p !== permissionId)
        : [...current, permissionId];
      
      return { ...prev, [selectedRole]: updated };
    });
    setModified(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    
    setIsSaving(true);
    try {
      await RoleService.updateRolePermissions(selectedRole, rolePermissions[selectedRole] || []);
      toast.success('Permissions updated successfully');
      setModified(false);
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    loadData();
    setModified(false);
  };

  // Group permissions by category
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, DbPermission[]>);

  const selectedRoleData = roles.find(r => r.id === selectedRole);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
            <p className="text-muted-foreground">
              Configure role definitions and granular access controls.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={!modified || isSaving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!modified || isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-full">Loading...</div>
        ) : (
          <div className="grid grid-cols-12 gap-6 h-full overflow-hidden">
            {/* Roles List */}
            <Card className="col-span-3 h-full flex flex-col">
              <CardHeader>
                <CardTitle>Roles</CardTitle>
                <CardDescription>Select a role to edit</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="flex flex-col p-4 gap-2">
                    {roles.map(role => (
                      <button
                        key={role.id}
                        onClick={() => {
                          if (modified) {
                            if (confirm('You have unsaved changes. Discard them?')) {
                              setSelectedRole(role.id);
                              setModified(false);
                              loadData(); // Reload to reset pending changes
                            }
                          } else {
                            setSelectedRole(role.id);
                          }
                        }}
                        className={`flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-colors border ${
                          selectedRole === role.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold">{role.label}</span>
                          {role.is_system && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {role.description}
                        </span>
                        <Badge variant="outline" className="text-[10px] mt-1">
                          Level {role.level}
                        </Badge>
                      </button>
                    ))}
                    <Button variant="ghost" size="sm" className="mt-2 w-full border border-dashed" onClick={seedDefaults}>
                      <RotateCcw className="mr-2 h-3 w-3" />
                      Reset to Defaults
                    </Button>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Permission Matrix */}
            <Card className="col-span-9 h-full flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedRoleData?.label}
                      <Badge>{(rolePermissions[selectedRole!] || []).length} Permissions</Badge>
                    </CardTitle>
                    <CardDescription>{selectedRoleData?.description}</CardDescription>
                  </div>
                  {selectedRoleData?.id === 'platform_admin' && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-md border border-amber-200">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-medium">Platform Admin has implicit full access</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="flex-1 overflow-hidden p-0">
                <Tabs defaultValue="all" className="h-full flex flex-col">
                  <div className="px-6 py-2 border-b bg-muted/40">
                    <TabsList className="w-full justify-start overflow-x-auto">
                      <TabsTrigger value="all">All</TabsTrigger>
                      {Object.keys(groupedPermissions).sort().map(category => (
                        <TabsTrigger key={category} value={category} className="capitalize">
                          {category}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  
                  <ScrollArea className="flex-1 p-6">
                    <TabsContent value="all" className="mt-0 space-y-8">
                      {Object.entries(groupedPermissions).map(([category, perms]) => (
                        <div key={category} className="space-y-4">
                          <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
                            {category}
                            <Badge variant="secondary" className="text-xs font-normal">
                              {perms.length}
                            </Badge>
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {perms.map(perm => (
                              <div
                                key={perm.id}
                                className={`flex items-start space-x-3 p-3 rounded-md border transition-all ${
                                  (rolePermissions[selectedRole!] || []).includes(perm.id)
                                    ? 'bg-primary/5 border-primary/20 shadow-sm'
                                    : 'hover:bg-muted/50'
                                }`}
                              >
                                <Checkbox
                                  id={perm.id}
                                  checked={(rolePermissions[selectedRole!] || []).includes(perm.id)}
                                  onCheckedChange={() => handlePermissionToggle(perm.id)}
                                  disabled={selectedRoleData?.id === 'platform_admin'} // Immutable for platform admin
                                />
                                <div className="grid gap-1.5 leading-none">
                                  <label
                                    htmlFor={perm.id}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                  >
                                    {perm.id}
                                  </label>
                                  {perm.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {perm.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <Separator className="mt-4" />
                        </div>
                      ))}
                    </TabsContent>

                    {Object.entries(groupedPermissions).map(([category, perms]) => (
                      <TabsContent key={category} value={category} className="mt-0">
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {perms.map(perm => (
                              <div
                                key={perm.id}
                                className={`flex items-start space-x-3 p-3 rounded-md border transition-all ${
                                  (rolePermissions[selectedRole!] || []).includes(perm.id)
                                    ? 'bg-primary/5 border-primary/20 shadow-sm'
                                    : 'hover:bg-muted/50'
                                }`}
                              >
                                <Checkbox
                                  id={`${category}-${perm.id}`}
                                  checked={(rolePermissions[selectedRole!] || []).includes(perm.id)}
                                  onCheckedChange={() => handlePermissionToggle(perm.id)}
                                  disabled={selectedRoleData?.id === 'platform_admin'}
                                />
                                <div className="grid gap-1.5 leading-none">
                                  <label
                                    htmlFor={`${category}-${perm.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                  >
                                    {perm.id}
                                  </label>
                                  {perm.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {perm.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                      </TabsContent>
                    ))}
                  </ScrollArea>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
