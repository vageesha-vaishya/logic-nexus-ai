const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env explicitly
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const sqlFile = process.argv[2];
if (!sqlFile) {
    console.error('Usage: node scripts/query_sql.cjs <path_to_sql_file>');
    process.exit(1);
}

const filePath = path.resolve(process.cwd(), sqlFile);

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');
    
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Executing ${path.basename(filePath)}...`);
    
    const result = await client.query(sql);
    console.log('Query executed successfully!');
    
    if (Array.isArray(result)) {
        result.forEach((res, index) => {
            console.log(`\n--- Result ${index + 1} ---`);
            console.log('Row Count:', res.rowCount);
            if (res.rows && res.rows.length > 0) {
                console.table(res.rows);
            } else {
                console.log('No rows returned.');
            }
        });
    } else {
        console.log('Row Count:', result.rowCount);
        if (result.rows && result.rows.length > 0) {
            console.table(result.rows);
        } else {
            console.log('No rows returned.');
        }
    }
  } catch (err) {
    console.error('Error executing query:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
