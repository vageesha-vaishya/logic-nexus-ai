
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrationFile = path.join(__dirname, '../supabase/migrations/20260218100000_add_vessel_info_to_shipments.sql');

if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

async function applyMigration() {
  console.log('Applying migration via RPC...');
  
  // Try to use execute_sql_query if available (common helper in some setups)
  // Or exec_sql, or similar.
  // If not, we can't apply via RPC unless we have a specific function.
  
  // Let's assume 'execute_sql_query' exists as per previous context/todos.
  const { data, error } = await supabase.rpc('execute_sql_query', {
    sql_query: migrationSQL
  });

  if (error) {
    console.error('Error executing migration:', error);
    
    // Fallback: Check if function exists
    if (error.code === '42883') { // undefined_function
        console.error("RPC function 'execute_sql_query' not found. Please apply migration manually or ensure the helper function exists.");
    }
    process.exit(1);
  }

  console.log('Migration applied successfully:', data);
}

applyMigration();
