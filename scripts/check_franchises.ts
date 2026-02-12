
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFranchises() {
  const tenantId = 'fbb1e554-6cf5-4091-b351-962db415efb2';

  const { data: franchises, error } = await supabase
    .from('franchises')
    .select('id, name')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Franchises:', franchises);
}

checkFranchises().catch(console.error);
