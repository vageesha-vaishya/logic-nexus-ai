import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QuotationWorkflowStepper } from './composer/QuotationWorkflowStepper';
import { QuoteDetailsStep } from './composer/QuoteDetailsStep';
import { LegsConfigurationStep } from './composer/LegsConfigurationStep';
import { ChargesManagementStep } from './composer/ChargesManagementStep';
import { ReviewAndSaveStep } from './composer/ReviewAndSaveStep';
import { BasisConfigModal } from './composer/BasisConfigModal';
import { DeleteConfirmDialog } from './composer/DeleteConfirmDialog';
import { SaveProgress } from './composer/SaveProgress';
import { ErrorBoundary } from './composer/ErrorBoundary';
import { ValidationFeedback } from './composer/ValidationFeedback';

interface Leg {
  id: string;
  mode: string;
  serviceTypeId: string;
  origin: string;
  destination: string;
  charges: any[];
  legType?: 'transport' | 'service';
  serviceOnlyCategory?: string;
}

interface MultiModalQuoteComposerProps {
  quoteId: string;
  versionId: string;
  optionId?: string;
}

const STEPS = [
  { id: 1, title: 'Quote Details', description: 'Basic information' },
  { id: 2, title: 'Transport Legs', description: 'Configure routes' },
  { id: 3, title: 'Charges', description: 'Add costs' },
  { id: 4, title: 'Review & Save', description: 'Finalize quote' }
];

