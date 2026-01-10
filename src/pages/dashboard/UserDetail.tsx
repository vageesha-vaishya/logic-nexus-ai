import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserForm } from '@/components/admin/UserForm';
import { UserRoleAssignment } from '@/components/roles/UserRoleAssignment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users2, Trash2, ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { supabase, context } = useCRM();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, [id, context]);

  const fetchUser = async () => {
    try {
      // 1. Verify access: Ensure the target user has a role within the current scope
      // (Unless platform admin without override)
      if (!context.isPlatformAdmin || context.adminOverrideEnabled) {
        const db = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
        const { data: roles, error: roleError } = await (db as any)
          .from('user_roles')
          .select('user_id')
          .eq('user_id', id);
        
        if (roleError) throw roleError;
        
        if (!roles || roles.length === 0) {
          throw new Error('User not found or access denied');
        }
      }

      // 2. Fetch profile using raw client (profiles is a global table)
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles!user_id(role, tenant_id, franchise_id)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      // Optionally redirect if not found
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        navigate('/dashboard/users');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      // Verify access before delete
      if (!context.isPlatformAdmin || context.adminOverrideEnabled) {
        const db = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
        const { data: roles } = await (db as any)
          .from('user_roles')
          .select('user_id')
          .eq('user_id', id);
          
        if (!roles || roles.length === 0) {
          throw new Error('Access denied');
        }
      }

      // Use raw client for profiles delete as it is a global table
      // TODO: For tenant admins, this should probably only remove the tenant role, not delete the profile?
      // For now, we allow delete if they have access, but strictly strictly speaking, 
      // deleting a global profile should probably be restricted to Platform Admins, 
      // or we should only delete the roles associated with this tenant.
      
      // If Tenant Admin, maybe just remove roles?
      // But the current requirement seems to be "Delete User".
      // We will proceed with delete but with the access check above.
      
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
      navigate('/dashboard/users');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">User not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/users')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {user.first_name} {user.last_name}
              </h1>
              <p className="text-muted-foreground">Edit user details</p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete User</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this user? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users2 className="h-5 w-5" />
                User Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UserForm user={user} onSuccess={fetchUser} />
            </CardContent>
          </Card>

          <UserRoleAssignment userId={user.id} />
        </div>
      </div>
    </DashboardLayout>
  );
}
