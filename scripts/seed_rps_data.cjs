
const fs = require('fs');
const Papa = require('papaparse');
const { Client } = require('pg');
const https = require('https');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envMigrationPath = path.join(__dirname, '../.env.migration');
if (fs.existsSync(envMigrationPath)) {
    dotenv.config({ path: envMigrationPath });
} else {
    dotenv.config();
}

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const CSV_URL = 'https://data.opensanctions.org/datasets/latest/us_trade_csl/targets.simple.csv';

async function downloadCSV(url) {
    return new Promise((resolve, reject) => {
        let data = '';
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download CSV: Status Code ${res.statusCode}`));
                return;
            }
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', (err) => reject(err));
        });
    });
}

async function seedRestrictedParties() {
    console.log('Starting Restricted Party List Seeding...');
    
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        console.log('Downloading CSV from OpenSanctions...');
        const csvData = await downloadCSV(CSV_URL);
        console.log(`Downloaded ${csvData.length} bytes. Parsing...`);

        const parsed = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true
        });

        const records = parsed.data;
        console.log(`Parsed ${records.length} records.`);

        // Upsert in batches
        const BATCH_SIZE = 500;
        let processed = 0;
        let inserted = 0;

        // Prepare statement (conceptually) - we'll use parameterized queries in loop
        // Columns: external_id, source_list, entity_name, address, country_code, meta_data
        
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            
            // Construct values for bulk insert is tricky with raw SQL driver without a helper
            // So we'll do one big query with UNNEST or just loop (slow but safe) or multi-value INSERT
            // Let's use multi-value INSERT for speed
            
            const values = [];
            const placeholders = [];
            
            batch.forEach((row, idx) => {
                const offset = idx * 6; // 6 parameters per row
                
                // Map fields
                const external_id = row.id;
                const source_list = row.dataset;
                const entity_name = row.name;
                
                // Address: split by ; if multiple, take first
                let address = row.addresses ? row.addresses.split(';')[0].trim() : null;
                
                // Country: split by ; if multiple, take first
                let country = row.countries ? row.countries.split(';')[0].trim() : null;
                
                // Meta: store full row
                const meta = JSON.stringify(row);

                values.push(external_id, source_list, entity_name, address, country, meta);
                placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::jsonb)`);
            });

            if (values.length === 0) continue;

            const query = `
                INSERT INTO public.restricted_party_lists 
                (external_id, source_list, entity_name, address, country_code, meta_data)
                VALUES ${placeholders.join(', ')}
                ON CONFLICT (external_id) 
                DO UPDATE SET 
                    source_list = EXCLUDED.source_list,
                    entity_name = EXCLUDED.entity_name,
                    address = EXCLUDED.address,
                    country_code = EXCLUDED.country_code,
                    meta_data = EXCLUDED.meta_data,
                    updated_at = now();
            `;

            await client.query(query, values);
            processed += batch.length;
            if (processed % 2000 === 0) console.log(`Processed ${processed} records...`);
        }

        console.log('Seeding completed successfully.');

    } catch (err) {
        console.error('Error seeding RPS data:', err);
    } finally {
        await client.end();
    }
}

seedRestrictedParties();
