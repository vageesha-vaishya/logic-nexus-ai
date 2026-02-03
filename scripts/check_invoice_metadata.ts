
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkInvoiceMetadata() {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*, invoice_line_items(*)')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching invoice:', error);
    return;
  }

  if (invoices && invoices.length > 0) {
    const invoice = invoices[0];
    console.log('Invoice ID:', invoice.id);
    console.log('Line Items:');
    invoice.invoice_line_items.forEach((item: any) => {
      console.log(`- Description: ${item.description}, Type: ${item.type}`);
      console.log('  Metadata:', JSON.stringify(item.metadata, null, 2));
    });
  } else {
    console.log('No invoices found.');
  }
}

checkInvoiceMetadata();
