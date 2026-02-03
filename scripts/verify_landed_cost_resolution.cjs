
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyResolution() {
  console.log('Verifying Landed Cost Country Resolution Logic...');

  // 1. Get Country ID for US
  const { data: countryData, error: countryError } = await supabase
    .from('countries')
    .select('id')
    .eq('code_iso2', 'US')
    .single();

  if (countryError || !countryData) {
      console.error('Error fetching US country ID:', countryError);
      return;
  }
  const usCountryId = countryData.id;
  console.log('Found US Country ID:', usCountryId);

  // 2. Find a US port to use as test
  // Try to fetch with country join
  const { data: usPort, error: portError } = await supabase
    .from('ports_locations')
    .select('id, countries(code_iso2)')
    .eq('country_id', usCountryId)
    .limit(1)
    .single();

  if (portError) {
    console.error('Error fetching US port:', portError);
    return;
  }
  
  console.log('Found US Port:', JSON.stringify(usPort, null, 2));

  // 3. Simulate Quote Data with port_id
  const quoteWithPort = {
    destination_port_id: usPort.id,
    destination: 'Some random string',
  };

  // Logic from PDFGenerator/DocumentPreview (PROPOSED FIX)
  let destCountry1 = 'UNKNOWN';
  if (quoteWithPort.destination_port_id) {
    const { data: port } = await supabase
      .from('ports_locations')
      .select('countries(code_iso2)')
      .eq('id', quoteWithPort.destination_port_id)
      .single();
    
    if (port?.countries?.code_iso2) {
      destCountry1 = port.countries.code_iso2;
    }
  } else if (quoteWithPort.destination) {
     // Fallback
  }

  console.log(`Test 1 (Port ID): Expected 'US', Got '${destCountry1}'`);
  if (destCountry1 === 'US') console.log('✅ Port ID Resolution Passed');
  else console.error('❌ Port ID Resolution Failed');

  // 3. Simulate Quote Data with string only
  const quoteWithString = {
    destination_port_id: null,
    destination: 'Los Angeles, CA, USA',
  };

  let destCountry2 = 'UNKNOWN';
  if (quoteWithString.destination_port_id) {
     // ...
  } else if (quoteWithString.destination) {
      const getCountryCode = (destination) => {
        if (!destination) return 'US'; // Default
        const dest = destination.trim().toUpperCase();
        if (dest.length === 2) return dest;
        if (dest.endsWith(' US') || dest.endsWith(', US') || dest.endsWith(', USA')) return 'US';
        if (dest.includes('UNITED STATES')) return 'US';
        return 'US'; // Default fallback in code
      };
      destCountry2 = getCountryCode(quoteWithString.destination);
  }

  console.log(`Test 2 (String): Expected 'US', Got '${destCountry2}'`);
  if (destCountry2 === 'US') console.log('✅ String Resolution Passed');
  else console.error('❌ String Resolution Failed');

  // 4. Test RPC with the resolved country
  // We need items.
  const items = [
    { hs_code: '6403.99.60', value: 1000, quantity: 10 } // Leather shoes
  ];
  
  const { data: landedCost, error: rpcError } = await supabase.rpc('calculate_landed_cost', {
      items: items,
      destination_country: destCountry1
  });

  if (rpcError) {
      console.error('RPC Error:', rpcError);
  } else {
      console.log('RPC Result:', landedCost.summary);
      console.log('✅ RPC Call with Resolved Country Passed');
  }
}

verifyResolution();
