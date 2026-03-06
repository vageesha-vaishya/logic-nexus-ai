import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { invokeFunction } from '@/lib/supabase-functions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TemplateSelector } from './TemplateSelector';

interface PDFGeneratorProps {
  versionId: string;
  versionNumber: number;
  quoteId: string;
}

export function PDFGenerator({ versionId, versionNumber, quoteId }: PDFGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const handleGenerateClick = () => {
    setShowModal(true);
  };

  const handleConfirmGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await invokeFunction('generate-quote-pdf', {
        body: {
          quoteId,
          versionId,
          templateId: selectedTemplateId || undefined,
          engine_v2: true,
          source: 'pdf_generator',
          action: 'generate-pdf',
        },
      });

      if (error) throw error;

      if (!data || !data.content) {
         const issues = Array.isArray(data?.issues) ? String(data.issues.join('; ')) : null;
         if (issues) {
             throw new Error(`Validation failed: ${issues}`);
         }
         throw new Error('No content received from PDF generation');
      }

      // Convert base64 to Blob and open in new tab
      const binaryString = window.atob(data.content);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      toast.success('PDF Generated successfully');
      setShowModal(false);
    } catch (error: any) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF', {
        description: error.message || 'Unknown error occurred',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleGenerateClick}
        disabled={generating}
      >
        <FileText className="w-4 h-4 mr-1" />
        Generate PDF
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Generate PDF</DialogTitle>
            <DialogDescription>
              Select a template to generate the quotation PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="template" className="text-sm font-medium">
                Template
              </label>
              <TemplateSelector
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                disabled={generating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={handleConfirmGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate PDF'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
