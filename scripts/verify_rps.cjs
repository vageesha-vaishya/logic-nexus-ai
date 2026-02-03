
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envMigrationPath = path.join(__dirname, '../.env.migration');
if (fs.existsSync(envMigrationPath)) {
    dotenv.config({ path: envMigrationPath });
} else {
    dotenv.config();
}

let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL');
  process.exit(1);
}

async function verifyRPS() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('Connected.');
    
    // 1. Verify Tables Exist
    const tablesRes = await client.query(`
       SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_name IN ('restricted_party_lists', 'compliance_screenings');
    `);
    console.log('Tables found:', tablesRes.rows.map(r => r.table_name));
    
    // 2. Verify Seed Data
    const seedRes = await client.query(`
        SELECT source_list, entity_name, country_code 
        FROM public.restricted_party_lists 
        LIMIT 5;
    `);
    console.log('Seed Data Sample:', seedRes.rows);
    
    // 2.5 Debug Similarity
    console.log('Debugging Similarity...');
    const debugRes = await client.query(`
        SELECT entity_name, similarity(entity_name, 'Huawei') as sim, word_similarity('Huawei', entity_name) as word_sim
        FROM public.restricted_party_lists 
        WHERE country_code = 'CN';
    `);
    console.log('Similarity Scores:', debugRes.rows);

    // 3. Test Screening RPC (should find Huawei)
    console.log('Testing screen_restricted_party RPC with "Huawei"...');
    const rpcRes1 = await client.query(`
        SELECT * FROM public.screen_restricted_party('Huawei', 'CN', 0.4);
    `);
    console.log('Huawei Search Result:', rpcRes1.rows);
    
    // 4. Test Screening RPC with mismatch
    console.log('Testing screen_restricted_party RPC with "Random Innocent Guy"...');
    const rpcRes2 = await client.query(`
        SELECT * FROM public.screen_restricted_party('Random Innocent Guy', 'US');
    `);
    console.log('Random Guy Search Result:', rpcRes2.rows);
    
  } catch (err) {
    console.error('Error verifying RPS:', err);
  } finally {
    await client.end();
  }
}

verifyRPS();
