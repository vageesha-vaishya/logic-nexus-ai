
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { auditLogger } from '@/lib/audit';

const folderSchema = z.object({
  name: z.string().min(1, 'Folder name is required'),
  read_access: z.string(),
  write_access: z.string(),
});

type FolderFormValues = z.infer<typeof folderSchema>;

interface VendorFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  folder?: any; // If provided, we are editing
  onSuccess: () => void;
}

export function VendorFolderDialog({ open, onOpenChange, vendorId, folder, onSuccess }: VendorFolderDialogProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);

  const form = useForm<FolderFormValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: {
      name: '',
      read_access: '*',
      write_access: 'admin,manager',
    },
  });

  useEffect(() => {
    if (open) {
      if (folder) {
        form.reset({
          name: folder.name,
          read_access: folder.permissions?.read?.join(',') || '*',
          write_access: folder.permissions?.write?.join(',') || 'admin,manager',
        });
      } else {
        form.reset({
          name: '',
          read_access: '*',
          write_access: 'admin,manager',
        });
      }
    }
  }, [open, folder, form]);

  const onSubmit = async (data: FolderFormValues) => {
    setLoading(true);
    try {
      const permissions = {
        read: data.read_access.split(',').map(s => s.trim()),
        write: data.write_access.split(',').map(s => s.trim()),
      };

      if (folder) {
        // Update
        const { error } = await supabase
          .from('vendor_folders')
          .update({
            name: data.name,
            permissions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', folder.id);
        if (error) throw error;
        toast.success('Folder updated successfully');

        await auditLogger.log({
          action: 'UPDATE_FOLDER',
          resource_type: 'vendor_folder',
          resource_id: folder.id,
          details: {
            vendor_id: vendorId,
            folder_name: data.name,
            permissions
          }
        });
      } else {
        // Create
        const { data: newFolder, error } = await supabase
          .from('vendor_folders')
          .insert({
            vendor_id: vendorId,
            name: data.name,
            permissions,
          })
          .select()
          .single();
        if (error) throw error;
        toast.success('Folder created successfully');

        await auditLogger.log({
          action: 'CREATE_FOLDER',
          resource_type: 'vendor_folder',
          resource_id: newFolder?.id,
          details: {
            vendor_id: vendorId,
            folder_name: data.name,
            permissions
          }
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving folder:', error);
      toast.error(error.message || 'Failed to save folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{folder ? 'Edit Folder' : 'Create New Folder'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Legal Documents" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="read_access"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Read Access</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select read access" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="*">Everyone (*)</SelectItem>
                      <SelectItem value="admin,manager">Admins & Managers</SelectItem>
                      <SelectItem value="admin">Admins Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="write_access"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Write Access</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select write access" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="*">Everyone (*)</SelectItem>
                      <SelectItem value="admin,manager">Admins & Managers</SelectItem>
                      <SelectItem value="admin">Admins Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (folder ? 'Update Folder' : 'Create Folder')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
