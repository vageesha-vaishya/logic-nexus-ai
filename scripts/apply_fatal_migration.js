import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
    console.error("No database URL found.");
    process.exit(1);
}

const client = new Client({ connectionString: dbUrl });

async function main() {
    try {
        await client.connect();
        console.log("Connected to DB.");

        console.log("Applying FATAL log level...");
        await client.query("ALTER TYPE public.log_level ADD VALUE IF NOT EXISTS 'FATAL' AFTER 'CRITICAL';");
        console.log("SUCCESS: Applied FATAL log level.");

    } catch (err) {
        console.error("Error applying migration:", err);
    } finally {
        await client.end();
    }
}

main();
