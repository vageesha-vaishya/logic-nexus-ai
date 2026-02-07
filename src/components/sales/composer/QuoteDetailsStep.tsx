import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { useToast } from '@/hooks/use-toast';
import { SharedCargoInput } from '@/components/sales/shared/SharedCargoInput';
import { CargoItem } from '@/types/cargo';
import { useQuoteStore } from './store/QuoteStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface QuoteDetailsStepProps {}

const INCOTERMS = [
  'EXW - Ex Works',
  'FCA - Free Carrier',
  'CPT - Carriage Paid To',
  'CIP - Carriage and Insurance Paid To',
  'DAP - Delivered at Place',
  'DPU - Delivered at Place Unloaded',
  'DDP - Delivered Duty Paid',
  'FAS - Free Alongside Ship',
  'FOB - Free on Board',
  'CFR - Cost and Freight',
  'CIF - Cost, Insurance and Freight',
];

export function QuoteDetailsStep({}: QuoteDetailsStepProps) {
  const { state, dispatch } = useQuoteStore();
  const { quoteData, validationErrors, referenceData } = state;
  const { currencies } = referenceData;
  const { invokeAiAdvisor } = useAiAdvisor();
  const { toast } = useToast();
  const [aiLoading, setAiLoading] = useState(false);
  const [complianceStatus, setComplianceStatus] = useState<{ compliant: boolean; issues: any[] } | null>(null);

  const onChange = (field: string, value: any) => {
    dispatch({ type: 'UPDATE_QUOTE_DATA', payload: { [field]: value } });
  };
  
  // Derived values for AI check
  const origin = quoteData.origin || '';
  const destination = quoteData.destination || '';

  const weight = Number(quoteData.total_weight) || 0;
  const volume = Number(quoteData.total_volume) || 0;

  const calculateDaysRemaining = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parse input as local date to ensure accurate day difference
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = calculateDaysRemaining(quoteData.validUntil);

  // AI: Classify Commodity & Suggest HTS
  const handleAiAnalyze = async () => {
    if (!quoteData.commodity || quoteData.commodity.length < 3) {
      toast({
        title: "Input Required",
        description: "Please enter a commodity description first.",
        variant: "destructive"
      });
      return;
    }

    setAiLoading(true);
    try {
        // Parallel calls for Classification and Compliance
        const [classRes, complianceRes] = await Promise.all([
            invokeAiAdvisor({
                action: 'classify_commodity', payload: { commodity: quoteData.commodity }
            }),
            invokeAiAdvisor({
                action: 'validate_compliance', payload: { 
                  commodity: quoteData.commodity,
                  origin: origin || "Global", 
                  destination: destination || "Global"
                }
            })
        ]);

        // Handle Classification
        if (classRes.data?.hts) {
            onChange('hts_code', classRes.data.hts);
            if (classRes.data.scheduleB) {
              onChange('schedule_b', classRes.data.scheduleB);
            }
            toast({
                title: "AI Analysis Complete",
                description: `Classified as ${classRes.data.type} (HTS: ${classRes.data.hts})`,
            });
        }

        // Handle Compliance
        if (complianceRes.data) {
            setComplianceStatus(complianceRes.data);
            if (!complianceRes.data.compliant) {
              toast({
                title: "Compliance Warning",
                description: "Potential trade restrictions detected.",
                variant: "destructive"
              });
            }
        }

    } catch (err) {
        console.error("AI Analyze Error:", err);
        toast({
          title: "Analysis Failed",
          description: "Could not complete AI analysis. Please try again.",
          variant: "destructive"
        });
    } finally {
        setAiLoading(false);
    }
  };

  const handleCargoChange = (cargo: CargoItem) => {
    onChange('commodity', cargo.commodity?.description || '');
    onChange('hts_code', cargo.commodity?.hts_code || '');
    onChange('total_weight', cargo.weight?.value || 0);
    onChange('total_volume', cargo.volume || 0);
    if (cargo.hazmat) {
        onChange('hazmat_details', cargo.hazmat);
    }
    onChange('cargo_details', cargo);
  };

  const cargoItem: CargoItem = {
    id: 'quote-cargo-1',
    type: 'loose',
    quantity: 1,
    commodity: {
      description: quoteData.commodity,
      hts_code: quoteData.hts_code,
    },
    weight: {
      value: Number(quoteData.total_weight) || 0,
      unit: 'kg'
    },
    volume: Number(quoteData.total_volume) || 0,
    dimensions: { l: 0, w: 0, h: 0, unit: 'cm' },
    stackable: false,
    hazmat: (quoteData as any).hazmat_details
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Quote Details</span>
          <div className="flex items-center gap-2">
            {validationErrors.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {validationErrors.length} Error{validationErrors.length > 1 ? 's' : ''}
              </Badge>
            )}
            {complianceStatus && (
              <div className="flex flex-col items-end gap-1">
                <Badge variant={complianceStatus.compliant ? "outline" : "destructive"} className="gap-1">
                  {complianceStatus.compliant ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {complianceStatus.compliant ? "Compliance Verified" : "Compliance Issues"}
                </Badge>
                {!complianceStatus.compliant && complianceStatus.issues?.length > 0 && (
                  <div className="text-[10px] text-destructive bg-destructive/10 p-2 rounded max-w-xs">
                    <ul className="list-disc pl-3 space-y-1">
                      {complianceStatus.issues.map((issue: any, i: number) => (
                        <li key={i}>
                          {typeof issue === 'string' 
                            ? issue 
                            : (issue.message || issue.description || JSON.stringify(issue))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardTitle>
        <CardDescription>Set up basic information for this quotation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="reference">Reference Number</Label>
            <Input
              id="reference"
              value={quoteData.reference || ''}
              onChange={(e) => onChange('reference', e.target.value)}
              placeholder="Auto-generated if left empty"
            />
          </div>
          
          <div>
            <Label htmlFor="validUntil">Valid Until</Label>
            <Input
              id="validUntil"
              type="date"
              value={quoteData.validUntil || ''}
              onChange={(e) => onChange('validUntil', e.target.value)}
            />
            {daysRemaining !== null && (
              <p className={`text-xs mt-1 ${daysRemaining < 7 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                {daysRemaining < 0 ? 'Expired' : `${daysRemaining} days remaining`}
              </p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-4">Logistics Parameters</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="incoterms">Incoterms (2020)</Label>
                  <Select value={quoteData.incoterms} onValueChange={(val) => onChange('incoterms', val)}>
                    <SelectTrigger id="incoterms">
                      <SelectValue placeholder="Select Incoterms" />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((term) => (
                        <SelectItem key={term} value={term.split(' - ')[0]}>
                          {term}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end pb-1">
                   <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={handleAiAnalyze}
                      disabled={aiLoading}
                    >
                      {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-purple-600" />}
                      Run AI Compliance Check
                    </Button>
                </div>
            </div>

            <div className="border rounded-lg p-4 bg-slate-50">
                <Label className="mb-2 block font-semibold text-slate-700">Cargo Details</Label>
                <SharedCargoInput 
                    value={cargoItem} 
                    onChange={handleCargoChange}
                    className="bg-white"
                />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="currency">Quote Currency</Label>
          <Select value={quoteData.currencyId} onValueChange={(val) => onChange('currencyId', val)}>
            <SelectTrigger id="currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((currency) => (
                <SelectItem key={currency.id} value={currency.id}>
                  {currency.code} - {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={quoteData.notes || ''}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Add any special notes or terms for this quotation"
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
}
