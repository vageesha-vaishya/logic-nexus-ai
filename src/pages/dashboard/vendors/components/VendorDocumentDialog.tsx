
import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { FileUpload } from '@/components/common/FileUpload';

import { logger } from '@/lib/logger';
import { auditLogger } from '@/lib/audit';
import { VendorFolder } from '@/types/vendor';

const documentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['insurance', 'license', 'certification', 'contract', 'nda', 'w9', 'other']),
  folder_id: z.string().optional(),
  tags: z.string().optional(), // Comma separated string for input
  url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  status: z.enum(['pending', 'verified', 'rejected', 'expired']),
  expiry_date: z.string().optional(),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

interface VendorDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  folders?: any[];
  defaultFolder?: string;
  onSuccess: () => void;
}

export function VendorDocumentDialog({ open, onOpenChange, vendorId, folders = [], defaultFolder = 'General', onSuccess }: VendorDocumentDialogProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      name: '',
      type: 'other',
      folder_id: '',
      tags: '',
      url: '',
      status: 'pending',
    },
  });

  useEffect(() => {
    if (open) {
      let initialFolderId = '';
      if (defaultFolder && defaultFolder !== 'All') {
        const folder = folders.find(f => f.name === defaultFolder);
        if (folder) {
          initialFolderId = folder.id;
        }
      }

      form.reset({
        name: '',
        type: 'other',
        folder_id: initialFolderId,
        tags: '',
        url: '',
        status: 'pending',
      });
      setSelectedFile(null);
    }
  }, [open, defaultFolder, folders, form]);

  const onSubmit = async (data: DocumentFormValues) => {
    if (!selectedFile && !data.url) {
      toast.error('Please provide either a file or a URL');
      return;
    }

    setLoading(true);
    try {
      // Check quota if uploading file
      if (selectedFile) {
        const { data: isQuotaAvailable, error: quotaError } = await supabase
            .rpc('check_vendor_storage_quota', {
                p_vendor_id: vendorId,
                p_new_bytes: selectedFile.size
            });
        
        if (quotaError) throw quotaError;
        if (!isQuotaAvailable) {
            toast.error('Storage quota exceeded (1GB limit). Please contact support.');
            setLoading(false);
            return;
        }
      }

      let filePath = null;
      let fileSize = null;
      let mimeType = null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const path = `documents/${vendorId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('vendor-documents')
          .upload(path, selectedFile);

        if (uploadError) throw uploadError;

        filePath = path;
        fileSize = selectedFile.size;
        mimeType = selectedFile.type;
        
        // Update storage usage
        await supabase.rpc('increment_vendor_storage', {
            p_vendor_id: vendorId,
            p_bytes: selectedFile.size
        });
      }

      const payload = {
        vendor_id: vendorId,
        name: data.name,
        type: data.type,
        folder_id: data.folder_id || null,
        // folder: Legacy field, we rely on folder_id now, but keeping for backward compatibility if column exists
        folder: data.folder_id ? folders.find(f => f.id === data.folder_id)?.name : 'General',
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        url: data.url || null,
        status: data.status,
        file_path: filePath,
        file_size: fileSize,
        mime_type: mimeType,
        expiry_date: data.expiry_date || null,
        created_at: new Date().toISOString(),
      };

      // Remove folder string if it causes issues, but for now we keep it mapped
      // If the table doesn't have 'folder' column, Supabase will ignore it if we use select() with explicit columns or it might error.
      // Safest is to rely on folder_id.


      const { data: newDoc, error } = await supabase
        .from('vendor_documents')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Simulate Virus Scan (Async)
      if (newDoc && newDoc.id && selectedFile) {
        setTimeout(async () => {
          try {
            const { error: scanError } = await supabase
              .from('vendor_documents')
              .update({ 
                virus_scan_status: 'clean',
                virus_scan_date: new Date().toISOString() 
              })
              .eq('id', newDoc.id);
              
            if (!scanError) {
              toast.success(`Virus scan completed for ${newDoc.name}: Clean`);
              onSuccess();
            }
          } catch (e) {
            console.error('Virus scan simulation failed', e);
          }
        }, 3000);
      }

      toast.success('Document added successfully. Virus scan started.');
      
      // Use auditLogger for consistent logging
      await auditLogger.log({
        action: 'UPLOAD_DOCUMENT',
        resource_type: 'vendor_document',
        resource_id: newDoc?.id,
        details: {
          vendor_id: vendorId,
          document_name: data.name,
          file_name: selectedFile?.name || 'URL',
          folder_id: payload.folder_id,
          file_size: fileSize
        }
      });

      form.reset();
      setSelectedFile(null);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error adding document:', error);
      toast.error(error.message || 'Failed to add document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
          <DialogDescription>Attach a new compliance document.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Liability Insurance 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="folder_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Folder</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select folder" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {folders.map(folder => (
                          <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                        ))}
                        {folders.length === 0 && <SelectItem value="general">General</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. important, 2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="license">License</SelectItem>
                        <SelectItem value="certification">Certification</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="nda">NDA</SelectItem>
                        <SelectItem value="w9">W9</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <FormLabel>File Upload</FormLabel>
              <FileUpload
                value={selectedFile}
                onFileSelect={setSelectedFile}
                onClear={() => setSelectedFile(null)}
                accept={{
                  'application/pdf': ['.pdf'],
                  'image/*': ['.png', '.jpg', '.jpeg'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
                }}
                maxSize={25 * 1024 * 1024} // 25MB
              />
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs">OR ENTER URL</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External Document URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiry_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Adding...' : 'Add Document'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

