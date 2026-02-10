
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPolicies() {
  const tables = ['ports_locations', 'service_type_mappings', 'service_types'];
  
  for (const table of tables) {
    console.log(`\nChecking policies for table: ${table}`);
    const { data, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', table);
      
    if (error) {
      console.error(`Error fetching policies for ${table}:`, error);
      // Try alternative query if pg_policies is not accessible via API (it's a system view)
      // Usually need direct SQL, but let's try RPC or assume we can't see it easily via client.
      continue;
    }
    
    if (data && data.length > 0) {
      console.table(data.map(p => ({ 
        name: p.policyname, 
        cmd: p.cmd, 
        roles: p.roles,
        qual: p.qual,
        with_check: p.with_check
      })));
    } else {
      console.log(`No policies found (or not accessible) for ${table}.`);
    }
    
    // Check if RLS is enabled
    const { data: tableInfo } = await supabase
      .from('pg_tables')
      .select('rowsecurity')
      .eq('tablename', table)
      .single();
      
    if (tableInfo) {
        console.log(`RLS Enabled: ${tableInfo.rowsecurity}`);
    }
  }
}

// Since pg_policies might not be exposed, let's try a direct SQL query via RPC if available, 
// or just infer from behavior.
// Actually, let's try to "Read" as an anonymous user vs authenticated user.
// But I can't easily simulate auth user here without a password.

checkPolicies();
