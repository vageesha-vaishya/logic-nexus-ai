
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
            AND column_name = 'requires_mfa';
        `);
        
        if (columnsRes.rows.length > 0) {
             console.log('✅ Column requires_mfa exists in email_account_delegations.');
        } else {
             console.error('❌ Column requires_mfa missing in email_account_delegations.');
        }
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkPhase1State();
