const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyBackfillNeed() {
  console.log('Verifying need for aes_hts_id backfill in cargo_details...');

  const { count: totalCount, error: countError } = await supabase
    .from('cargo_details')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting cargo_details:', countError);
    return;
  }

  const { count: nullCount, error: nullError } = await supabase
    .from('cargo_details')
    .select('*', { count: 'exact', head: true })
    .is('aes_hts_id', null);

  if (nullError) {
    console.error('Error counting null aes_hts_id:', nullError);
    return;
  }

  console.log(`Total cargo_details records: ${totalCount}`);
  console.log(`Records with missing aes_hts_id: ${nullCount}`);

  if (nullCount > 0) {
    console.log('\nFetching sample records with missing aes_hts_id:');
    const { data: samples, error: sampleError } = await supabase
      .from('cargo_details')
      .select('id, description, commodity, cargo_type_id')
      .is('aes_hts_id', null)
      .limit(5);

    if (sampleError) {
      console.error('Error fetching samples:', sampleError);
    } else {
      console.table(samples);
    }
  } else {
    console.log('No backfill needed! All records have aes_hts_id.');
  }
}

verifyBackfillNeed();
