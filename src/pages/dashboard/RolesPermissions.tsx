import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Shield, Save, RotateCcw, Lock, AlertTriangle } from 'lucide-react';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { RoleService, DbRole, DbPermission } from '@/lib/api/roles';
import { buildShipmentsMatrix, detectConflicts, isSensitiveChange } from '@/lib/auth/PermissionsValidator';
import { useCRM } from '@/hooks/useCRM';

export default function RolesPermissions() {
  const { supabase, context, scopedDb } = useCRM();
  const roleService = new RoleService(scopedDb);

  const [roles, setRoles] = useState<DbRole[]>([]);
  const [permissions, setPermissions] = useState<DbPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modified, setModified] = useState(false);
  const [hierarchyParents, setHierarchyParents] = useState<Record<string, string[]>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [createForm, setCreateForm] = useState<{ id: string; label: string; description: string; level: number; scopes: string[] }>({ id: '', label: '', description: '', level: 5, scopes: [] });
  const [editForm, setEditForm] = useState<{ label: string; description: string; level: number; scopes: string[] }>({ label: '', description: '', level: 5, scopes: [] });
  const [roleQuery, setRoleQuery] = useState('');
  const [permQuery, setPermQuery] = useState('');
  const [inheritanceAvailable, setInheritanceAvailable] = useState(true);
  const [justification, setJustification] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolesData, permsData, rolePermsMap, hierarchy] = await Promise.all([
        roleService.getRoles(),
        roleService.getPermissions(),
        roleService.getRolePermissions(),
        roleService.getRoleHierarchy()
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
      setHierarchyParents(hierarchy.childrenToParents || {});
      setInheritanceAvailable((hierarchy as any).available !== false);
      if (rolesData.length > 0 && !selectedRole) {
        setSelectedRole(rolesData[0].id);
      }
    } catch (error) {
      console.error('Failed to load roles data:', error);
      toast.error('Failed to load roles and permissions');
    } finally {
      setIsLoading(false);
    }
  }, [roleService]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const seedDefaults = async () => {
    try {
      await roleService.seedFromConfig();
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
      await roleService.updateRolePermissions(selectedRole, rolePermissions[selectedRole] || [], justification || undefined);
      toast.success('Permissions updated successfully');
      setModified(false);
      setJustification('');
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
  const filteredPermissions = permQuery
    ? permissions.filter(p => p.id.toLowerCase().includes(permQuery.toLowerCase()) || (p.description || '').toLowerCase().includes(permQuery.toLowerCase()))
    : permissions;
  const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, DbPermission[]>);

  const selectedRoleData = roles.find(r => r.id === selectedRole);
  const currentPerms = rolePermissions[selectedRole || ''] || [];
  const shipmentsMatrix = buildShipmentsMatrix(currentPerms);
  const conflicts = detectConflicts(currentPerms);
  const sensitive = isSensitiveChange([], currentPerms);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/settings">Settings</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/settings">Roles & Permissions</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Permissions Management</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
            <p className="text-muted-foreground">
              Configure role definitions and granular access controls.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowCreateDialog(true)} disabled={isSaving}>
              Create Role
            </Button>
            <Button variant="secondary" onClick={seedDefaults} disabled={isSaving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Seed Defaults
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={!modified || isSaving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!modified || isSaving || (conflicts.length > 0 && !justification)}>
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
                    <Input
                      placeholder="Search roles"
                      value={roleQuery}
                      onChange={e => setRoleQuery(e.target.value)}
                      className="mb-2"
                      aria-label="Search roles"
                    />
                    {roles
                      .filter(r => r.label.toLowerCase().includes(roleQuery.toLowerCase()) || r.id.toLowerCase().includes(roleQuery.toLowerCase()))
                      .map(role => (
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
                      Seed Defaults
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
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      if (!selectedRoleData) return;
                      setEditForm({
                        label: selectedRoleData.label,
                        description: selectedRoleData.description,
                        level: selectedRoleData.level,
                        scopes: selectedRoleData.can_manage_scopes || []
                      });
                      setShowEditDialog(true);
                    }} disabled={!selectedRoleData || selectedRoleData?.is_system}>
                      Edit Role
                    </Button>
                    <Button variant="destructive" onClick={async () => {
                      if (!selectedRoleData) return;
                      try {
                        await roleService.deleteRole(selectedRoleData.id);
                        toast.success('Role deleted');
                        loadData();
                      } catch (e) {
                        toast.error('Failed to delete role');
                      }
                    }} disabled={!selectedRoleData || selectedRoleData?.is_system}>
                      Delete Role
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="flex-1 overflow-hidden p-0">
                <Tabs defaultValue="all" className="h-full flex flex-col">
                  <div className="px-6 py-2 border-b bg-muted/40">
                    <div className="flex items-center gap-3 mb-2">
                      <Input
                        placeholder="Search permissions"
                        value={permQuery}
                        onChange={e => setPermQuery(e.target.value)}
                        aria-label="Search permissions"
                      />
                    </div>
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
                <Separator className="mt-2" />
                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Shipments Preview</h3>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    <div className="p-3 rounded-md border">
                      <p className="text-sm font-medium mb-2">Core</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={shipmentsMatrix.core.view ? 'bg-green-600' : 'bg-muted'}>view</Badge>
                        <Badge className={shipmentsMatrix.core.create ? 'bg-blue-600' : 'bg-muted'}>create</Badge>
                        <Badge className={shipmentsMatrix.core.edit ? 'bg-indigo-600' : 'bg-muted'}>edit</Badge>
                        <Badge className={shipmentsMatrix.core.delete ? 'bg-red-600' : 'bg-muted'}>delete</Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded-md border">
                      <p className="text-sm font-medium mb-2">Approvals</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={shipmentsMatrix.approvals.view ? 'bg-purple-600' : 'bg-muted'}>view</Badge>
                        <Badge className={shipmentsMatrix.approvals.manage ? 'bg-purple-800' : 'bg-muted'}>manage</Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded-md border">
                      <p className="text-sm font-medium mb-2">Reports</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={shipmentsMatrix.reports.view ? 'bg-orange-600' : 'bg-muted'}>view</Badge>
                        <Badge className={shipmentsMatrix.reports.manage ? 'bg-orange-800' : 'bg-muted'}>manage</Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded-md border">
                      <p className="text-sm font-medium mb-2">Config</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={shipmentsMatrix.config.manage ? 'bg-gray-700' : 'bg-muted'}>manage</Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded-md border">
                      <p className="text-sm font-medium mb-2">Audit</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={shipmentsMatrix.audit.view ? 'bg-amber-600' : 'bg-muted'}>view</Badge>
                        <Badge className={shipmentsMatrix.audit.manage ? 'bg-amber-800' : 'bg-muted'}>manage</Badge>
                      </div>
                    </div>
                  </div>
                  {conflicts.length > 0 && (
                    <div className="p-3 rounded-md border border-destructive/40 bg-destructive/10">
                      <p className="text-sm font-semibold">Validation Issues</p>
                      <ul className="mt-2 text-sm">
                        {conflicts.map(c => <li key={c.code}>{c.message}</li>)}
                      </ul>
                      <div className="mt-3 grid gap-2">
                        <label className="text-sm font-medium">Justification</label>
                        <Input value={justification} onChange={e => setJustification(e.target.value)} placeholder="Provide justification for overriding warnings" />
                      </div>
                    </div>
                  )}
                </div>
                <Separator className="mt-2" />
                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Inheritance</h3>
                  <p className="text-sm text-muted-foreground">
                    {inheritanceAvailable
                      ? 'Select parent roles to inherit their permissions.'
                      : 'Inheritance is unavailable. The auth_role_hierarchy table is missing; contact an administrator to run the migration.'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {roles.filter(r => r.id !== selectedRole).map(r => {
                      const checked = (hierarchyParents[selectedRole || ''] || []).includes(r.id);
                      return (
                        <label key={r.id} className={`flex items-center gap-3 p-3 rounded-md border ${checked ? 'bg-primary/5 border-primary/20' : ''}`}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(val) => {
                              const current = hierarchyParents[selectedRole || ''] || [];
                              const updated = val ? [...current, r.id] : current.filter(id => id !== r.id);
                              setHierarchyParents(prev => ({ ...prev, [selectedRole || '']: updated }));
                            }}
                            disabled={!inheritanceAvailable}
                          />
                          <div className="grid gap-0.5">
                            <span className="text-sm font-medium">{r.label}</span>
                            <span className="text-xs text-muted-foreground">{r.description}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={async () => {
                      try {
                        await roleService.setRoleInheritance(selectedRole || '', hierarchyParents[selectedRole || ''] || []);
                        toast.success('Inheritance updated');
                      } catch (e) {
                        toast.error('Failed to update inheritance');
                      }
                    }} disabled={!inheritanceAvailable}>
                      Save Inheritance
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>Define a custom role with label, level, and scopes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Role ID</label>
              <Input value={createForm.id} onChange={e => setCreateForm({ ...createForm, id: e.target.value })} placeholder="e.g., editor" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Label</label>
              <Input value={createForm.label} onChange={e => setCreateForm({ ...createForm, label: e.target.value })} placeholder="e.g., Editor" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Description</label>
              <Input value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Short description" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Level</label>
              <Input type="number" value={createForm.level} onChange={e => setCreateForm({ ...createForm, level: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Manage Scopes</label>
              <div className="flex gap-3">
                {['global','tenant','franchise'].map(scope => {
                  const checked = createForm.scopes.includes(scope);
                  return (
                    <label key={scope} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={checked} onCheckedChange={(val) => {
                        const current = createForm.scopes;
                        const updated = val ? [...current, scope] : current.filter(s => s !== scope);
                        setCreateForm({ ...createForm, scopes: updated });
                      }} />
                      <span className="capitalize">{scope}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button type="button" onClick={async () => {
              try {
                await roleService.createRole({
                  id: createForm.id,
                  label: createForm.label,
                  description: createForm.description,
                  level: createForm.level,
                  can_manage_scopes: createForm.scopes,
                  is_system: false
                });
                toast.success('Role created');
                setShowCreateDialog(false);
                loadData();
              } catch (e) {
                toast.error('Failed to create role');
              }
            }}>Create Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Label</label>
              <Input value={editForm.label} onChange={e => setEditForm({ ...editForm, label: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Description</label>
              <Input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Level</label>
              <Input type="number" value={editForm.level} onChange={e => setEditForm({ ...editForm, level: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Manage Scopes</label>
              <div className="flex gap-3">
                {['global','tenant','franchise'].map(scope => {
                  const checked = editForm.scopes.includes(scope);
                  return (
                    <label key={scope} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={checked} onCheckedChange={(val) => {
                        const current = editForm.scopes;
                        const updated = val ? [...current, scope] : current.filter(s => s !== scope);
                        setEditForm({ ...editForm, scopes: updated });
                      }} />
                      <span className="capitalize">{scope}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                await roleService.updateRole(selectedRole || '', {
                  label: editForm.label,
                  description: editForm.description,
                  level: editForm.level,
                  can_manage_scopes: editForm.scopes
                } as any);
                setShowEditDialog(false);
                toast.success('Role updated');
                loadData();
              } catch (e) {
                toast.error('Failed to update role');
              }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
