import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Sparkles, Loader2, FileText } from 'lucide-react';
import { useSalesDashboard } from '@/contexts/SalesDashboardContext';
import { toast } from 'sonner';

export function AIQuotationModal() {
  const { showAIQuote, setShowAIQuote } = useSalesDashboard();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<string | null>(null);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      setIsGenerating(false);
      setGeneratedQuote(`Based on your request, here is a generated quotation draft:

**Customer:** ${prompt.includes('Acme') ? 'Acme Corp' : 'Prospective Client'}
**Items:**
- 2x 40ft Containers (CN-US)
- Customs Clearance Service
- Inland Trucking

**Estimated Total:** $4,250.00
**Valid Until:** ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}

Review this draft before sending?`);
    }, 2000);
  };

  const handleCreate = () => {
    toast.success('Quotation draft created successfully!');
    setShowAIQuote(false);
    setGeneratedQuote(null);
    setPrompt('');
    // In real app, navigate to new quote page with pre-filled data
  };

  return (
    <Dialog open={showAIQuote} onOpenChange={setShowAIQuote}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Quotation Assistant
          </DialogTitle>
        </DialogHeader>

        {!generatedQuote ? (
          <div className="space-y-4 py-4">
            <div className="flex gap-4 items-start bg-purple-50 p-4 rounded-lg">
              <Bot className="h-8 w-8 text-purple-600 mt-1" />
              <p className="text-sm text-purple-800">
                Describe what you need, and I'll generate a complete quotation draft for you. 
                Include customer name, origin/destination, and cargo details.
              </p>
            </div>
            
            <Textarea 
              placeholder="e.g. Quote for Acme Corp: 2 containers from Shanghai to Los Angeles, including trucking and customs..."
              className="min-h-[120px]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-gray-50 border rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
              {generatedQuote}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAIQuote(false)}>Cancel</Button>
          {!generatedQuote ? (
            <Button onClick={handleGenerate} disabled={!prompt.trim() || isGenerating} className="bg-purple-600 hover:bg-purple-700">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Draft
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleCreate} className="bg-green-600 hover:bg-green-700">
              <FileText className="mr-2 h-4 w-4" />
              Create Quote
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
