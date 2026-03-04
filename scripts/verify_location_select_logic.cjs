
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  const localEnvPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or Key is missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyLocationSelectLogic(search) {
  console.log(`\nTesting LocationSelect logic for search: "${search}"`);
  
  try {
    // 1. Try RPC first
    console.log('1. Calling RPC...');
    const { data, error } = await supabase.rpc('search_locations', {
      search_text: search || '',
      limit_count: 20
    });

    let results = [];

    if (error) {
      console.warn('RPC error:', error.message);
    } else if (data && data.length > 0) {
      console.log(`RPC returned ${data.length} results.`);
      results = data;
    } else {
      console.log('RPC returned 0 results.');
    }

    // 2. Fallback to direct query
    if (results.length === 0 && search && search.length >= 2) {
       console.log('2. Trying fallback query...');
       const { data: fallbackData, error: fallbackError } = await supabase
          .from('ports_locations')
          .select('id, location_name, location_code, location_type, country, city')
          .or(`location_name.ilike.%${search}%,location_code.ilike.%${search}%,city.ilike.%${search}%`)
          .limit(20);
          
       if (!fallbackError && fallbackData) {
          console.log(`Fallback query returned ${fallbackData.length} results.`);
          results = fallbackData;
       } else if (fallbackError) {
          console.error('Fallback query error:', fallbackError.message);
       }
    }

    console.log(`Total results found: ${results.length}`);

    // Deduplicate and Normalize
    const uniqueNames = new Set();
    const uniqueResults = [];
    
    for (const item of results) {
      const locName = item.location_name || item.name || 'Unknown Location';
      const locCode = item.location_code || item.code || '';
      const locCity = item.city || item.city_name || '';
      const locCountry = item.country || item.country_name || '';
      const locType = item.location_type || item.type || 'unknown';
      
      if (!uniqueNames.has(locName)) {
        uniqueNames.add(locName);
        uniqueResults.push({
          ...item,
          location_name: locName,
          location_code: locCode,
          city: locCity,
          country: locCountry,
          location_type: locType
        });
      }
    }

    console.log(`Unique Normalized Results: ${uniqueResults.length}`);
    uniqueResults.forEach(r => {
        console.log(` - ${r.location_name} (${r.location_code})`);
    });

  } catch (e) {
    console.error('Exception:', e);
  }
}

// Test with "mum"
verifyLocationSelectLogic('mum');
