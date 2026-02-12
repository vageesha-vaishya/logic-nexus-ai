
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

async function checkSchema() {
  const tenantId = 'fbb1e554-6cf5-4091-b351-962db415efb2';

  // Check accounts structure
  const { data: accounts, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (accountError) {
      console.log('Error fetching accounts:', accountError);
  } else {
      console.log('Account sample:', accounts[0]);
  }

  // Check user_roles
  const { data: userRoles, error: roleError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('tenant_id', tenantId);

  if (roleError) {
      console.log('Error fetching user_roles:', roleError);
  } else {
      console.log('User Roles:', userRoles);
  }
}

checkSchema().catch(console.error);
