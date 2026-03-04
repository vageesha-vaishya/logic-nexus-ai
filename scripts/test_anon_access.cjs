const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAnonAccess(search) {
  console.log(`Testing ANON search for: "${search}"`);
  
  try {
    const { data, error } = await supabase.rpc('search_locations', { 
      search_text: search, 
      limit_count: 10 
    });

    if (error) {
      console.error('RPC Error:', error);
    } else {
      console.log('RPC Data count:', data?.length || 0);
    }
  } catch (error) {
    console.error('Exception:', error);
  }
}

testAnonAccess('mum');
