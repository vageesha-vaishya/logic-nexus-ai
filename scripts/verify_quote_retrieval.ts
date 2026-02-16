
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyQuoteRetrieval(quoteId: string) {
    if (!quoteId) {
        console.log('No quote ID provided. Listing recent quotes...');
        const { data: quotes, error } = await supabase
            .from('quotes')
            .select('id, title, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) {
            console.error('Error listing quotes:', error);
            return;
        }
        
        console.log('Recent Quotes:');
        quotes.forEach(q => console.log(`- ${q.title} (ID: ${q.id})`));
        console.log('\nPlease provide a quote ID to verify details.');
        return;
    }

    console.log(`Verifying retrieval for quote: ${quoteId}`);

    // 1. Fetch Raw Quote Data
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

    if (quoteError) {
        console.error('Error fetching quote:', quoteError);
        return;
    }

    console.log('--- Database Record ---');
    console.log('ID:', quote.id);
    console.log('Title:', quote.title);
    console.log('Pickup Date (DB):', quote.pickup_date);
    console.log('Ready Date (DB):', quote.ready_date);
    console.log('Delivery Deadline (DB):', quote.delivery_deadline);
    console.log('Valid Until (DB):', quote.valid_until);
    console.log('Tenant ID:', quote.tenant_id);
    console.log('Status:', quote.status);
    if (quote.service_type_id) {
        console.log(`Service Type ID: ${quote.service_type_id}`);
        // Check if this service type exists/is visible
        const { data: serviceType, error: stError } = await supabase
            .from('service_types')
            .select('id, name, code')
            .eq('id', quote.service_type_id)
            .maybeSingle();
            
        if (stError) {
             console.log(`Error fetching service type: ${stError.message}`);
        } else if (serviceType) {
             console.log(`Service Type Found: ${serviceType.name} (${serviceType.code})`);
        } else {
             console.log(`Service Type NOT FOUND or not visible to this user.`);
        }
    } else {
        console.log(`Service Type ID: null`);
    }

    // List all visible service types
    const { data: allServiceTypes, error: allStError } = await supabase
        .from('service_types')
        .select('id, name, code')
        .eq('is_active', true);
        
    if (allStError) {
        console.log(`Error listing all service types: ${allStError.message}`);
    } else {
        console.log(`Visible Service Types Count: ${allServiceTypes?.length || 0}`);
    }

    // 2. Fetch Options/Versions
    const { data: versions, error: versionsError } = await supabase
        .from('quotation_versions')
        .select(`
            id, 
            version_number,
            quotation_version_options (
                id,
                total_amount,
                quotation_version_option_legs (
                    id,
                    mode,
                    origin_location,
                    destination_location
                )
            )
        `)
        .eq('quote_id', quoteId)
        .order('version_number', { ascending: false })
        .limit(1);

    if (versionsError) {
        console.error('Error fetching versions:', versionsError);
    } else {
        console.log('--- Latest Version ---');
        if (versions && versions.length > 0) {
            const latest = versions[0];
            console.log('Version Number:', latest.version_number);
            console.log('Options Count:', latest.quotation_version_options?.length);
            latest.quotation_version_options?.forEach((opt: any, idx: number) => {
                console.log(`  Option ${idx + 1}: Total=${opt.total_amount}, Legs=${opt.quotation_version_option_legs?.length}`);
            });
        } else {
            console.log('No versions found.');
        }
    }
}

// Check for ID argument
const args = process.argv.slice(2);
const targetId = args[0] || '';

verifyQuoteRetrieval(targetId);
