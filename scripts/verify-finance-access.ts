
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase URL or Key in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFinanceSchemaAccess() {
  console.log('Verifying access to finance schema...');
  console.log(`Target URL: ${supabaseUrl}`);
  
  try {
    // 1. Verify access to tax_jurisdictions
    console.log('\nChecking finance.tax_jurisdictions...');
    const { data: jurisdictions, error: jurisError } = await supabase
      .schema('finance')
      .from('tax_jurisdictions')
      .select('count')
      .limit(1);

    if (jurisError) {
      console.error('❌ Error accessing tax_jurisdictions:', jurisError);
    } else {
      console.log('✅ Successfully accessed tax_jurisdictions');
    }

    // 2. Verify access to tax_rules
    console.log('\nChecking finance.tax_rules...');
    const { data: rules, error: rulesError } = await supabase
      .schema('finance')
      .from('tax_rules')
      .select('count')
      .limit(1);

    if (rulesError) {
      console.error('❌ Error accessing tax_rules:', rulesError);
    } else {
      console.log('✅ Successfully accessed tax_rules');
    }

    // 3. Verify access to tenant_nexus
    console.log('\nChecking finance.tenant_nexus...');
    const { data: nexus, error: nexusError } = await supabase
      .schema('finance')
      .from('tenant_nexus')
      .select('count')
      .limit(1);

    if (nexusError) {
      console.error('❌ Error accessing tenant_nexus:', nexusError);
    } else {
      console.log('✅ Successfully accessed tenant_nexus');
    }

  } catch (err) {
    console.error('Unexpected error during verification:', err);
  }
}

verifyFinanceSchemaAccess();
