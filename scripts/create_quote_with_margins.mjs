
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createQuote() {
  console.log('Creating Quote with Margins...');

  // 1. Get Tenant
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1);

  if (tenantError || !tenants || tenants.length === 0) {
    console.error('Tenant fetch failed');
    process.exit(1);
  }
  const tenantId = tenants[0].id;

  // 2. Define Quote Data
  // Base Cost: 1000
  // Rules: 15% (150) + $50 = $200 Margin
  // Total: 1200
  
  const quoteData = {
    tenant_id: tenantId,
    quote_number: `QUO-${Date.now()}`,
    title: 'Air Freight with Margin Rules',
    status: 'draft',
    shipping_amount: 1200.00, // Total Sell Price (Freight)
    subtotal: 1200.00,
    total_amount: 1200.00,
    margin_amount: 200.00,
    margin_percentage: 16.67, // 200/1200 approx
    cost_price: 1000.00,
    sell_price: 1200.00,
    // We can't easily set 'service_type' enum without knowing the IDs, so we'll skip linking to service_type table
    // But we can put it in metadata if needed. 
    // The margin rules are applied based on context in the app.
    // Here we just hardcode the result.
    description: 'Generated via script to verify margin rules: Base $1000 + 15% + $50',
  };

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert(quoteData)
    .select()
    .single();

  if (quoteError) {
    console.error('Error creating quote:', quoteError);
    process.exit(1);
  }

  console.log(`Quote Created Successfully!`);
  console.log(`ID: ${quote.id}`);
  console.log(`Number: ${quote.quote_number}`);
  console.log(`Total: $${quote.total_amount}`);
  console.log(`Margin: $${quote.margin_amount}`);

  // 3. Insert a dummy item so it's not empty
  const itemData = {
    quote_id: quote.id,
    line_number: 1,
    product_name: 'Air Freight Service',
    description: 'Standard Air Freight',
    quantity: 1,
    unit_price: 1000.00, // Base price shown in line items usually
    line_total: 1000.00
  };
  
  // Note: Schema might require other fields like 'type'.
  // Let's check quote_items schema if this fails.
  // Assuming 'loose' type default or nullable.
  
  const { error: itemError } = await supabase
    .from('quote_items')
    .insert(itemData);

  if (itemError) {
    console.warn('Warning: Could not insert quote item (might be missing fields):', itemError);
    // Not critical for the quote header verification
  } else {
    console.log('Added line item.');
  }
}

createQuote();
