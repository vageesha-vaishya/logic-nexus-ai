
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function applyMigration() {
    const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
    try {
        await client.connect();
        console.log('✅ Connected to DB');

        const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260219020000_email_phase2_threat_detection.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log(`Applying migration: ${path.basename(migrationPath)}`);
        await client.query(sql);
        console.log('✅ Migration applied successfully.');

    } catch (err) {
        console.error('❌ Error applying migration:', err);
    } finally {
        await client.end();
    }
}

applyMigration();
