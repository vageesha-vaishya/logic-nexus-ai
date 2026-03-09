const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
    const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:54322/postgres"; // Fallback to local
    
    console.log("Connecting to database with string: " + connectionString);
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false } // Needed for remote connections usually
    });

    try {
        await client.connect();
        console.log("Connected.");

        const migrationPath = path.join(__dirname, 'supabase/migrations/20260307120000_add_main_template.sql');
        console.log(`Reading migration file: ${migrationPath}`);
        
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        console.log("Applying migration...");
        await client.query(sql);
        console.log("Migration applied successfully!");
        
    } catch (err) {
        console.error("Error applying migration:", err);
    } finally {
        await client.end();
    }
}

applyMigration();