export function MultiModalQuoteComposer({ quoteId, versionId, optionId: initialOptionId }: MultiModalQuoteComposerProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [optionId, setOptionId] = useState<string | null>(initialOptionId || null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [combinedCharges, setCombinedCharges] = useState<any[]>([]);
  const [quoteData, setQuoteData] = useState<any>({});
  const [autoMargin, setAutoMargin] = useState(false);
  const [marginPercent, setMarginPercent] = useState(15);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  
  // Track charges to delete
  const [chargesToDelete, setChargesToDelete] = useState<string[]>([]);
  
  // Delete confirmation state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'leg' | 'charge' | 'combinedCharge';
    target?: any;
  }>({ open: false, type: 'leg' });

  // Save progress tracking
  const [saveProgress, setSaveProgress] = useState<{
    show: boolean;
    steps: { label: string; completed: boolean }[];
  }>({
    show: false,
    steps: []
  });
  
  // Validation feedback
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Reference data
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [chargeCategories, setChargeCategories] = useState<any[]>([]);
  const [chargeBases, setChargeBases] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [tradeDirections, setTradeDirections] = useState<any[]>([]);
  const [containerTypes, setContainerTypes] = useState<any[]>([]);
  const [containerSizes, setContainerSizes] = useState<any[]>([]);

  // Basis configuration modal
  const [basisModalOpen, setBasisModalOpen] = useState(false);
  const [currentBasisConfig, setCurrentBasisConfig] = useState<any>({
    tradeDirection: '',
    containerType: '',
    containerSize: '',
    quantity: 1
  });
  const [basisTarget, setBasisTarget] = useState<{ type: 'leg' | 'combined'; legId?: string; chargeIdx: number } | null>(null);

  // Transport modes for mode-to-service-type mapping
  const [transportModes, setTransportModes] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
    
    // Keyboard shortcuts
    const handleKeyboard = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (currentStep === 4 && !saving) {
          saveQuotation();
        }
      }
      // Cmd/Ctrl + → to go next
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        if (canProceed()) handleNext();
      }
      // Cmd/Ctrl + ← to go back
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
      }
    };
    
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [currentStep, saving]);

  useEffect(() => {
    if (optionId && tenantId) {
      loadOptionData();
    }
  }, [optionId, tenantId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userTenantId = user?.user_metadata?.tenant_id;
      // Resolve tenant from multiple sources to avoid save failures for platform admins
      let resolvedTenantId: string | null = userTenantId ?? null;

      // Fallback 1: fetch from quote context
      if (!resolvedTenantId && quoteId) {
        try {
          const { data: quoteRow } = await supabase
            .from('quotes')
            .select('tenant_id, franchise_id')
            .eq('id', quoteId)
            .maybeSingle();
          resolvedTenantId = (quoteRow as any)?.tenant_id ?? null;
          if ((quoteRow as any)?.franchise_id) {
            setFranchiseId((quoteRow as any).franchise_id);
          }
        } catch {}
      }

      // Fallback 2: fetch from quotation version
      if (!resolvedTenantId && versionId) {
        try {
          const { data: versionRow } = await supabase
            .from('quotation_versions')
            .select('tenant_id')
            .eq('id', versionId)
            .maybeSingle();
          resolvedTenantId = (versionRow as any)?.tenant_id ?? null;
        } catch {}
      }

      // Fallback 3: fetch from existing option if provided
      if (!resolvedTenantId && optionId) {
        try {
          const { data: optionRow } = await supabase
            .from('quotation_version_options')
            .select('tenant_id')
            .eq('id', optionId)
            .maybeSingle();
          resolvedTenantId = (optionRow as any)?.tenant_id ?? null;
        } catch {}
      }

      setTenantId(resolvedTenantId);

      const [st, tm, cc, cb, cu, td, ct, cs] = await Promise.all([
        supabase
          .from('service_types')
          .select('*')
          .eq('is_active', true),
        supabase.from('transport_modes').select('*').eq('is_active', true),
        supabase.from('charge_categories').select('*').eq('is_active', true),
        supabase.from('charge_bases').select('*').eq('is_active', true),
        supabase.from('currencies').select('*').eq('is_active', true),
        supabase.from('trade_directions').select('*').eq('is_active', true),
        supabase.from('container_types').select('*').eq('is_active', true),
        supabase.from('container_sizes').select('*').eq('is_active', true),
      ]);

      setServiceTypes(st.data || []);
      setTransportModes(tm.data || []);
      setChargeCategories(cc.data || []);
      setChargeBases(cb.data || []);
      setCurrencies(cu.data || []);
      setTradeDirections(td.data || []);
      setContainerTypes(ct.data || []);
      setContainerSizes(cs.data || []);

      // Set default currency
      if (cu.data && cu.data.length > 0) {
        setQuoteData((prev: any) => ({ ...prev, currencyId: cu.data[0].id }));
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Helper to ensure tenantId exists at save time
  const ensureTenantForSave = async (): Promise<string | null> => {
    if (tenantId) return tenantId;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let resolved: string | null = user?.user_metadata?.tenant_id ?? null;
      if (!resolved && quoteId) {
        const { data: q } = await supabase
          .from('quotes')
          .select('tenant_id')
          .eq('id', quoteId)
          .maybeSingle();
        resolved = (q as any)?.tenant_id ?? null;
      }
      if (!resolved && versionId) {
        const { data: v } = await supabase
          .from('quotation_versions')
          .select('tenant_id')
          .eq('id', versionId)
          .maybeSingle();
        resolved = (v as any)?.tenant_id ?? null;
      }
      if (!resolved && optionId) {
        const { data: o } = await supabase
          .from('quotation_version_options')
          .select('tenant_id')
          .eq('id', optionId)
          .maybeSingle();
        resolved = (o as any)?.tenant_id ?? null;
      }
      if (resolved) setTenantId(resolved);
      return resolved;
    } catch {
      return null;
    }
  };

  const loadOptionData = async () => {
    if (!optionId || !tenantId) return;

    setLoading(true);
    try {
      // Load legs from quotation_version_option_legs to align with FK on quote_charges.leg_id
      const { data: legData, error: legError } = await supabase
        .from('quotation_version_option_legs')
        .select(`
          *,
          quote_charges(
            *,
            charge_sides(code),
            charge_categories(name, code),
            charge_bases(name, code),
            currencies(code, symbol)
          )
        `)
        .eq('quotation_version_option_id', optionId)
        .order('sort_order', { ascending: true });

      if (legError) throw legError;

      if (legData && legData.length > 0) {
        // Group charges by leg and pair buy/sell
        const legsWithCharges = legData.map((leg: any) => {
          const chargesMap = new Map();

          // Group charges by their base properties (category, basis, etc.)
          leg.quote_charges?.forEach((charge: any) => {
            const key = `${charge.category_id}-${charge.basis_id}-${charge.note || ''}`;
            if (!chargesMap.has(key)) {
              chargesMap.set(key, {
                id: charge.id,
                category_id: charge.category_id,
                basis_id: charge.basis_id,
                unit: charge.unit,
                currency_id: charge.currency_id,
                note: charge.note,
                buy: { quantity: 0, rate: 0 },
                sell: { quantity: 0, rate: 0 }
              });
            }

            const chargeObj = chargesMap.get(key);
            const side = charge.charge_sides?.code;
            if (side === 'buy') {
              chargeObj.buy = { quantity: charge.quantity || 0, rate: charge.rate || 0 };
            } else if (side === 'sell') {
              chargeObj.sell = { quantity: charge.quantity || 0, rate: charge.rate || 0 };
            }
          });

          return {
            id: leg.id,
            mode: leg.mode || 'ocean',
            serviceTypeId: leg.service_type_id || '',
            origin: leg.origin_location || '',
            destination: leg.destination_location || '',
            legType: leg.leg_type || 'transport',
            serviceOnlyCategory: leg.service_only_category || '',
            charges: Array.from(chargesMap.values())
          };
        });

        setLegs(legsWithCharges);
      }
      // Load combined charges (leg_id IS NULL) and pair buy/sell
      const { data: combinedData, error: combinedErr } = await supabase
        .from('quote_charges' as any)
        .select(`*, charge_sides(code)`)
        .eq('quote_option_id', optionId)
        .is('leg_id', null)
        .order('sort_order', { ascending: true });
      if (combinedErr) throw combinedErr;
      if (Array.isArray(combinedData)) {
        const map = new Map<string, any>();
        combinedData.forEach((row: any) => {
          const key = `${row.category_id}-${row.basis_id}-${row.note || ''}`;
          const existing = map.get(key) || {
            id: row.id,
            category_id: row.category_id,
            basis_id: row.basis_id,
            unit: row.unit,
            currency_id: row.currency_id,
            note: row.note,
            buy: { quantity: 0, rate: 0 },
            sell: { quantity: 0, rate: 0 }
          };
          if (row.charge_sides?.code === 'buy') {
            existing.buy = { quantity: row.quantity || 0, rate: row.rate || 0 };
          } else if (row.charge_sides?.code === 'sell') {
            existing.sell = { quantity: row.quantity || 0, rate: row.rate || 0 };
          }
          map.set(key, existing);
        });
        setCombinedCharges(Array.from(map.values()));
      } else {
        setCombinedCharges([]);
      }
    } catch (error: any) {
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const addLeg = (modeId: string) => {
    // Resolve the selected transport mode so we can use its code for lookups and labels
    const selectedMode = transportModes.find((tm) => tm.id === modeId);
    const modeCode = selectedMode?.code || modeId;
    const lowerModeCode = modeCode.toLowerCase();
    
    // Find matching service types by looking at their transport_modes relationship
    const matchingServiceTypes = serviceTypes.filter((st) => {
      if (!st.is_active) return false;
      const transportMode = (st as any).transport_modes;
      return transportMode && transportMode.code?.toLowerCase() === lowerModeCode;
    });
    
    const defaultServiceType = matchingServiceTypes[0];

    const newLeg: Leg = {
      id: `leg-${Date.now()}`,
      mode: modeCode,
      serviceTypeId: defaultServiceType?.id || '',
      origin: '',
      destination: '',
      charges: [],
      legType: 'transport',
    };
    setLegs([...legs, newLeg]);
    
    // Show toast if service type was auto-selected
    if (defaultServiceType) {
      toast({
        title: 'Service Type Auto-Selected',
        description: `${defaultServiceType.name} has been automatically selected for ${selectedMode?.name || modeCode} transport.`,
      });
    }
  };

  const updateLeg = (legId: string, updates: Partial<Leg>) => {
    setLegs(legs.map(leg => leg.id === legId ? { ...leg, ...updates } : leg));
  };

  const confirmRemoveLeg = (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    const hasCharges = leg && leg.charges.length > 0;
    
    if (hasCharges) {
      setDeleteDialog({
        open: true,
        type: 'leg',
        target: legId
      });
    } else {
      removeLeg(legId);
    }
  };

  const removeLeg = (legId: string) => {
    // Track charges that need to be deleted from DB
    const legToRemove = legs.find(leg => leg.id === legId);
    if (legToRemove) {
      const chargeIdsToDelete: string[] = [];
      legToRemove.charges.forEach(charge => {
        if (charge.buy?.dbChargeId) chargeIdsToDelete.push(charge.buy.dbChargeId);
        if (charge.sell?.dbChargeId) chargeIdsToDelete.push(charge.sell.dbChargeId);
      });
      if (chargeIdsToDelete.length > 0) {
        setChargesToDelete(prev => [...prev, ...chargeIdsToDelete]);
      }
    }
    
    setLegs(legs.filter(leg => leg.id !== legId));
    setDeleteDialog({ open: false, type: 'leg' });
  };

  const addCharge = (legId: string) => {
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        return {
          ...leg,
          charges: [
            ...leg.charges,
            {
              id: `charge-${Date.now()}`,
              category_id: '',
              basis_id: '',
              unit: '',
              currency_id: currencies[0]?.id || '',
              buy: { quantity: 1, rate: 0, dbChargeId: null },
              sell: { quantity: 1, rate: 0, dbChargeId: null },
              note: ''
            }
          ]
        };
      }
      return leg;
    }));
  };

  const updateCharge = (legId: string, chargeIdx: number, field: string, value: any) => {
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        const charges = [...leg.charges];
        const charge = { ...charges[chargeIdx] };

        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          charge[parent] = { ...(charge[parent] || {}), [child]: value };
        } else {
          charge[field] = value;
        }

        // Apply auto margin if enabled
        if (autoMargin && marginPercent > 0 && field.startsWith('buy.')) {
          const sellRate = (charge.buy?.rate || 0) * (1 + marginPercent / 100);
          charge.sell = {
            quantity: charge.buy?.quantity || 1,
            rate: sellRate
          };
        }

        charges[chargeIdx] = charge;
        return { ...leg, charges };
      }
      return leg;
    }));
  };

  const confirmRemoveCharge = (legId: string, chargeIdx: number) => {
    setDeleteDialog({
      open: true,
      type: 'charge',
      target: { legId, chargeIdx }
    });
  };

  const removeCharge = (legId: string, chargeIdx: number) => {
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        const chargeToRemove = leg.charges[chargeIdx];
        
        // Track DB charge IDs for deletion
        if (chargeToRemove) {
          const idsToDelete: string[] = [];
          if (chargeToRemove.buy?.dbChargeId) idsToDelete.push(chargeToRemove.buy.dbChargeId);
          if (chargeToRemove.sell?.dbChargeId) idsToDelete.push(chargeToRemove.sell.dbChargeId);
          if (idsToDelete.length > 0) {
            setChargesToDelete(prev => [...prev, ...idsToDelete]);
          }
        }
        
        return {
          ...leg,
          charges: leg.charges.filter((_, idx) => idx !== chargeIdx)
        };
      }
      return leg;
    }));
    
    setDeleteDialog({ open: false, type: 'charge' });
  };

  // Combined charges handlers
  const addCombinedCharge = () => {
    setCombinedCharges(prev => ([
      ...prev,
      {
        id: `combined-${Date.now()}`,
        category_id: '',
        basis_id: '',
        unit: '',
        currency_id: currencies[0]?.id || '',
        buy: { quantity: 1, rate: 0, dbChargeId: null },
        sell: { quantity: 1, rate: 0, dbChargeId: null },
        note: ''
      }
    ]));
  };

  const updateCombinedCharge = (chargeIdx: number, field: string, value: any) => {
    setCombinedCharges(prev => {
      const next = [...prev];
      const charge = { ...next[chargeIdx] };
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        charge[parent] = { ...(charge[parent] || {}), [child]: value };
      } else {
        charge[field] = value;
      }
      if (autoMargin && marginPercent > 0 && field.startsWith('buy.')) {
        const buyAmount = (charge.buy?.quantity || 1) * (charge.buy?.rate || 0);
        const sellRate = (charge.buy?.rate || 0) * (1 + marginPercent / 100);
        charge.sell = {
          quantity: charge.buy?.quantity || 1,
          rate: sellRate
        };
      }
      next[chargeIdx] = charge;
      return next;
    });
  };

  const confirmRemoveCombinedCharge = (chargeIdx: number) => {
    setDeleteDialog({
      open: true,
      type: 'combinedCharge',
      target: chargeIdx
    });
  };

  const removeCombinedCharge = (chargeIdx: number) => {
    setCombinedCharges(prev => {
      const chargeToRemove = prev[chargeIdx];
      
      // Track DB charge IDs for deletion
      if (chargeToRemove) {
        const idsToDelete: string[] = [];
        if (chargeToRemove.buy?.dbChargeId) idsToDelete.push(chargeToRemove.buy.dbChargeId);
        if (chargeToRemove.sell?.dbChargeId) idsToDelete.push(chargeToRemove.sell.dbChargeId);
        if (idsToDelete.length > 0) {
          setChargesToDelete(prevIds => [...prevIds, ...idsToDelete]);
        }
      }
      
      return prev.filter((_, idx) => idx !== chargeIdx);
    });
    
    setDeleteDialog({ open: false, type: 'combinedCharge' });
  };

  const openBasisModal = (legId: string, chargeIdx: number) => {
    setBasisTarget({ type: 'leg', legId, chargeIdx });
    const tdId = String(tradeDirections?.[0]?.id ?? '');
    const ctId = String(containerTypes?.[0]?.id ?? '');
    const csId = String(containerSizes?.[0]?.id ?? '');
    setCurrentBasisConfig({ tradeDirection: tdId, containerType: ctId, containerSize: csId, quantity: 1 });
    setBasisModalOpen(true);
  };

  const openCombinedBasisModal = (chargeIdx: number) => {
    setBasisTarget({ type: 'combined', chargeIdx });
    const tdId = String(tradeDirections?.[0]?.id ?? '');
    const ctId = String(containerTypes?.[0]?.id ?? '');
    const csId = String(containerSizes?.[0]?.id ?? '');
    setCurrentBasisConfig({ tradeDirection: tdId, containerType: ctId, containerSize: csId, quantity: 1 });
    setBasisModalOpen(true);
  };

  const saveBasisConfig = (config: any) => {
    if (!basisTarget) return;
    const size = containerSizes.find(s => s.id === config.containerSize);

    if (basisTarget.type === 'leg' && basisTarget.legId) {
      const { legId, chargeIdx } = basisTarget;
      setLegs(legs.map(leg => {
        if (leg.id === legId) {
          const charges = [...leg.charges];
          charges[chargeIdx] = {
            ...charges[chargeIdx],
            unit: `${config.quantity}x${size?.name || ''}`,
            buy: { ...charges[chargeIdx].buy, quantity: config.quantity },
            sell: { ...charges[chargeIdx].sell, quantity: config.quantity },
            basisDetails: config
          };
          return { ...leg, charges };
        }
        return leg;
      }));
    } else if (basisTarget.type === 'combined') {
      const { chargeIdx } = basisTarget;
      setCombinedCharges(prev => {
        const next = [...prev];
        next[chargeIdx] = {
          ...next[chargeIdx],
          unit: `${config.quantity}x${size?.name || ''}`,
          buy: { ...(next[chargeIdx].buy || {}), quantity: config.quantity },
          sell: { ...(next[chargeIdx].sell || {}), quantity: config.quantity },
          basisDetails: config
        };
        return next;
      });
    }

    setBasisModalOpen(false);
    setCurrentBasisConfig({ tradeDirection: '', containerType: '', containerSize: '', quantity: 1 });
  };

  const validateQuotation = () => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate legs
    if (legs.length === 0) {
      errors.push('At least one transport leg is required');
    }

    legs.forEach((leg, idx) => {
      if (!leg.mode) errors.push(`Leg ${idx + 1}: Mode is required`);
      if (!leg.origin) errors.push(`Leg ${idx + 1}: Origin is required`);
      if (!leg.destination) errors.push(`Leg ${idx + 1}: Destination is required`);
      
      if (leg.charges.length === 0) {
        warnings.push(`Leg ${idx + 1}: No charges added. Consider adding at least one charge.`);
      }
      
      leg.charges.forEach((charge, chargeIdx) => {
        if (!charge.category_id) {
          errors.push(`Leg ${idx + 1}, Charge ${chargeIdx + 1}: Category is required`);
        }
        if (!charge.currency_id) {
          errors.push(`Leg ${idx + 1}, Charge ${chargeIdx + 1}: Currency is required`);
        }
        
        // Warn about zero rates
        if (charge.sell?.rate === 0) {
          warnings.push(`Leg ${idx + 1}, Charge ${chargeIdx + 1}: Sell rate is zero`);
        }
      });
    });

    // Validate combined charges
    combinedCharges.forEach((charge, idx) => {
      if (!charge.category_id) {
        errors.push(`Combined Charge ${idx + 1}: Category is required`);
      }
      if (!charge.currency_id) {
        errors.push(`Combined Charge ${idx + 1}: Currency is required`);
      }
    });
    
    // Check if all legs have zero charges and no combined charges
    if (legs.every(leg => leg.charges.length === 0) && combinedCharges.length === 0) {
      errors.push('At least one leg must have charges, or add combined charges');
    }

    return { errors, warnings };
  };

  const saveQuotation = async () => {
    // Validate first
    const validation = validateQuotation();
    setValidationErrors(validation.errors);
    setValidationWarnings(validation.warnings);
    
    if (validation.errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: `Please fix ${validation.errors.length} error${validation.errors.length > 1 ? 's' : ''} before saving`,
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    
    // Initialize progress tracking
    const progressSteps = [
      { label: 'Validating data...', completed: false },
      { label: 'Creating quotation option...', completed: false },
      { label: 'Cleaning up deleted items...', completed: false },
      { label: 'Saving transport legs...', completed: false },
      { label: 'Saving charges...', completed: false },
      { label: 'Finalizing...', completed: false }
    ];
    
    setSaveProgress({ show: true, steps: progressSteps });
    
    const updateProgress = (stepIndex: number) => {
      progressSteps[stepIndex].completed = true;
      setSaveProgress({ show: true, steps: [...progressSteps] });
    };

    try {
      // Ensure tenant is resolved before proceeding
      const finalTenantId = await ensureTenantForSave();
      if (!finalTenantId) {
        toast({
          title: 'Save Failed',
          description: 'Tenant ID not found. Please ensure the quote belongs to a tenant or your user has a tenant assigned.',
          variant: 'destructive'
        });
        setSaving(false);
        setSaveProgress({ show: false, steps: [] });
        return;
      }

      updateProgress(0); // Validation complete

      // Create option if needed
      let currentOptionId = optionId;
      if (!currentOptionId) {
        const { data: newOption, error: optError } = await supabase
          .from('quotation_version_options')
          .insert({
            quotation_version_id: versionId,
            tenant_id: finalTenantId
          })
          .select()
          .maybeSingle();
        
        if (optError) {
          console.error('Error creating option:', optError);
          throw new Error(`Failed to create quotation option: ${optError.message}`);
        }
        currentOptionId = newOption.id;
        setOptionId(currentOptionId);
      }
      
      updateProgress(1); // Option created

      // Delete tracked charges first
      if (chargesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('quote_charges')
          .delete()
          .in('id', chargesToDelete);
        
        if (deleteError) {
          console.error('Error deleting charges:', deleteError);
          throw new Error(`Failed to delete charges: ${deleteError.message}`);
        }
        
        // Clear the deletion queue
        setChargesToDelete([]);
      }

      // Get charge side IDs
      const [buySideRes, sellSideRes] = await Promise.all([
        supabase.from('charge_sides').select('id').eq('code', 'buy').single(),
        supabase.from('charge_sides').select('id').eq('code', 'sell').single()
      ]);

      if (buySideRes.error || sellSideRes.error || !buySideRes.data || !sellSideRes.data) {
        throw new Error('Failed to fetch charge sides');
      }

      const buySideId = buySideRes.data.id;
      const sellSideId = sellSideRes.data.id;

      // Clean up orphaned legs and their charges
      const { data: existingLegs } = await supabase
        .from('quotation_version_option_legs')
        .select('id')
        .eq('quotation_version_option_id', currentOptionId);
      
      const stateLegIds = new Set(
        (legs || [])
          .filter(l => !String(l.id).startsWith('leg-'))
          .map(l => String(l.id))
      );
      
      const toDeleteLegIds = (existingLegs || [])
        .map((l: any) => String(l.id))
        .filter((id: string) => !stateLegIds.has(id));
      
      if (toDeleteLegIds.length > 0) {
        // Delete charges associated with removed legs
        const { error: chargeDeleteError } = await supabase
          .from('quote_charges')
          .delete()
          .in('leg_id', toDeleteLegIds)
          .eq('quote_option_id', currentOptionId);
        
        if (chargeDeleteError) {
          console.error('Error deleting leg charges:', chargeDeleteError);
          throw new Error(`Failed to delete leg charges: ${chargeDeleteError.message}`);
        }
        
        // Delete the legs themselves
        const { error: legDeleteError } = await supabase
          .from('quotation_version_option_legs')
          .delete()
          .in('id', toDeleteLegIds);
        
        if (legDeleteError) {
          console.error('Error deleting legs:', legDeleteError);
          throw new Error(`Failed to delete legs: ${legDeleteError.message}`);
        }
      }
      
      updateProgress(2); // Cleanup complete

      // Save legs and charges
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        let legId = leg.id;
        
        if (leg.id.startsWith('leg-')) {
          // New leg
          const { data: newLeg, error: legError } = await supabase
            .from('quotation_version_option_legs')
            .insert({
              quotation_version_option_id: currentOptionId,
              mode: leg.mode,
              service_type_id: leg.serviceTypeId || null,
              origin_location: leg.origin,
              destination_location: leg.destination,
              leg_type: leg.legType || 'transport',
              service_only_category: leg.serviceOnlyCategory || null,
              tenant_id: finalTenantId,
              franchise_id: franchiseId,
              sort_order: i
            })
            .select()
            .single();
          
          if (legError) throw legError;
          if (!newLeg) throw new Error('Failed to create leg');
          legId = (newLeg as any).id;
        } else {
          // Update existing leg
          const { error: updateError } = await supabase
            .from('quotation_version_option_legs')
            .update({
              mode: leg.mode,
              service_type_id: leg.serviceTypeId || null,
              origin_location: leg.origin,
              destination_location: leg.destination,
              leg_type: leg.legType || 'transport',
              service_only_category: leg.serviceOnlyCategory || null,
              sort_order: i
            })
            .eq('id', legId);
          
          if (updateError) throw updateError;
        }

        // Save charges with UPDATE/INSERT logic
        for (const charge of leg.charges) {
          const chargeData = {
            quote_option_id: currentOptionId,
            leg_id: legId,
            category_id: charge.category_id || null,
            basis_id: charge.basis_id || null,
            currency_id: charge.currency_id || null,
            unit: charge.unit || null,
            note: charge.note || null,
            tenant_id: finalTenantId,
            franchise_id: franchiseId
          };

          // Handle buy side
          if (charge.buy?.dbChargeId) {
            // Update existing
            const { error: updateError } = await supabase
              .from('quote_charges')
              .update({
                ...chargeData,
                quantity: charge.buy.quantity || 1,
                rate: charge.buy.rate || 0,
                amount: (charge.buy.quantity || 1) * (charge.buy.rate || 0)
              })
              .eq('id', charge.buy.dbChargeId);
            if (updateError) throw updateError;
          } else {
            // Insert new
            const { error: insertError } = await supabase
              .from('quote_charges')
              .insert({
                ...chargeData,
                charge_side_id: buySideId,
                quantity: charge.buy?.quantity || 1,
                rate: charge.buy?.rate || 0,
                amount: (charge.buy?.quantity || 1) * (charge.buy?.rate || 0)
              });
            if (insertError) throw insertError;
          }

          // Handle sell side
          if (charge.sell?.dbChargeId) {
            // Update existing
            const { error: updateError } = await supabase
              .from('quote_charges')
              .update({
                ...chargeData,
                quantity: charge.sell.quantity || 1,
                rate: charge.sell.rate || 0,
                amount: (charge.sell.quantity || 1) * (charge.sell.rate || 0)
              })
              .eq('id', charge.sell.dbChargeId);
            if (updateError) throw updateError;
          } else {
            // Insert new
            const { error: insertError } = await supabase
              .from('quote_charges')
              .insert({
                ...chargeData,
                charge_side_id: sellSideId,
                quantity: charge.sell?.quantity || 1,
                rate: charge.sell?.rate || 0,
                amount: (charge.sell?.quantity || 1) * (charge.sell?.rate || 0)
              });
            if (insertError) throw insertError;
          }
        }
      }
      
      updateProgress(3); // Legs saved

      // Save combined charges with UPDATE/INSERT logic
      for (const charge of combinedCharges || []) {
        const chargeData = {
          quote_option_id: currentOptionId,
          leg_id: null,
          category_id: charge.category_id || null,
          basis_id: charge.basis_id || null,
          currency_id: charge.currency_id || null,
          unit: charge.unit || null,
          note: charge.note || null,
          tenant_id: finalTenantId
        };

        // Handle buy side
        if (charge.buy?.dbChargeId) {
          const { error: updateError } = await supabase
            .from('quote_charges')
            .update({
              ...chargeData,
              quantity: charge.buy.quantity || 1,
              rate: charge.buy.rate || 0,
              amount: (charge.buy.quantity || 1) * (charge.buy.rate || 0)
            })
            .eq('id', charge.buy.dbChargeId);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('quote_charges')
            .insert({
              ...chargeData,
              charge_side_id: buySideId,
              quantity: charge.buy?.quantity || 1,
              rate: charge.buy?.rate || 0,
              amount: (charge.buy?.quantity || 1) * (charge.buy?.rate || 0)
            });
          if (insertError) throw insertError;
        }

        // Handle sell side
        if (charge.sell?.dbChargeId) {
          const { error: updateError } = await supabase
            .from('quote_charges')
            .update({
              ...chargeData,
              quantity: charge.sell.quantity || 1,
              rate: charge.sell.rate || 0,
              amount: (charge.sell.quantity || 1) * (charge.sell.rate || 0)
            })
            .eq('id', charge.sell.dbChargeId);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('quote_charges')
            .insert({
              ...chargeData,
              charge_side_id: sellSideId,
              quantity: charge.sell?.quantity || 1,
              rate: charge.sell?.rate || 0,
              amount: (charge.sell?.quantity || 1) * (charge.sell?.rate || 0)
            });
          if (insertError) throw insertError;
        }
      }
      
      updateProgress(4); // Charges saved

      toast({ 
        title: 'Success', 
        description: 'Quotation saved successfully',
        duration: 3000
      });
      
      // Reload data to sync with database
      if (currentOptionId) {
        await loadOptionData();
      }
      
      // Clear deletion queue after successful save
      setChargesToDelete([]);
      
      // Clear validation feedback
      setValidationErrors([]);
      setValidationWarnings([]);
      
      updateProgress(5); // Complete
      
      // Keep success display for a moment
      setTimeout(() => {
        setSaveProgress({ show: false, steps: [] });
      }, 1000);
      
    } catch (error: any) {
      console.error('Save quotation error:', error);
      const errorMessage = error.message || 'Failed to save quotation';
      
      // Hide progress on error
      setSaveProgress({ show: false, steps: [] });
      
      toast({ 
        title: 'Save Failed', 
        description: errorMessage,
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    // Clear validation on navigation
    setValidationErrors([]);
    setValidationWarnings([]);
    
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    // Clear validation on navigation
    setValidationErrors([]);
    setValidationWarnings([]);
    
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        // Quote details - require at least currency
        return quoteData.currencyId;
      case 2:
        // Legs - require at least one valid leg
        return legs.length > 0 && legs.every(leg => 
          leg.mode && leg.origin && leg.destination
        );
      case 3:
        // Charges - at least one leg should have charges OR there should be combined charges
        return legs.some(leg => leg.charges.length > 0) || combinedCharges.length > 0;
      default:
        return true;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading quotation data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Validation Feedback */}
      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <ValidationFeedback errors={validationErrors} warnings={validationWarnings} />
      )}
      
      <Card>
        <CardContent className="pt-6">
          <QuotationWorkflowStepper
            currentStep={currentStep}
            onStepClick={setCurrentStep}
            steps={STEPS}
          />
        </CardContent>
      </Card>

      {currentStep === 1 && (
        <QuoteDetailsStep
          quoteData={quoteData}
          currencies={currencies}
          onChange={(field, value) => setQuoteData({ ...quoteData, [field]: value })}
        />
      )}

      {currentStep === 2 && (
        <LegsConfigurationStep
          legs={legs}
          serviceTypes={serviceTypes}
          onAddLeg={addLeg}
          onUpdateLeg={updateLeg}
          onRemoveLeg={confirmRemoveLeg}
        />
      )}

      {currentStep === 3 && (
        <ChargesManagementStep
          legs={legs}
          combinedCharges={combinedCharges}
          chargeCategories={chargeCategories}
          chargeBases={chargeBases}
          currencies={currencies}
          tradeDirections={tradeDirections}
          containerTypes={containerTypes}
          containerSizes={containerSizes}
          serviceTypes={serviceTypes}
          autoMargin={autoMargin}
          marginPercent={marginPercent}
          onAutoMarginChange={setAutoMargin}
          onMarginPercentChange={setMarginPercent}
          onAddCharge={addCharge}
          onUpdateCharge={updateCharge}
          onRemoveCharge={confirmRemoveCharge}
          onConfigureBasis={openBasisModal}
          onAddCombinedCharge={addCombinedCharge}
          onUpdateCombinedCharge={updateCombinedCharge}
          onRemoveCombinedCharge={confirmRemoveCombinedCharge}
          onConfigureCombinedBasis={openCombinedBasisModal}
        />
      )}

      {currentStep === 4 && (
        <ReviewAndSaveStep
          legs={legs}
          quoteData={quoteData}
          currencies={currencies}
          combinedCharges={combinedCharges}
        />
      )}

      {/* Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {currentStep < 4 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={saveQuotation} disabled={saving} size="lg">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Quotation
                <span className="ml-2 text-xs opacity-70">(Ctrl+S)</span>
              </Button>
            )}
          </div>
          
          {/* Keyboard shortcuts hint */}
          <p className="text-xs text-center text-muted-foreground mt-4">
            💡 Tip: Use <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl</kbd> + <kbd className="px-2 py-1 bg-muted rounded text-xs">←</kbd> / <kbd className="px-2 py-1 bg-muted rounded text-xs">→</kbd> to navigate, <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl</kbd> + <kbd className="px-2 py-1 bg-muted rounded text-xs">S</kbd> to save
          </p>
        </CardContent>
      </Card>

      {/* Basis Configuration Modal */}
      <BasisConfigModal
        open={basisModalOpen}
        onClose={() => setBasisModalOpen(false)}
        onSave={saveBasisConfig}
        config={currentBasisConfig}
        onChange={(updates) => setCurrentBasisConfig({ ...currentBasisConfig, ...updates })}
        tradeDirections={tradeDirections}
        containerTypes={containerTypes}
        containerSizes={containerSizes}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        onConfirm={() => {
          if (deleteDialog.type === 'leg' && deleteDialog.target) {
            removeLeg(deleteDialog.target);
          } else if (deleteDialog.type === 'charge' && deleteDialog.target) {
            removeCharge(deleteDialog.target.legId, deleteDialog.target.chargeIdx);
          } else if (deleteDialog.type === 'combinedCharge' && typeof deleteDialog.target === 'number') {
            removeCombinedCharge(deleteDialog.target);
          }
        }}
        title={
          deleteDialog.type === 'leg' 
            ? 'Delete Transport Leg' 
            : deleteDialog.type === 'charge'
            ? 'Delete Charge'
            : 'Delete Combined Charge'
        }
        description={
          deleteDialog.type === 'leg'
            ? 'This will remove the leg and all its associated charges. This action cannot be undone.'
          : 'This will remove this charge. This action cannot be undone.'
        }
      />
      
      {/* Save Progress Overlay */}
      <SaveProgress show={saveProgress.show} steps={saveProgress.steps} />
    </div>
  );
}