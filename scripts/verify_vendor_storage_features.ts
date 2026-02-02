
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🚀 Starting Vendor Storage Features Verification (Service Role)...');

  // 1. Authenticate (Skipped - using Service Role)
  /*
  console.log(`\n🔑 Authenticating as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('❌ Auth failed:', authError.message);
    process.exit(1);
  }
  console.log('✅ Authenticated');
  */

  // 2. Create Test Vendor
  const vendorName = `Test Vendor Storage ${Date.now()}`;
  console.log(`\n🏢 Creating test vendor: ${vendorName}...`);
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .insert({
      name: vendorName,
      contact_info: {
        primary_contact: 'Test Contact',
        email: `test-${Date.now()}@vendor.com`,
        phone: '555-0123'
      },
      type: 'carrier',
      status: 'active'
    })
    .select()
    .single();

  if (vendorError) {
    console.error('❌ Vendor creation failed:', vendorError.message);
    process.exit(1);
  }
  console.log(`✅ Vendor created: ${vendor.id}`);

  try {
    // 3. Test Quota Check (Initial)
    console.log('\n📊 Testing check_vendor_storage_quota (Initial)...');
    const { data: quotaOk, error: quotaError } = await supabase
      .rpc('check_vendor_storage_quota', {
        p_vendor_id: vendor.id,
        p_new_bytes: 1000 // 1KB
      });
    
    if (quotaError) throw quotaError;
    if (quotaOk !== true) throw new Error('Quota check failed (should be true)');
    console.log('✅ Initial quota check passed');

    // 4. Test Increment Storage
    console.log('\n📈 Testing increment_vendor_storage (Adding 10MB)...');
    const tenMB = 10 * 1024 * 1024;
    const { error: incError } = await supabase
      .rpc('increment_vendor_storage', {
        p_vendor_id: vendor.id,
        p_bytes: tenMB
      });
    
    if (incError) throw incError;
    console.log('✅ Storage usage incremented');

    // Verify usage record
    const { data: usage, error: usageError } = await supabase
      .from('vendor_storage_usage')
      .select('*')
      .eq('vendor_id', vendor.id)
      .single();
    
    if (usageError) throw usageError;
    if (parseInt(usage.total_bytes_used) !== tenMB) {
        throw new Error(`Usage mismatch: expected ${tenMB}, got ${usage.total_bytes_used}`);
    }
    console.log(`✅ Usage record verified: ${usage.total_bytes_used} bytes`);

    // 5. Test Quota Check (Near Limit)
    console.log('\n📊 Testing check_vendor_storage_quota (Near Limit)...');
    // Try to add 1.1GB (should fail)
    const largeFile = Math.floor(1.1 * 1024 * 1024 * 1024);
    const { data: quotaFail, error: quotaFailError } = await supabase
      .rpc('check_vendor_storage_quota', {
        p_vendor_id: vendor.id,
        p_new_bytes: largeFile
      });
    
    if (quotaFailError) throw quotaFailError;
    if (quotaFail !== false) throw new Error('Quota check failed (should be false for >1GB)');
    console.log('✅ Quota check correctly rejected large file');

    // 6. Test Metadata (Folder & Tags)
    console.log('\n🗂 Testing Document with Folder & Tags...');
    const docPayload = {
      vendor_id: vendor.id,
      name: 'Test Doc with Metadata',
      type: 'contract',
      url: 'https://example.com/test.pdf',
      status: 'pending',
      folder: 'Legal',
      tags: ['important', '2024'],
      created_at: new Date().toISOString()
    };

    const { data: doc, error: docError } = await supabase
      .from('vendor_documents')
      .insert(docPayload)
      .select()
      .single();

    if (docError) throw docError;
    console.log(`✅ Document created with folder=${doc.folder} and tags=${doc.tags}`);

    // 7. Verify Filter Query
    console.log('\n🔍 Verifying Search/Filter Query...');
    const { data: searchResults, error: searchError } = await supabase
      .from('vendor_documents')
      .select('*')
      .contains('tags', ['important'])
      .eq('folder', 'Legal');

    if (searchError) throw searchError;
    if (searchResults.length !== 1) throw new Error(`Search failed: expected 1 result, got ${searchResults.length}`);
    console.log('✅ Search query returned correct document');

  } catch (err: any) {
    console.error('❌ Verification failed:', err.message || err);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await supabase.from('vendors').delete().eq('id', vendor.id);
    console.log('✅ Test vendor deleted');
  }
}

main().catch(console.error);
