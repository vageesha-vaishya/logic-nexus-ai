
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

async function verifyPhase1() {
  console.log('Verifying Phase 1: Foundations & Compliance...');
  let allPassed = true;

  // 1. Verify RPC: check_vendor_storage_quota
  try {
    const { error } = await supabase.rpc('check_vendor_storage_quota', {
      p_vendor_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      p_new_bytes: 100
    });
    
    // It might return true/false or error if UUID invalid, but if RPC missing it says "function not found"
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

  // 2. Verify RPC: archive_expired_vendor_documents
  try {
    const { error } = await supabase.rpc('archive_expired_vendor_documents', {
      p_retention_days: 365
    });
    
    if (error && error.message.includes('function not found')) {
      console.error('❌ RPC archive_expired_vendor_documents NOT found');
      allPassed = false;
    } else {
      console.log('✅ RPC archive_expired_vendor_documents exists');
    }
  } catch (e) {
    console.error('❌ Error checking RPC:', e);
    allPassed = false;
  }

  // 3. Verify Audit Log Table
  const { data: auditLogs, error: auditError } = await supabase
    .from('audit_logs')
    .select('*')
    .limit(1);
    
  if (auditError) {
    console.error('❌ audit_logs table access failed:', auditError.message);
    allPassed = false;
  } else {
    console.log('✅ audit_logs table accessible');
  }

  // 4. Verify Vendor Folders Table
  const { data: folders, error: foldersError } = await supabase
    .from('vendor_folders')
    .select('*')
    .limit(1);

  if (foldersError) {
    console.error('❌ vendor_folders table access failed:', foldersError.message);
    allPassed = false;
  } else {
    console.log('✅ vendor_folders table accessible');
  }

  if (allPassed) {
    console.log('\n🎉 Phase 1 Verification PASSED');
  } else {
    console.error('\n❌ Phase 1 Verification FAILED');
    process.exit(1);
  }
}

verifyPhase1();
