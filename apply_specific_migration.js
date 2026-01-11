import pg from 'pg';
import fs from 'fs';
import path from 'path';

function getConnectionString() {
  try {
    const envPath = path.join(process.cwd(), '.env.migration');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const poolerMatch = envContent.match(/SUPABASE_POOLER_URL=(.+)/);
      const dbMatch = envContent.match(/SUPABASE_DB_URL=(.+)/);
      
      // Prioritize Pooler URL
      const connectionString = poolerMatch ? poolerMatch[1] : (dbMatch ? dbMatch[1] : null);
      if (connectionString) {
        return connectionString.trim().replace(/['"]/g, '');
      }
    }
  } catch (e) {
    console.error('Failed to read .env.migration', e);
  }
  return null;
}

const connectionString = getConnectionString();

if (!connectionString) {
  console.error('No connection string found in .env.migration');
  process.exit(1);
}

console.log(`Using connection string: ${connectionString.replace(/:([^:@]+)@/, ':****@')}`);

// Use connection string but force SSL settings
const client = new pg.Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected to database.');

    const files = [
      'supabase/migrations/20260115_fix_dashboard_preferences_access.sql',
      'supabase/migrations/20260115_strict_rls_override.sql'
    ];

    for (const file of files) {
      console.log(`Applying ${file}...`);
      if (fs.existsSync(file)) {
          const sql = fs.readFileSync(file, 'utf8');
          await client.query(sql);
          console.log(`Successfully applied ${file}`);
      } else {
          console.error(`File not found: ${file}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();