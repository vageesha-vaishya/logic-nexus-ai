
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const QUOTE_NUMBER = 'QUO-260303-00002';

async function repairQuote() {
  console.log(`Repairing quote: ${QUOTE_NUMBER}`);

  // 1. Fetch Quote
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('quote_number', QUOTE_NUMBER)
    .single();

  if (quoteError || !quote) {
    console.error('Error fetching quote:', quoteError);
    return;
  }

  console.log('Quote found:', quote.id);
  console.log('Current Version ID in Quote:', quote.current_version_id);

  if (!quote.current_version_id) {
      console.log('No current_version_id set. Will create new version.');
  }

  // 2. Check if version exists
  let versionId = quote.current_version_id;
  let versionExists = false;

  if (versionId) {
      const { data: version, error: vError } = await supabase
        .from('quotation_versions')
        .select('id')
        .eq('id', versionId)
        .maybeSingle();
      
      if (version) {
          console.log('Version exists:', version.id);
          versionExists = true;
      } else {
          console.log('Version record missing for ID:', versionId);
      }
  }

  if (versionExists) {
      console.log('Quote appears to have a valid version. Checking options...');
      // Check options
      const { count, error: oError } = await supabase
        .from('quotation_version_options')
        .select('*', { count: 'exact', head: true })
        .eq('quotation_version_id', versionId);
      
      console.log(`Found ${count} options.`);
      if (count > 0) {
          console.log('Data seems intact. No repair needed.');
          return;
      }
      console.log('Version exists but has no options. Adding default option.');
  } else {
      // 3. Create Version
      console.log('Creating missing version record...');
      const newVersionId = versionId || crypto.randomUUID();
      
      const { error: insertError } = await supabase
        .from('quotation_versions')
        .insert({
            id: newVersionId,
            quote_id: quote.id,
            version_number: 1,
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

      if (insertError) {
          console.error('Error creating version:', insertError);
          return;
      }
      console.log('Created version:', newVersionId);
      versionId = newVersionId;

      // Update quote if needed
      if (versionId !== quote.current_version_id) {
          await supabase.from('quotes').update({ current_version_id: versionId }).eq('id', quote.id);
          console.log('Updated quote.current_version_id');
      }
  }

  // 4. Create Default Option
  console.log('Creating default option...');
  // Need carrier ID?
  // Just use null or find a carrier.
  
  const { data: carrier } = await supabase.from('carriers').select('id').limit(1).maybeSingle();
  const carrierId = carrier?.id || null;

  const { error: optError } = await supabase
    .from('quotation_version_options')
    .insert({
        quotation_version_id: versionId,
        carrier_id: carrierId,
        transit_time_days: 30,
        frequency: 'Weekly',
        service_level: 'Standard',
        is_preferred: true,
        valid_until: quote.expiration_date,
        created_at: new Date().toISOString()
    });

  if (optError) {
      console.error('Error creating option:', optError);
  } else {
      console.log('Created default option.');
  }
  
  console.log('Repair complete.');
}

repairQuote();
