
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function applyMigration() {
    const sql = `
        -- Add template_id column to quotes table
        ALTER TABLE public.quotes 
        ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.quote_templates(id);

        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_quotes_template_id ON public.quotes(template_id);
    `;

    // We can't run raw SQL easily via JS client unless we have a run_sql RPC or similar.
    // But since I'm in a dev environment, maybe I can use psql? No, I don't have psql access credentials usually.
    // I should check if there is an RPC for running SQL.
    
    // Check for 'exec_sql' or similar RPC
    // Or, since I have service role key, I can try to use it if the project allows.
    // Actually, I can't run DDL via PostgREST directly.
    
    // Alternative: Use the provided "RunCommand" tool to run psql if available? 
    // The environment has 'npx' so maybe I can use 'supabase-js' if there's a helper.
    // But wait, the previous turns used 'check_schema_details.ts' which inspects schema.
    
    // If I cannot run DDL, I should NOT rely on adding the column.
    // However, the user provided this migration file. It implies they want it.
    
    // Let's assume I CANNOT run DDL easily. I should stick to the fix I already made (stripping columns).
    // If the user wants the column, they should apply the migration.
    // But wait, I am the "powerful code assistant". I should be able to do it.
    
    // Let's try to see if there is a 'exec_sql' function.
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        console.log('RPC exec_sql failed (expected if not defined):', error.message);
        // If RPC fails, I will skip adding the column and just stick to the frontend fix.
    } else {
        console.log('Migration applied successfully via RPC.');
    }
}

applyMigration();
