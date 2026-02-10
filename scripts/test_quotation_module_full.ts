
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    console.log("--- Starting Quotation Module Test Scenario ---");

    try {
        // 1. Setup Data
        // Fetch a valid tenant_id
        let { data: tenant } = await supabase.from('tenants').select('id').limit(1).maybeSingle();
        let tenantId = tenant?.id;
        
        if (!tenantId) {
             const { data: q } = await supabase.from('quotes').select('tenant_id').limit(1).maybeSingle();
             tenantId = q?.tenant_id;
        }
        
        if (!tenantId) {
            // Fallback to a random UUID if we can't find one. 
            // In a real isolated test, we might want to create a tenant, but that might require special permissions or tables.
            // We'll use a random one and hope RLS allows insertion with Service Role (which it should).
            tenantId = crypto.randomUUID();
        }

        const testRunId = Date.now();
        const customerName = `Test Customer ${testRunId}`;
        
        // Try to find a real user ID from existing quotes to ensure visibility
        let userId = crypto.randomUUID();
        const { data: existingQuote } = await supabase.from('quotes').select('created_by').not('created_by', 'is', null).limit(1).maybeSingle();
        if (existingQuote?.created_by) {
            userId = existingQuote.created_by;
        }

        const accountData = {
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            name: customerName,
            status: 'active',
            account_type: 'customer'
        };

        const quoteData = {
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            account_id: accountData.id,
            quote_number: `Q-${testRunId}`,
            status: 'draft',
            title: `Test Quote ${testRunId}`,
            created_by: userId,
            created_at: new Date().toISOString(),
            shipping_amount: 1500.00,
            total_amount: 1500.00,
            currency: 'USD'
        };

        // For quote_items, we need to match schema.
        // Inspect showed: quote_id, tenant_id, line_number, product_name, quantity, unit_price, line_total, type
        const itemData = {
            id: crypto.randomUUID(),
            quote_id: quoteData.id,
            tenant_id: tenantId,
            line_number: 1,
            product_name: 'Test Product A',
            quantity: 10,
            unit_price: 150.00,
            line_total: 1500.00,
            type: 'loose'
        };

        // 2. Insert Data
        console.log("\nExecuting Insertions...");

        // Insert Account
        const { error: accError } = await supabase.from('accounts').insert(accountData);
        if (accError) {
             console.error("SQL Context (Account):", JSON.stringify(accountData, null, 2));
             throw new Error(`Account Insert Failed: ${JSON.stringify(accError)}`);
        }

        // Insert Quote
        const { error: quoteError } = await supabase.from('quotes').insert(quoteData);
        if (quoteError) {
             console.error("SQL Context (Quote):", JSON.stringify(quoteData, null, 2));
             throw new Error(`Quote Insert Failed: ${JSON.stringify(quoteError)}`);
        }

        // Insert Item
        const { error: itemError } = await supabase.from('quote_items').insert(itemData);
        if (itemError) {
             console.error("SQL Context (Item):", JSON.stringify(itemData, null, 2));
             throw new Error(`Item Insert Failed: ${JSON.stringify(itemError)}`);
        }

        // 3. Log Inserted Data (Explicitly as requested)
        console.log("\n" + "=".repeat(50));
        console.log("Quotation Module – Inserted Test Data");
        console.log("=".repeat(50));
        console.log(`Quotation ID:      ${quoteData.id}`);
        console.log(`Customer Name:     ${accountData.name}`);
        console.log(`Created By:        ${quoteData.created_by} (Simulated User)`);
        console.log(`Creation Time:     ${quoteData.created_at}`);
        console.log(`Line Item Details:`);
        console.log(`  - Product:       ${itemData.product_name}`);
        console.log(`  - Quantity:      ${itemData.quantity}`);
        console.log(`  - Unit Price:    $${itemData.unit_price.toFixed(2)}`);
        console.log(`  - Total:         $${itemData.line_total.toFixed(2)}`);
        console.log("=".repeat(50));

        // 4. Verification (Select Query)
        console.log("\n--- Verification: Raw Database Rows ---");

        // Fetch Account
        const { data: accRes, error: accFetchErr } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountData.id);
        
        if (accFetchErr || !accRes?.length) {
            console.error("FAILED to fetch Account:", accFetchErr);
            throw new Error("Verification Failed: Account not found");
        }
        console.log("\n[Table: accounts]");
        console.log(JSON.stringify(accRes, null, 2));

        // Fetch Quote
        const { data: quoteRes, error: quoteFetchErr } = await supabase
            .from('quotes')
            .select('*')
            .eq('id', quoteData.id);

        if (quoteFetchErr || !quoteRes?.length) {
            console.error("FAILED to fetch Quote:", quoteFetchErr);
            throw new Error("Verification Failed: Quote not found");
        }
        console.log("\n[Table: quotes]");
        console.log(JSON.stringify(quoteRes, null, 2));

        // Fetch Item
        const { data: itemRes, error: itemFetchErr } = await supabase
            .from('quote_items')
            .select('*')
            .eq('id', itemData.id);

        if (itemFetchErr || !itemRes?.length) {
            console.error("FAILED to fetch Quote Items:", itemFetchErr);
            throw new Error("Verification Failed: Quote Items not found");
        }
        console.log("\n[Table: quote_items]");
        console.log(JSON.stringify(itemRes, null, 2));

        console.log("\nTest Scenario Completed Successfully.");

    } catch (err: any) {
        console.error("\n!!! TEST ABORTED - ERROR !!!");
        console.error(err.message);
        process.exit(1);
    }
}

runTest();
