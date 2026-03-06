console.log("STARTING SCRIPT");
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL or SUPABASE_DB_URL');
  process.exit(1);
}

// Masked log
const masked = connectionString.replace(/:[^:@]+@/, ':****@');
console.log(`🔌 Connecting to: ${masked}`);

async function checkColumns(client, tableName) {
    const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY column_name;
    `, [tableName]);
    console.log(`📊 Columns in '${tableName}':`, res.rows.map(r => r.column_name).join(', '));
}

async function reloadSchema() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('✅ Connected.');
    
    console.log('🔄 Reloading schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('✅ Reload signal sent.');
    
    await checkColumns(client, 'quotes');
    
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

reloadSchema();
