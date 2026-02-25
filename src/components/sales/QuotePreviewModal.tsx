import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Loader2, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { invokeAnonymous, emitEvent, enrichPayload } from '@/lib/supabase-functions';
import { startSpan } from '@/lib/otel-lite';
import { toast } from 'sonner';
import { EmitEventSchema } from '@/lib/schemas/events';

interface QuotePreviewModalProps {
  quoteId: string;
  quoteNumber: string;
  versionId?: string;
  disabled?: boolean;
}

export function QuotePreviewModal({ quoteId, quoteNumber, versionId, disabled }: QuotePreviewModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generatePdf = async () => {
    setLoading(true);
    setError(null);
    try {
      const span = startSpan('preview.generate', { quoteId, versionId });
      // Clean up previous URL to avoid memory leaks
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }

      console.log('[QuotePreview] Generating PDF for:', { quoteId, versionId });
      const basePayload = { quoteId, versionId, engine_v2: true, source: 'preview', action: 'generate-pdf', trace_id: span.id };
      const response = await invokeAnonymous('generate-quote-pdf', enrichPayload(basePayload));

      if (!response || !response.content) {
        const issues = Array.isArray(response?.issues) ? String(response.issues.join('; ')) : null;
        if (issues) {
          throw new Error(issues);
        }
        throw new Error('Received empty content from PDF generation service');
      }

      // Convert base64 to Blob
      const binaryString = window.atob(response.content);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      const evt = { eventName: 'PdfGenerated', payload: { quote_id: quoteId, version_id: versionId, trace_id: basePayload.trace_id } };
      const parsed = EmitEventSchema.safeParse(evt);
      if (parsed.success) {
        await emitEvent(parsed.data.eventName, parsed.data.payload);
      }
      span.end();
    } catch (err: any) {
      console.error('PDF Preview Error:', err);
      setError(err.message || 'Failed to generate PDF preview');
      toast.error('Preview Generation Failed', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !pdfUrl) {
      generatePdf();
    }
  }, [open]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={disabled}>
          <Eye className="h-4 w-4" />
          Preview PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 flex flex-row items-center justify-between border-b bg-background z-10">
            <div className="flex items-center gap-2">
                <DialogTitle>Preview Quote #{quoteNumber}</DialogTitle>
                {versionId && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">v{versionId}</span>}
            </div>
            <DialogDescription className="hidden">
                Preview of the generated PDF document for Quote #{quoteNumber}
            </DialogDescription>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={generatePdf} disabled={loading} title="Refresh Preview">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                {pdfUrl && (
                    <Button variant="ghost" size="icon" asChild title="Download PDF">
                        <a href={pdfUrl} download={`Quote-${quoteNumber}.pdf`}>
                            <Download className="h-4 w-4" />
                        </a>
                    </Button>
                )}
            </div>
        </DialogHeader>
        
        <div className="flex-1 bg-muted/20 relative w-full overflow-hidden">
            {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-background/50 backdrop-blur-sm z-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p>Generating PDF Preview...</p>
                </div>
            ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-destructive p-8 text-center">
                    <div className="bg-destructive/10 p-4 rounded-full">
                        <AlertTriangle className="h-10 w-10" />
                    </div>
                    <div>
                        <p className="font-semibold text-lg">Preview Generation Failed</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md">{error}</p>
                    </div>
                    <Button variant="outline" onClick={generatePdf} className="mt-2">Try Again</Button>
                </div>
            ) : pdfUrl ? (
                <iframe 
                    src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`} 
                    className="w-full h-full border-none bg-white" 
                    title="PDF Preview"
                />
            ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
