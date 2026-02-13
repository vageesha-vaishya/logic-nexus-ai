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
  const { currencies, carriers, serviceTypes, shippingTerms, ports } = referenceData;
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

  const getSafeName = (obj: any, fallback: string = '') => {
    if (obj === null || obj === undefined) return fallback;
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'object') {
       return obj.name || obj.code || obj.description || fallback;
    }
    return String(obj);
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
      <CardContent className="space-y-6">
        
        {/* Route & Timing Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Route</h4>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="origin">Origin Location</Label>
                  <Input
                    id="origin"
                    value={quoteData.origin || ''}
                    onChange={(e) => onChange('origin', e.target.value)}
                    placeholder="City, Address, or Location"
                  />
                </div>
                <div>
                  <Label htmlFor="origin_port_id">Origin Port (Optional)</Label>
                  <Select 
                    value={quoteData.origin_port_id || ''} 
                    onValueChange={(val) => {
                      onChange('origin_port_id', val);
                      // Auto-fill name if empty
                      const port = ports.find((p: any) => p.id === val);
                      if (port && !quoteData.origin) {
                        onChange('origin', port.name || port.port_name || port.code);
                      }
                    }}
                  >
                    <SelectTrigger id="origin_port_id">
                      <SelectValue placeholder="Select Port" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name || p.port_name || p.code} ({p.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="destination">Destination Location</Label>
                  <Input
                    id="destination"
                    value={quoteData.destination || ''}
                    onChange={(e) => onChange('destination', e.target.value)}
                    placeholder="City, Address, or Location"
                  />
                </div>
                <div>
                  <Label htmlFor="destination_port_id">Destination Port (Optional)</Label>
                  <Select 
                    value={quoteData.destination_port_id || ''} 
                    onValueChange={(val) => {
                      onChange('destination_port_id', val);
                      // Auto-fill name if empty
                      const port = ports.find((p: any) => p.id === val);
                      if (port && !quoteData.destination) {
                        onChange('destination', port.name || port.port_name || port.code);
                      }
                    }}
                  >
                    <SelectTrigger id="destination_port_id">
                      <SelectValue placeholder="Select Port" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name || p.port_name || p.code} ({p.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Timing</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ready_date">Ready Date</Label>
                <Input
                  id="ready_date"
                  type="date"
                  value={quoteData.ready_date || ''}
                  onChange={(e) => onChange('ready_date', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="deadline_date">Deadline</Label>
                <Input
                  id="deadline_date"
                  type="date"
                  value={quoteData.deadline_date || ''}
                  onChange={(e) => onChange('deadline_date', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="validUntil">Quote Validity</Label>
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
        </div>

        {/* Service Details Section */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Service Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="carrier_id">Preferred Carrier</Label>
              <Select value={quoteData.carrier_id || ''} onValueChange={(val) => onChange('carrier_id', val)}>
                <SelectTrigger id="carrier_id">
                  <SelectValue placeholder="Select Carrier" />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.carrier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="service_type_id">Service Type</Label>
              <Select value={quoteData.service_type_id || ''} onValueChange={(val) => onChange('service_type_id', val)}>
                <SelectTrigger id="service_type_id">
                  <SelectValue placeholder="Select Service" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {getSafeName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="incoterms">Incoterms</Label>
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

            <div>
              <Label htmlFor="shipping_term_id">Shipping Term</Label>
              <Select value={quoteData.shipping_term_id || ''} onValueChange={(val) => onChange('shipping_term_id', val)}>
                <SelectTrigger id="shipping_term_id">
                  <SelectValue placeholder="Select Term" />
                </SelectTrigger>
                <SelectContent>
                  {shippingTerms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {getSafeName(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Cargo & AI Section */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cargo Details</h4>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              className="gap-2"
              onClick={handleAiAnalyze}
              disabled={aiLoading}
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-purple-600" />}
              AI Compliance Check
            </Button>
          </div>
          
          <div className="border rounded-lg p-4 bg-slate-50">
            <SharedCargoInput 
              value={cargoItem} 
              onChange={handleCargoChange}
              className="bg-white"
            />
          </div>
        </div>

        {/* Reference & Notes Section */}
        <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes / Remarks</Label>
            <Textarea
              id="notes"
              value={quoteData.notes || ''}
              onChange={(e) => onChange('notes', e.target.value)}
              placeholder="Additional notes for this quote..."
              className="min-h-[80px]"
            />
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
