const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// Configuration - Set these before running!
const NEW_PROJECT_URL = process.env.NEW_SUPABASE_URL;
const NEW_SERVICE_KEY = process.env.NEW_SERVICE_ROLE_KEY;
const BACKUP_DIR = path.join(__dirname, '../migration_backup_20260127');

if (!NEW_PROJECT_URL || !NEW_SERVICE_KEY) {
  console.error('Error: NEW_SUPABASE_URL and NEW_SERVICE_ROLE_KEY environment variables are required.');
  console.error('Usage: NEW_SUPABASE_URL=... NEW_SERVICE_ROLE_KEY=... node scripts/master_migration.cjs');
  process.exit(1);
}

const supabase = createClient(NEW_PROJECT_URL, NEW_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// --- 1. Schema (Manual Instruction) ---
function printSchemaInstruction() {
  console.log('===================================================');
  console.log('STEP 1: DATABASE SCHEMA');
  console.log('We cannot automatically apply schema without direct DB access.');
  console.log('Please Copy content of: full_schema.sql');
  console.log('And run it in your New Project SQL Editor.');
  console.log('===================================================\n');
}

// --- 2. Auth Restoration ---
async function restoreAuth() {
  console.log('STEP 2: RESTORING AUTH USERS...');
  const usersPath = path.join(BACKUP_DIR, 'auth/users.json');
  if (!fs.existsSync(usersPath)) {
    console.log('No auth backup found. Skipping.');
    return;
  }
  
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  console.log(`Found ${users.length} users to restore.`);
  
  for (const user of users) {
    // Create user via Admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: 'TemporaryPassword123!', // Must set a password, user should reset
      email_confirm: true,
      user_metadata: user.user_metadata
    });
    
    if (error) {
      if (error.message.includes('already registered')) {
        console.log(`  - User ${user.email} already exists.`);
      } else {
        console.error(`  ✗ Failed to create ${user.email}:`, error.message);
      }
    } else {
      console.log(`  ✓ Created user ${user.email} (ID: ${data.user.id})`);
    }
  }
}

// --- 3. Storage Restoration ---
async function restoreStorage() {
  console.log('\nSTEP 3: RESTORING STORAGE BUCKETS...');
  const storageDir = path.join(BACKUP_DIR, 'storage');
  if (!fs.existsSync(storageDir)) return;
  
  const buckets = fs.readdirSync(storageDir);
  for (const bucketName of buckets) {
    const bucketPath = path.join(storageDir, bucketName);
    if (!fs.statSync(bucketPath).isDirectory()) continue;
    
    // Create bucket if not exists
    const { error: createError } = await supabase.storage.createBucket(bucketName, { public: false });
    if (createError && !createError.message.includes('already exists')) {
      console.error(`  ✗ Failed to create bucket ${bucketName}:`, createError.message);
      continue;
    }
    
    const files = fs.readdirSync(bucketPath);
    for (const fileName of files) {
      const filePath = path.join(bucketPath, fileName);
      const fileContent = fs.readFileSync(filePath);
      
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, fileContent, { upsert: true });
        
      if (uploadError) {
        console.error(`  ✗ Failed to upload ${fileName}:`, uploadError.message);
      } else {
        console.log(`  ✓ Uploaded ${bucketName}/${fileName}`);
      }
    }
  }
}

// --- 4. Data Restoration (CSV) ---
async function restoreData() {
  console.log('\nSTEP 4: RESTORING DATA TABLES...');
  const csvDir = path.join(BACKUP_DIR, 'csv');
  if (!fs.existsSync(csvDir)) {
      console.log('No csv directory found. Skipping.');
      return;
  }
  const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));
  
  for (const file of files) {
    const tableName = file.replace('.csv', '');
    console.log(`Processing ${tableName}...`);
    await uploadTable(tableName, path.join(csvDir, file));
  }
}

async function uploadTable(tableName, filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

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
    const values = line.split(',');
    const record = {};
    headers.forEach((h, i) => {
      let val = values[i];
      if (val && val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
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
        if (error.message.includes('does not exist')) {
            console.error(`  ✗ Batch Error ${tableName}: Table does not exist (Schema missing?)`);
        } else {
            console.error(`  ✗ Batch Error ${tableName}:`, error.message);
        }
    }
}

async function main() {
  printSchemaInstruction();
  
  await restoreAuth();
  await restoreStorage();
  await restoreData();
}

main().catch(console.error);
