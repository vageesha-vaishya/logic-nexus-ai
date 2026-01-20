
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load env
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
      // Try finding it in root
      const rootEnv = path.resolve(__dirname, '../.env'); 
      if (fs.existsSync(rootEnv)) return parseEnv(rootEnv);
      return {};
  }
  return parseEnv(envPath);
}

function parseEnv(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            result[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
        }
    });
    return result;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY; // Must use service key to invoke function

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
    console.log("Reading migration file...");
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260119_create_email_sync_logs.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split by statement if needed, or pass as one block?
    // execute-sql-external might execute strictly one query or allow multiple.
    // It accepts `statements: string[]`.
    
    // Simple split by ';' might be fragile but sufficient for this file.
    // The file has CREATE TABLE, ALTER TABLE, CREATE POLICY.
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    console.log(`Found ${statements.length} statements.`);

    console.log("Invoking execute-sql-external...");
    
    // Invoke using Service Role Key in Authorization header
    const { data, error } = await supabase.functions.invoke('execute-sql-external', {
        body: {
            action: 'execute',
            useLocalDb: true,
            statements: statements
        }
    });

    if (error) {
        console.error("Error invoking function:", error);
        // Fallback: Print instructions
        console.log("\nFailed to run migration automatically.");
        console.log("Please run the following SQL manually in Supabase Dashboard:");
        console.log(sql);
    } else {
        console.log("Migration result:", data);
        if (data.success) {
            console.log("✅ Successfully created email_sync_logs table.");
        } else {
            console.error("❌ Migration failed:", data.message);
            if (data.details && data.details.errors) {
                data.details.errors.forEach(e => console.error(`Statement ${e.index}: ${e.error}`));
            }
        }
    }
}

run().catch(console.error);
