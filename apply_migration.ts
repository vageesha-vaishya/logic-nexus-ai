
import { Client } from "https://deno.land/x/postgres/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

// Load .env
const env = config();
const dbUrl = env.DATABASE_URL || Deno.env.get("DATABASE_URL");

if (!dbUrl) {
  console.error("DATABASE_URL not found");
  Deno.exit(1);
}

const client = new Client(dbUrl);

async function run() {
  await client.connect();
  console.log("Connected to DB");

  // Read the SQL file
  const sql = await Deno.readTextFile("./supabase/migrations/20260307120000_add_main_template.sql");

  try {
    await client.queryArray(sql);
    console.log("Migration applied successfully");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}

run();
