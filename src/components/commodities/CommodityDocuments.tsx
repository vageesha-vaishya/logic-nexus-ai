import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileUpload } from '@/components/common/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
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

interface CommodityDocumentsProps {
  commodityId: string;
}

interface CommodityDocument {
  id: string;
  commodity_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  uploaded_by: string | null;
}

export function CommodityDocuments({ commodityId }: CommodityDocumentsProps) {
  const { supabase } = useCRM();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['commodity-documents', commodityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commodity_documents')
        .select('*')
        .eq('commodity_id', commodityId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CommodityDocument[];
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${commodityId}/${fileName}`;

      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('commodity-docs')
        .upload(filePath, file, {
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Insert into Database
      const { error: dbError } = await supabase
        .from('commodity_documents')
        .insert({
          commodity_id: commodityId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
        });

      if (dbError) {
        // Cleanup storage if DB insert fails
        await supabase.storage.from('commodity-docs').remove([filePath]);
        throw dbError;
      }
    },
    onMutate: () => {
      setUploadProgress(0);
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);
      return { interval };
    },
    onSuccess: (data, variables, context) => {
      clearInterval((context as any).interval);
      setUploadProgress(100);
      toast.success('Document uploaded successfully');
      setSelectedFile(null);
      setTimeout(() => setUploadProgress(0), 1000);
      queryClient.invalidateQueries({ queryKey: ['commodity-documents', commodityId] });
    },
    onError: (error, variables, context) => {
      clearInterval((context as any).interval);
      setUploadProgress(0);
      toast.error('Failed to upload document', { description: error.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (doc: CommodityDocument) => {
      // 1. Delete from Storage
      const { error: storageError } = await supabase.storage
        .from('commodity-docs')
        .remove([doc.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue to DB delete even if storage fails (orphan cleanup)
      }

      // 2. Delete from Database
      const { error: dbError } = await supabase
        .from('commodity_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success('Document deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['commodity-documents', commodityId] });
    },
    onError: (error) => {
      toast.error('Failed to delete document', { description: error.message });
    },
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleDownload = async (doc: CommodityDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('commodity-docs')
        .createSignedUrl(doc.file_path, 60); // 1 minute expiry

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      toast.error('Failed to download document', { description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>
            Attach relevant documents such as MSDS, Technical Sheets, or Certificates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <FileUpload
              onFileSelect={handleFileSelect}
              value={selectedFile}
              onClear={() => setSelectedFile(null)}
              progress={uploadProgress}
              disabled={uploadMutation.isPending}
            />
            <div className="flex justify-end">
              <Button 
                onClick={handleUpload} 
                disabled={!selectedFile || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attached Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading documents...</div>
          ) : documents && documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        {doc.file_name}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[100px] truncate" title={doc.file_type || 'Unknown'}>
                      {doc.file_type || '-'}
                    </TableCell>
                    <TableCell>
                      {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(doc)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{doc.file_name}". This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteMutation.mutate(doc)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              No documents attached.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
