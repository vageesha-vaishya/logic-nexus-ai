
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkPhase1State() {
    const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
    try {
        await client.connect();
        console.log('Connected to DB');

        // Check tenant_domains table
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'tenant_domains';
        `);
        
        if (tablesRes.rows.length > 0) {
            console.log('✅ Table tenant_domains exists.');
        } else {
            console.error('❌ Table tenant_domains DOES NOT exist.');
        }

        // Check email_account_delegations columns
        const columnsRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'email_account_delegations'
            AND column_name IN ('require_mfa', 'allowed_ip_ranges');
        `);
        
        const foundCols = columnsRes.rows.map(r => r.column_name);
        if (foundCols.includes('require_mfa') && foundCols.includes('allowed_ip_ranges')) {
             console.log('✅ Columns require_mfa and allowed_ip_ranges exist in email_account_delegations.');
        } else {
             console.error(`❌ Missing columns in email_account_delegations. Found: ${foundCols.join(', ')}`);
        }
        
        // Check migration record
        const migRes = await client.query(`
            SELECT version, name, applied_at FROM supabase_migrations WHERE version = '20260219010000';
        `);
        if (migRes.rows.length > 0) {
            console.log(`✅ Migration 20260219010000 is recorded as applied at ${migRes.rows[0].applied_at}`);
        } else {
            console.log('⚠️ Migration 20260219010000 is NOT recorded in supabase_migrations.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkPhase1State();
