const { Client } = require('pg');

async function validate() {
  const sourceUrl = process.argv[2];
  const targetUrl = process.argv[3];

  if (!sourceUrl || !targetUrl) {
    console.error('Usage: node validate-migration.js <SOURCE_DB_URL> <TARGET_DB_URL>');
    process.exit(1);
  }

  const sourceClient = new Client({ connectionString: sourceUrl });
  const targetClient = new Client({ connectionString: targetUrl });

  try {
    await sourceClient.connect();
    await targetClient.connect();

    console.log('Validating migration...');

    // Get all tables in public schema
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    `;
    
    const res = await sourceClient.query(tablesQuery);
    const tables = res.rows.map(r => r.table_name);

    let errors = 0;

    for (const table of tables) {
      const countQuery = `SELECT COUNT(*) as c FROM "${table}"`;
      
      const sourceCountRes = await sourceClient.query(countQuery);
      const targetCountRes = await targetClient.query(countQuery);
      
      const sourceCount = parseInt(sourceCountRes.rows[0].c);
      const targetCount = parseInt(targetCountRes.rows[0].c);

      if (sourceCount !== targetCount) {
        console.error(`❌ Mismatch in table ${table}: Source=${sourceCount}, Target=${targetCount}`);
        errors++;
      } else {
        console.log(`✅ ${table}: ${sourceCount} rows matched.`);
      }
    }

    if (errors === 0) {
        console.log('All tables validated successfully!');
    } else {
        console.error(`Migration validation failed with ${errors} errors.`);
        process.exit(1);
    }

  } catch (err) {
    console.error('Validation failed:', err);
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
}

validate();
