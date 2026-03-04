
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  
  let envFile = envPath;
  if (fs.existsSync(envLocalPath)) {
    // Read local env file
    const envConfig = require('dotenv').parse(fs.readFileSync(envLocalPath));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
    console.log(`Loaded .env.local`);
  } else if (fs.existsSync(envPath)) {
    const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
    console.log(`Loaded .env`);
  } else {
    console.error('No .env file found');
    process.exit(1);
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Starting verification of quote load and populate...');

  // 1. Get user context
  const { data: userData } = await supabase
    .from('user_roles')
    .select('user_id, tenant_id')
    .not('tenant_id', 'is', null)
    .limit(1)
    .single();

  if (!userData) {
    console.error('No valid user/tenant found');
    return;
  }
  
  const userId = userData.user_id;
  const tenantId = userData.tenant_id;
  console.log(`Context: User=${userId}, Tenant=${tenantId}`);

  // 2. Get dependencies
  const { data: currencies } = await supabase.from('currencies').select('id').limit(1);
  const currencyId = currencies[0].id;
  
  const { data: services } = await supabase.from('services').select('id').limit(1);
  const serviceId = services[0].id;

  const { data: serviceTypes } = await supabase.from('service_types').select('id').limit(1);
  const serviceTypeId = serviceTypes[0].id;

  // 3. Get Locations
  const { data: locations } = await supabase
    .from('ports_locations')
    .select('id, location_name, location_code')
    .limit(2);
    
  if (!locations || locations.length < 2) {
    console.error('Need at least 2 locations in ports_locations');
    return;
  }

  const origin = locations[0];
  const destination = locations[1];
  
  console.log(`Selected Origin: ${origin.location_name} (${origin.id})`);
  console.log(`Selected Destination: ${destination.location_name} (${destination.id})`);

  // 4. Create Quote Payload
  const payload = {
    title: 'Load Test Quote ' + Date.now(),
    transport_mode: 'ocean',
    origin_port_id: origin.id,
    destination_port_id: destination.id,
    // origin: origin.location_name, // Legacy text field removed
    // destination: destination.location_name, // Legacy text field removed
    status: 'draft',
    tenant_id: tenantId,
    currency_id: currencyId,
    service_id: serviceId,
    service_type_id: serviceTypeId,
    owner_id: userId,
    created_by: userId,
    valid_until: new Date(Date.now() + 86400000).toISOString()
  };

  // 5. Insert directly (simpler than RPC for this test, but RPC is also fine)
  // We use direct insert to ensure we control the exact columns
  const { data: insertedQuote, error: insertError } = await supabase
    .from('quotes')
    .insert(payload)
    .select()
    .single();

  if (insertError) {
    console.error('Insert failed:', insertError);
    return;
  }

  const quoteId = insertedQuote.id;
  console.log(`Quote inserted with ID: ${quoteId}`);

  // 6. Simulate Frontend Load Query
  console.log('Simulating frontend load query...');
  
  const { data: quoteRow, error: quoteError } = await supabase
    .from('quotes')
    .select('*, origin_location:origin_port_id(location_name, location_code), destination_location:destination_port_id(location_name, location_code)')
    .eq('id', quoteId)
    .single();

  if (quoteError) {
    console.error('Load query failed:', quoteError);
    return;
  }

  console.log('Load query result:', JSON.stringify(quoteRow, null, 2));

  // 7. Verify Data Mapping
  const raw = quoteRow;
  const mappedOrigin = raw.origin_location?.location_name || raw.origin || '';
  const mappedDestination = raw.destination_location?.location_name || raw.destination || '';
  const mappedOriginId = raw.origin_port_id || '';
  const mappedDestinationId = raw.destination_port_id || '';

  console.log('--- Verification ---');
  console.log(`Expected Origin Name: ${origin.location_name}`);
  console.log(`Mapped Origin Name:   ${mappedOrigin}`);
  console.log(`Expected Origin ID:   ${origin.id}`);
  console.log(`Mapped Origin ID:     ${mappedOriginId}`);

  let success = true;

  if (mappedOrigin !== origin.location_name) {
    console.error('FAIL: Origin name mismatch');
    success = false;
  }
  if (mappedOriginId !== origin.id) {
    console.error('FAIL: Origin ID mismatch');
    success = false;
  }
  if (mappedDestination !== destination.location_name) {
    console.error('FAIL: Destination name mismatch');
    success = false;
  }
  if (mappedDestinationId !== destination.id) {
    console.error('FAIL: Destination ID mismatch');
    success = false;
  }

  if (success) {
    console.log('SUCCESS: Quote data loaded and mapped correctly.');
  } else {
    console.error('FAILURE: Data mapping issues detected.');
  }
}

run().catch(console.error);
