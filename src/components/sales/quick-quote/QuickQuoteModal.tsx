import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plane, Ship, Truck, Package, ArrowRight, Timer, Sparkles, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { QuoteResultsList } from './QuoteResultsList';
import { QuoteComparisonView } from './QuoteComparisonView';
import { LayoutList, Columns } from 'lucide-react';

// --- Zod Schemas ---

const baseSchema = z.object({
  mode: z.enum(["air", "ocean", "road"]),
  origin: z.string().min(2, "Origin is required"), // Store Code or Name
  destination: z.string().min(2, "Destination is required"), // Store Code or Name
  commodity: z.string().min(2, "Commodity is required"),
  // Common
  weight: z.string().optional(),
  volume: z.string().optional(),
  unit: z.string().optional(),
});

// We'll use a superRefine to handle mode-specific requirements
const quickQuoteSchema = baseSchema.superRefine((data, ctx) => {
  // Air Requirements
  if (data.mode === 'air') {
    if (!data.weight || isNaN(Number(data.weight)) || Number(data.weight) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid weight is required for Air", path: ["weight"] });
    }
  }
  // Ocean Requirements
  if (data.mode === 'ocean') {
     // Ensure container details are checked in UI state, but basic validation here
     // We might want to enforce weight OR volume if LCL, or Container count if FCL
  }
});

type QuickQuoteValues = z.infer<typeof baseSchema> & {
    // Extended fields managed via state/register manually if needed
    containerType?: string;
    containerSize?: string;
    containerQty?: string;
    htsCode?: string;
    scheduleB?: string;
    dims?: string;
    dangerousGoods?: boolean;
    specialHandling?: string;
    vehicleType?: string;
};

interface RateOption {
  id: string;
  tier: 'contract' | 'spot' | 'market' | 'best_value' | 'cheapest' | 'fastest' | 'greenest' | 'reliable';
  name: string;
  price: number;
  currency: string;
  transitTime: string;
  carrier: string;
  validUntil?: string;
  // Extended AI Fields
  legs?: any[];
  price_breakdown?: any;
  reliability?: any;
  environmental?: any;
  source_attribution?: string;
}

interface QuickQuoteModalProps {
  children?: React.ReactNode;
  accountId?: string;
}

