
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, FileText, X, AlertTriangle, Shield, Activity, FileCode, FileAudio, FileVideo } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    name: string;
    url: string | null;
    mimeType?: string;
    virusStatus?: 'pending' | 'clean' | 'infected';
  } | null;
}

export function FilePreviewDialog({ open, onOpenChange, file }: FilePreviewDialogProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!file) return null;

  const isImage = file.mimeType?.startsWith('image/') || file.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isPdf = file.mimeType === 'application/pdf' || file.url?.match(/\.pdf$/i);
  const isAudio = file.mimeType?.startsWith('audio/') || file.url?.match(/\.(mp3|wav|ogg)$/i);
  const isVideo = file.mimeType?.startsWith('video/') || file.url?.match(/\.(mp4|webm|mov)$/i);
  const isText = file.mimeType?.startsWith('text/') || file.mimeType === 'application/json' || file.url?.match(/\.(txt|json|csv|md|log)$/i);

  // Attempt to fetch text content for small text files
  useEffect(() => {
    if (open && isText && file.url) {
      setLoading(true);
      fetch(file.url)
        .then(res => {
            if (res.ok) return res.text();
            throw new Error('Failed to fetch');
        })
        .then(text => setContent(text.slice(0, 50000))) // Limit to 50KB for preview
        .catch(err => console.error('Failed to load text content:', err))
        .finally(() => setLoading(false));
    } else {
      setContent(null);
    }
  }, [open, file.url, isText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="p-6 pb-2 flex-shrink-0 bg-background z-10">
            <div className="flex items-center justify-between mr-8">
                <div className="flex items-center gap-3 overflow-hidden">
                    <DialogTitle className="truncate text-lg">{file.name}</DialogTitle>
                    {file.virusStatus && (
                        <Badge variant={file.virusStatus === 'clean' ? 'outline' : file.virusStatus === 'infected' ? 'destructive' : 'secondary'} className="gap-1">
                            {file.virusStatus === 'clean' && <Shield className="h-3 w-3 text-green-600" />}
                            {file.virusStatus === 'infected' && <AlertTriangle className="h-3 w-3" />}
                            {file.virusStatus === 'pending' && <Activity className="h-3 w-3 animate-pulse" />}
                            <span className="capitalize">{file.virusStatus}</span>
                        </Badge>
                    )}
                </div>
                <div className="flex gap-2">
                {file.url && (
                    <Button variant="outline" size="sm" onClick={() => window.open(file.url!, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                    </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                    <X className="h-4 w-4" />
                </Button>
                </div>
            </div>
            <DialogDescription className="mt-1">
                {file.mimeType || 'Unknown Type'}
            </DialogDescription>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 relative flex items-center justify-center min-h-0">
          {file.url ? (
            <>
              {isImage && (
                <img 
                  src={file.url} 
                  alt={file.name} 
                  className="max-w-full max-h-full object-contain shadow-lg" 
                />
              )}
              {isPdf && (
                <iframe 
                  src={`${file.url}#toolbar=0`} 
                  className="w-full h-full border-0" 
                  title={file.name}
                />
              )}
              {isAudio && (
                 <div className="bg-white p-8 rounded-lg shadow-md flex flex-col items-center gap-4">
                    <FileAudio className="h-16 w-16 text-primary/50" />
                    <audio controls src={file.url} className="w-[300px]" />
                 </div>
              )}
              {isVideo && (
                 <video controls src={file.url} className="max-w-full max-h-full rounded-lg shadow-lg" />
              )}
              {isText && (
                <div className="w-full h-full p-4 overflow-auto bg-white font-mono text-xs">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">Loading content...</div>
                    ) : (
                        <pre className="whitespace-pre-wrap">{content || 'Preview not available.'}</pre>
                    )}
                </div>
              )}
              {!isImage && !isPdf && !isAudio && !isVideo && !isText && (
                <div className="text-center p-8">
                  <FileText className="h-20 w-20 mx-auto text-slate-300 mb-4" />
                  <p className="text-xl font-medium text-slate-700">Preview not available</p>
                  <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto">This file type cannot be previewed directly in the browser.</p>
                  <Button onClick={() => window.open(file.url!, '_blank')} size="lg">
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )}
            </>
          ) : (
             <div className="text-center p-8 text-muted-foreground">
               <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
               File URL not available.
             </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
