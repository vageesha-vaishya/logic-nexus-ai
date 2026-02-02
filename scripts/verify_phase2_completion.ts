
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyPhase2() {
  console.log('Verifying Phase 2: Advanced Document Management & Workflows...');
  let allPassed = true;

  // 1. Verify vendor_document_versions table
  const { error: docVerError } = await supabase
    .from('vendor_document_versions')
    .select('count')
    .limit(1)
    .maybeSingle();

  if (docVerError) {
    console.error('❌ vendor_document_versions table access failed:', docVerError.message);
    allPassed = false;
  } else {
    console.log('✅ vendor_document_versions table accessible');
  }

  // 2. Verify vendor_contract_versions table
  const { error: conVerError } = await supabase
    .from('vendor_contract_versions')
    .select('count')
    .limit(1)
    .maybeSingle();

  if (conVerError) {
    console.error('❌ vendor_contract_versions table access failed:', conVerError.message);
    allPassed = false;
  } else {
    console.log('✅ vendor_contract_versions table accessible');
  }

  // 3. Verify vendor_folders table
  const { error: foldersError } = await supabase
    .from('vendor_folders')
    .select('count')
    .limit(1)
    .maybeSingle();

  if (foldersError) {
    console.error('❌ vendor_folders table access failed:', foldersError.message);
    allPassed = false;
  } else {
    console.log('✅ vendor_folders table accessible');
  }

  // 4. Verify RPC: check_vendor_storage_quota (Re-verify)
  try {
    const { error } = await supabase.rpc('check_vendor_storage_quota', {
      p_vendor_id: '00000000-0000-0000-0000-000000000000',
      p_new_bytes: 100
    });
    
    if (error && error.message.includes('function not found')) {
      console.error('❌ RPC check_vendor_storage_quota NOT found');
      allPassed = false;
    } else {
      console.log('✅ RPC check_vendor_storage_quota exists');
    }
  } catch (e) {
    console.error('❌ Error checking RPC:', e);
    allPassed = false;
  }

  if (allPassed) {
    console.log('\n🎉 Phase 2 Verification PASSED');
  } else {
    console.error('\n❌ Phase 2 Verification FAILED');
    process.exit(1);
  }
}

verifyPhase2();
