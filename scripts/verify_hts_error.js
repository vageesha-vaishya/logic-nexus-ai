
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyGlobalHSRoots() {
  console.log('🔍 Verifying global_hs_roots table structure...');

  try {
    // Attempt to select the 'chapter' column from global_hs_roots
    const { data, error } = await supabase
      .from('global_hs_roots')
      .select('chapter, heading, hs6_code')
      .limit(1);

    if (error) {
      console.error('❌ Error selecting columns:', error.message);
      if (error.message.includes('does not exist')) {
        console.log('⚠️  Confirmed: Column likely missing.');
      }
    } else {
      console.log('✅ Columns exist. Data sample:', data);
    }
    
    // Also try to check if we can call the RPC
    console.log('🔄 Testing RPC get_global_hs_hierarchy...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_global_hs_hierarchy', {
        level_type: 'chapter',
        parent_code: null
    });

    if (rpcError) {
        console.error('❌ RPC Error:', rpcError.message);
    } else {
        console.log('✅ RPC Success. Count:', rpcData?.length);
    }

  } catch (err) {
    console.error('❌ Unexpected Error:', err);
  }
}

verifyGlobalHSRoots();
