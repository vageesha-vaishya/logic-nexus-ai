const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(supabaseUrl, supabaseServiceKey);

async function inspectAll() {
  const quoteId = '38f327ac-ba09-4502-aacb-5ac2536c2a12'; // QUO-260202-00005
  console.log(`Checking Quote: ${quoteId}`);

  const tables = [
      'quote_items',
      'quote_items_core',
      'quote_commodities',
      'quote_cargo',
      'cargo_details',
      'quotation_items'
  ];
  
  for (const table of tables) {
      const { data, error } = await client
          .from(table)
          .select('*')
          .eq('quote_id', quoteId);
          
      if (error) {
          console.log(`${table}: Error - ${error.message}`);
      } else {
          console.log(`${table}: Found ${data.length} records.`);
          if (data.length > 0) {
              console.log(`- Sample:`, JSON.stringify(data[0]));
          }
      }
  }
}

inspectAll();
