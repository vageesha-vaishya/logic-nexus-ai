import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, ShieldCheck, AlertTriangle, Building2 } from 'lucide-react';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { useToast } from '@/hooks/use-toast';
import { SharedCargoInput } from '@/components/sales/shared/SharedCargoInput';
import { CargoItem } from '@/types/cargo';
import { useQuoteStore } from './store/QuoteStore';
import { getSafeName } from './utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useIncoterms } from '@/hooks/useIncoterms';

export const QuoteDetailsStep = memo(function QuoteDetailsStep() {
  const { state, dispatch } = useQuoteStore();
  const {
    quoteData,
    validationErrors,
    referenceData: {
      currencies = [],
      carriers = [],
      serviceTypes = [],
      shippingTerms = [],
      ports = [],
    },
  } = state;
  const accounts = state.referenceData?.accounts || [];
  const contacts = state.referenceData?.contacts || [];
  const { incoterms, loading: incLoading } = useIncoterms();

  const { invokeAiAdvisor } = useAiAdvisor();
  const { toast } = useToast();
  const [aiLoading, setAiLoading] = useState(false);
  const [complianceStatus, setComplianceStatus] = useState<{ compliant: boolean; issues: any[] } | null>(null);

  // Ref to hold latest quoteData for async/event handlers to avoid stale closures and dependency cycles
  const quoteDataRef = useRef(quoteData);
  useEffect(() => {
    quoteDataRef.current = quoteData;
  }, [quoteData]);

  const formatDateForInput = useCallback((dateVal: any): string => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  }, []);

  const onChange = useCallback((field: string, value: any) => {
    dispatch({ type: 'UPDATE_QUOTE_DATA', payload: { [field]: value } });
  }, [dispatch]);
  
  // Derived values for AI check
  const origin = quoteData.origin || '';
  const destination = quoteData.destination || '';

  const calculateDaysRemaining = useCallback((dateStr: string | undefined) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parse input as local date to ensure accurate day difference
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  const daysRemaining = calculateDaysRemaining(quoteData.valid_until);

  // Auto-fill origin/destination names from ports if empty
  useEffect(() => {
    if (ports.length > 0) {
      if (!quoteData.origin && quoteData.origin_port_id) {
        const port = ports.find((p: any) => p.id === quoteData.origin_port_id);
        if (port) {
           onChange('origin', port.name || port.location_name || port.location_code || port.code);
        }
      }
      if (!quoteData.destination && quoteData.destination_port_id) {
        const port = ports.find((p: any) => p.id === quoteData.destination_port_id);
        if (port) {
           onChange('destination', port.name || port.location_name || port.location_code || port.code);
        }
      }
    }
  }, [ports, quoteData.origin_port_id, quoteData.destination_port_id, quoteData.origin, quoteData.destination]);

  // Sync Incoterms and Shipping Term
  useEffect(() => {
    if (shippingTerms.length > 0) {
      // Sync logic for shipping_term_id and incoterms
      // Note: shipping_term_id might not be strictly typed in QuoteFormValues but is used here
      
      const shippingTermId = quoteData.shipping_term_id;
      
      if (shippingTermId && !quoteData.incoterms) {
        const term = shippingTerms.find((t: any) => t.id === shippingTermId);
        if (term && term.code) {
           const matchingIncoterm = incoterms.find(i => i.incoterm_code === term.code);
           if (matchingIncoterm) {
             onChange('incoterms', term.code);
           }
        }
      }
      // If Incoterms is set but Shipping Term is empty, try to set Shipping Term
      else if (quoteData.incoterms && !shippingTermId) {
        const term = shippingTerms.find((t: any) => t.code === quoteData.incoterms || t.name === quoteData.incoterms);
        if (term) {
          onChange('shipping_term_id', term.id);
        }
      }
    }
  }, [shippingTerms, quoteData.shipping_term_id, quoteData.incoterms]);

  // AI: Classify Commodity & Suggest HTSValidate Compliance
  const handleAiAnalyze = useCallback(async () => {
    const currentData = quoteDataRef.current;
    const currentOrigin = currentData.origin || '';
    const currentDestination = currentData.destination || '';

    if (!currentData.commodity || currentData.commodity.length < 3) {
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
                action: 'classify_commodity', payload: { commodity: currentData.commodity }
            }),
            invokeAiAdvisor({
                action: 'validate_compliance', payload: { 
                  commodity: currentData.commodity,
                  origin: currentOrigin || "Global", 
                  destination: currentDestination || "Global"
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
  }, [invokeAiAdvisor, toast, onChange]);

  const handleCargoChange = useCallback((cargo: CargoItem) => {
    onChange('commodity', cargo.commodity?.description || '');
    onChange('hts_code', cargo.commodity?.hts_code || '');
    onChange('total_weight', String(cargo.weight?.value || 0));
    onChange('total_volume', String(cargo.volume || 0));
    if (cargo.hazmat) {
        onChange('hazmat_details', cargo.hazmat);
    }
    onChange('cargo_details', cargo);
  }, [onChange]);

  const cargoItem: CargoItem = useMemo(() => ({
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
    hazmat: quoteData.hazmat_details
  }), [quoteData.commodity, quoteData.hts_code, quoteData.total_weight, quoteData.total_volume, quoteData.hazmat_details]);

  // Helper to find account/contact name
  const getAccountName = useCallback((id: string | undefined) => {
      if (!id) return 'N/A';
      const acc = accounts.find((a: any) => a.id === id);
      return acc ? acc.name : 'N/A';
  }, [accounts]);

  const getContactName = useCallback((id: string | undefined) => {
      if (!id) return 'N/A';
      const con = contacts.find((c: any) => c.id === id);
      return con ? `${con.first_name} ${con.last_name}` : 'N/A';
  }, [contacts]);

  const handleOriginPortChange = useCallback((val: string) => {
    onChange('origin_port_id', val);
    // Auto-fill name if empty
    const port = ports.find((p: any) => p.id === val);
    if (port && !quoteDataRef.current.origin) {
      onChange('origin', port.name || port.code);
    }
  }, [onChange, ports]);

  const handleDestinationPortChange = useCallback((val: string) => {
    onChange('destination_port_id', val);
    // Auto-fill name if empty
    const port = ports.find((p: any) => p.id === val);
    if (port && !quoteDataRef.current.destination) {
      onChange('destination', port.name || port.location_name || port.code);
    }
  }, [onChange, ports]);

  const handleCarrierChange = useCallback((val: string) => {
    onChange('carrier_id', val);
  }, [onChange]);

  const handleServiceTypeChange = useCallback((val: string) => {
    onChange('service_type_id', val);
  }, [onChange]);

  const handleIncotermsChange = useCallback((val: string) => {
    onChange('incoterms', val);
  }, [onChange]);

  const handleShippingTermChange = useCallback((val: string) => {
    onChange('shipping_term_id', val);
  }, [onChange]);

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
        
        {/* Customer Information Section */}
        <div className="bg-muted/30 p-4 rounded-md border border-dashed mb-6">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Client Details
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Customer</Label>
              <div className="font-medium text-base">
                {getAccountName(quoteData.account_id)}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Contact</Label>
              <div className="font-medium text-base">
                 {getContactName(quoteData.contact_id)}
              </div>
            </div>
          </div>
        </div>

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
                    onValueChange={handleOriginPortChange}
                  >
                    <SelectTrigger id="origin_port_id">
                      <SelectValue placeholder="Select Port" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name || p.code} ({p.code})
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
                    onValueChange={handleDestinationPortChange}
                  >
                    <SelectTrigger id="destination_port_id">
                      <SelectValue placeholder="Select Port" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name || p.location_name || p.code} ({p.code})
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
                  value={formatDateForInput(quoteData.pickup_date)}
                  onChange={(e) => onChange('pickup_date', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="deadline_date">Deadline</Label>
                <Input
                  id="deadline_date"
                  type="date"
                  value={formatDateForInput(quoteData.delivery_deadline)}
                  onChange={(e) => onChange('delivery_deadline', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="valid_until">Quote Validity</Label>
              <Input
                id="valid_until"
                type="date"
                value={formatDateForInput(quoteData.valid_until)}
                onChange={(e) => onChange('valid_until', e.target.value)}
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
              <Select value={quoteData.carrier_id || ''} onValueChange={handleCarrierChange}>
                <SelectTrigger id="carrier_id">
                  <SelectValue placeholder="Select Carrier" />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.carrier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="service_type_id">Service Type</Label>
              <Select value={quoteData.service_type_id || ''} onValueChange={handleServiceTypeChange}>
                <SelectTrigger id="service_type_id">
                  <SelectValue placeholder="Select Service" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {getSafeName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="incoterms">Incoterms</Label>
              <Select value={quoteData.incoterms} onValueChange={handleIncotermsChange}>
                <SelectTrigger id="incoterms">
                  <SelectValue placeholder="Select Incoterms" />
                </SelectTrigger>
                <SelectContent>
                  {incLoading ? (
                    <SelectItem value="__loading" disabled>Loading...</SelectItem>
                  ) : incoterms.length === 0 ? (
                    <SelectItem value="__empty" disabled>No Incoterms available</SelectItem>
                  ) : (
                    incoterms.map((t) => (
                      <SelectItem key={t.id} value={t.incoterm_code}>
                        {t.incoterm_code} - {t.incoterm_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="shipping_term_id">Shipping Term</Label>
              <Select value={quoteData.shipping_term_id || ''} onValueChange={handleShippingTermChange}>
                <SelectTrigger id="shipping_term_id">
                  <SelectValue placeholder="Select Term" />
                </SelectTrigger>
                <SelectContent>
                  {shippingTerms.map((t: any) => (
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
              value={quoteData.title || ''}
              onChange={(e) => onChange('title', e.target.value)}
              placeholder="Auto-generated if left empty"
            />
          </div>
          <div>
            <Label htmlFor="currency">Quote Currency</Label>
            <Select value={quoteData.currency_id} onValueChange={(val) => onChange('currency_id', val)}>
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
});
