import { useCallback, useMemo, memo, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { TransportModeSelector } from './TransportModeSelector';
import { HelpTooltip } from './HelpTooltip';
import { useQuoteStore } from './store/QuoteStore';
import { useAppFeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';
import { Leg } from './store/types';
import { normalizeModeCode } from '@/lib/mode-utils';
import { LegCard } from './LegCard';

const EMPTY_ARRAY: any[] = [];


export const LegsConfigurationStep = memo(function LegsConfigurationStep() {
  const { state, dispatch } = useQuoteStore();
  const { legs, validationErrors, referenceData, options, optionId } = state;
  const { 
    serviceTypes = EMPTY_ARRAY, 
    carriers = EMPTY_ARRAY, 
    serviceLegCategories: serviceCategories = EMPTY_ARRAY, 
    ports = EMPTY_ARRAY 
  } = referenceData || {};
  const { enabled: multiLegAutoFillEnabled } = useAppFeatureFlag(FEATURE_FLAGS.COMPOSER_MULTI_LEG_AUTOFILL, false);

  // Refs for stable callbacks
  const legsRef = useRef(legs);
  const quoteDataRef = useRef(state.quoteData);

  useEffect(() => {
    legsRef.current = legs;
    quoteDataRef.current = state.quoteData;
  }, [legs, state.quoteData]);

  const activeOption = useMemo(() => Array.isArray(options)
    ? options.find((o: any) => o.id === optionId) || options[0]
    : undefined, [options, optionId]);

  const optionLegTemplates = useMemo(() => Array.isArray((activeOption as any)?.legs)
    ? [...(activeOption as any).legs].sort(
        (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      )
    : [], [activeOption]);

  const onAddLeg = useCallback((mode: string) => {
    const currentLegs = legsRef.current;
    const currentQuoteData = quoteDataRef.current;
    
    const legIndex = currentLegs.length;
    const templateLeg = optionLegTemplates[legIndex];

    const resolvedModeRaw = templateLeg?.mode || mode;
    const targetKey = normalizeModeCode(resolvedModeRaw);

    const defaultServiceType = serviceTypes.find(st => {
      if (!st) return false;
      const transportMode = (st as any).transport_modes;
      const codeKey = normalizeModeCode(transportMode?.code || (st as any).mode || '');
      if (!codeKey) return false;
      return codeKey === targetKey;
    });

    let serviceTypeId = defaultServiceType?.id || '';
    if (templateLeg?.service_type_id) {
      const fromTemplate = serviceTypes.find(
        st => st.id === templateLeg.service_type_id
      );
      if (fromTemplate) {
        serviceTypeId = fromTemplate.id;
      }
    }

    const carrierId =
      templateLeg?.carrier_id ||
      templateLeg?.provider_id ||
      (activeOption as any)?.carrier_id ||
      (activeOption as any)?.provider_id ||
      undefined;

    const carrierName =
      (carrierId
        ? carriers.find(c => c.id === carrierId)?.carrier_name
        : templateLeg?.carrier_name ||
          (templateLeg?.leg_type === 'transport'
            ? (activeOption as any)?.carrier_name
            : undefined)) || undefined;

    const serviceOnlyCategory =
      templateLeg?.service_only_category ||
      (templateLeg?.leg_type === 'service'
        ? (activeOption as any)?.service_only_category
        : undefined);

    const baseOrigin =
      currentLegs.length === 0
        ? currentQuoteData.origin
        : currentLegs[currentLegs.length - 1]?.destination || '';

    let baseDestination = '';
    if (currentLegs.length === 0) {
      baseDestination = currentQuoteData.destination;
    } else if (multiLegAutoFillEnabled) {
      baseDestination = currentQuoteData.destination || currentLegs[currentLegs.length - 1]?.destination || '';
    } else {
      baseDestination = '';
    }

    const newLeg: Leg = {
      id: crypto.randomUUID(),
      mode: resolvedModeRaw,
      serviceTypeId,
      origin: baseOrigin,
      destination: baseDestination,
      charges: [],
      legType: 'transport',
      carrierId,
      carrierName,
      serviceOnlyCategory
    };
    dispatch({ type: 'ADD_LEG', payload: newLeg });
  }, [optionLegTemplates, serviceTypes, activeOption, carriers, multiLegAutoFillEnabled, dispatch]);

  const onUpdateLeg = useCallback((id: string, updates: Partial<Leg>) => {
    dispatch({ type: 'UPDATE_LEG', payload: { id, updates } });
  }, [dispatch]);

  const onRemoveLeg = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_LEG', payload: id });
  }, [dispatch]);

  // Ensure legType is valid
  useEffect(() => {
    legs.forEach(leg => {
      if (leg.legType !== 'transport' && leg.legType !== 'service') {
        onUpdateLeg(leg.id, { legType: 'transport' });
      }
    });
  }, [legs, onUpdateLeg]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Configure Legs & Services
          <HelpTooltip content="Add transport legs (origin to destination) or service-only legs (warehousing, customs, packing, etc.) for your shipment." />
        </CardTitle>
        <CardDescription>Add transport legs or service-only providers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-base font-semibold mb-3 block">Add Transport Mode</Label>
          <TransportModeSelector selectedMode={null} onSelect={onAddLeg} />
        </div>

        {legs.length > 0 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">Your Legs ({legs.length})</Label>
            {legs.map((leg, index) => (
              <LegCard
                key={leg.id}
                leg={leg}
                index={index}
                onUpdateLeg={onUpdateLeg}
                onRemoveLeg={onRemoveLeg}
                validationErrors={validationErrors || []}
                serviceTypes={serviceTypes}
                serviceCategories={serviceCategories}
                ports={ports}
              />
            ))}
          </div>
        )}

        {legs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No legs added yet. Select a transport mode above to begin.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
