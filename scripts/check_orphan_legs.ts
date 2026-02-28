
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const connectionString = process.env.DATABASE_URL;

async function checkOrphans() {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();

    // Check legs without options
    const legsWithoutOptions = await client.query(`
        SELECT count(*) 
        FROM quotation_version_option_legs l
        LEFT JOIN quotation_version_options o ON l.quotation_version_option_id = o.id
        WHERE o.id IS NULL
    `);
    console.log('Legs without options:', legsWithoutOptions.rows[0].count);

    // Check options without versions
    const optionsWithoutVersions = await client.query(`
        SELECT count(*) 
        FROM quotation_version_options o
        LEFT JOIN quotation_versions v ON o.quotation_version_id = v.id
        WHERE v.id IS NULL
    `);
    console.log('Options without versions:', optionsWithoutVersions.rows[0].count);

    // Check versions without quotes
    const versionsWithoutQuotes = await client.query(`
        SELECT count(*) 
        FROM quotation_versions v
        LEFT JOIN quotes q ON v.quote_id = q.id
        WHERE q.id IS NULL
    `);
    console.log('Versions without quotes:', versionsWithoutQuotes.rows[0].count);
    
    // Check if quotes current_version_id is valid
    const quotesWithInvalidCurrentVersion = await client.query(`
        SELECT count(*)
        FROM quotes q
        LEFT JOIN quotation_versions v ON q.current_version_id = v.id
        WHERE q.current_version_id IS NOT NULL AND v.id IS NULL
    `);
    console.log('Quotes with invalid current_version_id:', quotesWithInvalidCurrentVersion.rows[0].count);

    await client.end();
}
checkOrphans();
