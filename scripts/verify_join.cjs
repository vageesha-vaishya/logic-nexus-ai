const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

console.log('Script started');

// Load environment variables
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
  console.log('Loading .env.local');
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log('Loading .env');
  dotenv.config({ path: envPath });
} else {
  console.warn('No .env file found');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyJoin() {
  console.log('Verifying Join...');

  try {
    // 1. Get a quote that has origin_port_id
    const { data: quotes, error: quoteError } = await supabase
        .from('quotes')
        .select('id, origin_port_id')
        .not('origin_port_id', 'is', null)
        .limit(1);

    if (quoteError) {
        console.error('Error fetching quote:', quoteError);
        return;
    }

    if (!quotes || quotes.length === 0) {
        console.log('No quotes with origin_port_id found.');
        return;
    }

    const quoteId = quotes[0].id;
    console.log(`Testing with Quote ID: ${quoteId}, Origin Port ID: ${quotes[0].origin_port_id}`);

    // 2. Perform the join query exactly as in UnifiedQuoteComposer
    const { data, error } = await supabase
        .from('quotes')
        .select('id, origin_port_id, origin_location:origin_port_id(location_name, location_code)')
        .eq('id', quoteId)
        .single();

    if (error) {
        console.error('Join query failed:', error);
    } else {
        console.log('Join query successful!');
        console.log('Data:', JSON.stringify(data, null, 2));
        
        if (data.origin_location) {
            console.log('Origin Location populated correctly via join.');
        } else {
            console.log('Origin Location is NULL despite origin_port_id being present.');
        }
    }
  } catch (err) {
      console.error('Unexpected error:', err);
  }
}

verifyJoin().then(() => console.log('Done')).catch(err => console.error('Main error:', err));
