const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env or .env.local
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  
  let envVars = {};
  
  if (fs.existsSync(envLocalPath)) {
    const envConfig = require('dotenv').parse(fs.readFileSync(envLocalPath));
    envVars = { ...envVars, ...envConfig };
  }
  
  if (fs.existsSync(envPath)) {
    const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
    envVars = { ...envVars, ...envConfig };
  }
  
  return envVars;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLoadQuote() {
  console.log('--- Testing Quote Loading with Joins ---');

  // 1. Get a valid location ID
  const { data: location, error: locError } = await supabase
    .from('ports_locations')
    .select('id, location_name')
    .limit(1)
    .single();

  if (locError) {
    console.error('Error fetching location:', locError);
    return;
  }
  console.log('Using location:', location);

  // 2. Get a valid user/tenant
  const { data: userRole, error: userError } = await supabase
    .from('user_roles')
    .select('user_id, tenant_id')
    .not('tenant_id', 'is', null)
    .limit(1)
    .single();

  if (userError) {
    console.error('Error fetching user:', userError);
    return;
  }
  console.log('Using user/tenant:', userRole);

  // 3. Create a test quote
  const quoteData = {
    quote_number: `TEST-LOAD-${Date.now()}`,
    title: `Test Quote ${Date.now()}`,
    tenant_id: userRole.tenant_id,
    owner_id: userRole.user_id,
    created_by: userRole.user_id,
    status: 'draft',
    origin_port_id: location.id, // Set the ID
    destination_port_id: location.id
  };

  const { data: quote, error: createError } = await supabase
    .from('quotes')
    .insert(quoteData)
    .select()
    .single();

  if (createError) {
    console.error('Error creating quote:', createError);
    return;
  }
  console.log('Created quote:', quote.id);

  // 4. Simulate the exact query from UnifiedQuoteComposer
  console.log('Executing join query...');
  const { data: loadedQuote, error: loadError } = await supabase
    .from('quotes')
    .select('*, origin_location:origin_port_id(location_name, location_code), destination_location:destination_port_id(location_name, location_code)')
    .eq('id', quote.id)
    .maybeSingle();

  if (loadError) {
    console.error('Error loading quote:', loadError);
  } else {
    console.log('Loaded Quote Structure:');
    console.log('origin_port_id:', loadedQuote.origin_port_id);
    console.log('origin_location:', loadedQuote.origin_location);
    console.log('destination_location:', loadedQuote.destination_location);
    
    if (loadedQuote.origin_location && loadedQuote.origin_location.location_name === location.location_name) {
        console.log('SUCCESS: Origin location joined correctly.');
    } else {
        console.error('FAILURE: Origin location NOT joined or name mismatch.');
    }
  }

  // Cleanup
  await supabase.from('quotes').delete().eq('id', quote.id);
}

testLoadQuote();
