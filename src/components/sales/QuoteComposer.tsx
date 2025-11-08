import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import ChargesTable from './ChargesTable';
import { supabase } from '@/integrations/supabase/client';

export default function QuoteComposer({ quoteId, versionId }: { quoteId: string; versionId: string }) {
  const [optionId, setOptionId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [containerTypeId, setContainerTypeId] = useState<string | null>(null);
  const [containerSizeId, setContainerSizeId] = useState<string | null>(null);
  const [currencyId, setCurrencyId] = useState<string | null>(null);

  const [charges, setCharges] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [containerTypes, setContainerTypes] = useState<any[]>([]);
  const [containerSizes, setContainerSizes] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from('carriers').select('id, carrier_name').order('carrier_name');
      setCarriers(c ?? []);
      const { data: st } = await supabase.from('service_types').select('id, name').order('name');
      setServiceTypes(st ?? []);
      const { data: sv } = await supabase.from('services').select('id, name').order('name');
      setServices(sv ?? []);
      const { data: ct } = await supabase.from('container_types').select('id, name').order('name');
      setContainerTypes(ct ?? []);
      const { data: cs } = await supabase.from('container_sizes').select('id, name').order('name');
      setContainerSizes(cs ?? []);
      const { data: cur } = await supabase.from('currencies').select('id, code').order('code');
      setCurrencies(cur ?? []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const tenantId = (userData?.user as any)?.user_metadata?.tenant_id ?? null;
      const { data, error } = await supabase
        .from('quote_options')
        .insert({
          tenant_id: tenantId,
          quote_version_id: versionId,
          provider_id: providerId,
          service_type_id: serviceTypeId,
          service_id: serviceId,
          container_type_id: containerTypeId,
          container_size_id: containerSizeId,
          currency_id: currencyId,
        })
        .select('id')
        .single();
      if (!error && data?.id) setOptionId(data.id);
    })();
  }, [versionId]);

  const saveCharges = async () => {
    if (!optionId) return;
    const { data: userData } = await supabase.auth.getUser();
    const tenantId = (userData?.user as any)?.user_metadata?.tenant_id ?? null;
    const payload = charges.map((c: any) => ({
      tenant_id: tenantId,
      quote_option_id: optionId,
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
    const { error } = await supabase.from('quote_charges').insert(payload);
    if (error) return;

    const buy = charges.filter((x: any) => x.side === 'buy').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
    const sell = charges.filter((x: any) => x.side === 'sell').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
    await supabase.from('quote_options').update({
      buy_subtotal: buy,
      sell_subtotal: sell,
      margin_amount: sell - buy,
      total_amount: sell,
    }).eq('id', optionId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compose Quotation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select value={providerId ?? ''} onValueChange={setProviderId}>
            <SelectTrigger><SelectValue placeholder="Service Provider" /></SelectTrigger>
            <SelectContent>
              {(carriers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.carrier_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={serviceTypeId ?? ''} onValueChange={setServiceTypeId}>
            <SelectTrigger><SelectValue placeholder="Service Type" /></SelectTrigger>
            <SelectContent>
              {(serviceTypes ?? []).map((st) => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={serviceId ?? ''} onValueChange={setServiceId}>
            <SelectTrigger><SelectValue placeholder="Service" /></SelectTrigger>
            <SelectContent>
              {(services ?? []).map((sv) => <SelectItem key={sv.id} value={sv.id}>{sv.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={containerTypeId ?? ''} onValueChange={setContainerTypeId}>
            <SelectTrigger><SelectValue placeholder="Container Type" /></SelectTrigger>
            <SelectContent>
              {(containerTypes ?? []).map((ct) => <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={containerSizeId ?? ''} onValueChange={setContainerSizeId}>
            <SelectTrigger><SelectValue placeholder="Container Size" /></SelectTrigger>
            <SelectContent>
              {(containerSizes ?? []).map((cs) => <SelectItem key={cs.id} value={cs.id}>{cs.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={currencyId ?? ''} onValueChange={setCurrencyId}>
            <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
            <SelectContent>
              {(currencies ?? []).map((cur) => <SelectItem key={cur.id} value={cur.id}>{cur.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <ChargesTable charges={charges} onChange={setCharges} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCharges([])}>Clear</Button>
          <Button onClick={saveCharges} disabled={!optionId}>Save Charges</Button>
        </div>
      </CardContent>
    </Card>
  );
}