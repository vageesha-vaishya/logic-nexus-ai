
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup Environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/.env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TENANT_ID = 'bb451198-2877-4345-a578-d404c5720f1a';

async function fixServiceMismatch() {
    console.log("========================================================");
    console.log("   FIXING SERVICE TYPE MISMATCH   ");
    console.log("========================================================");

    // 1. Get Latest Quote
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (quoteError) {
        console.error("Failed to fetch quote:", quoteError.message);
        return;
    }
    console.log(`Target Quote: ${quote.quote_number} (${quote.id})`);

    if (!quote.service_id) {
        console.error("Quote has no service_id. Cannot fix mismatch.");
        return;
    }

    // 2. Get the Service's NATIVE Type ID
    const { data: svc, error: svcError } = await supabase
        .from('services')
        .select('id, service_name, service_type_id')
        .eq('id', quote.service_id)
        .single();

    if (svcError) {
        console.error("Failed to fetch service:", svcError.message);
        return;
    }

    console.log(`Service: ${svc.service_name}`);
    console.log(`  Native Type ID: ${svc.service_type_id}`);
    console.log(`  Quote uses Type ID: ${quote.service_type_id}`);

    if (svc.service_type_id === quote.service_type_id) {
        console.log("  Match confirmed. No fix needed.");
        return;
    }

    const correctTypeId = svc.service_type_id;

    // 3. Fix Mappings
    console.log(`\n--> Fixing Mappings for Tenant ${TENANT_ID}...`);
    
    // Check if correct mapping exists
    const { data: existingCorrect } = await supabase
        .from('service_type_mappings')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .eq('service_type_id', correctTypeId)
        .eq('service_id', svc.id);

    if (!existingCorrect || existingCorrect.length === 0) {
        console.log("  Creating correct mapping...");
        const { error: insertError } = await supabase
            .from('service_type_mappings')
            .insert({
                tenant_id: TENANT_ID,
                service_type_id: correctTypeId,
                service_id: svc.id,
                is_active: true,
                is_default: true,
                priority: 10
            });
        if (insertError) console.error("  Failed to insert mapping:", insertError.message);
        else console.log("  Mapping created.");
    } else {
        console.log("  Correct mapping already exists.");
    }

    // 4. Update Quote
    console.log(`\n--> Updating Quote to use Correct Type ID (${correctTypeId})...`);
    const { error: updateError } = await supabase
        .from('quotes')
        .update({ service_type_id: correctTypeId })
        .eq('id', quote.id);

    if (updateError) console.error("  Failed to update quote:", updateError.message);
    else console.log("  Quote updated successfully.");

    // 5. Clean up incorrect mappings (Optional, but good for hygiene)
    // Be careful not to delete if it was used by other things, but for this tenant/service pair it's likely wrong.
    if (quote.service_type_id) {
        console.log(`\n--> Removing incorrect mapping for Type ${quote.service_type_id}...`);
        const { error: delError } = await supabase
            .from('service_type_mappings')
            .delete()
            .eq('tenant_id', TENANT_ID)
            .eq('service_type_id', quote.service_type_id)
            .eq('service_id', svc.id);
            
        if (delError) console.error("  Failed to delete incorrect mapping:", delError.message);
        else console.log("  Incorrect mapping removed.");
    }
    
    console.log("\nFix Complete.");
}

fixServiceMismatch();
