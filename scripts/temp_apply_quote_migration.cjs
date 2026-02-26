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

const migrationFile = '/Users/vims/Downloads/Development Projects/Trae/SOS Logistics Pro/logic-nexus-ai/supabase/migrations/20260226120000_quote_numbering_rpc.sql';

if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

async function applyMigration() {
  console.log('Applying migration via RPC...');
  
  // Try to use execute_sql_query if available
  const { data, error } = await supabase.rpc('execute_sql_query', {
    sql_query: migrationSQL
  });

  if (error) {
    console.error('Error executing migration:', error);
    process.exit(1);
  }

  console.log('Migration applied successfully:', data);
}

applyMigration();
