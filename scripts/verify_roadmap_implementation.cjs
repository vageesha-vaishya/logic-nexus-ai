const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyRoadmapImplementation() {
  console.log('Starting Enterprise Quotation Roadmap Verification...');
  let allPassed = true;

  // 1. Verify cargo_simulations table
  console.log('\n1. Checking cargo_simulations table...');
  const { data: simData, error: simError } = await supabase
    .from('cargo_simulations')
    .select('*')
    .limit(1);

  if (simError && simError.code !== 'PGRST116') { // PGRST116 is no rows, which is fine
    console.error('❌ cargo_simulations table access failed:', simError.message);
    allPassed = false;
  } else {
    console.log('✅ cargo_simulations table exists and is accessible.');
  }

  // 2. Verify margin_rules table
  console.log('\n2. Checking margin_rules table...');
  const { data: marginData, error: marginError } = await supabase
    .from('margin_rules')
    .select('*')
    .limit(1);

  if (marginError) {
    console.error('❌ margin_rules table access failed:', marginError.message);
    allPassed = false;
  } else {
    console.log('✅ margin_rules table exists and is accessible.');
  }

  // 3. Verify search_hts_codes_smart RPC
  console.log('\n3. Checking search_hts_codes_smart RPC...');
  // We'll try to call it with a common search term
  const { data: htsData, error: htsError } = await supabase
    .rpc('search_hts_codes_smart', {
      p_search_term: 'plastic',
      p_limit: 5
    });

  if (htsError) {
    console.error('❌ search_hts_codes_smart RPC failed:', htsError.message);
    // It might fail if the function doesn't exist or if parameters are wrong
    allPassed = false;
  } else {
    console.log(`✅ search_hts_codes_smart RPC works (returned ${htsData ? htsData.length : 0} results).`);
  }

  // 4. Verify shipents vessel columns (just to be double sure)
  console.log('\n4. Checking shipments vessel columns...');
  const { data: shipmentData, error: shipmentError } = await supabase
    .from('shipments')
    .select('vessel_name, voyage_number, port_of_loading')
    .limit(1);
    
  if (shipmentError) {
     console.error('❌ shipments vessel columns check failed:', shipmentError.message);
     allPassed = false;
  } else {
     console.log('✅ shipments vessel columns exist.');
  }

  console.log('\n----------------------------------------');
  if (allPassed) {
    console.log('✅ All Roadmap Database Artifacts Verified.');
  } else {
    console.error('❌ Some verification checks failed.');
    process.exit(1);
  }
}

verifyRoadmapImplementation().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
