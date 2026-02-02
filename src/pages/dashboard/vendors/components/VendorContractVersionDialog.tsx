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
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { FileUpload } from '@/components/common/FileUpload';
import { logger } from '@/lib/logger';
import { auditLogger } from '@/lib/audit';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Download, FileText, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const versionSchema = z.object({
  comments: z.string().optional(),
});

type VersionFormValues = z.infer<typeof versionSchema>;

interface VendorContractVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  contractId: string;
  contractTitle: string;
  onSuccess: () => void;
}

export function VendorContractVersionDialog({ 
  open, 
  onOpenChange, 
  vendorId, 
  contractId, 
  contractTitle,
  onSuccess 
}: VendorContractVersionDialogProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const form = useForm<VersionFormValues>({
    resolver: zodResolver(versionSchema),
    defaultValues: {
      comments: '',
    },
  });

  useEffect(() => {
    if (open && contractId) {
      fetchVersions();
    }
  }, [open, contractId]);

  const fetchVersions = async () => {
    setLoadingVersions(true);
    try {
      const { data, error } = await supabase
        .from('vendor_contract_versions')
        .select('*')
        .eq('contract_id', contractId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error fetching versions:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleDownloadVersion = async (version: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('vendor-documents')
        .createSignedUrl(version.file_path, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
        
        auditLogger.log({
            action: 'DOWNLOAD_CONTRACT_VERSION',
            resource_type: 'vendor_contract_version',
            resource_id: version.id,
            details: { 
                vendor_id: vendorId, 
                contract_id: contractId,
                version: version.version_number
            }
        });
      }
    } catch (error) {
      console.error('Error downloading version:', error);
      toast.error('Failed to download file');
    }
  };

  const onSubmit = async (data: VersionFormValues) => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setLoading(true);
    try {
      // 1. Check Quota
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

      // 2. Get Next Version Number
      const nextVersion = (versions.length > 0) ? versions[0].version_number + 1 : 1;

      // 3. Upload File
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = selectedFile.name;
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `contracts/${vendorId}/${contractId}/v${nextVersion}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('vendor-documents')
        .upload(path, selectedFile);

      if (uploadError) throw uploadError;

      // 4. Create Version Record
      const { error: versionError } = await supabase
        .from('vendor_contract_versions')
        .insert({
          contract_id: contractId,
          version_number: nextVersion,
          file_path: path,
          file_name: fileName,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          comments: data.comments,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (versionError) throw versionError;

      // 5. Update Storage Usage
      await supabase.rpc('increment_vendor_storage', {
        p_vendor_id: vendorId,
        p_bytes: selectedFile.size
      });

      // 6. Audit Log
      await auditLogger.log({
        action: 'UPLOAD_CONTRACT_VERSION',
        resource_type: 'vendor_contract_version',
        resource_id: contractId, // Using contract ID as resource for now
        details: {
          vendor_id: vendorId,
          contract_title: contractTitle,
          version: nextVersion,
          file_name: fileName
        }
      });

      toast.success(`Version ${nextVersion} uploaded successfully`);
      form.reset();
      setSelectedFile(null);
      fetchVersions(); // Refresh list
      onSuccess();
    } catch (error: any) {
      console.error('Error uploading version:', error);
      toast.error(error.message || 'Failed to upload version');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Versions</DialogTitle>
          <DialogDescription>
            {contractTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-6">
          {/* Upload New Version */}
          <div className="bg-slate-50 p-4 rounded-lg border">
            <h4 className="font-medium mb-3 text-sm">Upload New Version</h4>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                
                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version Comments</FormLabel>
                      <FormControl>
                        <textarea 
                          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Brief description of changes..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={loading || !selectedFile} size="sm">
                    {loading ? 'Uploading...' : 'Upload Version'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          <Separator />

          {/* Version History List */}
          <div className="flex-1 min-h-0 flex flex-col">
             <h4 className="font-medium mb-3 text-sm flex items-center gap-2">
                Version History
                <Badge variant="secondary" className="ml-auto">{versions.length} versions</Badge>
             </h4>
             <ScrollArea className="flex-1 pr-4">
               {loadingVersions ? (
                 <div className="text-center py-8 text-muted-foreground text-sm">Loading history...</div>
               ) : versions.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                   No versions uploaded yet.
                 </div>
               ) : (
                 <div className="space-y-3">
                   {versions.map((version) => (
                     <div key={version.id} className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                       <div className="flex items-start gap-3">
                         <div className="bg-primary/10 p-2 rounded-full mt-1">
                           <FileText className="h-4 w-4 text-primary" />
                         </div>
                         <div>
                           <div className="flex items-center gap-2">
                             <span className="font-semibold text-sm">Version {version.version_number}</span>
                             {version.version_number === versions[0].version_number && (
                               <Badge className="text-[10px] h-5">Current</Badge>
                             )}
                           </div>
                           <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                             <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(version.created_at), 'MMM d, yyyy HH:mm')}</span>
                             <span className="flex items-center gap-1"><User className="h-3 w-3" /> {version.uploaded_by ? 'User' : 'System'}</span>
                           </p>
                           {version.comments && (
                             <p className="text-sm mt-2 text-foreground/80 bg-muted/50 p-2 rounded text-xs">
                               "{version.comments}"
                             </p>
                           )}
                           <div className="text-xs text-muted-foreground mt-1">
                             {version.file_name} ({(version.file_size / 1024 / 1024).toFixed(2)} MB)
                           </div>
                         </div>
                       </div>
                       <Button variant="outline" size="sm" onClick={() => handleDownloadVersion(version)}>
                         <Download className="h-4 w-4" />
                       </Button>
                     </div>
                   ))}
                 </div>
               )}
             </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
