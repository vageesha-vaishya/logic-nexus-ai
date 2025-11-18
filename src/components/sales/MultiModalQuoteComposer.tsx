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

interface Leg {
  id: string;
  mode: string;
  serviceTypeId: string;
  origin: string;
  destination: string;
  charges: any[];
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

  useEffect(() => {
    loadInitialData();
  }, []);

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
      setTenantId(userTenantId);

      const [st, cc, cb, cu, td, ct, cs] = await Promise.all([
        supabase.from('service_types').select('*').eq('is_active', true),
        supabase.from('charge_categories').select('*').eq('is_active', true),
        supabase.from('charge_bases').select('*').eq('is_active', true),
        supabase.from('currencies').select('*').eq('is_active', true),
        supabase.from('trade_directions').select('*').eq('is_active', true),
        supabase.from('container_types').select('*').eq('is_active', true),
        supabase.from('container_sizes').select('*').eq('is_active', true),
      ]);

      setServiceTypes(st.data || []);
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

  const loadOptionData = async () => {
    if (!optionId || !tenantId) return;
    
    setLoading(true);
    try {
      // Load legs with charges in a single optimized query
      const { data: legData, error: legError } = await supabase
        .from('quote_legs' as any)
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
        .eq('quote_option_id', optionId)
        .order('leg_number');

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

  const addLeg = (mode: string) => {
    const lowerMode = mode.toLowerCase();
    const defaultServiceType =
      serviceTypes.find((st) => st.code?.toLowerCase().startsWith(lowerMode)) ||
      serviceTypes[0];

    const newLeg: Leg = {
      id: `leg-${Date.now()}`,
      mode,
      serviceTypeId: defaultServiceType?.id || '',
      origin: '',
      destination: '',
      charges: []
    };
    setLegs([...legs, newLeg]);
  };

  const updateLeg = (legId: string, updates: Partial<Leg>) => {
    setLegs(legs.map(leg => leg.id === legId ? { ...leg, ...updates } : leg));
  };

  const removeLeg = (legId: string) => {
    setLegs(legs.filter(leg => leg.id !== legId));
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
              buy: { quantity: 1, rate: 0 },
              sell: { quantity: 1, rate: 0 },
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
          const buyAmount = (charge.buy?.quantity || 1) * (charge.buy?.rate || 0);
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

  const removeCharge = (legId: string, chargeIdx: number) => {
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        return {
          ...leg,
          charges: leg.charges.filter((_, idx) => idx !== chargeIdx)
        };
      }
      return leg;
    }));
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
        buy: { quantity: 1, rate: 0 },
        sell: { quantity: 1, rate: 0 },
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

