
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Starting Invoice Duty Flow Verification...');

  // 1. Get Tenant ID (pick first one)
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1);

  if (tenantError || !tenants || tenants.length === 0) {
    console.error('No tenants found or error:', tenantError);
    process.exit(1);
  }
  const tenantId = tenants[0].id;
  console.log('Using Tenant ID:', tenantId);

  // 2. Find HTS Code ID
  const htsCodeStr = '0207.14.00.45';
  const { data: htsCodes, error: htsError } = await supabase
    .from('aes_hts_codes')
    .select('id')
    .eq('hts_code', htsCodeStr)
    .limit(1);

  if (htsError || !htsCodes || htsCodes.length === 0) {
    console.error(`HTS Code ${htsCodeStr} not found. Run seed first?`);
    process.exit(1);
  }
  const htsId = htsCodes[0].id;
  console.log(`Found HTS ID for ${htsCodeStr}:`, htsId);

  // 2.5 Find an Account (Customer)
  const { data: accounts, error: accError } = await supabase
    .from('accounts')
    .select('id')
    .limit(1);

  if (accError || !accounts || accounts.length === 0) {
    console.error('No accounts found. Run seed first?');
    process.exit(1);
  }
  const accountId = accounts[0].id;
  console.log('Using Account ID:', accountId);

  // 3. Create Test Shipment
  const { data: shipment, error: shipError } = await supabase
    .from('shipments')
    .insert({
      tenant_id: tenantId,
      account_id: accountId, // Linked customer
      shipment_number: `TEST-DUTY-${Date.now()}`,
      status: 'draft',
      shipment_type: 'ocean_freight',
      origin_address: { country: 'US', country_code: 'US', city: 'New York' },
      destination_address: { country: 'DE', country_code: 'DE', city: 'Berlin' }
    })
    .select('id')
    .single();

  if (shipError) {
    console.error('Error creating shipment:', shipError);
    process.exit(1);
  }
  console.log('Created Shipment:', shipment.id);

  // 4. Add Cargo Details
  const { error: cargoError } = await supabase
    .from('cargo_details')
    .insert({
      tenant_id: tenantId,
      service_type: 'shipment',
      service_id: shipment.id,
      cargo_type_id: null, // Optional if allowed nullable, or find a type
      aes_hts_id: htsId,
      package_count: 10,
      value_amount: 5000, // $5000 value
      value_currency: 'USD',
      commodity_description: 'Test Commodity',
      is_active: true
    });
  
  // Note: cargo_type_id might be required constraint. Let's check if it fails.
  if (cargoError) {
    if (cargoError.message.includes('cargo_type_id')) {
        // Find a cargo type
        const { data: cTypes } = await supabase.from('cargo_types').select('id').limit(1);
        if (cTypes && cTypes.length > 0) {
            const { error: retryError } = await supabase.from('cargo_details').insert({
                tenant_id: tenantId,
                service_type: 'shipment',
                service_id: shipment.id,
                cargo_type_id: cTypes[0].id,
                aes_hts_id: htsId,
                package_count: 10,
                value_amount: 5000,
                value_currency: 'USD',
                commodity_description: 'Test Commodity',
                is_active: true
            });
            if (retryError) {
                console.error('Error creating cargo (retry):', retryError);
                process.exit(1);
            }
        } else {
             console.error('Error creating cargo:', cargoError);
             process.exit(1);
        }
    } else {
        console.error('Error creating cargo:', cargoError);
        process.exit(1);
    }
  }
  console.log('Added Cargo Details.');

  // 5. Call create_invoice_from_shipment RPC
  console.log('Calling create_invoice_from_shipment...');
  const { data: invoiceId, error: rpcError } = await supabase
    .rpc('create_invoice_from_shipment', {
      p_shipment_id: shipment.id,
      p_tenant_id: tenantId
    });

  if (rpcError) {
    console.error('RPC Error:', rpcError);
    process.exit(1);
  }
  console.log('Invoice Created:', invoiceId);

  // 6. Verify Invoice Line Items
  const { data: lineItems, error: linesError } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId);

  if (linesError) {
    console.error('Error fetching line items:', linesError);
    process.exit(1);
  }

  console.log('Line Items:', JSON.stringify(lineItems, null, 2));

  const dutyItem = lineItems.find(item => item.description.includes('Duties'));
  if (dutyItem) {
    console.log('SUCCESS: Found Duty Line Item!');
    console.log('Duty Amount:', dutyItem.unit_price);
  } else {
    console.error('FAILURE: No Duty Line Item found.');
  }
}

run();
