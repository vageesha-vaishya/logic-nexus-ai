
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

async function verifySchema() {
  console.log('Verifying Logistics Invoicing Schema...');

  const tablesToCheck = ['invoices', 'invoice_line_items', 'payments', 'document_sequences'];
  let allExist = true;

  for (const table of tablesToCheck) {
    // For document_sequences, we check tenant_id because it uses a composite PK (tenant_id, document_type)
    const columnToCheck = table === 'document_sequences' ? 'tenant_id' : 'id';
    
    const { error } = await supabase.from(table).select(columnToCheck).limit(0);

    if (error) {
      if (error.code === '42P01') {
        console.error(`❌ Table '${table}' does NOT exist.`);
      } else if (error.code === '42703') {
         // Column does not exist
         console.error(`❌ Column '${columnToCheck}' not found in '${table}'. Table might have different structure.`);
      } else {
        console.error(`❌ Error checking '${table}':`, error.message);
      }
      allExist = false;
    } else {
      console.log(`✅ Table '${table}' exists.`);
    }
  }

  // Check enum existence via a custom query is harder with JS client unless we use rpc
  // But checking tables is a good enough proxy.

  if (allExist) {
    console.log('\n🎉 Schema verification PASSED. Tables are ready.');
  } else {
    console.error('\n⚠️ Schema verification FAILED. Please run migrations.');
    process.exit(1);
  }
}

verifySchema().catch(console.error);