  const removeCombinedCharge = (chargeIdx: number) => {
    setCombinedCharges(prev => prev.filter((_, idx) => idx !== chargeIdx));
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

  const saveQuotation = async () => {
    setSaving(true);
    try {
      if (!tenantId) {
        throw new Error('Tenant ID not found');
      }

      // Create option if needed
      let currentOptionId = optionId;
      if (!currentOptionId) {
        const { data: newOption, error: optError } = await supabase
          .from('quotation_version_options')
          .insert({
            quotation_version_id: versionId,
            tenant_id: tenantId
          })
          .select()
          .single();
        
        if (optError) throw optError;
        currentOptionId = newOption.id;
        setOptionId(currentOptionId);
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

      // Remove deleted legs and their charges
      const { data: existingLegs } = await supabase
        .from('quote_legs' as any)
        .select('id')
        .eq('quote_option_id', currentOptionId);
      const stateLegIds = new Set(
        (legs || [])
          .filter(l => !String(l.id).startsWith('leg-'))
          .map(l => String(l.id))
      );
      const toDeleteLegIds = (existingLegs || [])
        .map((l: any) => String(l.id))
        .filter((id: string) => !stateLegIds.has(id));
      if (toDeleteLegIds.length) {
        await supabase
          .from('quote_charges' as any)
          .delete()
          .in('leg_id', toDeleteLegIds)
          .eq('quote_option_id', currentOptionId);
        await supabase
          .from('quote_legs' as any)
          .delete()
          .in('id', toDeleteLegIds);
      }

      // Save legs and charges
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        let legId = leg.id;
        
        if (leg.id.startsWith('leg-')) {
          // New leg
          const { data: newLeg, error: legError } = await supabase
            .from('quote_legs' as any)
            .insert({
              quote_option_id: currentOptionId,
              mode: leg.mode,
              service_type_id: leg.serviceTypeId || null,
              origin_location: leg.origin,
              destination_location: leg.destination,
              tenant_id: tenantId,
              leg_number: i + 1
            })
            .select()
            .single();
          
          if (legError) throw legError;
          if (!newLeg) throw new Error('Failed to create leg');
          legId = (newLeg as any).id;
        } else {
          // Update existing leg
          const { error: updateError } = await supabase
            .from('quote_legs' as any)
            .update({
              mode: leg.mode,
              service_type_id: leg.serviceTypeId || null,
              origin_location: leg.origin,
              destination_location: leg.destination,
              leg_number: i + 1
            })
            .eq('id', legId);
          
          if (updateError) throw updateError;
        }

        // Replace charges for this leg
        await supabase
          .from('quote_charges' as any)
          .delete()
          .eq('quote_option_id', currentOptionId)
          .eq('leg_id', legId);

        const newCharges: any[] = [];
        for (const charge of leg.charges) {
          // Prepare buy side
          newCharges.push({
            quote_option_id: currentOptionId,
            leg_id: legId,
            charge_side_id: buySideId,
            category_id: charge.category_id || null,
            basis_id: charge.basis_id || null,
            quantity: charge.buy?.quantity || 1,
            rate: charge.buy?.rate || 0,
            amount: (charge.buy?.quantity || 1) * (charge.buy?.rate || 0),
            currency_id: charge.currency_id || null,
            unit: charge.unit || null,
            note: charge.note || null,
            tenant_id: tenantId
          });

          // Prepare sell side
          newCharges.push({
            quote_option_id: currentOptionId,
            leg_id: legId,
            charge_side_id: sellSideId,
            category_id: charge.category_id || null,
            basis_id: charge.basis_id || null,
            quantity: charge.sell?.quantity || 1,
            rate: charge.sell?.rate || 0,
            amount: (charge.sell?.quantity || 1) * (charge.sell?.rate || 0),
            currency_id: charge.currency_id || null,
            unit: charge.unit || null,
            note: charge.note || null,
            tenant_id: tenantId
          });
        }

        if (newCharges.length > 0) {
          const { error: chargeError } = await supabase
            .from('quote_charges' as any)
            .insert(newCharges);
          if (chargeError) throw chargeError;
        }
      }

      // Persist combined charges (leg_id IS NULL)
      await supabase
        .from('quote_charges' as any)
        .delete()
        .eq('quote_option_id', currentOptionId)
        .is('leg_id', null);

      const combinedPayload = (combinedCharges || []).flatMap((charge: any) => [
        {
          quote_option_id: currentOptionId,
          leg_id: null,
          charge_side_id: buySideId,
          category_id: charge.category_id || null,
          basis_id: charge.basis_id || null,
          quantity: charge.buy?.quantity || 1,
          rate: charge.buy?.rate || 0,
          amount: (charge.buy?.quantity || 1) * (charge.buy?.rate || 0),
          currency_id: charge.currency_id || null,
          unit: charge.unit || null,
          note: charge.note || null,
          tenant_id: tenantId
        },
        {
          quote_option_id: currentOptionId,
          leg_id: null,
          charge_side_id: sellSideId,
          category_id: charge.category_id || null,
          basis_id: charge.basis_id || null,
          quantity: charge.sell?.quantity || 1,
          rate: charge.sell?.rate || 0,
          amount: (charge.sell?.quantity || 1) * (charge.sell?.rate || 0),
          currency_id: charge.currency_id || null,
          unit: charge.unit || null,
          note: charge.note || null,
          tenant_id: tenantId
        }
      ]);
      if (combinedPayload.length) {
        const { error: combErr } = await supabase
          .from('quote_charges' as any)
          .insert(combinedPayload);
        if (combErr) throw combErr;
      }

      toast({ title: 'Success', description: 'Quotation saved successfully' });
      
      // Reload data
      if (currentOptionId) {
        await loadOptionData();
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return quoteData.currencyId;
      case 2:
        return legs.length > 0 && legs.every(leg => leg.origin && leg.destination);
      case 3:
        return legs.every(leg => leg.charges.length > 0);
      default:
        return true;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
          onRemoveLeg={removeLeg}
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
          onRemoveCharge={removeCharge}
          onConfigureBasis={openBasisModal}
          onAddCombinedCharge={addCombinedCharge}
          onUpdateCombinedCharge={updateCombinedCharge}
          onRemoveCombinedCharge={removeCombinedCharge}
          onConfigureCombinedBasis={openCombinedBasisModal}
        />
      )}

      {currentStep === 4 && (
        <ReviewAndSaveStep
          legs={legs}
          quoteData={quoteData}
          currencies={currencies}
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
              <Button onClick={saveQuotation} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Quotation
              </Button>
            )}
          </div>
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
    </div>
  );
}