
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for admin tasks if needed, or anon if simulating user

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

const USER_EMAIL = 'bahuguna.vimal@gmail.com';
// Hardcoded Tenant ID for testing - based on previous context or use a default
const TENANT_ID = '00000000-0000-0000-0000-000000000000'; // Default/System tenant or specific one if known.
// Actually, let's fetch a valid tenant or user first if possible, or use the one from the context if I had it.
// Since I don't have the exact tenant ID in memory, I will query specifically for the user's tenant or just use a known one.
// For now, I'll rely on the script to look up the user.

async function runE2ETest() {
    console.log('Starting E2E Multi-Leg Quotation Test...');

    // 1. Get User/Tenant Context
    // We'll simulate being the specific user
    // Ideally we would sign in, but with Service Role we can bypass RLS or just impersonate.
    // For this test, we'll create data directly.

    // 2. Create Quote Header
    const quoteNum = `Q-E2E-${Date.now()}`;
    console.log(`Creating Quote: ${quoteNum}`);
    
    const { data: quote, error: quoteErr } = await supabase
        .from('quotes')
        .insert({
            // tenant_id: TENANT_ID, // If RLS allows, or if we use service role we might need it.
            // Let's assume we need to set tenant_id if RLS is on.
            // If we don't know it, we might fail. Let's try to fetch a valid tenant id first.
            quote_number: quoteNum,
            title: `E2E Multi-Leg Test Quote`,
            status: 'draft',
            // Assign to the user if possible
        })
        .select()
        .single();

    if (quoteErr) {
        console.error('Error creating quote:', quoteErr);
        // Try to fetch a tenant_id from existing quotes to reuse
        const { data: existingQuote } = await supabase.from('quotes').select('tenant_id').limit(1).single();
        if (existingQuote) {
             console.log(`Retrying with tenant_id: ${existingQuote.tenant_id}`);
             const { data: quoteRetry, error: retryErr } = await supabase.from('quotes').insert({
                tenant_id: existingQuote.tenant_id,
                quote_number: quoteNum,
                title: `E2E Multi-Leg Test Quote`,
                status: 'draft',
            }).select().single();
            
            if (retryErr) {
                console.error('Retry failed:', retryErr);
                return;
            }
            console.log('Quote created:', quoteRetry.id);
            await createQuoteContents(quoteRetry.id, quoteRetry.tenant_id, quoteNum);
        } else {
            return;
        }
    } else {
        console.log('Quote created:', quote.id);
        await createQuoteContents(quote.id, quote.tenant_id, quoteNum);
    }
}

async function createQuoteContents(quoteId: string, tenantId: string, quoteNum: string) {
    // 3. Create Quotation Version
    console.log('Creating Quotation Version...');
    const { data: version, error: verErr } = await supabase
        .from('quotation_versions')
        .insert({
            quote_id: quoteId,
            version_number: 1,
            is_current: true,
            tenant_id: tenantId
        })
        .select()
        .single();

    if (verErr) {
        console.error('Error creating version:', verErr);
        return;
    }
    console.log('Version created:', version.id);

    // 4. Create Multi-Leg Option
    console.log('Creating Quote Option...');
    const { data: option, error: optErr } = await supabase
        .from('quote_options')
        .insert({
            quote_version_id: version.id,
            is_primary: true,
            transport_mode: 'multi_modal', // or just leave it if it's derived
            tenant_id: tenantId,
            total_amount: 5000.00,
            currency: 'USD'
        })
        .select()
        .single();

    if (optErr) {
        console.error('Error creating option:', optErr);
        return;
    }
    console.log('Option created:', option.id);

    // 5. Create Legs (Truck -> Ocean -> Rail)
    console.log('Creating Legs...');
    
    // Fetch some ports/locations for realism
    const { data: ports } = await supabase.from('ports_locations').select('id, name').limit(5);
    const originId = ports?.[0]?.id;
    const trans1Id = ports?.[1]?.id;
    const trans2Id = ports?.[2]?.id;
    const destId = ports?.[3]?.id;

    const legsPayload = [
        {
            quote_option_id: option.id,
            sequence_number: 1,
            transport_mode: 'road',
            origin_location_id: originId,
            destination_location_id: trans1Id,
            tenant_id: tenantId
        },
        {
            quote_option_id: option.id,
            sequence_number: 2,
            transport_mode: 'ocean',
            origin_location_id: trans1Id,
            destination_location_id: trans2Id,
            tenant_id: tenantId
        },
        {
            quote_option_id: option.id,
            sequence_number: 3,
            transport_mode: 'rail',
            origin_location_id: trans2Id,
            destination_location_id: destId,
            tenant_id: tenantId
        }
    ];

    const { data: legs, error: legsErr } = await supabase
        .from('quote_option_legs')
        .insert(legsPayload)
        .select();

    if (legsErr) {
        console.error('Error creating legs:', legsErr);
        return;
    }
    console.log(`Created ${legs.length} legs.`);

    // 6. Verify Hydration (Simulate what the frontend does)
    console.log('Verifying Data Structure...');
    const { data: fetchedVersion, error: fetchErr } = await supabase
        .from('quotation_versions')
        .select(`
            *,
            quote_options (
                *,
                quote_option_legs (*)
            )
        `)
        .eq('id', version.id)
        .single();

    if (fetchErr) {
        console.error('Error fetching version:', fetchErr);
        return;
    }

    const fetchedOption = fetchedVersion.quote_options[0];
    const fetchedLegs = fetchedOption.quote_option_legs;
    
    if (fetchedLegs.length !== 3) {
        console.error('FAIL: Expected 3 legs, got', fetchedLegs.length);
    } else {
        console.log('SUCCESS: Hydration verified. Legs found:', fetchedLegs.length);
        fetchedLegs.forEach((l: any) => console.log(` - Leg ${l.sequence_number}: ${l.transport_mode}`));
    }

    // 7. Simulate Email Send
    console.log(`Sending Email to ${USER_EMAIL}...`);
    
    const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2>Quotation Ready: ${quoteId}</h2>
            <p>Your multi-leg quotation has been generated successfully.</p>
            <h3>Route Details:</h3>
            <ul>
                ${fetchedLegs.map((l: any) => {
                    const o = ports?.find(p => p.id === l.origin_location_id)?.name || 'Origin';
                    const d = ports?.find(p => p.id === l.destination_location_id)?.name || 'Dest';
                    return `<li><strong>${l.transport_mode.toUpperCase()}</strong>: ${o} &rarr; ${d}</li>`;
                }).join('')}
            </ul>
            <p><strong>Total Estimate: $${fetchedOption.total_amount} ${fetchedOption.currency}</strong></p>
            <p>Click <a href="#">here</a> to view the full quote.</p>
        </div>
    `;

    const { data: emailData, error: emailErr } = await supabase.functions.invoke('send-email', {
        body: {
            to: [USER_EMAIL],
            subject: `SOS Nexus Quote: ${quoteNum}`,
            html: emailHtml
        }
    });

    if (emailErr) {
        console.error('Error sending email:', emailErr);
    } else {
        console.log('Email sent successfully!', emailData);
    }
}

runE2ETest().catch(console.error);
