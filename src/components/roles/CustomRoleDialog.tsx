import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ROLE_PERMISSIONS } from "@/config/permissions";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
});

type FormData = z.infer<typeof formSchema>;

interface CustomRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: any;
}

export function CustomRoleDialog({ open, onOpenChange, role }: CustomRoleDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [allPermissions, setAllPermissions] = useState<string[]>([]);

  useEffect(() => {
    // Extract all unique permissions from ROLE_PERMISSIONS
    const permissions = new Set<string>();
    Object.values(ROLE_PERMISSIONS).forEach((rolePerms) => {
      rolePerms.forEach((perm) => permissions.add(perm));
    });
    setAllPermissions(Array.from(permissions).sort());
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      is_active: true,
      permissions: [],
    },
  });

  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description || "",
        is_active: role.is_active,
        permissions: role.custom_role_permissions?.map((p: any) => p.permission_key) || [],
      });
    } else {
      form.reset({
        name: "",
        description: "",
        is_active: true,
        permissions: [],
      });
    }
  }, [role, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (role) {
        // Update existing role
        const { error: roleError } = await supabase
          .from("custom_roles")
          .update({
            name: data.name,
            description: data.description,
            is_active: data.is_active,
          })
          .eq("id", role.id);

        if (roleError) throw roleError;

        // Delete old permissions
        const { error: deleteError } = await supabase
          .from("custom_role_permissions")
          .delete()
          .eq("role_id", role.id);

        if (deleteError) throw deleteError;

        // Insert new permissions
        if (data.permissions.length > 0) {
          const { error: permError } = await supabase
            .from("custom_role_permissions")
            .insert(
              data.permissions.map((perm) => ({
                role_id: role.id,
                permission_key: perm,
              }))
            );

          if (permError) throw permError;
        }
      } else {
        // Create new role
        const { data: newRole, error: roleError } = await supabase
          .from("custom_roles")
          .insert({
            name: data.name,
            description: data.description,
            is_active: data.is_active,
            tenant_id: profile?.id, // This should be the actual tenant_id
          })
          .select()
          .single();

        if (roleError) throw roleError;

        // Insert permissions
        if (data.permissions.length > 0) {
          const { error: permError } = await supabase
            .from("custom_role_permissions")
            .insert(
              data.permissions.map((perm) => ({
                role_id: newRole.id,
                permission_key: perm,
              }))
            );

          if (permError) throw permError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_roles"] });
      toast.success(role ? "Role updated successfully" : "Role created successfully");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save role");
    },
  });

  const onSubmit = (data: FormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? "Edit Custom Role" : "Create Custom Role"}</DialogTitle>
          <DialogDescription>
            Define a custom role with specific permissions for your organization
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Sales Manager" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this role can do..."
                      {...field}
                    />
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
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive roles cannot be assigned to users
                    </FormDescription>
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
              name="permissions"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel>Permissions</FormLabel>
                    <FormDescription>
                      Select the permissions this role should have
                    </FormDescription>
                  </div>
                  <ScrollArea className="h-[300px] rounded-md border p-4">
                    <div className="space-y-4">
                      {allPermissions.map((permission) => (
                        <FormField
                          key={permission}
                          control={form.control}
                          name="permissions"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={permission}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(permission)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, permission])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== permission
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {permission}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : role ? "Update Role" : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
