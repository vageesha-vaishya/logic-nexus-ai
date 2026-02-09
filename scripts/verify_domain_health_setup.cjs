
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDomainHealthSetup() {
  console.log('Verifying Domain Health Setup...');

  // 1. Check if tenant_domains table exists and is accessible
  console.log('1. Checking tenant_domains table...');
  const { data: domains, error } = await supabase
    .from('tenant_domains')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error accessing tenant_domains:', error);
    process.exit(1);
  }
  console.log('✅ tenant_domains table is accessible.');

  // 2. Check if edge function is registered (optional, can't easily check via JS client without invoking)
  // We'll skip invoking it to avoid side effects or 500s if not deployed.
  
  // 3. Attempt to insert a test domain (and delete it)
  console.log('3. Testing domain insertion...');
  
  // Need a valid tenant_id. Fetch one.
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  if (!tenants || tenants.length === 0) {
    console.warn('⚠️ No tenants found. Skipping insertion test.');
    return;
  }
  const tenantId = tenants[0].id;
  const testDomain = `test-verify-${Date.now()}.com`;

  const { data: inserted, error: insertError } = await supabase
    .from('tenant_domains')
    .insert({
      tenant_id: tenantId,
      domain_name: testDomain,
      is_verified: false
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Insertion failed:', insertError);
  } else {
    console.log('✅ Domain insertion successful:', inserted.domain_name);
    
    // Clean up
    const { error: deleteError } = await supabase
      .from('tenant_domains')
      .delete()
      .eq('id', inserted.id);
      
    if (deleteError) {
      console.error('⚠️ Failed to clean up test domain:', deleteError);
    } else {
      console.log('✅ Test domain cleaned up.');
    }
  }
}

verifyDomainHealthSetup().catch(console.error);
