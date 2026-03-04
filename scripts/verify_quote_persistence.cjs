const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPersistence() {
  console.log('Starting persistence verification...');

  // 1. Get IDs for Locations
  const { data: locations, error: locError } = await supabase
    .from('ports_locations')
    .select('id, location_name')
    .in('location_name', ['Delhi (ICD)', 'Nhava Sheva']);

  if (locError) {
    console.error('Error fetching locations:', locError);
    return;
  }

  const origin = locations.find(l => l.location_name === 'Delhi (ICD)');
  const destination = locations.find(l => l.location_name === 'Nhava Sheva');

  if (!origin || !destination) {
    console.error('Seed data missing. Found:', locations);
    return;
  }

  console.log('Origin ID:', origin.id);
  console.log('Destination ID:', destination.id);

  // 2. Get Dependencies (Tenant, Service, etc.)
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  const tenantId = tenants?.[0]?.id || '00000000-0000-0000-0000-000000000000';

  const { data: services } = await supabase.from('services').select('id').limit(1);
  const { data: serviceTypes } = await supabase.from('service_types').select('id').limit(1);
  const { data: currencies } = await supabase.from('currencies').select('id').limit(1);

  // 3. Construct Payload
  const payload = {
    quote: {
      title: 'Persistence Test Quote ' + new Date().toISOString(),
      transport_mode: 'ocean',
      origin: 'Delhi (ICD)',
      destination: 'Nhava Sheva',
      origin_port_id: origin.id,
      destination_port_id: destination.id,
      status: 'draft',
      tenant_id: tenantId,
      service_id: services?.[0]?.id,
      service_type_id: serviceTypes?.[0]?.id,
      currency_id: currencies?.[0]?.id,
      // Add other required fields if necessary
      created_by: '00000000-0000-0000-0000-000000000000', // Mock user
      owner_id: '00000000-0000-0000-0000-000000000000'
    },
    items: [],
    cargo_configurations: [],
    options: []
  };

  console.log('Payload prepared. Calling save_quote_atomic...');

  // 4. Call RPC
  const { data: quoteId, error: rpcError } = await supabase.rpc('save_quote_atomic', { p_payload: payload });

  if (rpcError) {
    console.error('RPC Error:', rpcError);
    return;
  }

  console.log('Quote saved successfully with ID:', quoteId);

  // 5. Verify Persistence
  const { data: quote, error: fetchError } = await supabase
    .from('quotes')
    .select('id, origin_port_id, destination_port_id, origin_location:origin_port_id(location_name), destination_location:destination_port_id(location_name)')
    .eq('id', quoteId)
    .single();

  if (fetchError) {
    console.error('Error fetching saved quote:', fetchError);
    return;
  }

  console.log('Saved Quote Data:', JSON.stringify(quote, null, 2));

  let success = true;
  if (quote.origin_port_id !== origin.id) {
    console.error(`FAILURE: Origin ID mismatch. Expected ${origin.id}, got ${quote.origin_port_id}`);
    success = false;
  }
  if (quote.destination_port_id !== destination.id) {
    console.error(`FAILURE: Destination ID mismatch. Expected ${destination.id}, got ${quote.destination_port_id}`);
    success = false;
  }

  if (success) {
    console.log('✅ SUCCESS: Origin and Destination Port IDs persisted correctly.');
    
    // Cleanup
    console.log('Cleaning up...');
    await supabase.from('quotes').delete().eq('id', quoteId);
  } else {
    console.log('❌ FAILURE: Persistence check failed.');
  }
}

verifyPersistence();
