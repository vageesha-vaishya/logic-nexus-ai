console.log('Starting check_port_ids script...');
import { createClient } from '@supabase/supabase-js';

// Credentials should be loaded from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPortIds() {
  const TENANT_ID = '33816694-814b-4265-a65e-263624c87895'; // From previous context

  console.log('Fetching latest quote...');
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, origin_port_id, destination_port_id, service_id, service_type_id')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (quoteError) {
    console.error('Error fetching quote:', quoteError);
    return;
  }

  console.log('Quote:', quote);

  if (quote.origin_port_id) {
    const { data: origin, error: originError } = await supabase
      .from('ports_locations')
      .select('id, location_name')
      .eq('id', quote.origin_port_id)
      .maybeSingle();
    
    if (originError) console.error('Error fetching origin port:', originError);
    console.log(`Origin Port (${quote.origin_port_id}):`, origin ? `Found: ${origin.location_name}` : 'NOT FOUND');
  } else {
    console.log('Origin Port ID is null');
  }

  if (quote.destination_port_id) {
    const { data: dest, error: destError } = await supabase
      .from('ports_locations')
      .select('id, location_name')
      .eq('id', quote.destination_port_id)
      .maybeSingle();

    if (destError) console.error('Error fetching destination port:', destError);
    console.log(`Destination Port (${quote.destination_port_id}):`, dest ? `Found: ${dest.location_name}` : 'NOT FOUND');
  } else {
    console.log('Destination Port ID is null');
  }
}

checkPortIds();
