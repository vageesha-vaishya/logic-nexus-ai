
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL in .env');
  process.exit(1);
}

async function verifyDashboardData() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. Get a user
    const userRes = await client.query('SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1');
    if (userRes.rows.length === 0) {
        console.log('No users found.');
        return;
    }
    const userId = userRes.rows[0].id;
    const userEmail = userRes.rows[0].email;
    console.log(`Verifying for user: ${userEmail} (${userId})`);

    // 2. Check quotes count for this user
    const quotesRes = await client.query('SELECT count(*) FROM quotes WHERE owner_id = $1', [userId]);
    const count = parseInt(quotesRes.rows[0].count);
    console.log(`User has ${count} quotes visible (owner_id match).`);

    // 3. Check if any quotes are still missing owner_id
    const nullOwnerRes = await client.query('SELECT count(*) FROM quotes WHERE owner_id IS NULL');
    const nullCount = parseInt(nullOwnerRes.rows[0].count);
    console.log(`Quotes with NULL owner_id: ${nullCount}`);

    if (count > 0 && nullCount === 0) {
        console.log('✅ Dashboard visibility check passed (data layer).');
    } else {
        console.log('❌ Dashboard visibility check failed or incomplete.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

verifyDashboardData();
