const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

// Config
const PROJECT_URL = process.env.VITE_SUPABASE_URL || 'https://iutyqzjlpenfddqdwcsk.supabase.co';
const ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const OUTPUT_DIR = 'migration_backup_20260127/csv';

if (!ANON_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY environment variable is required.');
  process.exit(1);
}

// Ensure output dir
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function fetchSwagger() {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    };
    https.get(`${PROJECT_URL}/rest/v1/`, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function downloadTable(tableName) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Accept': 'text/csv'
      }
    };
    const file = fs.createWriteStream(path.join(OUTPUT_DIR, `${tableName}.csv`));
    https.get(`${PROJECT_URL}/rest/v1/${tableName}?select=*`, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${tableName}: Status ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded ${tableName}.csv`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(path.join(OUTPUT_DIR, `${tableName}.csv`), () => {});
      reject(err);
    });
  });
}

async function main() {
  try {
    console.log('Fetching database schema from REST API...');
    const swagger = await fetchSwagger();
    const definitions = swagger.definitions || {};
    
    const tables = Object.keys(definitions).filter(key => {
      // Filter out weird definitions if any, usually table names are direct keys
      return !key.includes('.'); // Simple heuristic, adjust if needed
    });

    console.log(`Found ${tables.length} tables. Starting download...`);
    
    for (const table of tables) {
      try {
        await downloadTable(table);
      } catch (e) {
        console.error(`✗ Error downloading ${table}: ${e.message}`);
      }
    }
    
    console.log('\nBackup complete! Files saved to:', OUTPUT_DIR);
  } catch (e) {
    console.error('Fatal Error:', e.message);
  }
}

main();
