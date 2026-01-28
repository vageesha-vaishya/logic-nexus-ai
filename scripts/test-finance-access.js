
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testFinanceSchema() {
  console.log('🔍 Testing access to "finance" schema...');

  try {
    // 1. Test Tax Jurisdictions
    const { data: jurisdictions, error: jurisdictionError } = await supabase
      .schema('finance')
      .from('tax_jurisdictions')
      .select('*')
      .limit(5);

    if (jurisdictionError) {
      console.error('❌ Error accessing finance.tax_jurisdictions:', jurisdictionError);
    } else {
      console.log(`✅ Successfully accessed finance.tax_jurisdictions. Count: ${jurisdictions.length}`);
    }

    // 2. Test Tax Codes
    const { data: codes, error: codesError } = await supabase
      .schema('finance')
      .from('tax_codes')
      .select('*')
      .limit(5);

    if (codesError) {
      console.error('❌ Error accessing finance.tax_codes:', codesError);
    } else {
      console.log(`✅ Successfully accessed finance.tax_codes. Count: ${codes.length}`);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testFinanceSchema();
