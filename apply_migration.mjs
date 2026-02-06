import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIRECT_URL = 'postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function applyMigration() {
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260216160000_add_container_fields_to_quote_items.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log(`Connecting to ${DIRECT_URL.replace(/:[^:]*@/, ':****@')}...`);
    const client = new Client({
        connectionString: DIRECT_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected.');
        console.log(`Applying migration: ${path.basename(migrationPath)}`);
        
        // Split by semicolon if needed? Usually pg client can handle multiple statements if they are valid SQL blocks.
        // But BEGIN; ... COMMIT; block should be fine as a single query.
        await client.query(sql);
        
        console.log('✅ Migration applied successfully.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await client.end();
    }
}

applyMigration();
