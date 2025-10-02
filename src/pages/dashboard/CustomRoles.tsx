import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { CustomRoleDialog } from "@/components/roles/CustomRoleDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CustomRoles() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<any>(null);

  const { data: roles, isLoading } = useQuery({
    queryKey: ["custom_roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_roles")
        .select(`
          *,
          custom_role_permissions(permission_key)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from("custom_roles")
        .delete()
        .eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_roles"] });
      toast.success("Role deleted successfully");
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete role");
    },
  });

  const handleEdit = (role: any) => {
    setSelectedRole(role);
    setDialogOpen(true);
  };

  const handleDelete = (role: any) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedRole(null);
    setDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Custom Roles</h1>
          <p className="text-muted-foreground">
            Create and manage custom roles with specific permissions
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-full mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : roles && roles.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                  </div>
                  <Badge variant={role.is_active ? "default" : "secondary"}>
                    {role.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>{role.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Permissions:</p>
                    <div className="flex flex-wrap gap-1">
                      {role.custom_role_permissions?.length > 0 ? (
                        role.custom_role_permissions.slice(0, 3).map((perm: any, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {perm.permission_key}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No permissions</span>
                      )}
                      {role.custom_role_permissions?.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{role.custom_role_permissions.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!role.is_system_role && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(role)}
                        className="flex-1"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(role)}
                        className="flex-1"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No custom roles yet</p>
            <p className="text-muted-foreground mb-4">
              Create your first custom role to get started
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </Button>
          </CardContent>
        </Card>
      )}

      <CustomRoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={selectedRole}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{roleToDelete?.name}"? This action cannot be
              undone and will remove all role assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => roleToDelete && deleteMutation.mutate(roleToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
