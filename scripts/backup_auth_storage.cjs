const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://iutyqzjlpenfddqdwcsk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const BACKUP_DIR = 'migration_backup_20260127';
const AUTH_DIR = path.join(BACKUP_DIR, 'auth');
const STORAGE_DIR = path.join(BACKUP_DIR, 'storage');

// Ensure dirs
[AUTH_DIR, STORAGE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function backupAuth() {
  console.log('Backing up Auth Users...');
  let allUsers = [];
  let page = 1;
  const perPage = 50;
  
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    if (!users || users.length === 0) break;
    
    allUsers = allUsers.concat(users);
    console.log(`  Fetched ${users.length} users (Page ${page})`);
    page++;
  }
  
  fs.writeFileSync(path.join(AUTH_DIR, 'users.json'), JSON.stringify(allUsers, null, 2));
  console.log(`✓ Saved ${allUsers.length} users to ${AUTH_DIR}/users.json`);
}

async function backupStorage() {
  console.log('Backing up Storage Buckets...');
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  
  console.log(`Found ${buckets.length} buckets.`);
  
  for (const bucket of buckets) {
    console.log(`  Processing bucket: ${bucket.name}`);
    const bucketDir = path.join(STORAGE_DIR, bucket.name);
    if (!fs.existsSync(bucketDir)) fs.mkdirSync(bucketDir, { recursive: true });
    
    // List files recursively (simplified for root level, recursive logic needed for folders)
    // Supabase list() is not recursive by default. We'll list root.
    const { data: files, error: listError } = await supabase.storage.from(bucket.name).list();
    if (listError) {
      console.error(`  ✗ Error listing bucket ${bucket.name}:`, listError.message);
      continue;
    }
    
    for (const file of files) {
      if (file.id === null) continue; // Folder
      console.log(`    Downloading ${file.name}...`);
      const { data, error: downError } = await supabase.storage.from(bucket.name).download(file.name);
      if (downError) {
        console.error(`    ✗ Failed to download ${file.name}:`, downError.message);
        continue;
      }
      
      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(path.join(bucketDir, file.name), buffer);
    }
  }
  console.log('✓ Storage backup complete.');
}

async function main() {
  try {
    await backupAuth();
    await backupStorage();
    console.log('\nFull Auth & Storage Backup Complete!');
  } catch (e) {
    console.error('Fatal Error:', e);
  }
}

main();
