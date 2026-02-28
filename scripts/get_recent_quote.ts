
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

async function getRecentQuote() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Get ANY quote that has legs
    const query = `
      SELECT q.id, q.quote_number, q.title, q.created_at, q.current_version_id
      FROM quotes q
      JOIN quotation_versions qv ON q.current_version_id = qv.id
      JOIN quotation_version_options qvo ON qv.id = qvo.quotation_version_id
      JOIN quotation_version_option_legs qvl ON qvo.id = qvl.quotation_version_option_id
      LIMIT 1;
    `;
    
    const result = await client.query(query);
    
    if (result.rows.length === 0) {
      console.log('No quotes found.');
      return;
    }

    const quote = result.rows[0];
    console.log('Recent Quote:', quote);

    if (quote.current_version_id) {
        const vQuery = `
            SELECT id, version_number 
            FROM quotation_versions 
            WHERE id = $1
        `;
        const vResult = await client.query(vQuery, [quote.current_version_id]);
        console.log('Current Version:', vResult.rows[0]);

        if (vResult.rows.length > 0) {
            const optQuery = `
                SELECT id, option_name, total_amount 
                FROM quotation_version_options 
                WHERE quotation_version_id = $1
            `;
            const optResult = await client.query(optQuery, [quote.current_version_id]);
            console.log(`Options (${optResult.rows.length}):`, optResult.rows);

            if (optResult.rows.length > 0) {
                const optId = optResult.rows[0].id;
                const legQuery = `
                    SELECT id, origin_location, destination_location 
                    FROM quotation_version_option_legs 
                    WHERE quotation_version_option_id = $1
                `;
                const legResult = await client.query(legQuery, [optId]);
                console.log(`Legs for option ${optId} (${legResult.rows.length}):`, legResult.rows);
            }
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

getRecentQuote();
