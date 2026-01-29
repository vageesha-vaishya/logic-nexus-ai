
const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

async function verifyMigration() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    
    const tables = [
      'tax_jurisdictions',
      'tax_codes',
      'tax_rules',
      'invoices',
      'invoice_items',
      'gl_accounts',
      'journal_entries'
    ];

    console.log('Verifying tables in finance schema...');
    
    for (const table of tables) {
      const res = await client.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'finance' AND table_name = $1)",
        [table]
      );
      
      const exists = res.rows[0].exists;
      console.log(`Table finance.${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
    }

  } catch (err) {
    console.error('Error verifying migration:', err);
  } finally {
    await client.end();
  }
}

verifyMigration();
