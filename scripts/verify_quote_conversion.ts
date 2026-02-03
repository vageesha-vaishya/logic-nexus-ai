
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verifyQuoteConversion() {
  console.log('Verifying Quote to Shipment Conversion...');

  // 1. Create Test Tenant
  // We'll use an existing tenant if possible, or create a dummy one
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  const tenantId = tenants?.[0]?.id;
  
  if (!tenantId) {
    console.error('No tenant found.');
    return;
  }
  
  console.log('Using Tenant:', tenantId);
  
  // 2. Create Test Quote
  const quoteId = crypto.randomUUID();
  const accountId = crypto.randomUUID(); // Need valid account? Usually yes due to FK.
  
  // Create Account first
  const { error: accError } = await supabase.from('accounts').insert({
    id: accountId,
    tenant_id: tenantId,
    name: 'Test Customer ' + Date.now(),
    account_type: 'customer'
  });
  
  let finalAccountId = accountId;

  if (accError) {
      console.log('Account creation failed (might exist):', accError.message);
      // Try to find one
      const { data: acc } = await supabase.from('accounts').select('id').eq('tenant_id', tenantId).limit(1).single();
      if (!acc) throw new Error('No account available');
      finalAccountId = acc.id;
      console.log('Using existing account:', finalAccountId);
  }

  // Insert Quote
  const { error: quoteError } = await supabase.from('quotes').insert({
    id: quoteId,
    tenant_id: tenantId,
    quote_number: 'Q-TEST-' + Date.now(),
    title: 'Test Conversion Quote',
    status: 'open',
    account_id: finalAccountId,
    incoterms: 'FOB',
    service_level: 'Standard',
    shipping_address: { country_code: 'US', city: 'New York' },
    billing_address: { country_code: 'US', city: 'New York' }
  });

  if (quoteError) throw new Error('Quote creation failed: ' + quoteError.message);
  console.log('Quote Created:', quoteId);

  // 3. Create Quote Version & Option
  const versionId = crypto.randomUUID();
  const { error: verError } = await supabase.from('quotation_versions').insert({
    id: versionId,
    tenant_id: tenantId,
    quote_id: quoteId,
    version_number: 1,
    is_active: true
  });
  if (verError) throw new Error('Version creation failed: ' + verError.message);

  const optionId = crypto.randomUUID();
  const { error: optError } = await supabase.from('quotation_version_options').insert({
    id: optionId,
    tenant_id: tenantId,
    quotation_version_id: versionId,
    recommended: true,
    sell_subtotal: 5000,
    buy_subtotal: 4000
  });
  if (optError) throw new Error('Option creation failed: ' + optError.message);

  // 4. Create Quote Items
  const { error: itemError } = await supabase.from('quote_items_core').insert({
    quote_id: quoteId,
    line_number: 1,
    product_name: 'Test Widget',
    quantity: 100,
    unit_price: 50,
    line_total: 5000
  });
  if (itemError) throw new Error('Item creation failed: ' + itemError.message);
  
  // Also populate extension for HS Code? (Currently no HS Code in quote_items, verify logic handles null)

  // 5. Call Convert RPC
  console.log('Calling convert_quote_to_shipment...');
  const { data: shipmentId, error: convError } = await supabase.rpc('convert_quote_to_shipment', {
    p_quote_id: quoteId,
    p_tenant_id: tenantId
  });

  if (convError) {
    console.error('Conversion Failed:', convError);
    return;
  }
  
  console.log('Conversion Success! Shipment ID:', shipmentId);

  // 6. Verify Shipment
  const { data: shipment } = await supabase.from('shipments').select('*, shipment_items(*)').eq('id', shipmentId).single();
  
  if (!shipment) {
      console.error('Shipment not found in DB');
      return;
  }
  
  console.log('Shipment Verified:', {
      number: shipment.shipment_number,
      quote_id: shipment.quote_id,
      total_charges: shipment.total_charges,
      items_count: shipment.shipment_items.length
  });

  if (shipment.shipment_items.length !== 1) {
      console.error('Expected 1 shipment item, found', shipment.shipment_items.length);
  } else {
      console.log('Shipment Item:', shipment.shipment_items[0].description, shipment.shipment_items[0].value);
  }

  console.log('Shipment Destination:', shipment.destination_address);

  // 7. Verify Invoice Creation (Pipeline Test)
  console.log('Testing create_invoice_from_shipment...');
  
  // Add HS Code to shipment item manually to test duty calculation
  const { error: updateError } = await supabase.from('shipment_items')
    .update({ hs_code: '8517.62.00' }) // Phone/Comm Gear (should trigger duty)
    .eq('shipment_id', shipmentId);
    
  if (updateError) console.error('Error updating HS Code:', updateError);

  const { data: invoiceId, error: invError } = await supabase.rpc('create_invoice_from_shipment', {
      p_shipment_id: shipmentId,
      p_tenant_id: tenantId
  });
  
  if (invError) {
      console.error('Invoice Creation Failed:', invError);
  } else {
      console.log('Invoice Created:', invoiceId);
      
      const { data: invoice } = await supabase.from('invoices').select('*, invoice_line_items(*)').eq('id', invoiceId).single();
      console.log('Invoice Details:', {
          number: invoice.invoice_number,
          total: invoice.total,
          lines_count: invoice.invoice_line_items.length
      });
      console.log('All Invoice Lines:', JSON.stringify(invoice.invoice_line_items, null, 2));
      
      // Check for Duty Line

    
      const dutyLine = invoice.invoice_line_items.find((i: any) => i.description.startsWith('Duty:'));
      if (dutyLine) {
          console.log('SUCCESS: Duty Line found:', dutyLine.description, dutyLine.amount);
      } else {
          console.log('WARNING: No Duty Line found (maybe HS code invalid or 0 rate)');
      }
  }

  // Cleanup
  console.log('Cleaning up...');
  await supabase.from('quotes').delete().eq('id', quoteId);
  // Cascades should handle the rest
}

verifyQuoteConversion().catch(console.error);
