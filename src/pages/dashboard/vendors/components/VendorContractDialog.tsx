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

const contractSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  contract_number: z.string().optional(),
  type: z.enum(['service_agreement', 'nda', 'sow', 'rate_agreement']),
  status: z.enum(['draft', 'active', 'expired', 'terminated', 'renewed']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  value: z.coerce.number().min(0).optional(),
  currency: z.string().default('USD'),
  tags: z.string().optional(),
  folder_id: z.string().optional(),
});

type ContractFormValues = z.infer<typeof contractSchema>;

interface VendorContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  folders?: VendorFolder[];
  defaultFolder?: string;
  onSuccess: () => void;
}

export function VendorContractDialog({ open, onOpenChange, vendorId, folders = [], defaultFolder = 'General', onSuccess }: VendorContractDialogProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      title: '',
      contract_number: '',
      type: 'service_agreement',
      status: 'draft',
      currency: 'USD',
      start_date: new Date().toISOString().split('T')[0],
      tags: '',
      folder_id: '',
    },
  });

  useEffect(() => {
    if (open) {
      let initialFolderId = '';
      
      // Try to find folder by name from defaultFolder prop
      if (defaultFolder && defaultFolder !== 'All') {
        const folder = folders.find(f => f.name === defaultFolder);
        if (folder) {
          initialFolderId = folder.id;
        }
      }
      
      // Fallback to General if no folder found or defaultFolder is All
      if (!initialFolderId) {
        const generalFolder = folders.find(f => f.name === 'General');
        if (generalFolder) {
          initialFolderId = generalFolder.id;
        }
      }

      form.reset({
        title: '',
        contract_number: '',
        type: 'service_agreement',
        status: 'draft',
        currency: 'USD',
        start_date: new Date().toISOString().split('T')[0],
        tags: '',
        folder_id: initialFolderId,
      });
      setSelectedFile(null);
    }
  }, [open, defaultFolder, folders, form]);

  const onSubmit = async (data: ContractFormValues) => {
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
            toast.error('Storage quota exceeded (1GB limit).');
            setLoading(false);
            return;
        }
      }

      // Resolve folder_id
      const targetFolderId = data.folder_id || null;

      // 1. Create Contract
      const payload = {
        vendor_id: vendorId,
        title: data.title,
        contract_number: data.contract_number,
        type: data.type,
        status: data.status,
        start_date: data.start_date,
        currency: data.currency,
        value: data.value || 0,
        end_date: data.end_date || null,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        folder_id: targetFolderId,
        created_at: new Date().toISOString(),
      };

      const { data: contract, error: contractError } = await supabase
        .from('vendor_contracts')
        .insert(payload)
        .select()
        .single();

      if (contractError) throw contractError;

      // 2. Upload File & Create Version (if file selected)
      if (selectedFile && contract) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = selectedFile.name; 
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `contracts/${vendorId}/${contract.id}/v1/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('vendor-documents')
          .upload(path, selectedFile);

        if (uploadError) {
          console.error('File upload failed:', uploadError);
          toast.error('Contract created but file upload failed');
        } else {
          // Create Version Record
          const { error: versionError } = await supabase
            .from('vendor_contract_versions')
            .insert({
              contract_id: contract.id,
              version_number: 1,
              file_path: path,
              file_name: fileName,
              file_size: selectedFile.size,
              mime_type: selectedFile.type,
              uploaded_by: (await supabase.auth.getUser()).data.user?.id
            });

          if (versionError) {
            console.error('Version creation failed:', versionError);
            toast.error('Contract created but version record failed');
          } else {
             // Update storage usage
             await supabase.rpc('increment_vendor_storage', {
                p_vendor_id: vendorId,
                p_bytes: selectedFile.size
            });
          }
        }
      }

      toast.success('Contract created successfully');

      // Legacy logger
      logger.info(`Contract created: ${data.title}`, {
        type: 'AUDIT',
        action: 'CREATE_CONTRACT',
        vendor_id: vendorId,
        contract_id: contract.id
      });

      // New Audit Logger
      await auditLogger.log({
        action: 'CREATE_CONTRACT',
        resource_type: 'vendor_contract',
        resource_id: contract.id,
        details: {
          vendor_id: vendorId,
          contract_title: data.title,
          folder_id: payload.folder_id,
          has_file: !!selectedFile
        }
      });

      form.reset();
      setSelectedFile(null);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating contract:', error);
      toast.error(error.message || 'Failed to create contract');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Contract</DialogTitle>
          <DialogDescription>Create a new contract for this vendor.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Master Service Agreement" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contract_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        {(!folders.length || !folders.find(f => f.name === 'General')) && (
                             <SelectItem value="general">General</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
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
                        <SelectItem value="service_agreement">Service Agreement</SelectItem>
                        <SelectItem value="nda">NDA</SelectItem>
                        <SelectItem value="sow">Statement of Work</SelectItem>
                        <SelectItem value="rate_agreement">Rate Agreement</SelectItem>
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
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                        <SelectItem value="renewed">Renewed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="CNY">CNY</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (comma separated)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. vital, 2025" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Contract Document</FormLabel>
              <FileUpload
                value={selectedFile}
                onFileSelect={setSelectedFile}
                onClear={() => setSelectedFile(null)}
                accept={{
                  'application/pdf': ['.pdf'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
                }}
                maxSize={25 * 1024 * 1024} // 25MB
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Contract'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
