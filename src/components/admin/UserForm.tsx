import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';
import { ROLE_MATRIX, UserRole, canManageRole, validateHierarchy } from '@/lib/auth/RoleMatrix';
import { RoleService } from '@/lib/api/roles';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  first_name: z.string().min(2, 'First name must be at least 2 characters'),
  last_name: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  must_change_password: z.boolean().default(false),
  email_verified: z.boolean().default(true),
  role: z.enum(['platform_admin', 'tenant_admin', 'franchise_admin', 'user']),
  tenant_id: z.string().optional(),
  franchise_id: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

interface UserFormProps {
  user?: any;
  onSuccess?: () => void;
}

export function UserForm({ user, onSuccess }: UserFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context, supabase } = useCRM();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<UserFormValues | null>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>(user?.user_roles?.[0]?.role || '');
  const [selectedTenantId, setSelectedTenantId] = useState<string>(user?.user_roles?.[0]?.tenant_id || '');
  const [assignedRoles, setAssignedRoles] = useState<Array<{ role: UserRole; tenant_id?: string | null; franchise_id?: string | null }>>(
    (user?.user_roles || []).map((r: any) => ({ role: r.role, tenant_id: r.tenant_id || null, franchise_id: r.franchise_id || null })) || []
  );

  // Determine current user's role for permission checks
  const currentUserRole: UserRole = context.isPlatformAdmin ? 'platform_admin' 
    : context.isTenantAdmin ? 'tenant_admin'
    : context.isFranchiseAdmin ? 'franchise_admin'
    : 'user';

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: user?.email || '',
      password: '',
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      avatar_url: user?.avatar_url || '',
      is_active: user?.is_active ?? true,
      must_change_password: user?.must_change_password ?? false,
      email_verified: true,
      role: user?.user_roles?.[0]?.role || (currentUserRole === 'franchise_admin' ? 'user' : 'user'),
      tenant_id: user?.user_roles?.[0]?.tenant_id || context.tenantId || '',
      franchise_id: user?.user_roles?.[0]?.franchise_id || context.franchiseId || '',
    },
  });

  useEffect(() => {
    fetchTenants();
  }, [context]);

  useEffect(() => {
    // If tenant admin, force tenant selection
    if (context.isTenantAdmin && context.tenantId) {
      setSelectedTenantId(context.tenantId);
      form.setValue('tenant_id', context.tenantId);
    }
    
    // If franchise admin, force tenant and franchise
    if (context.isFranchiseAdmin && context.tenantId && context.franchiseId) {
      setSelectedTenantId(context.tenantId);
      form.setValue('tenant_id', context.tenantId);
      form.setValue('franchise_id', context.franchiseId);
    }
  }, [context.isTenantAdmin, context.tenantId, context.isFranchiseAdmin, context.franchiseId, form]);

  useEffect(() => {
    if (selectedTenantId) {
      fetchFranchises(selectedTenantId);
    }
  }, [selectedTenantId, context]);

  const fetchTenants = async () => {
    try {
      const db = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { data, error } = await (db as any)
        .from('tenants')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      setTenants(data || []);
    } catch (error: any) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchFranchises = async (tenantId: string) => {
    try {
      // Note: ScopedDataAccess automatically filters by tenant_id if the user is a tenant admin.
      // However, since we are passing tenantId explicitly (e.g. platform admin selecting a tenant),
      // we should still use eq('tenant_id', tenantId) to filter for the selected tenant.
      // If the user is a tenant admin, ScopedDataAccess will enforce their tenantId anyway.
      
      const db = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { data, error } = await (db as any)
        .from('franchises')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      
      if (error) throw error;
      setFranchises(data || []);
    } catch (error: any) {
      console.error('Error fetching franchises:', error);
    }
  };

  const handleFormSubmit = (values: UserFormValues) => {
    setPendingData(values);
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setShowConfirmDialog(false);
    
    await onSubmit(pendingData);
    setPendingData(null);
  };

  const onSubmit = async (values: UserFormValues) => {
    // Validate hierarchy security
    if (!validateHierarchy(
      currentUserRole,
      context.tenantId || null,
      context.franchiseId || null,
      values.tenant_id || null,
      values.franchise_id || null
    )) {
      toast({
        title: 'Security Violation',
        description: 'You are not authorized to assign users to this scope.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (user) {
        // Update profile - using ScopedDataAccess for audit logging
        const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
        const { error: profileError } = await dao
          .from('profiles')
          .update({
            first_name: values.first_name,
            last_name: values.last_name,
            phone: values.phone,
            avatar_url: values.avatar_url,
            is_active: values.is_active,
            must_change_password: values.must_change_password,
          })
          .eq('id', user.id);

        if (profileError) throw profileError;

        // Replace roles with assignedRoles (include primary role from form if not present)
        const primaryAssignment = { role: values.role as UserRole, tenant_id: values.tenant_id || null, franchise_id: values.franchise_id || null };
        const hasPrimary = assignedRoles.some(r => r.role === primaryAssignment.role && r.tenant_id === primaryAssignment.tenant_id && r.franchise_id === primaryAssignment.franchise_id);
        const finalAssignments = hasPrimary ? assignedRoles : [primaryAssignment, ...assignedRoles];
        const roleService = new RoleService(new ScopedDataAccess(supabase, context));
        await roleService.assignRolesToUser(user.id, finalAssignments, true);

        toast({
          title: 'Success',
          description: 'User updated successfully',
        });
        onSuccess?.();
      } else {
        // Create new user via edge function
        if (!values.password) {
          throw new Error('Password is required for new users');
        }

        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: values.email,
            password: values.password,
            first_name: values.first_name,
            last_name: values.last_name,
            phone: values.phone,
            avatar_url: values.avatar_url,
            is_active: values.is_active,
            must_change_password: values.must_change_password,
            email_verified: values.email_verified,
            role: values.role,
            tenant_id: values.tenant_id || null,
            franchise_id: values.franchise_id || null,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const messages = [];
        if (values.must_change_password) {
          messages.push('They will need to change their password on first login.');
        }
        if (!values.email_verified) {
          messages.push('They must verify their email before logging in.');
        } else {
          messages.push('Email verification bypassed - they can log in immediately.');
        }

        toast({
          title: 'Success',
          description: `User created successfully. ${messages.join(' ')}`,
        });
        
        try {
          // Assign additional roles after creation
          const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
          const { data: created } = await dao.from('profiles').select('id').eq('email', values.email).single();
          if (created?.id && assignedRoles.length > 0) {
            const roleService = new RoleService(dao);
            await roleService.assignRolesToUser(created.id, assignedRoles, false);
          }
        } catch (e) {
          console.warn('Failed to assign additional roles on creation', e);
        }
        navigate('/dashboard/users');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input placeholder="user@example.com" {...field} disabled={!!user} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!user && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temporary Password *</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Min 6 characters" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input placeholder="+1 (555) 123-4567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="avatar_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/avatar.jpg" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Active Status</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Enable or disable this user
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="must_change_password"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Must Change Password</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Require password change on next login
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {!user && (
          <FormField
            control={form.control}
            name="email_verified"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Override Email Verification</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Skip email verification - user can log in immediately
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role *</FormLabel>
              <Select 
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedRole(value);
                }} 
                defaultValue={field.value}
                disabled={!!user && !canManageRole(currentUserRole, field.value as UserRole)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(ROLE_MATRIX)
                    .filter(role => canManageRole(currentUserRole, role.id))
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {(selectedRole === 'tenant_admin' || selectedRole === 'franchise_admin' || selectedRole === 'user') && (
          <FormField
            control={form.control}
            name="tenant_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tenant *</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedTenantId(value);
                  }} 
                  defaultValue={field.value}
                  disabled={!context.isPlatformAdmin}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tenant" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {(selectedRole === 'franchise_admin' || selectedRole === 'user') && selectedTenantId && (
          <FormField
            control={form.control}
            name="franchise_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Franchise *</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  disabled={!context.isPlatformAdmin && !context.isTenantAdmin}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a franchise" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {franchises.map((franchise) => (
                      <SelectItem key={franchise.id} value={franchise.id}>
                        {franchise.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <FormLabel>Additional Roles</FormLabel>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignedRoles(prev => [...prev, { role: 'user', tenant_id: context.tenantId || null, franchise_id: context.franchiseId || null }])}
            >
              Add Role
            </Button>
          </div>
          <div className="space-y-3">
            {assignedRoles.map((r, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <FormLabel>Role</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      setAssignedRoles(prev => prev.map((item, i) => i === idx ? { ...item, role: value as UserRole } : item));
                    }} 
                    defaultValue={r.role}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(ROLE_MATRIX)
                        .filter(role => canManageRole(currentUserRole, role.id))
                        .map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FormLabel>Tenant</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      setAssignedRoles(prev => prev.map((item, i) => i === idx ? { ...item, tenant_id: value } : item));
                    }} 
                    defaultValue={r.tenant_id || ''}
                    disabled={!context.isPlatformAdmin}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tenant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <FormLabel>Franchise</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        setAssignedRoles(prev => prev.map((item, i) => i === idx ? { ...item, franchise_id: value } : item));
                      }} 
                      defaultValue={r.franchise_id || ''}
                      disabled={!context.isPlatformAdmin && !context.isTenantAdmin}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a franchise" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {franchises.map((franchise) => (
                          <SelectItem key={franchise.id} value={franchise.id}>
                            {franchise.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setAssignedRoles(prev => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="submit" className="flex-1">
            {user ? 'Update' : 'Create'} User
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/dashboard/users')}
          >
            Cancel
          </Button>
        </div>
        </form>
      </Form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {user ? 'Update' : 'Creation'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {user ? 'update' : 'create'} this user?
              {!user && ' The user will be required to change their password on first login.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
