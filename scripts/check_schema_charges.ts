
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking tables...');
  
  // Check quotation_version_options columns
  const { data: qvo, error: qvoError } = await supabase
    .from('quotation_version_options')
    .select('*')
    .limit(1);
    
  if (qvoError) console.error('Error fetching quotation_version_options:', qvoError);
  else console.log('quotation_version_options columns:', qvo && qvo.length > 0 ? Object.keys(qvo[0]) : 'No data');

  // Check quote_charges columns
  const { data: qc, error: qcError } = await supabase
    .from('quote_charges')
    .select('*')
    .limit(1);
    
  if (qcError) console.error('Error fetching quote_charges:', qcError);
  else console.log('quote_charges columns:', qc && qc.length > 0 ? Object.keys(qc[0]) : 'No data');

  // Check if there is a quotation_version_option_charges table
  const { error: qvocError } = await supabase
    .from('quotation_version_option_charges')
    .select('*')
    .limit(1);
    
  if (qvocError) console.log('quotation_version_option_charges table likely does not exist or error:', qvocError.message);
  else console.log('quotation_version_option_charges table exists.');
}

checkSchema();
