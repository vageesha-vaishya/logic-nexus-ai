
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDebugQuote() {
  const quoteNumber = 'MGL-SYS-1770819021371';
  console.log(`Seeding quote: ${quoteNumber}`);

  // Check if it exists first
  const { data: existing } = await supabase
    .from('quotes')
    .select('id')
    .eq('quote_number', quoteNumber)
    .single();

  if (existing) {
    console.log('Quote already exists with ID:', existing.id);
    return;
  }

  // Create a new quote
  const { data: newQuote, error } = await supabase
    .from('quotes')
    .insert({
      quote_number: quoteNumber,
      title: 'Debug Quote MGL-SYS-1770819021371',
      status: 'draft',
      // Add other required fields based on schema knowledge or defaults
      // Assuming basic fields for now, might need more based on constraints
      service_id: null, // or a valid service ID
      service_type_id: null,
      origin_port_id: null,
      destination_port_id: null,
      account_id: null,
      contact_id: null,
      opportunity_id: null,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      pickup_date: new Date().toISOString(),
      delivery_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      incoterms: 'FOB',
      currency: 'USD',
      total_amount: 1500.00,
      sell_price: 1800.00,
      margin_percentage: 20.0,
      tenant_id: null // Assuming global or null tenant for now
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating quote:', error);
  } else {
    console.log('Successfully created quote:', newQuote);
    
    // Also create a version for it
    const { error: versionError } = await supabase
        .from('quotation_versions')
        .insert({
            quote_id: newQuote.id,
            version_number: 1,
            status: 'draft',
            total_amount: 1500.00,
            valid_until: newQuote.valid_until
        });
        
    if (versionError) {
        console.error('Error creating version:', versionError);
    } else {
        console.log('Created initial version.');
    }
  }
}

seedDebugQuote();
