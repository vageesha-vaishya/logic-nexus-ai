
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envMigrationPath = path.join(__dirname, '../.env.migration');
if (fs.existsSync(envMigrationPath)) {
    dotenv.config({ path: envMigrationPath });
} else {
    dotenv.config();
}

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

async function verifyRPS() {
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        // 1. Get a sample name from the table
        const sampleRes = await client.query('SELECT entity_name FROM public.restricted_party_lists LIMIT 1');
        const sampleName = sampleRes.rows[0]?.entity_name;
        console.log('Sample Entity from DB:', sampleName);

        if (!sampleName) {
            console.error('No data found in restricted_party_lists!');
            return;
        }

        // 2. Screen it (Exact Match)
        console.log(`\nScreening for exact match: "${sampleName}"...`);
        const exactRes = await client.query(`
            SELECT * FROM public.screen_restricted_party($1, null, 0.8)
        `, [sampleName]);
        
        console.log(`Found ${exactRes.rowCount} matches.`);
        if (exactRes.rowCount > 0) {
            console.log('Top match:', exactRes.rows[0].entity_name, `(Score: ${exactRes.rows[0].similarity})`);
        }

        // 3. Screen it (Fuzzy Match)
        const partialName = sampleName.substring(0, Math.max(5, sampleName.length - 2)); // Remove last few chars
        console.log(`\nScreening for fuzzy match: "${partialName}"...`);
        const fuzzyRes = await client.query(`
            SELECT * FROM public.screen_restricted_party($1, null, 0.4)
        `, [partialName]);

        console.log(`Found ${fuzzyRes.rowCount} matches.`);
        if (fuzzyRes.rowCount > 0) {
            console.log('Top match:', fuzzyRes.rows[0].entity_name, `(Score: ${fuzzyRes.rows[0].similarity})`);
        }

        // 4. Test "Huawei" specifically (common test case)
        console.log(`\nScreening for "Huawei"...`);
        const huaweiRes = await client.query(`
            SELECT * FROM public.screen_restricted_party('Huawei', null, 0.4)
        `);
        console.log(`Found ${huaweiRes.rowCount} matches for "Huawei".`);
        if (huaweiRes.rowCount > 0) {
            huaweiRes.rows.forEach(row => {
                console.log(`- ${row.entity_name} (${row.country_code}) [${row.similarity}]`);
            });
        }

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        await client.end();
    }
}

verifyRPS();
