
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Supabase requires SSL, but sometimes certs are tricky locally
  });

  try {
    await client.connect();
    console.log("Connected to DB");

    const sql = `
CREATE OR REPLACE FUNCTION get_templates_secure(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.is_active, t.tenant_id
  FROM quote_templates t
  WHERE 
    t.is_active = true
    AND (
      (p_tenant_id IS NOT NULL AND t.tenant_id = p_tenant_id)
      OR
      (p_tenant_id IS NULL AND t.tenant_id IS NULL)
    )
  ORDER BY t.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_templates_secure(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_templates_secure(UUID) TO service_role;
    `;

    await client.query(sql);
    console.log("Migration applied successfully: get_templates_secure RPC created/updated.");

  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
