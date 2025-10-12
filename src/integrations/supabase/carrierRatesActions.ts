import { supabase as defaultClient } from '@/integrations/supabase/client';

type ChargeInput = {
  type: string;
  amount: number;
  currency?: string;
  note?: string;
  basis?: string;
  quantity?: number;
};

type CarrierQuoteInput = {
  carrier_id: string;
  mode?: string; // 'ocean' | 'air' | 'trucking' | 'courier' | 'moving' | 'railway_transport'
  buying_charges: ChargeInput[];
  selling_charges: ChargeInput[];
};

type CreateRateParams = {
  tenant_id: string;
  carrier_id: string;
  service_id?: string | null;
  origin_port_id?: string | null;
  destination_port_id?: string | null;
  mode?: string | null;
  currency?: string | null;
  base_rate?: number | null;
  rate_reference_id?: string | null; // e.g. quote id or number
};

const chargeTypeMap = (mode: string | undefined, type: string): string => {
  const t = String(type || '').toLowerCase();
  switch (t) {
    case 'freight':
      return mode === 'air' ? 'AFT' : 'OFT';
    case 'fuel':
      return 'BAF';
    case 'handling':
    case 'origin':
    case 'destination':
      return 'THC';
    case 'documentation':
    case 'other':
      return 'DOC';
    case 'customs':
      return 'ISF';
    default:
      return 'DOC';
  }
};

export async function createCarrierRate(params: CreateRateParams, client = defaultClient): Promise<string> {
  const payload: any = {
    tenant_id: params.tenant_id,
    carrier_id: params.carrier_id,
    service_id: params.service_id || null,
    origin_port_id: params.origin_port_id || null,
    destination_port_id: params.destination_port_id || null,
    currency: params.currency || 'USD',
    base_rate: params.base_rate ?? 0,
    rate_reference_id: params.rate_reference_id || null,
    status: 'active',
  };

  const { data, error } = (client as any)
    .from('carrier_rates')
    .insert([payload])
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function upsertChargesForRate(
  tenant_id: string,
  carrier_rate_id: string,
  mode: string | undefined,
  charges: ChargeInput[],
  client = defaultClient,
): Promise<void> {
  if (!charges || charges.length === 0) return;
  const rows = charges.map((c) => ({
    tenant_id,
    carrier_rate_id,
    charge_type: chargeTypeMap(mode, c.type),
    basis: c.basis || null,
    quantity: c.quantity ?? 1,
    amount: Number(c.amount || 0),
    currency: c.currency || 'USD',
    notes: c.note || null,
  }));
  const { error } = (client as any).from('carrier_rate_charges').insert(rows);
  if (error) throw error;
}

export async function createRatesAndChargesForQuote(
  quoteId: string,
  tenant_id: string,
  service_id: string | null,
  origin_port_id: string | null,
  destination_port_id: string | null,
  carrierQuotes: CarrierQuoteInput[],
  client = defaultClient,
): Promise<string[]> {
  const rateIds: string[] = [];
  for (const cq of carrierQuotes) {
    if (!cq.carrier_id) continue;
    const rateId = await createCarrierRate(
      {
        tenant_id,
        carrier_id: cq.carrier_id,
        service_id,
        origin_port_id,
        destination_port_id,
        mode: cq.mode || null,
        currency: 'USD',
        base_rate: 0,
        rate_reference_id: quoteId,
      },
      client,
    );
    await upsertChargesForRate(tenant_id, rateId, cq.mode, [...(cq.buying_charges || []), ...(cq.selling_charges || [])], client);
    rateIds.push(rateId);
  }
  return rateIds;
}

export async function createQuotationVersionWithOptions(
  tenant_id: string,
  quote_id: string,
  carrier_rate_ids: string[],
  opts: { major?: number; minor?: number; change_reason?: string; valid_until?: string; created_by?: string | null; version_number?: number; kind?: 'minor' | 'major' } = {},
  client = defaultClient,
): Promise<{ version_id: string; option_ids: string[] }> {
  // Allow creating versions without carrier rates (can be added later)
  const versionPayload: any = {
    tenant_id,
    quote_id,
    major: opts.major ?? 1,
    minor: opts.minor ?? 0,
    version_number: opts.version_number ?? 1,
    kind: opts.kind ?? 'minor',
    change_reason: opts.change_reason || null,
    valid_until: opts.valid_until || null,
    created_by: opts.created_by || null,
  };
  // Insert version and safely extract the returned id regardless of shape
  const { data: versionData, error: vErr } = await (client as any)
    .from('quotation_versions')
    .insert(versionPayload)
    .select('id');
  if (vErr) throw vErr;
  const version_id = Array.isArray(versionData)
    ? (versionData[0]?.id as string | undefined)
    : (versionData?.id as string | undefined);
  if (!version_id) throw new Error('Version insert did not return id');

  // Only create options if there are carrier rates to link
  let option_ids: string[] = [];
  if (carrier_rate_ids.length > 0) {
    const optionRows = carrier_rate_ids.map((rid) => ({
      tenant_id,
      quotation_version_id: version_id,
      carrier_rate_id: rid,
      recommended: false,
      status: 'active',
    }));
    const { data: optionsData, error: oErr } = await (client as any)
      .from('quotation_version_options')
      .insert(optionRows)
      .select('id');
    if (oErr) throw oErr;
    option_ids = Array.isArray(optionsData)
      ? (optionsData || []).map((x: any) => x.id as string)
      : optionsData?.id
        ? [optionsData.id as string]
        : [];
  }
  return { version_id, option_ids };
}

export async function recordCustomerSelection(
  tenant_id: string,
  quote_id: string,
  version_id: string,
  option_id: string,
  reason: string | null,
  user_id: string,
  client = defaultClient,
): Promise<void> {
  const { error } = (client as any).rpc('record_customer_selection', {
    p_tenant_id: tenant_id,
    p_quote_id: quote_id,
    p_version_id: version_id,
    p_option_id: option_id,
    p_reason: reason,
    p_user_id: user_id,
  });
  if (error) throw error;
}