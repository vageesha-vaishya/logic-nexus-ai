
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Polyfill for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyManualQuoteCreation() {
  console.log('Starting Manual Quote Creation Verification...');

  try {
    // 1. Get a valid tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Failed to get tenant: ${tenantError?.message}`);
    }
    console.log('✅ Tenant resolved:', tenant.id);

    // 2. Create a test quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        tenant_id: tenant.id,
        title: 'Manual Verification Test Quote',
        transport_mode: 'OCEAN',
        origin_code: 'CNSHA',
        destination_code: 'USLGB',
        status: 'draft'
      })
      .select()
      .single();

    if (quoteError || !quote) {
      throw new Error(`Failed to create quote: ${quoteError?.message}`);
    }
    console.log('✅ Test quote created:', quote.id);

    // 3. Create a version
    const { data: version, error: versionError } = await supabase
      .from('quotation_versions')
      .insert({
        quote_id: quote.id,
        tenant_id: tenant.id,
        version_number: 1
      })
      .select()
      .single();

    if (versionError || !version) {
      throw new Error(`Failed to create version: ${versionError?.message}`);
    }
    console.log('✅ Version created:', version.id);

    // 4. Simulate Manual Option Creation (like MultiModalQuoteComposer)
    console.log('Simulating manual option save...');
    const manualOptionPayload = {
      quotation_version_id: version.id,
      tenant_id: tenant.id,
      source: 'composer',
      source_attribution: 'manual',
      ai_generated: false,
      option_name: 'Manual Test Option'
    };

    const { data: option, error: optionError } = await supabase
      .from('quotation_version_options')
      .insert(manualOptionPayload)
      .select()
      .single();

    if (optionError || !option) {
      throw new Error(`Failed to create manual option: ${optionError?.message}`);
    }

    console.log('✅ Manual option created:', option.id);
    
    // 5. Verify fields
    if (option.source !== 'composer') throw new Error(`Source mismatch: ${option.source}`);
    if (option.source_attribution !== 'manual') throw new Error(`Attribution mismatch: ${option.source_attribution}`);
    if (option.ai_generated !== false) throw new Error(`AI Generated flag mismatch: ${option.ai_generated}`);

    console.log('✅ Fields verified successfully:');
    console.log({
      source: option.source,
      source_attribution: option.source_attribution,
      ai_generated: option.ai_generated
    });

    // Clean up
    console.log('Cleaning up...');
    await supabase.from('quotes').delete().eq('id', quote.id); // Cascade should handle the rest
    console.log('✅ Cleanup complete');

  } catch (error: any) {
    console.error('❌ Verification Failed:', error.message);
    process.exit(1);
  }
}

verifyManualQuoteCreation();
