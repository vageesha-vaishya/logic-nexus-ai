
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
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
  console.log('Checking policies for quotation_versions...');
  
  const { data, error } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'quotation_versions');
    
  if (error) {
    console.error('Error fetching policies:', error);
    return;
  }
  
  console.log('Policies for quotation_versions:');
  data.forEach((policy: any) => {
    console.log(`- Name: ${policy.policyname}`);
    console.log(`  Cmd: ${policy.cmd}`);
    console.log(`  Roles: ${policy.roles}`);
    console.log(`  Qual: ${policy.qual}`);
    console.log(`  With Check: ${policy.with_check}`);
    console.log('---');
  });

  // Also check quotes policies for comparison
  console.log('\nChecking policies for quotes...');
  const { data: quotesPolicies } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'quotes');
    
  quotesPolicies?.forEach((policy: any) => {
    console.log(`- Name: ${policy.policyname}`);
    console.log(`  Cmd: ${policy.cmd}`);
    console.log(`  Qual: ${policy.qual}`);
    console.log('---');
  });
}

checkPolicies();
