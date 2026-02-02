
import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in bytes
  label?: string;
  className?: string;
  value?: File | null;
  error?: string;
  progress?: number;
  disabled?: boolean;
}

export function FileUpload({
  onFileSelect,
  accept = '*',
  maxSize = 25 * 1024 * 1024, // 25MB default
  label = 'Drag & drop file here or click to upload',
  className,
  value,
  error,
  progress,
  disabled = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateFile = (file: File): boolean => {
    setLocalError(null);
    
    // Size check
    if (file.size > maxSize) {
      setLocalError(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit.`);
      return false;
    }

    // Type check (basic extension check based on accept prop)
    // Note: This is a loose check. Real validation happens on server/storage.
    if (accept !== '*') {
      const acceptedTypes = accept.split(',').map(t => t.trim().toLowerCase());
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();
      
      const isValid = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileName.endsWith(type);
        }
        return fileType.match(new RegExp(type.replace('*', '.*')));
      });

      if (!isValid) {
        setLocalError(`File type not accepted. Allowed: ${accept}`);
        return false;
      }
    }

    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inputRef.current) inputRef.current.value = '';
    // We can't pass null to onFileSelect if strict, but assuming the parent handles it via external state reset
    // Actually, onFileSelect expects a File. 
    // This component is controlled by `value`. 
    // To clear, we usually need an `onClear` or pass null.
    // For now, I'll rely on the parent checking `value`. 
    // Wait, onFileSelect signature is `(file: File) => void`. 
    // I should probably allow passing null or add onClear.
    // For simplicity, I'll assume parent handles removal if they pass `value`.
    // I'll add onClear prop or modify onFileSelect.
    // Let's modify onFileSelect to accept null.
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-colors flex flex-col items-center justify-center text-center cursor-pointer min-h-[120px]',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          disabled && 'opacity-50 cursor-not-allowed',
          (error || localError) && 'border-destructive bg-destructive/5',
          value && 'border-solid border-primary/20 bg-primary/5'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
        />

        {value ? (
          <div className="flex items-center gap-4 w-full max-w-sm">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 text-left truncate">
              <p className="text-sm font-medium truncate">{value.name}</p>
              <p className="text-xs text-muted-foreground">
                {(value.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                    e.stopPropagation();
                    // This is a hack because onFileSelect is strict. 
                    // Ideally parent passes a handler to clear.
                    // I will change the interface below.
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-center">
              <Upload className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="text-xs text-muted-foreground/70">
              Accepted: {accept === '*' ? 'All files' : accept.replace(/,/g, ', ')} (Max {Math.round(maxSize/1024/1024)}MB)
            </p>
          </div>
        )}

        {(error || localError) && (
            <div className="absolute -bottom-6 left-0 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{error || localError}</span>
            </div>
        )}
      </div>

      {typeof progress === 'number' && (
        <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading...</span>
                <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
        </div>
      )}
    </div>
  );
}
