
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  console.log('Listing tables...');
  
  // This query might fail if we don't have permissions to information_schema
  // but let's try. Alternatively we can just try to select from known tables.
  
  const { data, error } = await supabase
    .rpc('get_tables'); // Assuming a helper function exists, if not we might need another way.
    
  // Since we can't easily list tables without a specific RPC or direct SQL access,
  // let's try to search in 'quotes' table across multiple columns.
  
  const quoteNumber = 'MGL-SYS-1770819021371';
  console.log(`Searching for ${quoteNumber} in quotes table columns...`);
  
  // columns to check: id, quote_number, reference_id, external_id, title, description
  const columns = ['id', 'quote_number', 'reference_id', 'external_id', 'title', 'description']; // Adjust based on schema knowledge
  
  // We need to know the schema first. Let's try to get one row from quotes and see keys.
  const { data: oneQuote } = await supabase.from('quotes').select('*').limit(1);
  if (oneQuote && oneQuote.length > 0) {
      console.log('Quote table columns:', Object.keys(oneQuote[0]));
      const keys = Object.keys(oneQuote[0]);
      
      for (const key of keys) {
          const { data: result, error } = await supabase
            .from('quotes')
            .select('*')
            .ilike(key, `%${quoteNumber}%`); // ilike needs text cast often, but let's try.
            
          if (result && result.length > 0) {
              console.log(`Found match in column ${key}:`, result[0]);
          }
      }
  } else {
      console.log('No quotes found to inspect schema.');
  }

}

listTables();
