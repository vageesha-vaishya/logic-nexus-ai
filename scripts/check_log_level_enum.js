import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const targetUrl = process.env.SUPABASE_DB_URL || process.env.TARGET_DB_URL || process.env.VITE_SUPABASE_URL; // Note: VITE_SUPABASE_URL is API URL, not DB URL. Need DB URL.

// Usually DB URL is in .env as SUPABASE_DB_URL or DATABASE_URL
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
    console.error("No database URL found in env vars (SUPABASE_DB_URL or DATABASE_URL).");
    process.exit(1);
}

const client = new Client({ connectionString: dbUrl });

async function main() {
    try {
        await client.connect();
        console.log("Connected to DB.");

        const res = await client.query("SELECT unnest(enum_range(NULL::public.log_level)) as level");
        const levels = res.rows.map(r => r.level);
        console.log("Current log_level values:", levels);

        if (levels.includes('FATAL')) {
            console.log("SUCCESS: FATAL level exists.");
        } else {
            console.log("FAILURE: FATAL level is MISSING.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

main();
