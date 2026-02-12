
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Checking RLS policies...');

  const { data: policies, error } = await supabase
    .from('pg_policies')
    .select('*')
    .in('tablename', ['quote_charges', 'quotation_version_option_legs', 'quotation_version_options', 'quotation_versions', 'quotes']);

  if (error) {
    // pg_policies is a system catalog, might not be accessible via postgrest directly depending on exposure
    // If this fails, I'll try an RPC if available, or just rely on my knowledge of migrations.
    console.error('Error fetching policies:', error);
    
    // Fallback: try to verify RLS enabled status via direct query if possible (usually not via client)
    // But we can check if we can query the tables without service key (using anon key) to see if we get nothing.
    return;
  }

  console.table(policies);
}

main();
