import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportFranchiseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface ImportData {
  [key: string]: any;
}

import { useCRM } from '@/hooks/useCRM';

export function ImportFranchiseModal({
  open,
  onOpenChange,
  onImportComplete,
}: ImportFranchiseModalProps) {
  const { context } = useCRM();
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'complete'>('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    setIsLoading(true);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setData(results.data as ImportData[]);
          setIsLoading(false);
          setStep('preview');
        },
        error: (err) => {
          setError(`Error parsing CSV: ${err.message}`);
          setIsLoading(false);
        },
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const parsedData = XLSX.utils.sheet_to_json(sheet);
          setData(parsedData as ImportData[]);
          setIsLoading(false);
          setStep('preview');
        } catch (err) {
          setError('Error parsing Excel file');
          setIsLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setError('Unsupported file format. Please upload a CSV or Excel file.');
      setIsLoading(false);
    }
  };

  const handleProcessWithAI = async () => {
    setStep('processing');
    setIsLoading(true);
    setProgress(10);

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('process-franchise-import', {
        body: { data },
      });

      if (invokeError) throw invokeError;
      if (!result.success) throw new Error(result.error || 'Processing failed');

      setProgress(50);
      
      const processedData = result.data.map((item: any) => ({
        ...item,
        processed: true
      }));

      await new Promise((resolve) => setTimeout(resolve, 500));
      setProgress(100);
      setData(processedData);
      setStep('complete');
      setIsLoading(false);
      toast.success('Data processed successfully by AI');

    } catch (err: any) {
      console.error('Processing error:', err);
      setError(err.message || 'Failed to process data with AI');
      setIsLoading(false);
      setStep('preview');
    }
  };

  const handleImport = async () => {
    setIsLoading(true);
    try {
      const franchisesToInsert = data.map(item => {
        // Determine tenant_id
        const tenantId = context.tenantId || item.tenant_id;
        
        if (!tenantId) {
          throw new Error(`Tenant ID is missing for record: ${item.name}. Please switch to a tenant context or include tenant_id in the file.`);
        }

        return {
          name: item.name,
          code: item.code,
          tenant_id: tenantId,
          is_active: item.is_active ?? true,
          address: item.address,
        };
      });
      
      const { error } = await supabase.from('franchises').insert(franchisesToInsert);
      
      if (error) throw error;
      
      toast.success(`Successfully imported ${data.length} franchises`);
      onImportComplete?.();
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to save data to database');
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setData([]);
    setError(null);
    setStep('upload');
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) resetState();
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Franchises</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to import franchise profiles. 
            Our AI agent will help map and validate the data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center hover:bg-accent/50 transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-primary font-semibold hover:underline">Click to upload</span>
                {' '}or drag and drop
                <Input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                />
              </Label>
              <p className="text-sm text-muted-foreground mt-2">
                CSV or Excel files (max 10MB)
              </p>
            </div>
          )}

          {(step === 'preview' || step === 'processing' || step === 'complete') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <span className="font-medium">{file?.name}</span>
                  <span className="text-sm text-muted-foreground">({data.length} records)</span>
                </div>
                {step === 'preview' && (
                  <Button variant="outline" size="sm" onClick={resetState}>
                    Change File
                  </Button>
                )}
              </div>

              {step === 'processing' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing with AI...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {data.length > 0 && Object.keys(data[0]).map((header) => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row, i) => {
                      const missingName = !row.name && !row.Name;
                      const missingCode = !row.code && !row.Code;
                      const missingTenant = !context.tenantId && !row.tenant_id;
                      const hasError = missingName || missingCode || missingTenant;

                      return (
                        <TableRow key={i} className={hasError ? "bg-red-50 hover:bg-red-100" : ""}>
                          {Object.keys(data[0]).map((key, j) => {
                            const cell = row[key];
                            const isRequired = 
                              (key.toLowerCase() === 'name' && missingName) || 
                              (key.toLowerCase() === 'code' && missingCode) || 
                              (key === 'tenant_id' && missingTenant);

                            return (
                              <TableCell key={j} className={isRequired ? "text-red-600 font-medium" : ""}>
                                {typeof cell === 'object' ? JSON.stringify(cell) : String(cell ?? '')}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === 'preview' && (
            <Button onClick={handleProcessWithAI} disabled={isLoading || data.length === 0}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Process with AI
            </Button>
          )}
          {step === 'complete' && (
            <Button onClick={handleImport} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
