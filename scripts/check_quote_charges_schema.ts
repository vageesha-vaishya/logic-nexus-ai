
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const checkSchema = async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'quote_charges' 
      ORDER BY ordinal_position
    `);
    
    console.table(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
};

checkSchema();
