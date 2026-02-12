
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const tenantId = 'fbb1e554-6cf5-4091-b351-962db415efb2'; // Tenant001

  console.log(`Checking users for tenant: ${tenantId}`);

  // Get profiles for this tenant
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, franchise_id')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  console.log(`Found ${profiles.length} profiles:`);
  profiles.forEach(p => {
    console.log(`- ${p.first_name} ${p.last_name} (${p.email})`);
    console.log(`  Franchise ID: ${p.franchise_id}`);
  });
  
  // Also check if there are any franchises in this tenant
  const { data: franchises, error: franchiseError } = await supabase
      .from('franchises')
      .select('id, name')
      .eq('tenant_id', tenantId);
      
  if (franchiseError) {
      console.error('Error fetching franchises:', franchiseError);
  } else {
      console.log(`Found ${franchises.length} franchises:`);
      franchises.forEach(f => {
          console.log(`- ${f.name} (${f.id})`);
      });
  }
}

checkUsers().catch(console.error);
