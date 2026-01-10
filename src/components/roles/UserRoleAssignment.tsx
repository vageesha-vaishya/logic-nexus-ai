import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCRM } from "@/hooks/useCRM";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { ScopedDataAccess, DataAccessContext } from "@/lib/db/access";

interface UserRoleAssignmentProps {
  userId: string;
}

export function UserRoleAssignment({ userId }: UserRoleAssignmentProps) {
  const { profile } = useAuth();
  const { supabase, context } = useCRM();
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  // Fetch available custom roles
  const { data: availableRoles } = useQuery({
    queryKey: ["custom_roles", context.tenantId],
    queryFn: async () => {
      const db = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { data, error } = await (db as any)
        .from("custom_roles")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch user's assigned custom roles
  const { data: userRoles, isLoading } = useQuery({
    queryKey: ["user_custom_roles", userId, context.tenantId],
    queryFn: async () => {
      const { data, error } = await new ScopedDataAccess(supabase, context)
        .from("user_custom_roles")
        .select(`
          *,
          custom_roles(*)
        `)
        .eq("user_id", userId);
      if (error) throw error;
      return data as any[];
    },
  });

  // Assign role mutation
  const assignMutation = useMutation({
    mutationFn: async (roleId: string) => {
      // We need to determine the tenant_id for the assignment.
      // If we are scoped to a tenant (context.tenantId), use that.
      // If platform admin and no tenant selected in context (which is rare for this view if it's tenant-specific), 
      // we might need to handle it. But usually custom roles are tenant-specific.
      
      const tenantId = context.tenantId;
      
      if (!tenantId && !context.isPlatformAdmin) {
        throw new Error("No tenant context found");
      }

      // If platform admin and no tenant, maybe we shouldn't assign? 
      // But ScopedDataAccess handles injection if we use it for insert?
      // Wait, ScopedDataAccess.insert injects tenant_id if it's missing in payload?
      // Yes, if configured.
      
      // Let's use ScopedDataAccess for insert too.
      
      const db = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { error } = await (db as any)
        .from("user_custom_roles")
        .insert({
          user_id: userId,
          role_id: roleId,
          // tenant_id will be injected by ScopedDataAccess if not provided and user is scoped.
          // If platform admin, we should probably provide it if we know it.
          // For now, let's assume the context has the correct tenant or we rely on the custom_role's tenant?
          // Actually, user_custom_roles table usually has tenant_id.
          tenant_id: tenantId, 
          assigned_by: profile?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_custom_roles", userId] });
      toast.success("Role assigned successfully");
      setSelectedRoleId("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign role");
    },
  });

  // Revoke role mutation
  const revokeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const db = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { error } = await (db as any)
        .from("user_custom_roles")
        .delete()
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_custom_roles", userId] });
      toast.success("Role revoked successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to revoke role");
    },
  });

  const handleAssign = () => {
    if (selectedRoleId) {
      assignMutation.mutate(selectedRoleId);
    }
  };

  const handleRevoke = (assignmentId: string) => {
    revokeMutation.mutate(assignmentId);
  };

  // Filter out already assigned roles
  const unassignedRoles = availableRoles?.filter(
    (role) => !userRoles?.some((ur) => ur.role_id === role.id)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Roles</CardTitle>
        <CardDescription>Manage additional custom roles for this user</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assigned roles */}
        <div>
          <p className="text-sm font-medium mb-2">Assigned Roles:</p>
          {isLoading ? (
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-muted rounded animate-pulse" />
              <div className="h-6 w-24 bg-muted rounded animate-pulse" />
            </div>
          ) : userRoles && userRoles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {userRoles.map((assignment) => (
                <Badge key={assignment.id} variant="secondary" className="gap-1">
                  {assignment.custom_roles?.name}
                  <button
                    onClick={() => handleRevoke(assignment.id)}
                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No custom roles assigned</p>
          )}
        </div>

        {/* Assign new role */}
        {unassignedRoles && unassignedRoles.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a role to assign" />
              </SelectTrigger>
              <SelectContent>
                {unassignedRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssign}
              disabled={!selectedRoleId || assignMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-1" />
              Assign
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
