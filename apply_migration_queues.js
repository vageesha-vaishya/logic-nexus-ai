
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read config
const configPath = path.join(__dirname, 'supabase/migration-package/new-supabase-config.env');
if (!fs.existsSync(configPath)) {
    console.error('Config file not found:', configPath);
    process.exit(1);
}

const configContent = fs.readFileSync(configPath, 'utf-8');
const dbUrlMatch = configContent.match(/NEW_DB_URL="([^"]+)"/);

if (!dbUrlMatch) {
    console.error('NEW_DB_URL not found in config');
    process.exit(1);
}

const connectionString = dbUrlMatch[1];

async function resolveHost(hostname) {
    console.log(`Resolving ${hostname}...`);
    try {
        const res = await fetch(`https://dns.google/resolve?name=${hostname}&type=A`);
        const data = await res.json();
        if (data.Answer && data.Answer.length > 0) {
            const ip = data.Answer.find(a => a.type === 1)?.data; // Type 1 is A record
            if (ip) {
                console.log(`Resolved ${hostname} to ${ip}`);
                return ip;
            }
        }
    } catch (e) {
        console.error('DNS resolution failed:', e.message);
    }
    return null;
}

async function runMigration(client, filePath) {
    console.log(`Reading migration: ${filePath}`);
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log('Executing migration...');
    try {
        await client.query(sql);
        console.log('Success!');
    } catch (err) {
        if (err.message.includes('already exists')) {
            console.log('Notice: Object already exists, continuing...');
        } else {
            console.error('Error executing migration:', err.message);
            // Don't exit, try next
        }
    }
}

async function main() {
    try {
        console.log('Connecting to database...');
        
        // Parse connection string to get hostname
        const urlObj = new URL(connectionString);
        const hostname = urlObj.hostname;
        const ip = await resolveHost(hostname);
        
        let clientConfig = {
            connectionString,
            ssl: { rejectUnauthorized: false }
        };

        if (ip) {
            // Use IP but keep hostname for SSL SNI
            clientConfig = {
                user: urlObj.username,
                password: urlObj.password,
                host: ip, // Use resolved IP
                port: urlObj.port || 5432,
                database: urlObj.pathname.slice(1),
                ssl: { 
                    rejectUnauthorized: false,
                    servername: hostname // Critical for SNI
                }
            };
        }

        const client = new Client(clientConfig);
        await client.connect();
        console.log('Connected.');

        // 1. UI Themes
        await runMigration(client, path.join(__dirname, 'supabase/migrations/20251007121500_ui_themes.sql'));

        // 2. Queues
        await runMigration(client, path.join(__dirname, 'supabase/migrations/20260104000001_add_queues_and_groups.sql'));

        await client.end();

    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

main();
