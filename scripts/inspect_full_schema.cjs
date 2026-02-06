const { Client } = require('pg');

const databases = [
  {
    name: 'Enterprise (from .env)',
    url: 'postgresql://postgres.iutyqzjlpenfddqdwcsk:%23!January%232026!@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
  },
  {
    name: 'Migration (from .env.migration)',
    url: 'postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
  }
];

async function inspect(db) {
  console.log(`\n--- Connecting to ${db.name} ---`);
  const client = new Client({
    connectionString: db.url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected.');
    
    const tables = ['aes_hts_codes', 'margin_rules', 'cargo_simulations'];
    
    for (const table of tables) {
        console.log(`\nChecking table: ${table}`);
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1
            ORDER BY ordinal_position;
        `, [table]);
        
        if (res.rows.length === 0) {
            console.log(`Table ${table} does not exist or has no columns.`);
        } else {
            console.log(`Table ${table} exists with ${res.rows.length} columns.`);
            // console.table(res.rows); // Too verbose, just listing names
            console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
        }
    }
    
  } catch (err) {
    console.error(`Error connecting/querying ${db.name}:`, err.message);
  } finally {
    await client.end();
  }
}

async function run() {
  for (const db of databases) {
    await inspect(db);
  }
}

run();
