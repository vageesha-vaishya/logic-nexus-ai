import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIRECT_URL = 'postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function applyMigration() {
    // Correct path relative to scripts/ directory
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260210150000_fix_reference_data_policies.sql');
    
    if (!fs.existsSync(migrationPath)) {
        console.error(`Migration file not found at: ${migrationPath}`);
        process.exit(1);
    }

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
        
        await client.query(sql);
        
        console.log('✅ Migration applied successfully.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await client.end();
    }
}

applyMigration();