export function QuickQuoteModal({ children, accountId }: QuickQuoteModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<RateOption[] | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'compare'>('list');
  const [loading, setLoading] = useState(false);
  const [smartMode, setSmartMode] = useState(true); // Default to true for "Enhanced" experience
  
  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ unit: string; confidence: number } | null>(null);
  const [complianceCheck, setComplianceCheck] = useState<{ compliant: boolean; issues: any[] } | null>(null);
  const [codeSuggestions, setCodeSuggestions] = useState<any[]>([]);
  
  // AI Analysis State
  const [marketAnalysis, setMarketAnalysis] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [anomalies, setAnomalies] = useState<string[]>([]);

  // Extended Form State
  const [extendedData, setExtendedData] = useState({
    containerType: 'dry',
    containerSize: '20ft',
    containerQty: '1',
    htsCode: '',
    scheduleB: '',
    dims: '',
    dangerousGoods: false,
    specialHandling: '',
    vehicleType: 'van',
    pickupDate: '',
    deliveryDeadline: '',
    originDetails: null as any,
    destinationDetails: null as any,
  });

  const navigate = useNavigate();
  const { toast } = useToast();
  const { supabase } = useCRM();

  const form = useForm<QuickQuoteValues>({
    resolver: zodResolver(quickQuoteSchema),
    defaultValues: {
      unit: "kg",
      mode: "ocean", // Default to Ocean as per new requirements focus
      commodity: "General Cargo"
    },
  });

  const mode = form.watch("mode");
  const commodity = form.watch("commodity");
  const origin = form.watch("origin");
  const destination = form.watch("destination");

  // Reset/Adjust when mode changes
  useEffect(() => {
    setResults(null);
    setComplianceCheck(null);
    setCodeSuggestions([]);
  }, [mode]);

  // AI: Lookup Codes (Debounced)
  useEffect(() => {
    const lookup = async (query: string, field: 'origin' | 'destination') => {
        if (query.length < 3) return;
        try {
            const { data } = await supabase.functions.invoke('ai-advisor', {
                body: { action: 'lookup_codes', payload: { query, mode } }
            });
            if (data?.suggestions) {
                // In a real app, we'd show a dropdown. For now, we'll just log or set state for a simple UI hint
                setCodeSuggestions(data.suggestions);
            }
        } catch (e) { console.error(e); }
    };

    const timer = setTimeout(() => {
        if (origin) lookup(origin, 'origin');
    }, 800);
    return () => clearTimeout(timer);
  }, [origin, mode]);


  // AI: Classify Commodity & Suggest HTS
  const handleAiSuggest = async () => {
    if (!commodity || commodity.length < 3) return;

    setAiLoading(true);
    try {
        // Parallel calls for Unit and Classification
        const [unitRes, classRes] = await Promise.all([
            supabase.functions.invoke('ai-advisor', {
                body: { action: 'suggest_unit', payload: { commodity } }
            }),
            supabase.functions.invoke('ai-advisor', {
                body: { action: 'classify_commodity', payload: { commodity } }
            })
        ]);

        // Handle Unit
        if (unitRes.data?.unit) {
            setAiSuggestion(unitRes.data);
            form.setValue('unit', unitRes.data.unit);
        }

        // Handle Classification
        if (classRes.data?.hts) {
            setExtendedData(prev => ({
                ...prev,
                htsCode: classRes.data.hts,
                scheduleB: classRes.data.scheduleB || prev.scheduleB
            }));
            toast({
                title: "AI Analysis Complete",
                description: `Classified as ${classRes.data.type} (HTS: ${classRes.data.hts})`,
            });
        }

    } catch (err) {
        console.error("AI Suggest Error:", err);
    } finally {
        setAiLoading(false);
    }
  };

  // AI: Validate Compliance before submit
  const validateCompliance = async () => {
    try {
        const { data } = await supabase.functions.invoke('ai-advisor', {
            body: { 
                action: 'validate_compliance', 
                payload: { 
                    origin, 
                    destination, 
                    commodity, 
                    mode, 
                    dangerous_goods: extendedData.dangerousGoods 
                } 
            }
        });
        setComplianceCheck(data);
        return data?.compliant !== false; // Default true if error
    } catch (e) {
        console.error(e);
        return true;
    }
  };

  const onSubmit = async (data: QuickQuoteValues) => {
    // 1. Compliance Check
    const isCompliant = await validateCompliance();
    if (!isCompliant) {
        toast({
            title: "Compliance Warning",
            description: "Please review the compliance issues identified by AI.",
            variant: "destructive"
        });
        // We allow proceeding but show warning
    }

    setLoading(true);
    setResults(null);
    setMarketAnalysis(null);
    setAnomalies([]);
    setConfidenceScore(null);
    setComplianceCheck(null);

    try {
      console.log('Form Submitted:', data);
      console.log('Extended Data:', extendedData);

      const payload = {
        ...data,
        ...extendedData,
        account_id: accountId
      };

      console.log('Invoking Edge Functions with payload:', payload);

      // Define promises for parallel execution
      const legacyPromise = supabase.functions.invoke('rate-engine', { body: payload });
      const aiPromise = smartMode 
        ? supabase.functions.invoke('ai-advisor', { body: { action: 'generate_smart_quotes', payload: payload } })
        : Promise.resolve({ data: null, error: null });

      const [legacyRes, aiRes] = await Promise.all([legacyPromise, aiPromise]);

      let combinedOptions: RateOption[] = [];

      // 1. Process Legacy Results
      if (legacyRes.error) {
          console.error("[QuickQuote] Legacy Rate Engine Error:", legacyRes.error);
          // Don't throw yet, see if AI succeeded
      } else if (legacyRes.data?.options) {
          console.log("[QuickQuote] Legacy Rate Engine Data:", legacyRes.data);
          const legacyOptions = legacyRes.data.options.map((opt: any) => ({
              ...opt,
              source_attribution: 'Standard Rate Engine',
              tier: opt.tier || 'standard'
          }));
          combinedOptions = [...combinedOptions, ...legacyOptions];
      }

      // 2. Process AI Results
      if (smartMode) {
          if (aiRes.error) {
              console.error("[QuickQuote] AI Advisor Error:", aiRes.error);
              
              let errorMsg = "Could not generate smart quotes, showing standard rates only.";
              
              // Try to extract specific error message from the Edge Function response
              try {
                  if (aiRes.error.context && typeof aiRes.error.context.json === 'function') {
                      const errBody = await aiRes.error.context.json();
                      if (errBody && errBody.error) {
                          errorMsg = `AI Error: ${errBody.error}`;
                      }
                  } else if (aiRes.error.message) {
                      errorMsg = `AI Error: ${aiRes.error.message}`;
                  }
              } catch (e) {
                  console.warn("Failed to parse AI error response", e);
                  if (aiRes.error.message) errorMsg = `AI Error: ${aiRes.error.message}`;
              }

              toast({ 
                  title: "AI Generation Failed", 
                  description: errorMsg, 
                  variant: "destructive" 
              });
          } else if (aiRes.data) {
              console.log("[QuickQuote] AI Advisor Data:", aiRes.data);
              const aiData = aiRes.data;
              
              if (aiData.options) {
                  const aiOptions = aiData.options.map((opt: any) => ({
                      id: opt.id || `ai-${Math.random().toString(36).substr(2, 9)}`,
                      tier: opt.tier,
                      name: opt.transport_mode || opt.carrier?.name,
                      carrier: opt.carrier?.name || 'AI Selected Carrier',
                      price: opt.price_breakdown?.total || 0,
                      currency: opt.price_breakdown?.currency || 'USD',
                      transitTime: opt.transit_time?.details || (opt.transit_time?.total_days + " days"),
                      legs: opt.legs,
                      price_breakdown: opt.price_breakdown,
                      reliability: opt.reliability,
                      environmental: opt.environmental,
                      source_attribution: 'AI Smart Engine',
                      ai_explanation: opt.ai_explanation
                  }));
                  
                  combinedOptions = [...combinedOptions, ...aiOptions];
                  setMarketAnalysis(aiData.market_analysis);
                  setConfidenceScore(aiData.confidence_score);
                  setAnomalies(aiData.anomalies || []);
              }
          }
      }

      if (combinedOptions.length === 0) {
          throw new Error("No quotes available from any source.");
      }

      setResults(combinedOptions);

    } catch (error: any) {
      console.error('Rate calculation error:', error);
      
      let description = error.message || "Failed to calculate rates.";
      
      // Attempt to extract detailed error from Edge Function response
      if (error && error.context) {
        try {
             // Clone response to avoid body used error if already read
             const res = error.context.clone ? error.context.clone() : error.context;
             const errorBody = await res.json();
             if (errorBody && errorBody.error) {
                 description = `Server Error: ${errorBody.error}`;
             }
        } catch (e) {
             console.warn("Could not parse error response JSON", e);
             try {
                // Fallback to text
                const text = await error.context.text();
                if (text) description = `Server Error: ${text.slice(0, 100)}`;
             } catch (textErr) {
                // Ignore
             }
        }
      }

      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToQuote = (option: RateOption) => {
    setIsOpen(false);
    navigate('/dashboard/quotes/new', { 
      state: { 
        ...form.getValues(),
        ...extendedData,
        selectedRate: option,
        accountId: accountId
      } 
    });
  };

  const reset = () => {
    setResults(null);
    form.reset();
    setExtendedData({
        containerType: 'dry', containerSize: '20ft', containerQty: '1',
        htsCode: '', scheduleB: '', dims: '', dangerousGoods: false,
        specialHandling: '', vehicleType: 'van',
        pickupDate: '', deliveryDeadline: '',
        originDetails: null, destinationDetails: null
    });
    setAiSuggestion(null);
    setComplianceCheck(null);
    setMarketAnalysis(null);
    setAnomalies([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) reset(); }}>
      <DialogTrigger asChild>
        {children || <Button>Quick Quote</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[1000px] h-[700px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            Multi-Modal Quick Quote
            {accountId && <Badge variant="outline" className="ml-2 font-normal text-xs">Customer Context Active</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Input Section - Left Side */}
          <div className="w-5/12 bg-muted/30 p-6 border-r overflow-y-auto">
            <form onSubmit={form.handleSubmit(onSubmit, (e) => console.error("Form Errors:", e))} className="space-y-5">
              
              {/* Smart Mode Toggle */}
              <div className="flex items-center justify-between bg-purple-50 p-3 rounded-md border border-purple-100">
                  <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <div className="flex flex-col">
                          <span className="text-sm font-medium text-purple-900">Smart Quote Mode</span>
                          <span className="text-[10px] text-purple-600">AI-optimized routes & pricing</span>
                      </div>
                  </div>
                  <Switch checked={smartMode} onCheckedChange={setSmartMode} />
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <Label>Transport Mode</Label>
                <Tabs 
                  value={mode} 
                  onValueChange={(v) => form.setValue("mode", v as any)}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="ocean"><Ship className="w-4 h-4 mr-2"/>Ocean</TabsTrigger>
                    <TabsTrigger value="air"><Plane className="w-4 h-4 mr-2"/>Air</TabsTrigger>
                    <TabsTrigger value="road"><Truck className="w-4 h-4 mr-2"/>Road</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Origin / Destination */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex justify-between">
                    {mode === 'ocean' ? 'Origin Port' : mode === 'air' ? 'Origin Airport' : 'Origin City'}
                    {form.formState.errors.origin && <span className="text-destructive text-xs">{form.formState.errors.origin.message}</span>}
                  </Label>
                  <Input placeholder={mode === 'ocean' ? 'e.g. USLAX' : 'e.g. JFK'} {...form.register("origin")} className="bg-background"/>
                  {codeSuggestions.length > 0 && origin && (
                    <div className="text-[10px] text-muted-foreground truncate">
                        Suggestion: {codeSuggestions[0].label}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="flex justify-between">
                    {mode === 'ocean' ? 'Dest Port' : mode === 'air' ? 'Dest Airport' : 'Dest City'}
                    {form.formState.errors.destination && <span className="text-destructive text-xs">{form.formState.errors.destination.message}</span>}
                  </Label>
                  <Input placeholder={mode === 'ocean' ? 'e.g. CNSHA' : 'e.g. LHR'} {...form.register("destination")} className="bg-background"/>
                </div>
              </div>

              {/* Commodity & AI */}
              <div className="space-y-2">
                 <Label className="flex justify-between">
                    <span>Commodity {form.formState.errors.commodity && <span className="text-destructive text-xs ml-2">{form.formState.errors.commodity.message}</span>}</span>
                    <button type="button" onClick={handleAiSuggest} className="text-xs text-primary flex items-center gap-1 hover:underline">
                        <Sparkles className="w-3 h-3" /> AI Analyze
                    </button>
                 </Label>
                 <Input {...form.register("commodity")} onBlur={handleAiSuggest} className="bg-background" />
              </div>

              {/* Dynamic Fields based on Mode */}
              
              {/* OCEAN FIELDS */}
              {mode === 'ocean' && (
                  <div className="space-y-4 p-4 border rounded-md bg-background">
                      <h4 className="text-sm font-medium flex items-center gap-2"><Ship className="w-3 h-3"/> Ocean Details</h4>
                      <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                              <Label className="text-xs">Container Type</Label>
                              <Select value={extendedData.containerType} onValueChange={(v) => setExtendedData({...extendedData, containerType: v})}>
                                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="dry">Dry Standard</SelectItem>
                                      <SelectItem value="reefer">Reefer</SelectItem>
                                      <SelectItem value="opentop">Open Top</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="space-y-1">
                              <Label className="text-xs">Size</Label>
                              <Select value={extendedData.containerSize} onValueChange={(v) => setExtendedData({...extendedData, containerSize: v})}>
                                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="20ft">20ft</SelectItem>
                                      <SelectItem value="40ft">40ft</SelectItem>
                                      <SelectItem value="40hc">40ft HC</SelectItem>
                                      <SelectItem value="45ft">45ft</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Quantity</Label>
                            <Input type="number" value={extendedData.containerQty} onChange={(e) => setExtendedData({...extendedData, containerQty: e.target.value})} className="h-8" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs flex justify-between">
                                Weight (Total kg)
                                {form.formState.errors.weight && <span className="text-destructive text-[10px]">{form.formState.errors.weight.message}</span>}
                            </Label>
                            <Input {...form.register("weight")} className="h-8" />
                        </div>
                      </div>
                  </div>
              )}

              {/* AIR FIELDS */}
              {mode === 'air' && (
                  <div className="space-y-4 p-4 border rounded-md bg-background">
                      <h4 className="text-sm font-medium flex items-center gap-2"><Plane className="w-3 h-3"/> Air Cargo Details</h4>
                      <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                              <Label className="text-xs flex justify-between">
                                  Total Weight (kg)
                                  {form.formState.errors.weight && <span className="text-destructive text-[10px]">{form.formState.errors.weight.message}</span>}
                              </Label>
                              <Input {...form.register("weight")} className="h-8" />
                          </div>
                          <div className="space-y-1">
                              <Label className="text-xs">Volume (cbm)</Label>
                              <Input {...form.register("volume")} className="h-8" />
                          </div>
                      </div>
                      <div className="space-y-1">
                          <Label className="text-xs">Dimensions (L x W x H cm)</Label>
                          <Input placeholder="e.g. 100x50x50" value={extendedData.dims} onChange={(e) => setExtendedData({...extendedData, dims: e.target.value})} className="h-8" />
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                          <Checkbox id="dg" checked={extendedData.dangerousGoods} onCheckedChange={(c) => setExtendedData({...extendedData, dangerousGoods: !!c})} />
                          <Label htmlFor="dg" className="text-xs">Dangerous Goods (DGR)</Label>
                      </div>
                  </div>
              )}

              {/* ROAD FIELDS */}
              {mode === 'road' && (
                  <div className="space-y-4 p-4 border rounded-md bg-background">
                      <h4 className="text-sm font-medium flex items-center gap-2"><Truck className="w-3 h-3"/> Trucking Details</h4>
                      <div className="space-y-1">
                          <Label className="text-xs">Vehicle Type</Label>
                          <Select value={extendedData.vehicleType} onValueChange={(v) => setExtendedData({...extendedData, vehicleType: v})}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="van">Dry Van</SelectItem>
                                  <SelectItem value="flatbed">Flatbed</SelectItem>
                                  <SelectItem value="reefer">Reefer Truck</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                              <Label className="text-xs">Weight (kg)</Label>
                              <Input {...form.register("weight")} className="h-8" />
                          </div>
                          <div className="space-y-1">
                              <Label className="text-xs">Pallets/Units</Label>
                              <Input type="number" value={extendedData.containerQty} onChange={(e) => setExtendedData({...extendedData, containerQty: e.target.value})} className="h-8" />
                          </div>
                      </div>
                  </div>
              )}

              {/* Timing Requirements */}
              <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Timing Requirements</h4>
                  <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                          <Label className="text-xs">Pickup Date</Label>
                          <Input type="date" value={extendedData.pickupDate} onChange={(e) => setExtendedData({...extendedData, pickupDate: e.target.value})} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                          <Label className="text-xs">Delivery Deadline</Label>
                          <Input type="date" value={extendedData.deliveryDeadline} onChange={(e) => setExtendedData({...extendedData, deliveryDeadline: e.target.value})} className="h-8 text-xs" />
                      </div>
                  </div>
              </div>

              {/* Classification Codes (AI Populated) */}
              <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Customs & Compliance</h4>
                  <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                          <Label className="text-xs">HTS Code</Label>
                          <Input value={extendedData.htsCode} onChange={(e) => setExtendedData({...extendedData, htsCode: e.target.value})} className="h-8 text-xs" placeholder="AI Suggested" />
                      </div>
                      <div className="space-y-1">
                          <Label className="text-xs">Schedule B</Label>
                          <Input value={extendedData.scheduleB} onChange={(e) => setExtendedData({...extendedData, scheduleB: e.target.value})} className="h-8 text-xs" placeholder="AI Suggested" />
                      </div>
                  </div>
              </div>

              <Button type="submit" className="w-full mt-4" disabled={loading}>
                {loading ? (
                    <>
                        <Timer className="w-4 h-4 mr-2 animate-spin"/> Calculating...
                    </>
                ) : (smartMode ? "Generate Comprehensive Quotes" : "Get Standard Quotes")}
              </Button>
              
              <div className="flex items-center space-x-2 mt-2 justify-center">
                  <Switch id="smart-mode" checked={smartMode} onCheckedChange={setSmartMode} />
                  <Label htmlFor="smart-mode" className="text-xs cursor-pointer flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-500" /> 
                      Include AI Market Analysis
                  </Label>
              </div>
            </form>
          </div>

          {/* Results Section - Right Side */}
          <div className="w-7/12 p-6 bg-background overflow-y-auto">
            
            {/* Compliance Alert */}
            {complianceCheck && !complianceCheck.compliant && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <h5 className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4"/> Compliance Checks
                    </h5>
                    <ul className="mt-2 space-y-1">
                        {complianceCheck.issues.map((issue: any, i: number) => (
                            <li key={i} className="text-xs text-yellow-700 flex items-start gap-2">
                                <span>•</span> {issue.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {!results ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p>Fill out the form to generate quotes</p>
                {smartMode && (
                    <div className="mt-4 p-3 bg-purple-50 text-purple-700 rounded-md text-xs max-w-xs text-center border border-purple-100">
                        <Sparkles className="w-4 h-4 mx-auto mb-1" />
                        AI Enhanced mode is active. System will generate multi-modal options and market analysis.
                    </div>
                )}
              </div>
            ) : (
                <div className="space-y-4">
                    {marketAnalysis && (
                        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100">
                            <CardContent className="p-4">
                                <h4 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4"/> AI Market Analysis
                                </h4>
                                <p className="text-xs text-indigo-700 leading-relaxed">
                                    {marketAnalysis}
                                </p>
                                {confidenceScore && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-xs font-medium text-indigo-800">Confidence Score:</span>
                                        <div className="h-2 w-24 bg-indigo-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-600" style={{ width: `${confidenceScore * 100}%` }}></div>
                                        </div>
                                        <span className="text-xs text-indigo-600">{Math.round(confidenceScore * 100)}%</span>
                                    </div>
                                )}
                                {anomalies.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-indigo-200/50">
                                        <span className="text-xs font-semibold text-red-600 block mb-1">Detected Anomalies:</span>
                                        <ul className="list-disc list-inside text-xs text-red-700/80">
                                            {anomalies.map((a, i) => <li key={i}>{a}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">Rate Options</h3>
                            <Badge variant="outline" className="text-xs">{results.length} Options</Badge>
                        </div>
                        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'compare')} className="w-auto">
                            <TabsList className="h-8">
                                <TabsTrigger value="list" className="text-xs h-7 px-2"><LayoutList className="w-3 h-3 mr-1"/> List</TabsTrigger>
                                <TabsTrigger value="compare" className="text-xs h-7 px-2"><Columns className="w-3 h-3 mr-1"/> Compare</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                    
                    {viewMode === 'list' ? (
                        <QuoteResultsList results={results} onSelect={handleConvertToQuote} />
                    ) : (
                        <QuoteComparisonView options={results} onSelect={handleConvertToQuote} />
                    )}
                </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
