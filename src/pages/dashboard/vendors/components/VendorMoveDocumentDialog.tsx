import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { auditLogger } from '@/lib/audit';

const moveSchema = z.object({
  folder_id: z.string().min(1, 'Please select a destination folder'),
});

type MoveFormValues = z.infer<typeof moveSchema>;

interface VendorMoveDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  documentIds: string[];
  folders: any[];
  onSuccess: () => void;
}

export function VendorMoveDocumentDialog({
  open,
  onOpenChange,
  vendorId,
  documentIds,
  folders,
  onSuccess,
}: VendorMoveDocumentDialogProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);

  const form = useForm<MoveFormValues>({
    resolver: zodResolver(moveSchema),
    defaultValues: {
      folder_id: '',
    },
  });

  const onSubmit = async (data: MoveFormValues) => {
    if (documentIds.length === 0) {
      toast.error('No documents selected');
      return;
    }

    setLoading(true);
    try {
      // 1. Update documents
      const { error } = await supabase
        .from('vendor_documents')
        .update({ folder_id: data.folder_id })
        .in('id', documentIds);

      if (error) throw error;

      // 2. Audit Log
      const targetFolder = folders.find(f => f.id === data.folder_id);
      await auditLogger.log({
        action: 'MOVE_DOCUMENTS',
        resource_type: 'vendor_document',
        resource_id: vendorId, // Using vendor_id as resource since multiple docs
        details: {
          vendor_id: vendorId,
          document_ids: documentIds,
          target_folder: targetFolder?.name || 'Unknown',
          count: documentIds.length
        }
      });

      toast.success(`Moved ${documentIds.length} documents successfully`);
      form.reset();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error moving documents:', error);
      toast.error(error.message || 'Failed to move documents');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Move Documents</DialogTitle>
          <DialogDescription>
            Move {documentIds.length} selected document{documentIds.length !== 1 ? 's' : ''} to a different folder.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="folder_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination Folder</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select folder" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {folders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Moving...' : 'Move Documents'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
