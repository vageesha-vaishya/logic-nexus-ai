const dns = require('dns');
const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function resolveHost(host) {
  return new Promise((resolve) => {
    dns.lookup(host, (err, address, family) => {
      if (err) {
        console.error(`❌ DNS lookup failed for ${host}:`, err.message);
        resolve(null);
      } else {
        console.log(`✅ DNS lookup for ${host}: ${address} (IPv${family})`);
        resolve(address);
      }
    });
  });
}

async function testConnection(connectionString, name) {
  console.log(`\n--- Testing ${name} ---`);
  if (!connectionString) {
    console.log('Not set.');
    return;
  }
  try {
    const url = new URL(connectionString);
    console.log(`Host: ${url.hostname}, Port: ${url.port}, User: ${url.username}`);
    
    await resolveHost(url.hostname);

    const config = {
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000, // 30s timeout
      keepAlive: true
    };
    
    console.log('Connecting...');
    const client = new Client(config);
    
    client.on('error', (err) => {
      console.error(`⚠️ Client error event: ${err.message}`);
    });

    await client.connect();
    console.log(`✅ ${name}: Connected successfully!`);
    
    const res = await client.query('SELECT version();');
    console.log('Query result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error(`❌ ${name}: Connection failed:`, err.message);
  }
}

async function main() {
  console.log('✅ Found .env file');
  
  // Test DIRECT_URL first as it's most important for migrations
  if (process.env.DIRECT_URL) {
    await testConnection(process.env.DIRECT_URL, 'DIRECT_URL (Session Mode)');
  }

  // Test DATABASE_URL
  if (process.env.DATABASE_URL) {
    await testConnection(process.env.DATABASE_URL, 'DATABASE_URL (Transaction Mode)');
  }

  // Test True Direct Connection (Bypass Pooler)
  const projectRef = 'gzhxgoigflftharcmdqj';
  const trueDirectUrl = `postgresql://postgres:${encodeURIComponent("#!January#2026!")}@db.${projectRef}.supabase.co:5432/postgres`;
  await testConnection(trueDirectUrl, 'TRUE DIRECT (Bypass Pooler)');
}

main();
