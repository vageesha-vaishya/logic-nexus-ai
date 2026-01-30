import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL || process.env.TARGET_DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    try {
        await client.connect();
        console.log('Connected to DB');

        // 1. Verify platform_domains
        console.log('\n--- platform_domains ---');
        const domains = await client.query('SELECT code, name FROM platform_domains ORDER BY code');
        console.table(domains.rows);

        // 2. Verify quote_items view
        console.log('\n--- quote_items view ---');
        const viewDef = await client.query("SELECT pg_get_viewdef('quote_items', true)");
        const def = viewDef.rows[0].pg_get_viewdef;
        if (def.includes('logistics.quote_items_extension') && def.includes('attributes')) {
            console.log('✅ quote_items view uses logistics.quote_items_extension and includes attributes');
        } else {
            console.log('❌ quote_items view is incorrect:', def);
        }

        // 3. Verify ports_locations count
        console.log('\n--- ports_locations ---');
        const ports = await client.query('SELECT count(*) FROM ports_locations');
        console.log(`Total ports: ${ports.rows[0].count}`);

        // 4. Verify migrations count
        console.log('\n--- supabase_migrations ---');
        const migrations = await client.query('SELECT count(*) FROM supabase_migrations');
        console.log(`Total applied migrations: ${migrations.rows[0].count}`);

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        await client.end();
    }
}

verify();
