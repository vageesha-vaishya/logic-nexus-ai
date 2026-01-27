const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// Configuration - Set these before running!
const NEW_PROJECT_URL = process.env.NEW_SUPABASE_URL;
const NEW_SERVICE_KEY = process.env.NEW_SERVICE_ROLE_KEY;
const BACKUP_DIR = path.join(__dirname, '../migration_backup_20260127/csv');

if (!NEW_PROJECT_URL || !NEW_SERVICE_KEY) {
  console.error('Error: NEW_SUPABASE_URL and NEW_SERVICE_ROLE_KEY environment variables are required.');
  process.exit(1);
}

const supabase = createClient(NEW_PROJECT_URL, NEW_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function restoreData() {
  console.log('\nSTEP 4: RESTORING DATA TABLES...');
  if (!fs.existsSync(BACKUP_DIR)) {
      console.error(`Backup directory not found: ${BACKUP_DIR}`);
      return;
  }

  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.csv'));
  
  for (const file of files) {
    const tableName = file.replace('.csv', '');
    console.log(`Processing ${tableName}...`);
    await uploadTable(tableName, path.join(BACKUP_DIR, file));
  }
}

async function uploadTable(tableName, filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let headers = [];
  let batch = [];
  let isFirstLine = true;
  const BATCH_SIZE = 100;

  for await (const line of rl) {
    if (isFirstLine) {
      headers = line.split(',');
      isFirstLine = false;
      continue;
    }
    
    // Simple CSV parsing (matches the export format)
    // Note: This split matches the export format where values are comma-separated
    // and strings are quoted if needed. It's not a full CSV parser but works for our export.
    const values = line.split(',');
    const record = {};
    
    headers.forEach((h, i) => {
      let val = values[i];
      // Remove quotes if present
      if (val && val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      // Handle NULLs or empty strings if necessary
      if (val === '') val = null; 
      
      record[h] = val;
    });
    
    batch.push(record);

    if (batch.length >= BATCH_SIZE) {
      await postBatch(tableName, batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await postBatch(tableName, batch);
  }
}

async function postBatch(tableName, data) {
    const { error } = await supabase.from(tableName).upsert(data);
    if (error) {
        // Ignore "relation does not exist" errors if schema is missing, but log others
        if (error.message.includes('does not exist')) {
            console.error(`  ✗ Batch Error ${tableName}: Table does not exist (Schema missing?)`);
        } else {
            console.error(`  ✗ Batch Error ${tableName}:`, error.message);
        }
    }
}

restoreData().catch(console.error);
