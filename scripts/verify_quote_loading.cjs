const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Try to load from .env.local first, then .env
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuoteLoading() {
  console.log('1. Preparing test data...');
  
  // 1. Get valid location IDs
  const { data: locations, error: locError } = await supabase
    .from('ports_locations')
    .select('id, location_name')
    .limit(2);

  if (locError || !locations || locations.length < 2) {
    console.error('Failed to get locations:', locError);
    return;
  }
  
  // Get a valid tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();
    
  if (tenantError || !tenant) {
     console.error('Failed to get tenant:', tenantError);
     return;
  }
  const tenantId = tenant.id;

  const origin = locations[0];
  const destination = locations[1];
  console.log(`Using Origin: ${origin.location_name} (${origin.id})`);
  console.log(`Using Destination: ${destination.location_name} (${destination.id})`);

  // Fetch valid service, service_type, currency, user
  const { data: service } = await supabase.from('services').select('id').limit(1).single();
  const { data: serviceType } = await supabase.from('service_types').select('id').limit(1).single();
  const { data: currency } = await supabase.from('currencies').select('id').limit(1).single();
  const { data: user } = await supabase.from('users').select('id').limit(1).single(); // Helper query for valid user

  if (!service || !currency) {
    console.error('Missing required seed data (service or currency)');
    return;
  }

  // 2. Create quote via direct insert
  const quoteId = crypto.randomUUID();
  const quoteData = {
      id: quoteId,
      quote_number: `TEST-${Date.now()}`,
      title: 'Test Quote Loading',
      transport_mode: 'ocean',
      origin_port_id: origin.id,
      destination_port_id: destination.id,
      status: 'draft',
      tenant_id: tenantId,
      currency_id: currency.id,
      service_id: service.id,
      service_type_id: serviceType?.id || null,
      created_by: user?.id || 'e303254e-986c-449e-9988-34857b28292f' // Fallback to hardcoded if fetch fails
  };

  const { data: savedQuote, error: saveError } = await supabase
    .from('quotes')
    .insert(quoteData)
    .select()
    .single();

  if (saveError) {
    console.error('Save failed:', saveError);
    return;
  }
  const savedId = savedQuote.id;
  console.log('Quote saved with ID:', savedId);

  // 3. Fetch quote using UnifiedQuoteComposer query syntax
  // Note: UnifiedQuoteComposer uses:
  // .select('*, origin_port_data:origin_port_id(location_name, location_code), destination_port_data:destination_port_id(location_name, location_code)')
  
  console.log('2. Fetching quote with alias syntax...');
  const { data: fetchedQuote, error: fetchError } = await supabase
    .from('quotes')
    .select('*, origin_port_data:origin_port_id(location_name, location_code), destination_port_data:destination_port_id(location_name, location_code)')
    .eq('id', savedId)
    .single();

  if (fetchError) {
    console.error('Fetch failed:', fetchError);
  } else {
    console.log('Fetch successful!');
    console.log('Origin Data:', fetchedQuote.origin_port_data);
    console.log('Destination Data:', fetchedQuote.destination_port_data);
    
    if (fetchedQuote.origin_port_data?.location_name === origin.location_name) {
        console.log('SUCCESS: Origin location name matches!');
    } else {
        console.error('FAILURE: Origin location name mismatch', fetchedQuote.origin_port_data);
    }
  }
  
  // Cleanup
  console.log('Cleaning up...');
  await supabase.from('quotes').delete().eq('id', savedId);
}

testQuoteLoading();
