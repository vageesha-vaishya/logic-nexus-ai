
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL in .env');
  process.exit(1);
}

async function checkOrphanQuotes() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // Backfill kind for existing versions where it is null
    console.log('Backfilling kind for existing versions...');
    await client.query(`
      UPDATE quotation_versions
      SET kind = CASE WHEN minor = 0 THEN 'major' ELSE 'minor' END
      WHERE kind IS NULL
    `);
    console.log('Finished backfilling kind.');

    // Find quotes with no versions
    const res = await client.query(`
      SELECT q.id, q.quote_number, q.tenant_id, q.owner_id
      FROM quotes q
      LEFT JOIN quotation_versions qv ON q.id = qv.quote_id
      WHERE qv.id IS NULL
    `);

    console.log(`Found ${res.rowCount} quotes with no versions.`);
    
    if (res.rowCount > 0) {
      console.table(res.rows.slice(0, 10)); // Show first 10
      
      // We could fix them by creating initial versions here, but QuoteDetail logic should handle it now.
      // But maybe we should create them in bulk to be safe?
      
      console.log('Creating initial versions for orphan quotes...');
      for (const quote of res.rows) {
        try {
            const insertRes = await client.query(`
                INSERT INTO quotation_versions (
                    quote_id, tenant_id, version_number, major, minor, 
                    status, is_active, is_current, created_at, updated_at,
                    created_by, metadata, kind
                ) VALUES (
                    $1, $2, 1, 1, 0, 
                    'draft', true, true, now(), now(),
                    $3, '{"source": "orphan_fix"}'::jsonb, 'major'
                ) RETURNING id
            `, [quote.id, quote.tenant_id, quote.owner_id]);

            const versionId = insertRes.rows[0].id;

            // Update the quote with this version
            await client.query(`
                UPDATE quotes
                SET current_version_id = $1
                WHERE id = $2
            `, [versionId, quote.id]);
            console.log(`Created version for quote ${quote.quote_number}`);
        } catch (err) {
            console.error(`Failed to create version for quote ${quote.quote_number}:`, err);
        }
      }
      console.log('Finished creating versions.');
    }

  } catch (error) {
    console.error('Error checking orphan quotes:', error);
  } finally {
    await client.end();
  }
}

checkOrphanQuotes();
