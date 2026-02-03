
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkTables() {
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .ilike('table_name', 'quote%')
    .eq('table_schema', 'public');
    
  if (error) {
      // Direct SQL via rpc if exposed, or try list tables via PostgREST
      console.log('Error fetching tables via PostgREST:', error.message);
      // Fallback: list known tables to check access
      const tables = ['quote_items', 'quote_packages', 'quotes', 'quote_legs'];
      for (const t of tables) {
          const { error: tErr } = await supabase.from(t).select('count', { count: 'exact', head: true });
          console.log(`Table ${t}: ${tErr ? 'Inaccessible/Missing' : 'Exists'}`);
      }
  } else {
      console.log('Tables found:', data.map(d => d.table_name));
  }
}

checkTables();
