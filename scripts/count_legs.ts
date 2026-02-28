
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const connectionString = process.env.DATABASE_URL;

async function countLegs() {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const res = await client.query('SELECT count(*) FROM quotation_version_option_legs');
    console.log('Total legs:', res.rows[0].count);
    await client.end();
}
countLegs();
