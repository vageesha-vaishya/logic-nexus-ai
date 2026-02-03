
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkColumns() {
  const table = process.argv[2] || 'quote_items';
  console.log('Checking table:', table);
  
  // Try to insert a dummy row to get column error, or just select * limit 0
  const { data, error } = await supabase.from(table).select('*').limit(0);
  
  if (error) {
      console.log('Error accessing table:', error.message);
      return;
  }
  console.log('Columns likely valid (based on empty select success).');
  // Since we can't easily get schema via PostgREST without specific setup, 
  // we'll try to get one row if it exists.
  const { data: rows } = await supabase.from(table).select('*').limit(1);
  if (rows && rows.length > 0) {
      console.log('Columns from row:', Object.keys(rows[0]));
  } else {
      console.log('Table is empty, cannot infer columns from data.');
  }
}

checkColumns();
