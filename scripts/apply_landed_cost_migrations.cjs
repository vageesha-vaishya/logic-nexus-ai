
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envMigrationPath = path.join(__dirname, '../.env.migration');
if (fs.existsSync(envMigrationPath)) {
    dotenv.config({ path: envMigrationPath });
} else {
    dotenv.config();
}

let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL');
  process.exit(1);
}

const MIGRATIONS = [
    '../supabase/migrations/20260207160000_enhance_landed_cost_engine.sql',
    '../supabase/migrations/20260207162000_fix_landed_cost_record_error.sql',
    '../supabase/migrations/20260207183000_fix_invoice_fees_aggregation.sql',
    '../supabase/migrations/20260207190000_enhance_duty_metadata.sql',
    '../supabase/migrations/20260207233000_enhance_invoice_fees.sql',
    '../supabase/migrations/20260208000000_fix_duty_calculation_service_type.sql',
    '../supabase/migrations/20260208140000_ensure_invoice_duty_metadata.sql',
    '../supabase/migrations/20260209150000_landed_cost_engine.sql',
    '../supabase/migrations/20260209151000_landed_cost_rpc.sql'
];

async function applyMigrations() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('Connected.');
    
    for (const file of MIGRATIONS) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`Applying ${file}...`);
            const sql = fs.readFileSync(filePath, 'utf8');
            await client.query(sql);
            console.log(`Success: ${file}`);
        } else {
            console.warn(`File not found, skipping: ${filePath}`);
        }
    }
    
    console.log('All landed cost migrations applied successfully.');
    
  } catch (err) {
    console.error('Error applying migrations:', err);
  } finally {
    await client.end();
  }
}

applyMigrations();
