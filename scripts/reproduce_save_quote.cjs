
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  
  let envFile = envPath;
  if (fs.existsSync(envLocalPath)) {
    envFile = envLocalPath;
    console.log(`Loading .env from ${envLocalPath}`);
  } else if (fs.existsSync(envPath)) {
    console.log(`Loading .env from ${envPath}`);
  } else {
    console.error('No .env file found');
    process.exit(1);
  }

  const envConfig = require('dotenv').parse(fs.readFileSync(envFile));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
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

function sanitizePayload(payload) {
  const seen = new WeakSet();
  const sanitize = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return undefined;
    seen.add(obj);
    if (Array.isArray(obj)) return obj.map(sanitize).filter(v => v !== undefined);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const sv = sanitize(v);
      if (sv !== undefined) out[k] = sv;
    }
    return out;
  };
  return sanitize(payload);
}

async function reproduceSaveQuote() {
  console.log('Starting reproduction of save_quote_atomic...');

  // 1. Get a valid user and tenant from user_roles
  const { data: userData, error: userError } = await supabase
    .from('user_roles')
    .select('user_id, tenant_id')
    .not('tenant_id', 'is', null)
    .limit(1)
    .single();

  if (userError || !userData) {
    console.error('Failed to fetch user from user_roles:', userError);
    return;
  }
  
  const userId = userData.user_id;
  const tenantId = userData.tenant_id;
  console.log(`Using User ID: ${userId}, Tenant ID: ${tenantId}`);

  // 2. Get valid IDs for foreign keys
  const { data: currency } = await supabase.from('currencies').select('id').eq('code', 'USD').single();
  const { data: service } = await supabase.from('services').select('id').eq('code', 'OCEAN').single(); // Assuming OCEAN code exists
  const { data: serviceType } = await supabase.from('service_types').select('id').eq('code', 'EXP').single(); // Assuming EXP code exists
  
  // Fallback if specific codes don't exist
  const currencyId = currency?.id || (await supabase.from('currencies').select('id').limit(1).single()).data.id;
  const serviceId = service?.id || (await supabase.from('services').select('id').limit(1).single()).data.id;
  const serviceTypeId = serviceType?.id || (await supabase.from('service_types').select('id').limit(1).single()).data.id;

  // 3. Get valid origin and destination locations
  const { data: locations, error: locError } = await supabase
    .from('ports_locations')
    .select('id, location_name')
    .limit(2);

  if (locError || !locations || locations.length < 2) {
    console.error('Failed to fetch locations:', locError);
    return;
  }

  const originId = locations[0].id;
  const destinationId = locations[1].id;
  const originName = locations[0].location_name;
  const destinationName = locations[1].location_name;
  
  console.log(`Using Origin: ${originName} (${originId})`);
  console.log(`Using Destination: ${destinationName} (${destinationId})`);

  // 4. Construct payload mimicking UnifiedQuoteComposer
  const payload = {
    quote: {
      quote_number: `TEST-${Date.now()}`,
      title: 'Reproduction Test Quote',
      transport_mode: 'ocean',
      origin: originName,
      destination: destinationName,
      origin_port_id: originId,
      destination_port_id: destinationId,
      status: 'draft',
      tenant_id: tenantId,
      currency_id: currencyId,
      service_id: serviceId,
      service_type_id: serviceTypeId,
      cargo_details: {
        commodity: 'Test Commodity',
        total_weight_kg: 1000,
        total_volume_cbm: 10
      },
      created_by: userId,
      owner_id: userId
    },
    items: [],
    cargo_configurations: [],
    options: [
      {
        option_name: 'Manual Option 1',
        is_selected: true,
        source: 'unified_composer',
        source_attribution: 'manual',
        margin_percent: 15,
        currency: 'USD',
        transit_time_days: 30,
        legs: [],
        combined_charges: [],
        rank_score: 100
      }
    ]
  };

  console.log('Payload constructed. Calling save_quote_atomic...');

  // 5. Call save_quote_atomic
  const { data: savedId, error: rpcError } = await supabase.rpc('save_quote_atomic', {
    p_payload: sanitizePayload(payload)
  });

  if (rpcError) {
    console.error('RPC Error:', rpcError);
    return;
  }

  console.log(`Quote saved with ID: ${savedId}`);

  // 6. Verify persistence
  const { data: savedQuote, error: verifyError } = await supabase
    .from('quotes')
    .select('id, origin_port_id, destination_port_id')
    .eq('id', savedId)
    .single();

  if (verifyError) {
    console.error('Verification Error:', verifyError);
    return;
  }

  console.log('Saved Quote Data:', savedQuote);

  if (savedQuote.origin_port_id === originId && savedQuote.destination_port_id === destinationId) {
    console.log('SUCCESS: Origin and Destination Port IDs persisted correctly.');
  } else {
    console.error('FAILURE: Port IDs mismatch or missing.');
    console.log(`Expected Origin ID: ${originId}, Got: ${savedQuote.origin_port_id}`);
    console.log(`Expected Destination ID: ${destinationId}, Got: ${savedQuote.destination_port_id}`);
  }
}

reproduceSaveQuote().catch(console.error);
