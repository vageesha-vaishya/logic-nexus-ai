
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL in .env');
  process.exit(1);
}

async function checkNullOwners() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query('SELECT count(*) FROM quotes WHERE owner_id IS NULL');
    console.log(`Quotes with NULL owner_id: ${res.rows[0].count}`);
    
    if (parseInt(res.rows[0].count) > 0) {
        console.log('Fixing NULL owner_ids...');
        
        // Find a valid user
        const userRes = await client.query('SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1');
        if (userRes.rows.length > 0) {
            const userId = userRes.rows[0].id;
            const userEmail = userRes.rows[0].email;
            console.log(`Assigning ${res.rows[0].count} quotes to user ${userEmail} (${userId})`);
            
            await client.query('UPDATE quotes SET owner_id = $1, created_by = $1 WHERE owner_id IS NULL', [userId]);
            console.log('Updated quotes successfully.');
        } else {
            console.log('No users found in auth.users. Cannot fix owner_id.');
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkNullOwners();
