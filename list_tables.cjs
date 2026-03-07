const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(supabaseUrl, supabaseServiceKey);

async function listTables() {
  const { data: tables, error } = await client
    .rpc('get_tables'); // Try RPC if available, or just standard query if I can

  // Supabase JS client doesn't give direct access to information_schema easily with RLS/permissions sometimes.
  // But service role key should allow it if we query pg_catalog or information_schema via SQL if we had SQL access.
  // Since we only have JS client, we can try to inspect definitions or guess.
  
  // Actually, I can use a raw SQL query if I have a function for it, but I probably don't.
  // I'll try to select from a few likely candidates.
  
  const candidates = [
      'quote_items',
      'quote_items_core',
      'quote_commodities',
      'quote_cargo',
      'cargo_details',
      'shipment_items',
      'freight_items',
      'quotation_items'
  ];
  
  for (const table of candidates) {
      const { data, error } = await client.from(table).select('count', { count: 'exact', head: true });
      if (error) {
          console.log(`${table}: Error - ${error.message}`);
      } else {
          console.log(`${table}: Exists (Access OK)`);
      }
  }
}

listTables();
