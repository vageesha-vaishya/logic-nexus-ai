
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

// Fallback to loading from .env.local if .env doesn't exist or is missing keys
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Loading .env.local fallback...');
    require('dotenv').config({ path: '.env.local' });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env or .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBrokenReferences() {
  console.log('Checking for quotes with broken origin/destination references...');

  // 1. Fetch quotes with non-null origin_port_id or destination_port_id
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select(`
      id, 
      quote_number, 
      origin_port_id, 
      destination_port_id, 
      origin_location:origin_port_id(id, location_name),
      destination_location:destination_port_id(id, location_name)
    `)
    .not('origin_port_id', 'is', null)
    .limit(50);

  if (error) {
    console.error('Error fetching quotes:', error);
    return;
  }

  let brokenCount = 0;
  quotes.forEach(q => {
    const hasOriginId = !!q.origin_port_id;
    const hasDestId = !!q.destination_port_id;
    
    // Check if join returned data
    const originFound = !!q.origin_location;
    const destFound = !!q.destination_location;

    if (hasOriginId && !originFound) {
      console.log(`[BROKEN ORIGIN] Quote ${q.quote_number} (${q.id}) has origin_port_id ${q.origin_port_id} but join failed.`);
      brokenCount++;
    }
    
    if (hasDestId && !destFound) {
      console.log(`[BROKEN DEST] Quote ${q.quote_number} (${q.id}) has destination_port_id ${q.destination_port_id} but join failed.`);
      brokenCount++;
    }
  });

  if (brokenCount === 0) {
    console.log('No broken references found in the sampled quotes.');
  } else {
    console.log(`Found ${brokenCount} broken references.`);
  }
}

checkBrokenReferences();
