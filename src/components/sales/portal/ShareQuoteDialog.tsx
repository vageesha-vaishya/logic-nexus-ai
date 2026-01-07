import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Share2, Copy, Trash2, RefreshCw, Globe, ExternalLink } from 'lucide-react';
import { useQuotePortal, PortalToken } from '@/hooks/useQuotePortal';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ShareQuoteDialogProps {
  quoteId: string;
  quoteNumber: string;
}

export function ShareQuoteDialog({ quoteId, quoteNumber }: ShareQuoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<PortalToken[]>([]);
  const { generateToken, getActiveTokens, revokeToken, loading } = useQuotePortal();
  const [generating, setGenerating] = useState(false);

  const loadTokens = async () => {
    if (!quoteId) return;
    const data = await getActiveTokens(quoteId);
    setTokens(data);
  };

  useEffect(() => {
    if (open) {
      loadTokens();
    }
  }, [open, quoteId]);

  const handleGenerate = async () => {
    setGenerating(true);
    const newToken = await generateToken(quoteId);
    if (newToken) {
      await loadTokens();
      toast.success('New portal link generated');
    }
    setGenerating(false);
  };

  const handleRevoke = async (id: string) => {
    if (confirm('Are you sure you want to revoke this link? The customer will no longer be able to access the quote.')) {
      const success = await revokeToken(id);
      if (success) {
        await loadTokens();
      }
    }
  };

  const getPortalUrl = (token: string) => {
    return `${window.location.origin}/portal/quote/${token}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share Quote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Quote #{quoteNumber}</DialogTitle>
          <DialogDescription>
            Generate secure links for your customers to view and accept this quote.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium leading-none">Active Links</h4>
              <p className="text-xs text-muted-foreground">
                Manage existing access links
              </p>
            </div>
            <Button size="sm" onClick={handleGenerate} disabled={generating || loading}>
              {generating ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : <Globe className="h-3 w-3 mr-2" />}
              Generate New Link
            </Button>
          </div>

          <ScrollArea className="h-[200px] w-full rounded-md border p-4">
            {tokens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No active links found. Generate one to share this quote.
              </div>
            ) : (
              <div className="space-y-4">
                {tokens.map((token) => (
                  <div key={token.id} className="flex flex-col space-y-2 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Active</Badge>
                        <span className="text-xs text-muted-foreground">Expires {new Date(token.expires_at).toLocaleDateString()}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRevoke(token.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Input 
                        readOnly 
                        value={getPortalUrl(token.token)} 
                        className="h-8 text-xs font-mono bg-background"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0"
                        onClick={() => copyToClipboard(getPortalUrl(token.token))}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0"
                        onClick={() => window.open(getPortalUrl(token.token), '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {token.accessed_at && (
                      <div className="text-[10px] text-muted-foreground text-right">
                        Last accessed: {new Date(token.accessed_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
