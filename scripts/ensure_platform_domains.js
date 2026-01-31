
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(projectRoot, '.env') });

// Load .env.migration for DB credentials if needed
const envMigrationPath = path.join(projectRoot, '.env.migration');
let dbUrl = process.env.DATABASE_URL;

if (fs.existsSync(envMigrationPath)) {
  const content = fs.readFileSync(envMigrationPath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1];
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (key === 'SUPABASE_DB_URL' && !dbUrl) dbUrl = val;
    }
  });
}

if (!dbUrl) {
  console.error('❌ No DATABASE_URL or SUPABASE_DB_URL found.');
  process.exit(1);
}

const { Client } = pg;
const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('🔌 Connected to database.');

    // 1. Check if table exists
    const res = await client.query("SELECT to_regclass('platform_domains')");
    const tableExists = !!res.rows[0].to_regclass;

    if (!tableExists) {
      console.log('⚠️ Table platform_domains does not exist. Creating...');
      const sqlPath = path.join(projectRoot, 'supabase', 'migrations', '20260131120000_create_platform_domains.sql');
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      await client.query(sql);
      console.log('✅ Created platform_domains table.');
    } else {
      console.log('✅ Table platform_domains exists.');
    }

    // 2. Ensure non-logistics domains are seeded
    const domains = [
      {
        key: 'trading',
        name: 'Trading & Procurement',
        description: 'Sourcing, inspection, and trade finance.',
        owner: 'Trading Squad',
        status: 'active'
      },
      {
        key: 'insurance',
        name: 'Insurance Services',
        description: 'Cargo and business liability insurance.',
        owner: 'Risk Squad',
        status: 'active'
      },
      {
        key: 'customs',
        name: 'Customs & Compliance',
        description: 'Regulatory compliance and clearance.',
        owner: 'Compliance Squad',
        status: 'active'
      },
      {
        key: 'telecom',
        name: 'Telecommunications',
        description: 'Network infrastructure, 5G services, and bandwidth management.',
        owner: 'Connectivity Squad',
        status: 'active'
      },
      {
        key: 'real_estate',
        name: 'Real Estate',
        description: 'Property management, virtual tours, and tenant services.',
        owner: 'PropTech Squad',
        status: 'active'
      },
      {
        key: 'ecommerce',
        name: 'E-commerce',
        description: 'Product catalog, order fulfillment, and inventory sync.',
        owner: 'Commerce Squad',
        status: 'active'
      }
    ];

    for (const d of domains) {
      const check = await client.query('SELECT 1 FROM platform_domains WHERE key = $1', [d.key]);
      if (check.rowCount === 0) {
        console.log(`🌱 Seeding domain: ${d.key}`);
        await client.query(`
          INSERT INTO platform_domains (key, code, name, description, owner, status)
          VALUES ($1, $1, $2, $3, $4, $5)
        `, [d.key, d.name, d.description, d.owner, d.status]);
      } else {
        console.log(`✓ Domain ${d.key} already exists.`);
      }
    }
    
    console.log('✅ Platform Domains readiness check complete.');

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
