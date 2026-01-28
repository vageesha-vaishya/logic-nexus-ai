
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanupPlatformDomains() {
  console.log('🔍 Fetching platform_domains...');
  
  // Fetch all domains, ordered by created_at DESC (newest first)
  const { data: domains, error } = await supabase
    .from('platform_domains')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching domains:', error);
    return;
  }

  console.log(`✅ Found ${domains.length} domains.`);

  const seen = new Set();
  const toDelete = [];
  const kept = [];

  for (const domain of domains) {
    const key = `${domain.code}|${domain.name}`; // Using | as separator
    
    if (seen.has(key)) {
      toDelete.push(domain.id);
      console.log(`🗑️  Marked for deletion: ${domain.name} (${domain.code}) - ID: ${domain.id} (Duplicate)`);
    } else {
      seen.add(key);
      kept.push(domain);
      console.log(`✨ Keeping: ${domain.name} (${domain.code}) - ID: ${domain.id}`);
    }
  }

  if (toDelete.length === 0) {
    console.log('🎉 No duplicates found.');
    return;
  }

  console.log(`⚠️  Deleting ${toDelete.length} duplicate domains...`);

  const { error: deleteError } = await supabase
    .from('platform_domains')
    .delete()
    .in('id', toDelete);

  if (deleteError) {
    console.error('❌ Error deleting duplicates:', deleteError);
  } else {
    console.log('✅ Successfully deleted duplicates.');
  }
}

cleanupPlatformDomains().catch(console.error);
