const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
    // Check for DATABASE_URL environment variable
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("Error: DATABASE_URL environment variable is not set.");
        process.exit(1);
    }
    
    console.log("Connecting to database...");
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected.");

        const migrationPath = path.join(__dirname, 'supabase/migrations/20260307140000_add_frequency_to_options.sql');
        console.log(`Reading migration file: ${migrationPath}`);
        
        if (!fs.existsSync(migrationPath)) {
            console.error(`Migration file not found at: ${migrationPath}`);
            process.exit(1);
        }

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
