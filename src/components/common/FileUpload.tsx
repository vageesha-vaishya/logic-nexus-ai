
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onClear?: () => void;
  accept?: Record<string, string[]>;
  maxSize?: number; // in bytes
  progress?: number;
  error?: string | null;
  disabled?: boolean;
  className?: string;
  value?: File | null;
}

export function FileUpload({
  onFileSelect,
  onClear,
  accept = {
    'application/pdf': ['.pdf'],
    'image/*': ['.png', '.jpg', '.jpeg'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
  },
  maxSize = 25 * 1024 * 1024, // 25MB
  progress = 0,
  error: externalError,
  disabled = false,
  className,
  value
}: FileUploadProps) {
  const [internalError, setInternalError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setInternalError(null);

    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors[0].code === 'file-too-large') {
        setInternalError(`File is too large. Max size is ${maxSize / 1024 / 1024}MB.`);
      } else if (rejection.errors[0].code === 'file-invalid-type') {
        setInternalError('Invalid file type.');
      } else {
        setInternalError(rejection.errors[0].message);
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [maxSize, onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: disabled || !!value
  });

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) onClear();
    setInternalError(null);
  };

  const error = externalError || internalError;

  return (
    <div className={cn("w-full", className)}>
      {!value ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50",
            error ? "border-red-200 bg-red-50" : "",
            disabled ? "opacity-50 cursor-not-allowed hover:bg-transparent hover:border-slate-200" : ""
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-2">
            <div className={cn("p-3 rounded-full bg-slate-100", isDragActive && "bg-primary/10")}>
              <Upload className={cn("h-6 w-6 text-slate-500", isDragActive && "text-primary")} />
            </div>
            <div className="text-sm font-medium text-slate-700">
              {isDragActive ? "Drop the file here" : "Click or drag file to upload"}
            </div>
            <div className="text-xs text-slate-500">
              PDF, DOC, DOCX, JPG, PNG (Max {Math.round(maxSize / 1024 / 1024)}MB)
            </div>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-primary/10 rounded-md flex-shrink-0">
                <File className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{value.name}</p>
                <p className="text-xs text-slate-500">{(value.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            {!disabled && onClear && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {progress > 0 && progress < 100 && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-right text-slate-500">{Math.round(progress)}%</p>
            </div>
          )}
          
          {progress === 100 && (
            <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Upload Complete
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-2 py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs ml-2">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
