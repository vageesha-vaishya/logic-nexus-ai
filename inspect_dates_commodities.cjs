const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(supabaseUrl, supabaseServiceKey);

async function inspectDatesAndCommodities() {
  const quoteId = '38f327ac-ba09-4502-aacb-5ac2536c2a12'; // QUO-260202-00005
  console.log(`Inspecting Quote: ${quoteId}`);

  // 1. Check all date-like columns in quotes
  const { data: quote, error: qError } = await client
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();

  if (qError) console.error('Error fetching quote:', qError);
  else {
    console.log('Quote Date Fields:');
    const dateFields = Object.keys(quote).filter(k => k.includes('date') || k.includes('time') || k.includes('valid') || k.includes('expire') || k.includes('deadline') || k.includes('at'));
    dateFields.forEach(k => console.log(`- ${k}: ${quote[k]}`));
  }

  // 2. Check master_commodities table
  const { data: mComm, error: mcError } = await client
    .from('master_commodities')
    .select('*')
    .limit(5);

  if (mcError) {
    console.log('master_commodities: Error -', mcError.message);
  } else {
    console.log(`master_commodities: Found ${mComm.length} records.`);
    if (mComm.length > 0) console.log('- Sample:', JSON.stringify(mComm[0]));
  }
  
  // 3. Check commodities table
  const { data: comm, error: cError } = await client
    .from('commodities')
    .select('*')
    .limit(5);

  if (cError) {
    console.log('commodities: Error -', cError.message);
  } else {
    console.log(`commodities: Found ${comm.length} records.`);
    if (comm.length > 0) console.log('- Sample:', JSON.stringify(comm[0]));
  }
}

inspectDatesAndCommodities();
