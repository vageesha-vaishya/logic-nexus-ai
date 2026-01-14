import { useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileArchive, CheckCircle2, XCircle, AlertTriangle, Clock, HardDrive, FileText } from 'lucide-react';
import { FileValidationResult } from '@/types/database-migration';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  onFileSelect: (file: File) => Promise<FileValidationResult>;
  validationResult: FileValidationResult | null;
  selectedFile: File | null;
  disabled?: boolean;
}

export function FileUploadZone({ onFileSelect, validationResult, selectedFile, disabled }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.zip')) {
        setIsValidating(true);
        try {
          await onFileSelect(file);
        } finally {
          setIsValidating(false);
        }
      }
    }
  }, [onFileSelect, disabled]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsValidating(true);
      try {
        await onFileSelect(files[0]);
      } finally {
        setIsValidating(false);
      }
    }
  }, [onFileSelect]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `~${seconds} seconds`;
    if (seconds < 3600) return `~${Math.ceil(seconds / 60)} minutes`;
    return `~${(seconds / 3600).toFixed(1)} hours`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="h-5 w-5" />
          Backup File Selection
        </CardTitle>
        <CardDescription>
          Upload your database export package (.zip)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 transition-all text-center",
            isDragging && "border-primary bg-primary/5",
            disabled && "opacity-50 cursor-not-allowed",
            !disabled && !isDragging && "hover:border-primary/50 hover:bg-muted/50 cursor-pointer",
            validationResult?.isValid && "border-green-500/50 bg-green-500/5",
            validationResult && !validationResult.isValid && "border-destructive/50 bg-destructive/5"
          )}
        >
          <input
            type="file"
            accept=".zip"
            onChange={handleFileInput}
            disabled={disabled || isValidating}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <div className="flex flex-col items-center gap-3">
            {isValidating ? (
              <>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <FileArchive className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Validating file...</p>
              </>
            ) : selectedFile ? (
              <>
                <div className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center",
                  validationResult?.isValid ? "bg-green-500/10" : "bg-destructive/10"
                )}>
                  {validationResult?.isValid ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Drop your backup file here</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>
                <Badge variant="outline" className="mt-2">.zip files only</Badge>
              </>
            )}
          </div>
        </div>

        {/* File Info */}
        {validationResult?.fileInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">File Size</p>
                <p className="text-sm font-medium">{formatFileSize(validationResult.fileInfo.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Est. Time</p>
                <p className="text-sm font-medium">{formatTime(validationResult.fileInfo.estimatedProcessingTime)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Data Files</p>
                <p className="text-sm font-medium">{validationResult.manifest?.dataFiles?.length || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Schema Files</p>
                <p className="text-sm font-medium">{validationResult.manifest?.schemaFiles?.length || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Validation Messages */}
        {validationResult && (validationResult.issues.length > 0 || validationResult.warnings.length > 0) && (
          <div className="space-y-2">
            {validationResult.issues.length > 0 && (
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
                  <XCircle className="h-4 w-4" />
                  Issues
                </div>
                <ul className="list-disc list-inside text-xs text-destructive/80 space-y-0.5">
                  {validationResult.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {validationResult.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 text-amber-600 text-sm font-medium mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </div>
                <ul className="list-disc list-inside text-xs text-amber-600/80 space-y-0.5">
                  {validationResult.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tables Preview */}
        {validationResult?.manifest?.tables && validationResult.manifest.tables.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Tables to Migrate ({validationResult.manifest.tables.length})</p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg bg-muted/30">
              {validationResult.manifest.tables.map((table, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {table}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
