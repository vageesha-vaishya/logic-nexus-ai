import { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import ChargesTable from './ChargesTable';
import { supabase } from '@/integrations/supabase/client';

export default function QuoteComposer({ quoteId, versionId, autoScroll }: { quoteId: string; versionId: string; autoScroll?: boolean }) {
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null); // leg-level
  const [serviceId, setServiceId] = useState<string | null>(null); // leg-level
  const [containerTypeId, setContainerTypeId] = useState<string | null>(null); // leg-level
  const [containerSizeId, setContainerSizeId] = useState<string | null>(null); // leg-level
  const [currencyId, setCurrencyId] = useState<string | null>(null); // quote currency
  const [validUntil, setValidUntil] = useState<string>('');
  const [importExport, setImportExport] = useState<string>('');
  const [originLocation, setOriginLocation] = useState<string>('');
  const [destinationLocation, setDestinationLocation] = useState<string>('');
  const [autoMarginEnabled, setAutoMarginEnabled] = useState<boolean>(false);
  const [marginMethod, setMarginMethod] = useState<'fixed'|'percent'|'none'>('none');
  const [marginValue, setMarginValue] = useState<number>(0);
  const [minMargin, setMinMargin] = useState<number>(0);
  const [roundingRule, setRoundingRule] = useState<string>('');

  const [charges, setCharges] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [containerTypes, setContainerTypes] = useState<any[]>([]);
  const [containerSizes, setContainerSizes] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  // Legs management
  const [legs, setLegs] = useState<any[]>([]);
  const [currentLegId, setCurrentLegId] = useState<string | null>(null);
  const [chargesByLeg, setChargesByLeg] = useState<Record<string, any[]>>({});

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from('carriers').select('id, carrier_name').order('carrier_name');
      setCarriers(c ?? []);
      const { data: st } = await supabase.from('service_types').select('id, name').order('name');
      setServiceTypes(st ?? []);
      const { data: sv } = await supabase.from('services').select('id, name').order('name');
      setServices(sv ?? []);
      const { data: ct } = await (supabase as any).from('container_types').select('id, name').order('name');
      setContainerTypes(ct ?? []);
      const { data: cs } = await (supabase as any).from('container_sizes').select('id, name').order('name');
      setContainerSizes(cs ?? []);
      const { data: cur } = await supabase.from('currencies').select('id, code').order('code');
      setCurrencies(cur ?? []);
      // Load margin methods for later if needed (optional)
      // const { data: mm } = await (supabase as any).from('margin_methods').select('id, name, code');
    })();
  }, []);

  useEffect(() => {
    if (autoScroll !== false) {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [autoScroll]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const tenantId = (userData?.user as any)?.user_metadata?.tenant_id ?? null;
      const { data, error } = await (supabase as any)
        .from('quote_options')
        .insert({
          tenant_id: tenantId,
          quote_version_id: versionId,
          currency_id: currencyId,
        })
        .select('id')
        .single();
      if (!error && data?.id) setOptionId(data.id);
      // Initialize first leg
      if (!error && data?.id) {
        const { data: leg } = await (supabase as any)
          .from('quote_option_legs')
          .insert({ tenant_id: tenantId, quote_option_id: data.id, leg_order: 1 })
          .select('id')
          .single();
        if (leg?.id) {
          setLegs([{ id: leg.id, leg_order: 1 }]);
          setCurrentLegId(leg.id);
          setChargesByLeg({ [leg.id]: [] });
        }
      }
    })();
  }, [versionId]);

  // Helper to patch option when user changes fields
  const patchOption = async (patch: Record<string, any>) => {
    if (!optionId) return;
    await (supabase as any)
      .from('quote_options')
      .update(patch)
      .eq('id', optionId);
  };

  // Persist core option fields on change
  useEffect(() => {
    (async () => {
      if (!optionId) return;
      const patch: any = {
        quote_currency_id: currencyId,
      };
      await patchOption(patch);
    })();
  }, [optionId, currencyId]);

  // Persist current leg details on change
  useEffect(() => {
    (async () => {
      if (!currentLegId) return;
      // Map import/export to leg trade_direction
      let tradeDirectionId: string | null = null;
      if (importExport) {
        const { data: userData } = await supabase.auth.getUser();
        const tenantId = (userData?.user as any)?.user_metadata?.tenant_id ?? null;
        const { data: dir } = await (supabase as any)
          .from('trade_directions')
          .select('id, code')
          .eq('tenant_id', tenantId)
          .eq('code', importExport)
          .limit(1);
        tradeDirectionId = Array.isArray(dir) && dir.length ? dir[0].id : null;
      }
      await (supabase as any)
        .from('quote_option_legs')
        .update({
          service_id: serviceId,
          provider_id: providerId,
          origin_location: originLocation,
          destination_location: destinationLocation,
          service_type_id: serviceTypeId,
          container_type_id: containerTypeId,
          container_size_id: containerSizeId,
          trade_direction_id: tradeDirectionId,
        })
        .eq('id', currentLegId);
    })();
  }, [currentLegId, serviceTypeId, serviceId, providerId, importExport, containerTypeId, containerSizeId, originLocation, destinationLocation]);

  const saveCharges = async () => {
    if (!optionId || !currentLegId) return;
    const { data: userData } = await supabase.auth.getUser();
    const tenantId = (userData?.user as any)?.user_metadata?.tenant_id ?? null;
    const legCharges = chargesByLeg[currentLegId] ?? [];
    const payload = legCharges.map((c: any) => ({
      tenant_id: tenantId,
      quote_option_id: optionId,
      leg_id: currentLegId,
      charge_side_id: c.charge_side_id,
      category_id: c.category_id,
      basis_id: c.basis_id,
      quantity: c.quantity ?? 1,
      unit: c.unit ?? null,
      rate: c.rate ?? 0,
      amount: c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1),
      currency_id: c.currency_id ?? currencyId,
      note: c.note ?? null,
      sort_order: c.sort_order ?? 1000,
    }));
    const { error } = await (supabase as any).from('quote_charges').insert(payload);
    if (error) return;

    const all = Object.values(chargesByLeg).flat();
    const buy = all.filter((x: any) => x.side === 'buy').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
    let sell = all.filter((x: any) => x.side === 'sell').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
    if (autoMarginEnabled) {
      if (marginMethod === 'percent') {
        sell = buy * (1 + (marginValue / 100));
      } else if (marginMethod === 'fixed') {
        sell = buy + marginValue;
      }
      const marginAmt = sell - buy;
      if (minMargin && marginAmt < minMargin) {
        sell = buy + minMargin;
      }
      if (roundingRule?.startsWith('nearest_')) {
        const step = Number(roundingRule.replace('nearest_', '')) || 1;
        sell = Math.round(sell / step) * step;
      }
    }
    await (supabase as any).from('quote_options').update({
      buy_subtotal: buy,
      sell_subtotal: sell,
      margin_amount: sell - buy,
      total_amount: sell,
      auto_margin_enabled: autoMarginEnabled,
      margin_value: marginValue,
      rounding_rule: roundingRule,
      min_margin: minMargin,
    }).eq('id', optionId);
  };

  const hydrateCharges = async () => {
    if (!providerId || !serviceId || !currentLegId) return;
    // Capture context for carrier rates: valid until, service type & id, direction, origin/destination, carrier
    await captureCarrierRates({
      providerId,
      serviceTypeId,
      serviceId,
      validUntil,
      importExport,
      originLocation,
      destinationLocation,
    });

    const { data: sides } = await supabase.from('charge_sides').select('id, code');
    const buySide = (sides ?? []).find((s: any) => s.code === 'buy');
    const buySideId = buySide?.id;
    const { data: rateCharges } = await (supabase as any)
      .from('carrier_rate_charges')
      .select('*')
      .eq('carrier_id', providerId)
      .eq('service_id', serviceId);
    const mapped = (rateCharges ?? []).map((rc: any) => ({
      side: 'buy' as const,
      charge_side_id: buySideId,
      category_id: rc.category_id ?? null,
      basis_id: rc.basis_id ?? null,
      quantity: rc.quantity ?? 1,
      unit: rc.unit ?? null,
      rate: rc.rate ?? 0,
      amount: rc.amount ?? ((rc.rate ?? 0) * (rc.quantity ?? 1)),
      currency_id: rc.currency_id ?? currencyId,
      note: rc.note ?? null,
      sort_order: rc.sort_order ?? 1000,
    }));
    setChargesByLeg(prev => ({ ...prev, [currentLegId]: [ ...(prev[currentLegId] ?? []), ...mapped ] }));
  };

  const captureCarrierRates = async (ctx: {
    providerId: string | null;
    serviceTypeId: string | null;
    serviceId: string | null;
    validUntil: string;
    importExport: string;
    originLocation: string;
    destinationLocation: string;
  }) => {
    // Central place to handle carrier rates capture; currently acts as a no-op
    // for storage and serves as a single choke point to extend later.
    // If your schema supports persisting this context (e.g., carrier_rates table),
    // we can upsert here using (supabase as any).from('carrier_rates').insert({...}).
    // For now, we just validate presence and return.
    if (!ctx.providerId || !ctx.serviceId) return;
    return;
  };

  return (
    <Card ref={composerRef}>
      <CardHeader>
        <CardTitle>Compose Quotation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1-7: Leg builder and quote currency in required order */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Select value={serviceTypeId ?? ''} onValueChange={setServiceTypeId}>
              <SelectTrigger><SelectValue placeholder="1) Service Type (Leg)" /></SelectTrigger>
              <SelectContent>
                {(serviceTypes ?? []).map((st) => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={serviceId ?? ''} onValueChange={setServiceId} disabled={!serviceTypeId}>
              <SelectTrigger><SelectValue placeholder="2) Service (Leg)" /></SelectTrigger>
              <SelectContent>
                {(services ?? []).map((sv) => <SelectItem key={sv.id} value={sv.id}>{sv.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={providerId ?? ''} onValueChange={setProviderId} disabled={!serviceId}>
              <SelectTrigger><SelectValue placeholder="3) Service Provider (Leg)" /></SelectTrigger>
              <SelectContent>
                {(carriers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.carrier_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={importExport} onValueChange={setImportExport} disabled={!providerId}>
              <SelectTrigger><SelectValue placeholder="4) Trade Direction (Leg)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="import">Import</SelectItem>
                <SelectItem value="export">Export</SelectItem>
                <SelectItem value="inland">Inland</SelectItem>
              </SelectContent>
            </Select>
            <Select value={containerTypeId ?? ''} onValueChange={setContainerTypeId} disabled={!importExport}>
              <SelectTrigger><SelectValue placeholder="5) Container Type (Leg)" /></SelectTrigger>
              <SelectContent>
                {(containerTypes ?? []).map((ct) => <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={containerSizeId ?? ''} onValueChange={setContainerSizeId} disabled={!containerTypeId}>
              <SelectTrigger><SelectValue placeholder="5) Container Size (Leg)" /></SelectTrigger>
              <SelectContent>
                {(containerSizes ?? []).map((cs) => <SelectItem key={cs.id} value={cs.id}>{cs.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={originLocation} onChange={e => setOriginLocation(e.target.value)} placeholder="6) Origin Port/Location" disabled={!containerSizeId} />
            <Input value={destinationLocation} onChange={e => setDestinationLocation(e.target.value)} placeholder="6) Destination Port/Location" disabled={!containerSizeId} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} placeholder="Valid Until" />
            <Select value={currencyId ?? ''} onValueChange={setCurrencyId}>
              <SelectTrigger><SelectValue placeholder="7) Quote Currency" /></SelectTrigger>
              <SelectContent>
                {(currencies ?? []).map((cur) => <SelectItem key={cur.id} value={cur.id}>{cur.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Margin Controls */}
        <div className="grid grid-cols-2 gap-4">
          <Select value={autoMarginEnabled ? 'on' : 'off'} onValueChange={(v) => setAutoMarginEnabled(v === 'on')}>
            <SelectTrigger><SelectValue placeholder="Auto Margin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Auto Margin Off</SelectItem>
              <SelectItem value="on">Auto Margin On</SelectItem>
            </SelectContent>
          </Select>
          <Select value={marginMethod} onValueChange={(v) => setMarginMethod(v as any)}>
            <SelectTrigger><SelectValue placeholder="Margin Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="fixed">Fixed Amount</SelectItem>
              <SelectItem value="percent">Percent of Buy</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-3 gap-2 col-span-2">
            <Input type="number" value={marginValue} onChange={e => setMarginValue(Number(e.target.value))} placeholder="Margin Value" />
            <Input type="number" value={minMargin} onChange={e => setMinMargin(Number(e.target.value))} placeholder="Min Margin" />
            <Input value={roundingRule} onChange={e => setRoundingRule(e.target.value)} placeholder="Rounding (e.g., nearest_10)" />
          </div>
        </div>

        {/* Legs management */}
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <Select value={currentLegId ?? ''} onValueChange={setCurrentLegId}>
              <SelectTrigger><SelectValue placeholder="Select Leg" /></SelectTrigger>
              <SelectContent>
                {legs.map((l) => <SelectItem key={l.id} value={l.id}>Leg {l.leg_order}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={async () => {
                const { data: userData } = await supabase.auth.getUser();
                const tenantId = (userData?.user as any)?.user_metadata?.tenant_id ?? null;
                const nextOrder = (legs[legs.length - 1]?.leg_order ?? 0) + 1;
                const { data: leg } = await (supabase as any)
                  .from('quote_option_legs')
                  .insert({ tenant_id: tenantId, quote_option_id: optionId, leg_order: nextOrder })
                  .select('id, leg_order')
                  .single();
                if (leg?.id) {
                  setLegs([...legs, { id: leg.id, leg_order: leg.leg_order }]);
                  setCurrentLegId(leg.id);
                  setChargesByLeg(prev => ({ ...prev, [leg.id]: [] }));
                }
              }}
            >Add Leg</Button>
          </div>
          {currentLegId && (
            <div className="grid grid-cols-2 gap-2">
              <Select value={serviceId ?? ''} onValueChange={setServiceId}>
                <SelectTrigger><SelectValue placeholder="Leg Service" /></SelectTrigger>
                <SelectContent>
                  {(services ?? []).map((sv) => <SelectItem key={sv.id} value={sv.id}>{sv.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={providerId ?? ''} onValueChange={setProviderId}>
                <SelectTrigger><SelectValue placeholder="Leg Provider" /></SelectTrigger>
                <SelectContent>
                  {(carriers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.carrier_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={originLocation} onChange={e => setOriginLocation(e.target.value)} placeholder="Leg Origin" />
              <Input value={destinationLocation} onChange={e => setDestinationLocation(e.target.value)} placeholder="Leg Destination" />
            </div>
          )}
        </div>

        {/* Step 9: Charges table */}
        <ChargesTable charges={currentLegId ? (chargesByLeg[currentLegId] ?? []) : []} defaultCurrencyId={currencyId} onChange={(rows) => {
          if (!currentLegId) return;
          setChargesByLeg(prev => ({ ...prev, [currentLegId]: rows }));
        }} />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={hydrateCharges} disabled={!providerId || !serviceId || !currentLegId || !containerSizeId || !currencyId || !originLocation || !destinationLocation}>Hydrate Buy Charges (Leg)</Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!currentLegId) return;
              setChargesByLeg(prev => ({ ...prev, [currentLegId]: [] }));
            }}
          >Clear</Button>
          <Button onClick={saveCharges} disabled={!optionId || !currentLegId}>Save Charges</Button>
        </div>
      </CardContent>
    </Card>
  );
}