
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

async function checkMappings() {
  const tenantId = 'bb451198-2877-4345-a578-d404c5720f1a';
  
  console.log('Checking mappings for tenant:', tenantId);

  const { data: mappings, error } = await supabase
    .from('service_type_mappings')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${mappings.length} mappings:`);
  console.table(mappings);
  
  // Also check global mappings
  const { data: globalMappings } = await supabase
    .from('service_type_mappings')
    .select('*')
    .is('tenant_id', null);
    
  console.log(`Found ${globalMappings?.length} global mappings.`);
}

checkMappings();
