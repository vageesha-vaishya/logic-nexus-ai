import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plane, Ship, Truck, Train, Package, ArrowRight, Timer, Sparkles, AlertTriangle, LayoutList, Columns, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { QuoteResultsList } from './QuoteResultsList';
import { QuoteComparisonView } from './QuoteComparisonView';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';
import { logger } from '@/lib/logger';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { PricingService } from '@/services/pricing.service';
import { RateOption } from '@/types/quote-breakdown';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import { SmartCargoInput, CommoditySelection } from '@/components/logistics/SmartCargoInput';
import { SharedCargoInput } from '@/components/sales/shared/SharedCargoInput';
import { CargoItem } from '@/types/cargo';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { useDebug } from '@/hooks/useDebug';
import { formatContainerSize } from '@/lib/container-utils';

// --- Zod Schemas ---

const baseSchema = z.object({
  mode: z.enum(["air", "ocean", "road", "rail"]),
  origin: z.string().min(2, "Origin is required"), // Store Code or Name
  destination: z.string().min(2, "Destination is required"), // Store Code or Name
  commodity: z.string().min(2, "Commodity is required"),
  preferredCarriers: z.array(z.string()).optional(),
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
  if (data.mode === 'ocean' || data.mode === 'rail') {
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
    masterCommodityId?: string;
    scheduleB?: string;
    dims?: string;
    dangerousGoods?: boolean;
    specialHandling?: string;
    vehicleType?: string;
};

interface QuickQuoteModalProps {
  children?: React.ReactNode;
  accountId?: string;
}

export function QuickQuoteModal({ children, accountId }: QuickQuoteModalProps) {
  const debug = useDebug('Sales', 'QuickQuoteModal');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<RateOption[] | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'compare'>('list');
  const [loading, setLoading] = useState(false);
  const [smartMode, setSmartMode] = useState(true); // Default to true for "Enhanced" experience
  
  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ unit: string; confidence: number } | null>(null);
  const [complianceCheck, setComplianceCheck] = useState<{ compliant: boolean; issues: any[] } | null>(null);
  
  // AI Analysis State
  const [marketAnalysis, setMarketAnalysis] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [anomalies, setAnomalies] = useState<string[]>([]);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Extended Form State
  const [extendedData, setExtendedData] = useState({
    containerType: '', // Normalized to store UUID
    containerSize: '', // Normalized to store UUID
    containerQty: '1',
    containerCombos: [] as Array<{ type: string; size: string; qty: number }>, // Normalized to store UUIDs
    htsCode: '',
    aes_hts_id: '',
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
  const { supabase, context } = useCRM();
  const { containerTypes, containerSizes } = useContainerRefs();
  const [carriers, setCarriers] = useState<{ id: string; carrier_name: string; carrier_type: string }[]>([]);

  const uniqueByCarrierName = (arr: any[], preferredTenantId?: string | null) => {
    try {
      const map: Record<string, any> = {};
      for (const item of arr || []) {
        const key = String((item as any)?.carrier_name || '').trim().toLowerCase();
        if (!key) continue;
        const existing = map[key];
        if (!existing) {
          map[key] = item;
        } else {
          const existingTenant = (existing as any)?.tenant_id ?? null;
          const currentTenant = (item as any)?.tenant_id ?? null;
          if (preferredTenantId && existingTenant !== preferredTenantId && currentTenant === preferredTenantId) {
            map[key] = item;
          }
        }
      }
      return Object.values(map);
    } catch {
      return arr || [];
    }
  };

  const form = useForm<QuickQuoteValues>({
    resolver: zodResolver(quickQuoteSchema),
    defaultValues: {
      unit: "kg",
      mode: "ocean", // Default to Ocean as per new requirements focus
      commodity: "General Cargo"
    },
  });

  const [cargoItem, setCargoItem] = useState<CargoItem>({
      id: '1',
      type: 'container',
      quantity: 1,
      dimensions: { l: 0, w: 0, h: 0, unit: 'cm' },
      weight: { value: 0, unit: 'kg' },
      stackable: false,
      containerDetails: { typeId: '', sizeId: '' }
  });

  // Sync CargoItem to Form/ExtendedData
  useEffect(() => {
      // Sync Commodity
      if (cargoItem.commodity?.description) {
          form.setValue('commodity', cargoItem.commodity.description);
      }

      // Sync Hazmat
      setExtendedData(prev => ({ ...prev, dangerousGoods: !!cargoItem.hazmat }));

      // Sync Mode Specifics
      const mode = form.getValues('mode');
      if (mode === 'ocean' || mode === 'rail') {
          if (cargoItem.type === 'container' && cargoItem.containerDetails?.typeId && cargoItem.containerDetails?.sizeId) {
             const combo = {
                 type: cargoItem.containerDetails.typeId,
                 size: cargoItem.containerDetails.sizeId,
                 qty: cargoItem.quantity
             };
             setExtendedData(prev => ({
                 ...prev,
                 containerType: combo.type,
                 containerSize: combo.size,
                 containerQty: String(combo.qty),
                 containerCombos: [combo] // Overwrite for now, assuming single line item
             }));
          }
      } else {
          // Air/Road
           setExtendedData(prev => ({
                 ...prev,
                 weight: String(cargoItem.weight.value),
                 volume: String(cargoItem.volume || 0),
                 containerQty: String(cargoItem.quantity),
                 dims: cargoItem.dimensions ? `${cargoItem.dimensions.l}x${cargoItem.dimensions.w}x${cargoItem.dimensions.h}` : ''
             }));
           form.setValue('weight', String(cargoItem.weight.value)); 
           form.setValue('volume', String(cargoItem.volume || 0));
      }
  }, [cargoItem, form.watch('mode')]);

  const mode = form.watch("mode");
  const filteredCarriers = useMemo(() => {
    return carriers
      .filter(c => {
        if (!mode) return true;
        const map: Record<string, string> = { 
          'ocean': 'ocean', 
          'air': 'air_cargo', 
          'road': 'trucking', 
          'rail': 'rail' 
        };
        const targetType = map[mode];
        return c.carrier_type === targetType;
      })
      .map(c => ({ id: c.id, name: c.carrier_name }));
  }, [carriers, mode]);
  const commodity = form.watch("commodity");
  const origin = form.watch("origin");
  const destination = form.watch("destination");

  // Helper to resolve UUID to Code/Name for legacy APIs
  const resolveContainerInfo = (typeId: string, sizeId: string) => {
    const typeObj = containerTypes.find(t => t.id === typeId);
    const sizeObj = containerSizes.find(s => s.id === sizeId);
    return {
      type: typeObj?.code || typeObj?.name || typeId, // Fallback to ID if not found
      size: sizeObj?.name || sizeId,
      iso_code: sizeObj?.iso_code
    };
  };

  // Log Mode Toggle
  useEffect(() => {
    if (isOpen) {
        debug.info('QuickQuote Modal Opened', { mode: viewMode, smartMode });
    }
  }, [isOpen]);

  useEffect(() => {
    debug.info('Smart Mode Toggled', { enabled: smartMode });
  }, [smartMode]);

  // Reset/Adjust when mode changes
  useEffect(() => {
    setResults(null);
    setComplianceCheck(null);
    debug.log('Transport Mode Changed', { mode });
  }, [mode]);
  useEffect(() => {
    const loadCarriers = async () => {
      try {
        const { data: carrierData } = await supabase
          .from('carriers')
          .select('id, carrier_name, carrier_type, tenant_id')
          .eq('is_active', true)
          .order('carrier_name');
        setCarriers(uniqueByCarrierName(carrierData || [], context?.tenantId));
      } catch (e) {
        console.error('Failed to load carriers', e);
      }
    };
    loadCarriers();
  }, [supabase]);

  const handleLocationChange = (field: 'origin' | 'destination', value: string, location?: any) => {
    form.setValue(field, value);
    if (location) {
        debug.log(`Location Selected: ${field}`, { location: location.location_name, code: location.location_code });
        setExtendedData(prev => ({
            ...prev,
            [field === 'origin' ? 'originDetails' : 'destinationDetails']: {
                name: location.location_name,
                formatted_address: [location.city, location.state_province, location.country].filter(Boolean).join(", "),
                code: location.location_code,
                type: location.location_type,
                country: location.country,
                city: location.city
            }
        }));
    }
  };

  const handleCommoditySelect = (selection: CommoditySelection) => {
    // Ensure dual visibility in the form field (Description - HTS Code)
    const displayValue = selection.hts_code 
      ? `${selection.description} - ${selection.hts_code}`
      : selection.description;

    form.setValue("commodity", displayValue);
    setExtendedData(prev => ({
        ...prev,
        htsCode: selection.hts_code || prev.htsCode,
        aes_hts_id: selection.aes_hts_id || prev.aes_hts_id,
        masterCommodityId: selection.master_commodity_id
    }));
    if (selection.hts_code) {
        debug.log('Commodity Selected with HTS', { code: selection.hts_code });
    }
  };


  // AI: Classify Commodity & Suggest HTS
  const handleAiSuggest = async () => {
    if (!commodity || commodity.length < 3) return;

    debug.info('Starting AI Suggestion', { commodity });
    setAiLoading(true);
    const startTime = performance.now();

    try {
        // Parallel calls for Unit and Classification
        const [unitRes, classRes] = await Promise.all([
            invokeAiAdvisor({
                action: 'suggest_unit', payload: { commodity }
            }),
            invokeAiAdvisor({
                action: 'classify_commodity', payload: { commodity }
            })
        ]);

        const duration = performance.now() - startTime;
        debug.log('AI Suggestion Completed', { duration: `${duration.toFixed(2)}ms` });

        // Handle Unit
        if (unitRes.data?.unit) {
            setAiSuggestion(unitRes.data);
            form.setValue('unit', unitRes.data.unit);
            debug.log('AI Suggested Unit', unitRes.data);
        }

        // Handle Classification
        if (classRes.data?.hts) {
            setExtendedData(prev => ({
                ...prev,
                htsCode: classRes.data.hts,
                scheduleB: classRes.data.scheduleB || prev.scheduleB
            }));
            debug.log('AI Classified Commodity', classRes.data);
            toast({
                title: "AI Analysis Complete",
                description: `Classified as ${classRes.data.type} (HTS: ${classRes.data.hts})`,
            });
        }

    } catch (err) {
        debug.error("AI Suggest Error", err);
    } finally {
        setAiLoading(false);
    }
  };

  // Helper to invoke AI Advisor with explicit auth using fetch
  const invokeAiAdvisor = async (body: any) => {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    let anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Safety: Strip quotes if present (common env issue)
    if (anonKey && (anonKey.startsWith('"') || anonKey.startsWith("'"))) {
        anonKey = anonKey.slice(1, -1);
    }

    const functionUrl = `${projectUrl}/functions/v1/ai-advisor`;

    let sessionToken = null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionToken = session?.access_token;
    } catch (e) {
        debug.warn("Failed to get session for AI Advisor", e);
    }

    if (!anonKey) {
        debug.error("Missing Supabase Anon/Publishable Key");
        return { data: null, error: new Error("Configuration Error: Missing API Key") };
    }

    // Function to perform the fetch
    const doFetch = async (token: string | null | undefined, useAnon: boolean) => {
        const keyToUse = useAnon ? anonKey : (token || anonKey);
        // debug.log(`[AI-Advisor] Calling ${functionUrl} (${useAnon ? 'Anon' : 'User Auth'})`);
        
        return fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${keyToUse}`,
                'apikey': anonKey
            },
            body: JSON.stringify(body)
        });
    };

    try {
        // 1. Try with User Token (if available)
        let response;
        if (sessionToken) {
            response = await doFetch(sessionToken, false);
            
            // If 401, retry with Anon Key
            if (response.status === 401) {
                debug.warn("[AI-Advisor] User token rejected (401). Retrying with Anon Key...");
                response = await doFetch(anonKey, true);
            }
        } else {
            // No session, try Anon Key directly
            debug.warn("[AI-Advisor] No active session. Using Anon Key.");
            response = await doFetch(anonKey, true);
        }

        if (!response.ok) {
            const errorText = await response.text();
            // Try to parse JSON error if possible
            try {
                const errJson = JSON.parse(errorText);
                return { data: null, error: { message: errJson.error || errorText, status: response.status } };
            } catch (e) {
                 return { data: null, error: { message: `Function returned ${response.status}: ${errorText}`, status: response.status } };
            }
        }

        const data = await response.json();
        return { data, error: null };
    } catch (err) {
        debug.error("AI Advisor Invocation Error", err);
        return { data: null, error: err };
    }
  };

  // AI: Validate Compliance before submit
  const validateCompliance = async () => {
    try {
        const { data, error } = await invokeAiAdvisor({
            action: 'validate_compliance', 
            payload: { 
                origin, 
                destination, 
                commodity, 
                mode, 
                dangerous_goods: extendedData.dangerousGoods 
            } 
        });

        if (error) {
            debug.error("Compliance Check Failed", error);
            // Fallback to true (allow user to proceed if AI fails)
            return true;
        }

        setComplianceCheck(data);
        if (data?.compliant === false) {
             debug.warn("Compliance Issues Found", data.issues);
        }
        return data?.compliant !== false; // Default true if error
    } catch (e) {
        debug.error("Compliance Check Exception", e);
        return true;
    }
  };

  const onSubmit = async (data: QuickQuoteValues) => {
    const submitStartTime = performance.now();
    debug.info('Quote Submission Initiated', { data, extendedData });

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
      const payload = {
        ...data,
        ...extendedData,
        account_id: accountId
      };

      debug.log('Invoking Rate Engines', { payload, smartMode });

      const combos = ((payload.mode === 'ocean' || payload.mode === 'rail') && extendedData.containerCombos.length > 0)
        ? extendedData.containerCombos
        : [{ type: extendedData.containerType, size: extendedData.containerSize, qty: Number(extendedData.containerQty) || 1 }];
      const legacyPromises = combos.map(c => {
        // Resolve UUIDs to Names/Codes for Legacy Rate Engine
        const { type: typeName, size: sizeName } = resolveContainerInfo(c.type, c.size);
        return supabase.functions.invoke('rate-engine', {
          body: { 
            ...payload, 
            containerType: typeName, 
            containerSize: sizeName, 
            containerQty: String(c.qty),
            // Pass UUIDs as well for future-proofing
            containerTypeId: c.type,
            containerSizeId: c.size
          }
        });
      });
      const aiPromise = smartMode 
        ? invokeAiAdvisor({ action: 'generate_smart_quotes', payload: payload })
        : Promise.resolve({ data: null, error: null });

      const [legacyResList, aiRes] = await Promise.all([Promise.all(legacyPromises), aiPromise]);
      const duration = performance.now() - submitStartTime;
      debug.info('Rate Engines Completed', { duration: `${duration.toFixed(2)}ms` });

      const pricingService = new PricingService(supabase);

      let combinedOptions: RateOption[] = [];

      let legacyErrorMsg = '';
      for (let i = 0; i < legacyResList.length; i++) {
        const legacyRes = legacyResList[i] as any;
        const combo = combos[i];
        if (legacyRes.error) {
          try {
            if (legacyRes.error.context && typeof legacyRes.error.context.json === 'function') {
              const body = await legacyRes.error.context.json();
              legacyErrorMsg = body.error || body.message || legacyRes.error.message;
            } else {
              legacyErrorMsg = legacyRes.error.message || 'Unknown Error';
            }
          } catch (e) {
            legacyErrorMsg = legacyRes.error.message || 'Unknown Error';
          }
          toast({
            title: "Rate Engine Error",
            description: `Failed for ${combo.type} ${combo.size} x${combo.qty}: ${legacyErrorMsg}`,
            variant: "destructive"
          });
          continue;
        }
        if (legacyRes.data?.options) {
          const { type: typeName, size: sizeName } = resolveContainerInfo(combo.type, combo.size);
          const formattedSize = formatContainerSize(sizeName);

          let legacyOptions = await Promise.all(legacyRes.data.options.map(async (opt: any) => {
            const mapped = mapOptionToQuote(opt);
            const qty = combo.qty || 1;
            const sell = (mapped.total_amount || 0) * qty;
            const calc = await pricingService.calculateFinancials(sell, 15, false);
            let markupPercent = 0;
            if (calc.buyPrice > 0) {
              markupPercent = Number(((calc.marginAmount / calc.buyPrice) * 100).toFixed(2));
            }
            return {
              ...mapped,
              source_attribution: 'Standard Rate Engine',
              carrier: mapped.carrier_name,
              price: sell,
              currency: mapped.currency || 'USD',
              name: `${mapped.option_name} • ${formattedSize} x${qty}`,
              transitTime: mapped.transit_time?.details,
              co2_kg: mapped.total_co2_kg,
              legs: mapped.legs,
              charges: mapped.charges,
              buyPrice: calc.buyPrice,
              marginAmount: calc.marginAmount,
              marginPercent: calc.marginPercent,
              markupPercent,
              verified: true,
              verificationTimestamp: new Date().toISOString()
            };
          }));
          legacyOptions = legacyOptions.sort((a: any, b: any) => {
            if (a.price !== b.price) return a.price - b.price;
            const getDays = (s?: string) => {
              if (!s) return 999;
              const match = s.match(/(\d+)/);
              return match ? parseInt(match[1]) : 999;
            };
            return getDays(a.transitTime) - getDays(b.transitTime);
          }).slice(0, 2);
          combinedOptions = [...combinedOptions, ...legacyOptions];
        }
      }

      // 2. Process AI Results
      if (smartMode) {
          if (aiRes.error) {
              debug.error("[QuickQuote] AI Advisor Error", aiRes.error);
              
              let errorMsg = "Could not generate smart quotes, showing standard rates only.";
              
              if (aiRes.error.message) {
                  errorMsg = `AI Error: ${aiRes.error.message}`;
              }

              toast({ 
                  title: "AI Generation Failed", 
                  description: errorMsg, 
                  variant: "destructive" 
              });
          } else if (aiRes.data) {
              debug.log("[QuickQuote] AI Advisor Data Received", { data: aiRes.data });
              const aiData = aiRes.data;
              
              if (aiData.options) {
                  let aiOptions = await Promise.all(aiData.options.map(async (opt: any) => {
                      const mapped = mapOptionToQuote(opt);
                      // Replace synchronous legacy calc with async PricingService
                      const calc = await pricingService.calculateFinancials(mapped.total_amount, 15, false);

                      let markupPercent = 0;
                      if (calc.buyPrice > 0) {
                          markupPercent = Number(((calc.marginAmount / calc.buyPrice) * 100).toFixed(2));
                      }

                      return {
                          ...mapped,
                          id: mapped.id || `ai-${Math.random().toString(36).substr(2, 9)}`,
                          source_attribution: 'AI Smart Engine',
                          carrier: mapped.carrier_name, // Ensure carrier is a string for validation
                           price: mapped.total_amount, // Ensure price field is populated for UI
                           currency: mapped.currency || 'USD', // Ensure currency is present
                           name: mapped.option_name,
                          transitTime: mapped.transit_time?.details,
                          co2_kg: mapped.total_co2_kg,
                          legs: mapped.legs,
                          charges: mapped.charges,
                          buyPrice: calc.buyPrice,
                          marginAmount: calc.marginAmount,
                          marginPercent: calc.marginPercent,
                          markupPercent: markupPercent
                      };
                  }));
                  
                  // Filter AI Rates: Top 5 per carrier
                  const aiOptionsByCarrier: Record<string, RateOption[]> = {};
                  aiOptions.forEach((opt: RateOption) => {
                      const carrier = opt.carrier || 'Unknown';
                      if (!aiOptionsByCarrier[carrier]) aiOptionsByCarrier[carrier] = [];
                      aiOptionsByCarrier[carrier].push(opt);
                  });

                  const filteredAiOptions: RateOption[] = [];
                  Object.values(aiOptionsByCarrier).forEach((rates) => {
                      // Sort by Tier (Best Value first) then Price
                      const sorted = rates.sort((a, b) => {
                          if (a.tier === 'best_value' && b.tier !== 'best_value') return -1;
                          if (a.tier !== 'best_value' && b.tier === 'best_value') return 1;
                          return a.price - b.price;
                      });
                      filteredAiOptions.push(...sorted.slice(0, 5));
                  });
                  
                  combinedOptions = [...combinedOptions, ...filteredAiOptions];
                  setMarketAnalysis(aiData.market_analysis);
                  setConfidenceScore(aiData.confidence_score);
                  setAnomalies(aiData.anomalies || []);
              }
          }
      }

      if (combinedOptions.length === 0) {
          const aiError = aiRes.error ? (aiRes.error.message || 'Unknown AI Error') : 'No Data';
          throw new Error(`No quotes available. Legacy: ${legacyErrorMsg || 'No Data'}. AI: ${aiError}`);
      }

      setResults(combinedOptions);

      // Save to History
      try {
          const user = (await supabase.auth.getUser()).data.user;
          if (user && context?.tenantId) {
              const historyPayload = {
                  options: combinedOptions,
                  market_analysis: smartMode && aiRes?.data?.market_analysis ? aiRes.data.market_analysis : null,
                  confidence_score: smartMode && aiRes?.data?.confidence_score ? aiRes.data.confidence_score : null,
                  anomalies: smartMode && aiRes?.data?.anomalies ? aiRes.data.anomalies : []
              };

              await supabase.from('ai_quote_requests').insert({
                  user_id: user.id,
                  tenant_id: context.tenantId,
                  request_payload: payload,
                  response_payload: historyPayload,
                  status: 'generated'
              });
          }
      } catch (err) {
          console.error("[QuickQuote] Failed to save history:", err);
      }

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

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
        prev.includes(id) 
            ? prev.filter(x => x !== id) 
            : [...prev, id]
    );
  };

  const handleConvertToQuote = (option: RateOption | RateOption[]) => {
    const selectedOptions = Array.isArray(option) ? option : [option];
    
    // Construct the transfer payload
    const transferPayload = { 
      ...form.getValues(),
      ...extendedData,
      commodity_description: form.getValues().commodity,
      selectedRates: selectedOptions.map(opt => ({
        ...opt,
        // Ensure AI fields are explicitly passed
        reliability_score: opt.reliability?.score || undefined,
        ai_generated: opt.source_attribution === 'AI Smart Engine',
        ai_explanation: opt.ai_explanation
      })),
      accountId: accountId,
      marketAnalysis,
      confidenceScore,
      anomalies
    };

    // 1. Validation
    try {
        // Use safeParse to allow handling errors gracefully without crashing if needed, 
        // but here we want to block invalid data.
        const validatedData = QuoteTransferSchema.parse(transferPayload);
        
        // 2. Logging
        debug.info('Initiating Quick Quote to New Quote Transfer', {
            origin: validatedData.origin,
            destination: validatedData.destination,
            mode: validatedData.mode,
            optionsCount: validatedData.selectedRates.length,
            timestamp: new Date().toISOString()
        });

        setIsOpen(false);
        navigate('/dashboard/quotes/new', { 
            state: {
                ...validatedData,
                selectedRate: selectedOptions[0] // Maintain backward compatibility if needed
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            debug.error('Quote Transfer Validation Failed', { errors: error.errors });
            toast({
                title: "Data Validation Error",
                description: "Cannot proceed: Missing required fields for quote generation.",
                variant: "destructive"
            });
            // Detailed log for debugging
            debug.error("Validation details:", error.errors);
        } else {
            debug.error('Unexpected Transfer Error', { error });
            toast({
                title: "Transfer Error",
                description: "An unexpected error occurred preparing the quote.",
                variant: "destructive"
            });
        }
    }
  };

  const handleConvertSelected = () => {
    if (!results) return;
    const selectedOptions = results.filter(r => selectedIds.includes(r.id));
    if (selectedOptions.length > 0) {
        handleConvertToQuote(selectedOptions);
    }
  };

  const reset = () => {
    setResults(null);
    form.reset();
    setSelectedIds([]);
    setExtendedData({
        containerType: '',
        containerSize: '',
        containerQty: '1',
        containerCombos: [],
        htsCode: '',
        aes_hts_id: '',
        scheduleB: '',
        dims: '',
        dangerousGoods: false,
        specialHandling: '',
        vehicleType: 'van',
        pickupDate: '',
        deliveryDeadline: '',
        originDetails: null,
        destinationDetails: null
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
      <DialogContent className="max-w-[95vw] w-[1600px] h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-8 py-5 border-b bg-background z-10">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            Quick Quote & AI Analysis
          </DialogTitle>
          <DialogDescription className="text-base">
            Generate instant quotes with AI-powered market analysis and route optimization.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Input Section - Left Side */}
          <div className="w-[400px] shrink-0 bg-muted/30 p-6 border-r overflow-y-auto">
            <form onSubmit={form.handleSubmit(onSubmit, (e) => console.error("Form Errors:", e))} className="space-y-6">
              
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
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="ocean"><Ship className="w-4 h-4 mr-2"/>Ocean</TabsTrigger>
                    <TabsTrigger value="air"><Plane className="w-4 h-4 mr-2"/>Air</TabsTrigger>
                    <TabsTrigger value="road"><Truck className="w-4 h-4 mr-2"/>Road</TabsTrigger>
                    <TabsTrigger value="rail"><Train className="w-4 h-4 mr-2"/>Rail</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Origin / Destination */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex justify-between">
                    Origin
                    {form.formState.errors.origin && <span className="text-destructive text-xs">{form.formState.errors.origin.message}</span>}
                  </Label>
                  <LocationAutocomplete
                    placeholder="Search origin port, airport, or city..."
                    value={origin}
                    onChange={(value, location) => handleLocationChange('origin', value, location)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex justify-between">
                    Destination
                    {form.formState.errors.destination && <span className="text-destructive text-xs">{form.formState.errors.destination.message}</span>}
                  </Label>
                  <LocationAutocomplete
                    placeholder="Search destination port, airport, or city..."
                    value={destination}
                    onChange={(value, location) => handleLocationChange('destination', value, location)}
                  />
                </div>
              </div>

              {/* Commodity & AI */}
              <div className="space-y-2">
                 <Label className="flex justify-between">
                    <span>Commodity & Cargo {form.formState.errors.commodity && <span className="text-destructive text-xs ml-2">{form.formState.errors.commodity.message}</span>}</span>
                    <button type="button" onClick={handleAiSuggest} className="text-xs text-primary flex items-center gap-1 hover:underline">
                        <Sparkles className="w-3 h-3" /> AI Analyze
                    </button>
                 </Label>
                 <SharedCargoInput 
                    value={cargoItem} 
                    onChange={setCargoItem}
                    errors={form.formState.errors as any}
                 />
                 <input type="hidden" {...form.register("commodity")} />
              </div>

              {/* Preferred Carriers */}
              <div className="space-y-2">
                 <Label>Preferred Carriers (Optional)</Label>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between text-left font-normal h-9 bg-background">
                            <span className="truncate">
                                {(form.watch("preferredCarriers")?.length ?? 0) > 0
                                    ? `${form.watch("preferredCarriers")?.length} Selected` 
                                    : "Any Carrier"}
                            </span>
                            <ChevronDown className="w-4 h-4 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="start">
                        <DropdownMenuLabel>Select Carriers</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {filteredCarriers.map((carrier) => {
                            const current = form.watch("preferredCarriers") || [];
                            const isSelected = current.includes(carrier.name);
                            return (
                                <DropdownMenuCheckboxItem
                                    key={carrier.id}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            form.setValue("preferredCarriers", [...current, carrier.name]);
                                        } else {
                                            form.setValue("preferredCarriers", current.filter(c => c !== carrier.name));
                                        }
                                    }}
                                >
                                    {carrier.name}
                                </DropdownMenuCheckboxItem>
                            );
                        })}
                    </DropdownMenuContent>
                 </DropdownMenu>
              </div>

              {/* Dynamic Fields based on Mode */}
              
              {/* OCEAN / RAIL FIELDS - Handled by SharedCargoInput */}

              {/* AIR FIELDS - Handled by SharedCargoInput */}

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
          <div className="flex-1 p-6 bg-background overflow-y-auto">
            
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
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">Rate Options</h3>
                            <Badge variant="outline" className="text-xs">{results.length} Options</Badge>
                        </div>
                        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'compare')} className="w-auto">
                            <TabsList className="h-8">
                                <TabsTrigger value="list" className="text-xs h-7 px-2"><LayoutList className="w-3 h-3 mr-1"/> Browse</TabsTrigger>
                                <TabsTrigger value="compare" className="text-xs h-7 px-2"><Columns className="w-3 h-3 mr-1"/> Compare</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                    
                    {viewMode === 'list' ? (
                        <QuoteResultsList 
                            results={results} 
                            onSelect={handleConvertToQuote}
                            selectedIds={selectedIds}
                            onToggleSelection={toggleSelection}
                            onGenerateSmartOptions={smartMode ? () => onSubmit(form.getValues()) : undefined}
                            marketAnalysis={marketAnalysis}
                            confidenceScore={confidenceScore}
                            anomalies={anomalies}
                        />
                    ) : (
                        <QuoteComparisonView 
                            options={results} 
                            onSelect={handleConvertToQuote}
                            selectedIds={selectedIds}
                            onToggleSelection={toggleSelection}
                            onGenerateSmartOptions={smartMode ? () => onSubmit(form.getValues()) : undefined}
                        />
                    )}

                    {/* Floating Selection Footer */}
                    {selectedIds.length > 0 && (
                        <div className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg flex justify-between items-center animate-in slide-in-from-bottom-5">
                            <div className="text-sm font-medium">
                                <Badge variant="secondary" className="mr-2">{selectedIds.length}</Badge>
                                options selected
                            </div>
                            <Button onClick={handleConvertSelected} className="gap-2">
                                Create Quote with Selected <ArrowRight className="w-4 h-4"/>
                            </Button>
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
