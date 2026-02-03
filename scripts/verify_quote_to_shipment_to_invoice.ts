
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runTest() {
  console.log('Starting Pipeline Verification...');

  // 0. Get a valid Tenant
  const { data: tenant, error: tErr } = await supabase.from('tenants').select('id').limit(1).single();
  if (tErr || !tenant) {
      console.error('No tenant found:', tErr);
      return;
  }
  const tenantId = tenant.id;
  console.log('Using Tenant:', tenantId);

  // 0.1 Get a valid Account (Customer)
  const { data: account, error: aErr } = await supabase.from('accounts').select('id').eq('tenant_id', tenantId).limit(1).single();
  if (aErr || !account) {
      console.error('No account found:', aErr);
      // Create a dummy account if needed?
      // For now, let's just return
      return;
  }
  const accountId = account.id;
  console.log('Using Account:', accountId);

  // 1. Create a Test Quote
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      account_id: accountId,
      title: 'Test Quote Pipeline',
      status: 'draft',
      currency: 'USD',
      total_amount: 1000
    })
    .select()
    .single();

  if (qErr) {
      console.error('Failed to create quote:', qErr);
      // Try to find an existing tenant or use a real one if FK fails
      // Assuming tenant_id check is loose or we have a valid one.
      // If fails, we might need to query a valid tenant.
      return;
  }
  console.log('Quote created:', quote.id);

  // 2. Add Quote Items (Charges)
  const { error: qiErr } = await supabase.from('quote_items').insert({
    quote_id: quote.id,
    product_name: 'Ocean Freight',
    quantity: 1,
    unit_price: 1000,
    line_total: 1000,
    line_number: 1
  });
  if (qiErr) console.error('Failed to add quote items:', qiErr);

  // 3. Add Cargo Details (Physical Goods with HTS)
  const { error: cdErr } = await supabase.from('cargo_details').insert({
    tenant_id: quote.tenant_id,
    service_id: quote.id,
    service_type: 'quote',
    commodity_description: 'Test Widget',
    hs_code: '8517.13.0000', // Smartphones (usually duty free or specific)
    value_amount: 5000,
    value_currency: 'USD',
    package_count: 10,
    weight_kg: 100
  });
  if (cdErr) console.error('Failed to add cargo details:', cdErr);

  // 4. Convert to Shipment
  console.log('Converting to Shipment...');
  const { data: shipmentId, error: sErr } = await supabase.rpc('create_shipment_from_quote', {
    p_quote_id: quote.id,
    p_tenant_id: quote.tenant_id
  });

  if (sErr) {
      console.error('Conversion failed:', sErr);
      return;
  }
  console.log('Shipment created:', shipmentId);

  // 5. Verify Shipment Cargo Details
  const { data: sCargo } = await supabase
    .from('cargo_details')
    .select('*')
    .eq('service_id', shipmentId)
    .eq('service_type', 'shipment');
    
  console.log('Shipment Cargo Count:', sCargo?.length);
  if (sCargo && sCargo.length > 0) {
      console.log('Shipment Cargo HTS:', sCargo[0].hs_code);
  } else {
      console.error('Shipment has no cargo details!');
  }

  // 6. Convert to Invoice
  console.log('Converting to Invoice...');
  
  // Need to set origin/dest on shipment for duty calc?
  // The RPC checks origin/dest address.
  // My dummy quote didn't set addresses.
  // I should update shipment addresses manually to test duty.
  await supabase.from('shipments').update({
      origin_address: { country_code: 'CN' },
      destination_address: { country_code: 'US' }
  }).eq('id', shipmentId);

  const { data: invoiceId, error: iErr } = await supabase.rpc('create_invoice_from_shipment', {
    p_shipment_id: shipmentId,
    p_tenant_id: quote.tenant_id
  });

  if (iErr) {
      console.error('Invoice creation failed:', iErr);
      return;
  }
  console.log('Invoice created:', invoiceId);

  // 7. Verify Invoice Lines (Duty)
  const { data: lines } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId);
    
  console.log('Invoice Lines:', lines?.map(l => `${l.description}: ${l.unit_price}`));

  // Cleanup?
}

runTest();
