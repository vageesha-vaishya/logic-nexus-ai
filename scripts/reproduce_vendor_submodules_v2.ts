
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsertion() {
  console.log('\n--- Testing Insertion with Correct Schema ---');
  
  // 1. Get a vendor
  const { data: vendor } = await supabase.from('vendors').select('id, tenant_id').limit(1).single();
  
  if (!vendor) {
    console.error('❌ No vendors found to test linkage.');
    return;
  }
  console.log(`Using Vendor ID: ${vendor.id} (Tenant: ${vendor.tenant_id})`);

  // 2. Try insert into vendor_contracts
  const contractPayload = {
    vendor_id: vendor.id,
    title: 'Test Contract Correct Schema', // CORRECT FIELD
    contract_number: 'TEST-002',
    type: 'service_agreement',
    start_date: new Date().toISOString(),
    status: 'draft'
  };

  console.log('Attempting insert into vendor_contracts:', contractPayload);
  const { data: contractData, error: contractError } = await supabase.from('vendor_contracts').insert(contractPayload).select();

  if (contractError) {
    console.error('❌ vendor_contracts Insert Failed:', contractError);
  } else {
    console.log('✅ vendor_contracts Insert Success:', contractData);
    // Cleanup
    await supabase.from('vendor_contracts').delete().eq('id', contractData[0].id);
  }

  // 3. Try insert into vendor_documents
  const docPayload = {
    vendor_id: vendor.id,
    name: 'Test Document',
    type: 'other',
    url: 'https://example.com/doc.pdf',
    status: 'pending'
  };

  console.log('Attempting insert into vendor_documents:', docPayload);
  const { data: docData, error: docError } = await supabase.from('vendor_documents').insert(docPayload).select();

  if (docError) {
    console.error('❌ vendor_documents Insert Failed:', docError);
  } else {
    console.log('✅ vendor_documents Insert Success:', docData);
    // Cleanup
    await supabase.from('vendor_documents').delete().eq('id', docData[0].id);
  }
}

testInsertion();
