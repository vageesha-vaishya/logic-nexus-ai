
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const { Client } = pg;

async function main() {
    const client = new Client({
        connectionString: process.env.SUPABASE_DB_URL,
    });

    try {
        await client.connect();
        console.log('Connected to DB');

        const tables = ['queue_rules', 'queue_members', 'queues'];
        
        for (const table of tables) {
            const res = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            
            console.log(`\nTable: ${table}`);
            if (res.rows.length === 0) {
                console.log('  (Table does not exist)');
            } else {
                res.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

main();
