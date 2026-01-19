import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Users2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';
import { PermissionGuard } from '@/lib/auth/PermissionGuard';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RoleService } from '@/lib/api/roles';
import { invokeFunction } from '@/lib/supabase-functions';

export default function Users() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context, scopedDb, supabase } = useCRM();
  type UserRole = {
    role: string;
    tenant_id: string | null;
    franchise_id: string | null;
    tenant_name?: string | null;
    franchise_name?: string | null;
  };
  type UserRow = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    created_at: string;
    user_roles?: UserRole[];
  };
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkRole, setBulkRole] = useState<string>('user');
  const [bulkTenant, setBulkTenant] = useState<string>('');
  const [bulkFranchise, setBulkFranchise] = useState<string>('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState<'set' | 'link'>('set');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      // First, get the user IDs based on role context
      let userIds: string[] | null = null;

      if (!context.isPlatformAdmin || context.adminOverrideEnabled) {
        const { data: roles } = await scopedDb
          .from('user_roles')
          .select('user_id');
        userIds = roles?.map((r: any) => r.user_id) || [];
      }

      // Build the main query using raw Supabase client as profiles table is global
      // Scoping is handled via the userIds filter above derived from user_roles
      let query = supabase
        .from('profiles')
        .select(`
          *,
          user_roles!user_id(role, tenant_id, franchise_id)
        `);

      // Apply filter if we have specific user IDs
      if (userIds !== null) {
        query = query.in('id', userIds);
      }
      // Platform admin has no filters - can see all users

      const { data: profilesData, error: profilesError } = await query.order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all tenants and franchises to map names
      const { data: tenantsData } = await scopedDb.from('tenants').select('id, name');
      const { data: franchisesData } = await scopedDb.from('franchises').select('id, name');

      // Create lookup maps
      const tenantsMap = new Map(tenantsData?.map(t => [t.id, t.name]) || []);
      const franchisesMap = new Map(franchisesData?.map(f => [f.id, f.name]) || []);

      // Enrich user data with tenant and franchise names
      const enrichedUsers = profilesData?.map(user => ({
        ...user,
        user_roles: user.user_roles?.map((role: { role: string; tenant_id: string | null; franchise_id: string | null }) => ({
          ...role,
          tenant_name: role.tenant_id ? tenantsMap.get(role.tenant_id) : null,
          franchise_name: role.franchise_id ? franchisesMap.get(role.franchise_id) : null,
        }))
      }));

      setUsers(enrichedUsers || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching users',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [context.isPlatformAdmin, context.adminOverrideEnabled, scopedDb, toast]);

  useEffect(() => {
    fetchUsers();
    scopedDb.from('tenants').select('id,name').then(({ data }) => setTenants(data || []));
    scopedDb.from('franchises').select('id,name').then(({ data }) => setFranchises(data || []));
  }, [fetchUsers, scopedDb]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-muted-foreground">Manage system users and permissions</p>
          </div>
          <PermissionGuard requiredPermission="user.create">
            <Button onClick={() => navigate('/dashboard/users/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New User
            </Button>
          </PermissionGuard>
          <PermissionGuard requiredPermission="admin.users.manage">
            <Button variant="outline" onClick={() => setShowBulkDialog(true)} disabled={selectedIds.length === 0}>
              Bulk Assign Roles
            </Button>
          </PermissionGuard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" />
              All Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users found. Create your first user to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length > 0 && selectedIds.length === users.length}
                        onCheckedChange={(val) => {
                          setSelectedIds(val ? users.map(u => u.id) : []);
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Franchise</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/dashboard/users/${user.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(user.id)}
                          onCheckedChange={(val) => {
                            setSelectedIds(prev => {
                              if (val) return [...prev, user.id];
                              return prev.filter(id => id !== user.id);
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.user_roles?.map((role: UserRole, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs capitalize">
                              {role.role.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.user_roles?.[0]?.tenant_name || '-'}
                      </TableCell>
                      <TableCell>
                        {user.user_roles?.[0]?.franchise_name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {(context.isPlatformAdmin || context.isTenantAdmin || context.isFranchiseAdmin) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setResetUserId(user.id);
                              setResetMode('set');
                              setNewPassword('');
                              setConfirmPassword('');
                              setShowResetDialog(true);
                            }}
                          >
                            Reset Password
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Assign Roles</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select defaultValue={bulkRole} onValueChange={setBulkRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {['platform_admin','tenant_admin','franchise_admin','user'].map(r => (
                      <SelectItem key={r} value={r}>{r.replace('_',' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Tenant</label>
                <Select defaultValue={bulkTenant} onValueChange={setBulkTenant}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Franchise</label>
                <Select defaultValue={bulkFranchise} onValueChange={setBulkFranchise}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select franchise" />
                  </SelectTrigger>
                  <SelectContent>
                    {franchises.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
              <Button onClick={async () => {
                try {
                  const roleService = new RoleService(scopedDb);
                  await roleService.bulkAssignRoles(selectedIds, { role: bulkRole, tenant_id: bulkTenant || null, franchise_id: bulkFranchise || null });
                  toast({ title: 'Success', description: 'Roles assigned' });
                  setShowBulkDialog(false);
                  setSelectedIds([]);
                  fetchUsers();
                } catch (e) {
                  toast({ title: 'Error', description: 'Failed to assign roles', variant: 'destructive' });
                }
              }}>Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={resetMode === 'set' ? 'default' : 'outline'}
                  onClick={() => setResetMode('set')}
                >
                  Set New Password
                </Button>
                <Button
                  variant={resetMode === 'link' ? 'default' : 'outline'}
                  onClick={() => setResetMode('link')}
                >
                  Send Reset Link
                </Button>
              </div>
              {resetMode === 'set' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">New Password</label>
                    <input
                      type="password"
                      className="w-full border rounded px-3 py-2"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Confirm Password</label>
                    <input
                      type="password"
                      className="w-full border rounded px-3 py-2"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  try {
                    if (!resetUserId) return;
                    if (resetMode === 'set') {
                      if (!newPassword || newPassword !== confirmPassword) {
                        toast({
                          title: 'Error',
                          description: 'Passwords do not match',
                          variant: 'destructive',
                        });
                        return;
                      }
                    }
                    const { data, error } = await invokeFunction('admin-reset-password', {
                      body: resetMode === 'set'
                        ? { target_user_id: resetUserId, new_password: newPassword }
                        : { target_user_id: resetUserId, send_reset_link: true, redirect_url: window.location.origin + '/' },
                    });
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);
                    if (resetMode === 'link' && data?.recovery_link) {
                      toast({
                        title: 'Reset Link Generated',
                        description: 'Copy and share the recovery link with the user.',
                      });
                      // Optionally show link in a separate UI; keeping minimal for now
                      console.log('Recovery link:', data.recovery_link);
                    } else {
                      toast({ title: 'Success', description: 'Password updated successfully' });
                    }
                    setShowResetDialog(false);
                  } catch (err: any) {
                    toast({
                      title: 'Error',
                      description: err?.message || 'Failed to reset password',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                {resetMode === 'set' ? 'Update Password' : 'Generate Link'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
