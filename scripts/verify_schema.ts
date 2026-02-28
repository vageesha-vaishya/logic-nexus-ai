
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Role Key in .env');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking schema for quotation_versions...');
  
  // Method 1: Check information_schema (if accessible)
  try {
    const { data: columns, error } = await adminSupabase
      .rpc('get_database_functions') // Try to use a known RPC or just direct query if allowed
      .select('*')
      .limit(1);
      
    // Direct query to information_schema is often blocked or requires SQL editor
    // But we can try via PostgREST if exposed, usually not.
    // So let's try to insert/select with expected columns.
  } catch (e) {}

  // Better Method: RPC call to inspect or just try to select known columns
  // If we select 'major', and it errors, we know.
  
  console.log('Testing select major/minor/version_number/kind/is_active/is_current/is_locked...');
  const { data: dataMajor, error: errorMajor } = await adminSupabase
    .from('quotation_versions')
    .select('major, minor, version_number, kind, is_active, is_current, is_locked')
    .limit(1);
    
  if (errorMajor) {
      console.log('Select extended columns failed:', errorMajor.message);
  } else {
      console.log('Select extended columns SUCCESS. Columns exist.');
  }

  console.log('Testing select major_version/minor_version...');
  const { data: dataVer, error: errorVer } = await adminSupabase
    .from('quotation_versions')
    .select('major_version, minor_version')
    .limit(1);

  if (errorVer) {
      console.log('Select major_version/minor_version failed:', errorVer.message);
  } else {
      console.log('Select major_version/minor_version SUCCESS. Columns exist.');
  }
}

checkSchema();
