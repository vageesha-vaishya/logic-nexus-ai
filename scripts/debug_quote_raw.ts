
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectQuoteRaw() {
  // Get the most recent quote
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('id, quote_number, service_type_id, service_id, origin_port_id, destination_port_id, pickup_date, delivery_deadline')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching quote:', error);
    return;
  }

  console.log('Raw Quote Data:', JSON.stringify(quote, null, 2));
}

inspectQuoteRaw();
