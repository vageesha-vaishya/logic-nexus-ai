const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAutocompleteLogic(search) {
  console.log(`Testing search for: "${search}"`);
  
  try {
    // 1. RPC Call
    const rpcPromise = supabase.rpc('search_locations', { 
      search_text: search, 
      limit_count: 10 
    });

    // 2. Direct Query (Fallback)
    // Note: LocationAutocomplete uses scopedDb.from('ports_locations', true)
    // which effectively does this:
    const fallbackPromise = supabase
      .from('ports_locations')
      .select('id, location_name, location_code, location_type, country, city')
      .or(`location_name.ilike.%${search}%,location_code.ilike.%${search}%,city.ilike.%${search}%`)
      .limit(10);

    const [rpcResponse, fallbackResponse] = await Promise.all([rpcPromise, fallbackPromise]);

    const { data: rpcData, error: rpcError } = rpcResponse;
    const { data: fallbackData, error: fbError } = fallbackResponse;

    if (rpcError) console.error('RPC Error:', rpcError);
    if (fbError) console.error('Fallback Error:', fbError);

    console.log('RPC Data count:', rpcData?.length || 0);
    console.log('Fallback Data count:', fallbackData?.length || 0);

    // 3. Deduplication Logic (mimicking LocationAutocomplete)
    const combinedResults = [];
    const seenIds = new Set();

    const addLocation = (item) => {
      const id = item.id;
      const key = id || `${item.location_name || item.name}-${item.location_code || item.code}`;
      
      if (!seenIds.has(key)) {
        seenIds.add(key);
        // Mapping logic
        combinedResults.push({
          id: item.id || key,
          location_name: item.location_name || item.name || 'Unknown Location',
          location_code: item.location_code || item.code || '',
          location_type: item.location_type || item.type || 'unknown',
          country: item.country || item.country_name || '',
          city: item.city || item.city_name || ''
        });
      }
    };

    if (rpcData && Array.isArray(rpcData)) rpcData.forEach(addLocation);
    if (fallbackData && Array.isArray(fallbackData)) fallbackData.forEach(addLocation);

    console.log('Combined Results count:', combinedResults.length);
    console.log('Results:', JSON.stringify(combinedResults, null, 2));

  } catch (error) {
    console.error('Exception:', error);
  }
}

testAutocompleteLogic('mum');
