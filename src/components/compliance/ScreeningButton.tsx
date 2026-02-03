import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { ComplianceScreeningService, QuoteScreeningResult, ScreeningMatch } from '@/services/compliance/ComplianceScreeningService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScreeningButtonProps {
  quoteId?: string;
  contactId: string;
  direction: 'shipper' | 'consignee';
  name: string;
  country?: string | null;
  onScreeningComplete?: (result: QuoteScreeningResult) => void;
}

export function ScreeningButton({
  quoteId,
  contactId,
  direction,
  name,
  country,
  onScreeningComplete
}: ScreeningButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuoteScreeningResult | null>(null);
  const [open, setOpen] = useState(false);

  // Fetch existing screening result for this quote context
  useEffect(() => {
    if (!quoteId || !contactId) {
        setResult(null);
        return;
    }

    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from('quote_contacts_screening')
        .select('*')
        .eq('quote_id', quoteId)
        .eq('direction', direction)
        .eq('contact_id', contactId)
        .maybeSingle();

      if (!error && data) {
        let screeningStatus: 'clear' | 'potential_match' | 'confirmed_match' = 'clear';
        if (data.status === 'hit') screeningStatus = 'potential_match';
        else if (data.status === 'review') screeningStatus = 'potential_match';
        
        // Parse matched_json safely
        let matches: ScreeningMatch[] = [];
        try {
            if (typeof data.matched_json === 'string') {
                matches = JSON.parse(data.matched_json);
            } else if (Array.isArray(data.matched_json)) {
                matches = data.matched_json as any[];
            }
        } catch (e) {
            console.error('Failed to parse matched_json', e);
        }

        setResult({
          status: screeningStatus,
          matches: matches,
          screening_id: '', 
          quote_screening_id: data.id,
          cached: true
        });
      } else {
        setResult(null);
      }
    };

    fetchStatus();
  }, [quoteId, contactId, direction]);

  const handleScreening = async () => {
    if (!quoteId) {
      toast.error("Please save the quote before screening contacts.");
      return;
    }

    setLoading(true);
    try {
      const res = await ComplianceScreeningService.screenQuoteContact(
        quoteId,
        contactId,
        direction,
        name,
        country || null
      );

      if (res) {
        setResult(res);
        if (res.status === 'clear') {
          toast.success("Contact screened: No matches found.");
        } else {
          toast.warning(`Warning: ${res.matches.length} potential matches found.`);
          setOpen(true); // Open modal to show matches
        }
        if (onScreeningComplete) onScreeningComplete(res);
      }
    } catch (error) {
      toast.error("Screening failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!quoteId) {
    return (
        <Button variant="outline" size="sm" disabled title="Save quote to enable screening">
            <Shield className="w-4 h-4 mr-2" /> Screen
        </Button>
    );
  }

  if (result) {
    // Show Badge
    let badgeClass = "cursor-pointer hover:bg-muted border-green-200 text-green-700 bg-green-50";
    let icon = <ShieldCheck className="w-3 h-3 mr-1" />;
    let text = "Cleared";

    if (result.status !== 'clear') {
      badgeClass = "cursor-pointer hover:bg-muted border-red-200 text-red-700 bg-red-50";
      icon = <ShieldAlert className="w-3 h-3 mr-1" />;
      text = `${result.matches.length} Matches`;
    }

    return (
      <>
        <Badge 
          variant="outline" 
          className={badgeClass}
          onClick={() => setOpen(true)}
        >
          {icon} {text}
        </Badge>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Screening Results: {name}</DialogTitle>
              <DialogDescription>
                Restricted Party Screening Status: <span className="font-bold uppercase">{result.status.replace('_', ' ')}</span>
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {result.matches.length === 0 ? (
                <div className="flex items-center text-green-600 gap-2 p-4 bg-green-50 rounded-md">
                  <ShieldCheck className="w-6 h-6" />
                  <span>No matches found on restricted party lists.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    The following potential matches were found on restricted party lists (DPL, EL, etc.).
                    Please review carefully.
                  </p>
                  {result.matches.map((match, idx) => (
                    <div key={idx} className="border p-3 rounded-md bg-destructive/5 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-destructive">{match.entity_name}</span>
                        <Badge variant="outline">{match.source_list}</Badge>
                      </div>
                      <div className="text-sm grid grid-cols-2 gap-2">
                         <div><span className="font-medium">Score:</span> {(match.similarity * 100).toFixed(0)}%</div>
                         <div><span className="font-medium">Country:</span> {match.country_code || 'N/A'}</div>
                         <div className="col-span-2"><span className="font-medium">Address:</span> {match.address}</div>
                         <div className="col-span-2 text-xs text-muted-foreground">{match.remarks}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <DialogFooter>
                <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={(e) => { e.preventDefault(); handleScreening(); }}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
      Screen Contact
    </Button>
  );
}
