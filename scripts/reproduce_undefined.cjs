const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || (!supabaseKey && !serviceRoleKey)) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Use service role key if available for direct DB access, otherwise anon key
const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

async function testLocationSearch(searchTerm) {
  console.log(`Testing search for: "${searchTerm}"`);

  // 1. RPC Call
  const { data: rpcData, error: rpcError } = await supabase.rpc('search_locations', {
    search_text: searchTerm,
    limit_count: 5
  });

  if (rpcError) {
    console.error('RPC Error:', rpcError);
  } else {
    console.log('RPC Data count:', rpcData?.length);
    if (rpcData && rpcData.length > 0) {
      console.log('First RPC result keys:', Object.keys(rpcData[0]));
      console.log('First RPC result:', JSON.stringify(rpcData[0], null, 2));
    }
  }

  // 2. Direct Query
  const { data: fallbackData, error: fbError } = await supabase
    .from('ports_locations')
    .select('id, location_name, location_code, location_type, country, city')
    .or(`location_name.ilike.%${searchTerm}%,location_code.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
    .limit(5);

  if (fbError) {
    console.error('Fallback Error:', fbError);
  } else {
    console.log('Fallback Data count:', fallbackData?.length);
    if (fallbackData && fallbackData.length > 0) {
      console.log('First Fallback result keys:', Object.keys(fallbackData[0]));
      console.log('First Fallback result:', JSON.stringify(fallbackData[0], null, 2));
    }
  }

  // 3. Simulate Normalization Logic (from LocationAutocomplete.tsx / LocationSelect.tsx)
  const combinedResults = [];
  const seenIds = new Set();

  const addLocation = (item) => {
    const id = item.id;
    const key = id || `${item.location_name || item.name}-${item.location_code || item.code}`;
    
    if (!seenIds.has(key)) {
      seenIds.add(key);
      
      const normalized = {
        id: item.id || key,
        location_name: item.location_name || item.name || 'Unknown Location',
        location_code: item.location_code || item.code || '',
        location_type: item.location_type || item.type || 'unknown',
        country: item.country || item.country_name || '',
        city: item.city || item.city_name || ''
      };
      combinedResults.push(normalized);
    }
  };

  if (rpcData) rpcData.forEach(addLocation);
  if (fallbackData) fallbackData.forEach(addLocation);

  console.log('Combined Results count:', combinedResults.length);

  // 4. Simulate Display Logic
  combinedResults.forEach((loc, index) => {
    console.log(`\n--- Item ${index + 1} ---`);
    
    // LocationAutocomplete display logic
    const autocompleteDisplay = loc.location_name || 'Unknown Location';
    const autocompleteType = (loc.location_type || 'unknown').replace('_', ' ');
    console.log(`[LocationAutocomplete] Name: "${autocompleteDisplay}"`);
    console.log(`[LocationAutocomplete] Type Badge: "${autocompleteType}"`);
    
    // LocationSelect display logic
    const selectLabel = `${loc.location_name} (${loc.location_code || 'N/A'}) - ${loc.city || ''}, ${loc.country || ''}`;
    console.log(`[LocationSelect] Label: "${selectLabel}"`);
    
    // Check for "undefined" string
    if (selectLabel.includes('undefined')) {
      console.error('!!! FOUND "undefined" IN OUTPUT !!!');
    }
    if (autocompleteDisplay === 'Undefined') {
      console.error('!!! FOUND "Undefined" NAME !!!');
    }
  });
}

(async () => {
  await testLocationSearch('Dehra Dun');
  await testLocationSearch('mum'); // For Mumbai
})();
