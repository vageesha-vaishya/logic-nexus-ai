
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
function loadEnv() {
  const envFiles = ['.env', '.env.local'];
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
          process.env[key] = value;
        }
      });
    }
  }
}
loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Role Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Applying migration to rename carrier_rates.customer_id to account_id...');

  const sql = `
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'carrier_rates' AND column_name = 'customer_id'
        ) THEN
            ALTER TABLE public.carrier_rates RENAME COLUMN customer_id TO account_id;
            RAISE NOTICE 'Renamed customer_id to account_id in carrier_rates';
        ELSE
            RAISE NOTICE 'Column customer_id not found in carrier_rates or already renamed';
        END IF;
    END $$;
  `;

  const { data, error } = await supabase.rpc('execute_sql_query', {
    query_text: sql
  });

  if (error) {
    console.error('Error applying migration:', error);
  } else {
    console.log('Migration applied successfully.');
  }
  
  // Verify
  const verifySql = "SELECT column_name FROM information_schema.columns WHERE table_name = 'carrier_rates' AND column_name = 'account_id'";
  const { data: verifyData, error: verifyError } = await supabase.rpc('execute_sql_query', {
    query_text: verifySql
  });
  
  if (verifyError) {
      console.error('Verification failed:', verifyError);
  } else {
      console.log('Verification result:', verifyData);
      if (verifyData && verifyData.length > 0) {
          console.log('SUCCESS: account_id column exists in carrier_rates.');
      } else {
          console.log('WARNING: account_id column NOT found in carrier_rates.');
      }
  }
}

applyMigration();
