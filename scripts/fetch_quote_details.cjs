
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fetchQuoteData(quoteNumber) {
  console.log(`Fetching data for quote: ${quoteNumber}`);
  
  // 1. Get Quote ID
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, quote_number, tenant_id')
    .eq('quote_number', quoteNumber)
    .single();

  if (quoteError) {
    console.error('Error fetching quote:', quoteError.message);
    return;
  }
  
  console.log(`Quote ID: ${quote.id}`);

  // 2. Get Latest Version
  const { data: version, error: versionError } = await supabase
    .from('quotation_versions')
    .select('id')
    .eq('quote_id', quote.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (versionError) {
    console.error('Error fetching version:', versionError.message);
    return;
  }

  console.log(`Version ID: ${version.id}`);

  // 3. Get Options
  const { data: options, error: optionsError } = await supabase
    .from('quotation_version_options')
    .select('*')
    .eq('quotation_version_id', version.id);

  if (optionsError) {
    console.error('Error fetching options:', optionsError.message);
    return;
  }

  console.log(`Found ${options.length} options.`);

  // 4. Get Legs for each option
  for (const opt of options) {
    console.log(`\n--- Option: ${opt.id} ---`);
    const { data: legs, error: legsError } = await supabase
      .from('quotation_version_option_legs')
      .select('*, origin:origin_location_id(location_name), destination:destination_location_id(location_name)')
      .eq('quotation_version_option_id', opt.id);
      // .order('sequence_id', { ascending: true }); // Removed sorting by sequence_id

    if (legsError) {
      console.error('Error fetching legs:', legsError.message);
    } else {
      if (legs.length > 0) {
        console.log('Leg keys:', Object.keys(legs[0]).join(', '));
      }
      legs.forEach((l, idx) => {
        const mode = l.mode || l.transport_mode;
        const origin = l.origin?.location_name || l.origin_location_id;
        const dest = l.destination?.location_name || l.destination_location_id;
        console.log(`Leg ${idx + 1}: ${mode} | Carrier: ${l.carrier_name} | ${origin} -> ${dest}`);
      });
    }
  }
}

fetchQuoteData('QUO-260303-00002');
