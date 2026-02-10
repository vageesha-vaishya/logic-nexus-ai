
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260210150000_fix_reference_data_policies.sql');
    
    if (!fs.existsSync(migrationPath)) {
        console.error("Migration file not found:", migrationPath);
        // Try to find it in the current dir if path resolve failed
        const altPath = 'supabase/migrations/20260210150000_fix_reference_data_policies.sql';
        if (fs.existsSync(altPath)) {
             console.log("Found at relative path");
             const sql = fs.readFileSync(altPath, 'utf8');
             await runSql(sql);
             return;
        }
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    await runSql(sql);
}

async function runSql(sql: string) {
    console.log("Applying migration...");
    // Split by statement if needed, but Postgres exec can often handle multiple.
    // Supabase JS client doesn't have a direct 'query' method for raw SQL unless via RPC.
    // BUT we can use the 'pg' library if available, OR use a custom RPC 'exec_sql' if it exists.
    // Many Supabase projects add an 'exec_sql' or 'exec' function for this purpose.
    
    // Let's try to check if 'exec_sql' exists.
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql });
    
    if (rpcError) {
        console.error("RPC exec_sql failed (maybe function doesn't exist):", rpcError.message);
        console.log("Attempting to use direct connection via pg is not possible without connection string.");
        console.log("Please define 'exec_sql' RPC function in your database to run raw migrations via this script.");
        
        // Fallback: If we can't run SQL, we must rely on the user or the 'supabase db push' if environment allows.
        // Or we can try to create the function if we can. But we can't create it without running SQL! Chicken and egg.
        
        // However, I can try to use the 'pg' driver if it's installed in node_modules.
        // Let's check package.json.
    } else {
        console.log("Migration applied successfully via RPC!");
    }
}

applyMigration();
