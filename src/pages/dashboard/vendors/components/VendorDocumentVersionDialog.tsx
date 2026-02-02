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
import { auditLogger } from '@/lib/audit';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Download, FileText, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

import { Input } from '@/components/ui/input';

const versionSchema = z.object({
  comments: z.string().optional(),
});

type VersionFormValues = z.infer<typeof versionSchema>;

interface VendorDocumentVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  documentId: string;
  documentName: string;
  onSuccess: () => void;
}

export function VendorDocumentVersionDialog({ 
  open, 
  onOpenChange, 
  vendorId, 
  documentId, 
  documentName,
  onSuccess 
}: VendorDocumentVersionDialogProps) {
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
    if (open && documentId) {
      fetchVersions();
    }
  }, [open, documentId]);

  const fetchVersions = async () => {
    setLoadingVersions(true);
    try {
      const { data, error } = await supabase
        .from('vendor_document_versions')
        .select('*')
        .eq('document_id', documentId)
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
            action: 'DOWNLOAD_DOCUMENT_VERSION',
            resource_type: 'vendor_document_version',
            resource_id: version.id,
            details: { 
                vendor_id: vendorId, 
                document_id: documentId,
                version_number: version.version_number
            }
        });
      }
    } catch (error: any) {
      console.error('Error downloading version:', error);
      toast.error('Failed to access file');
    }
  };

  const onSubmit = async (data: VersionFormValues) => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setLoading(true);
    try {
      // 1. Upload File
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${vendorId}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('vendor-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Get next version number
      const nextVersion = versions.length > 0 ? versions[0].version_number + 1 : 1;

      // 3. Create Version Record
      const { error: versionError } = await supabase
        .from('vendor_document_versions')
        .insert({
          document_id: documentId,
          version_number: nextVersion,
          file_path: fileName,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
          comments: data.comments
        });

      if (versionError) throw versionError;

      // 4. Update Main Document Record (to reflect latest file)
      const { error: updateError } = await supabase
        .from('vendor_documents')
        .update({
            file_path: fileName,
            name: selectedFile.name, // Optionally update name
            file_size: selectedFile.size,
            mime_type: selectedFile.type,
            updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (updateError) throw updateError;

      toast.success(`Version ${nextVersion} uploaded successfully`);
      
      await auditLogger.log({
        action: 'UPLOAD_DOCUMENT_VERSION',
        resource_type: 'vendor_document',
        resource_id: documentId,
        details: {
          vendor_id: vendorId,
          version: nextVersion,
          file_name: selectedFile.name
        }
      });

      form.reset();
      setSelectedFile(null);
      fetchVersions();
      onSuccess();
    } catch (error: any) {
      console.error('Error uploading version:', error);
      toast.error('Failed to upload version');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Document Version History</DialogTitle>
          <DialogDescription>
            Manage versions for {documentName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Upload New Version */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium">Upload New Version</h4>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FileUpload
                            value={selectedFile}
                            onFileSelect={setSelectedFile}
                            onClear={() => setSelectedFile(null)}
                            accept={{
                                'application/pdf': ['.pdf'],
                                'image/*': ['.png', '.jpg', '.jpeg'],
                                'application/msword': ['.doc'],
                                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                                'application/vnd.ms-excel': ['.xls', '.xlsx']
                            }}
                            maxSize={10 * 1024 * 1024} // 10MB
                        />
                        
                        <FormField
                            control={form.control}
                            name="comments"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Comments (Optional)</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Reason for update..." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit" className="w-full" disabled={loading || !selectedFile}>
                            {loading ? 'Uploading...' : 'Upload Version'}
                        </Button>
                    </form>
                </Form>
            </div>

            {/* Version History */}
            <div className="border-l pl-6">
                <h4 className="text-sm font-medium mb-4">History</h4>
                <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                        {loadingVersions ? (
                            <div className="text-center text-muted-foreground py-8">Loading...</div>
                        ) : versions.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">No versions found.</div>
                        ) : (
                            versions.map((version) => (
                                <div key={version.id} className="flex flex-col space-y-2 p-3 border rounded-lg bg-muted/30">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={version.version_number === versions[0].version_number ? "default" : "secondary"}>
                                                v{version.version_number}
                                            </Badge>
                                            <span className="font-medium text-sm truncate max-w-[120px]" title={version.file_name}>
                                                {version.file_name}
                                            </span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDownloadVersion(version)}>
                                            <Download className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {format(new Date(version.created_at), 'MMM d, yyyy')}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            System
                                        </div>
                                    </div>
                                    
                                    {version.comments && (
                                        <p className="text-xs text-muted-foreground mt-1 border-t pt-2">
                                            {version.comments}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
