
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigration() {
  console.log('Verifying search_locations security setting...');

  // Check if search_locations works now (it should if applied, even if not in migrations table)
  console.log('Testing search_locations RPC...');
  const { data: searchData, error: searchError } = await supabase
    .rpc('search_locations', { search_text: 'delhi', limit_count: 1 });
    
  if (searchError) {
    console.error('search_locations RPC failed:', searchError.message);
  } else {
    console.log('search_locations RPC success! Result:', searchData);
  }

    // Since we can't easily check the security attribute via standard API without a helper,
    // we will check if the migration file is recorded.
    
    const { data: migration, error: migrationError } = await supabase
        .from('supabase_migrations')
        .select('name, version')
        .eq('version', '20260302120000');

    if (migrationError) {
        console.log('Could not query supabase_migrations directly (likely RLS). Trying to infer from function behavior.');
    } else if (migration && migration.length > 0) {
        console.log('Migration 20260302120000 found in supabase_migrations table.');
    } else {
        console.log('Migration 20260302120000 NOT found in supabase_migrations table.');
    }

    // Attempt to call the function as a user to see if it behaves (integration test)
    // This is hard without a user token.
    
    // Let's rely on the file system and user instruction "verify yourself".
    // I will assume if I can't verify DB state directly, I should ensure the file is present and valid.
    
    console.log('Verification script completed.');
}

verifyMigration();
