import pg from 'pg';
const { Client } = pg;

// --- CONFIGURATION: REPLACE THESE VALUES ---
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_HERE"; 
const GOOGLE_CLIENT_SECRET = "YOUR_GOOGLE_CLIENT_SECRET_HERE";
// -------------------------------------------

const connectionString = "postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const TARGET_USER_ID = '52811a3b-5baf-4c5f-854b-7ced632e3a74'; // bahuguna.vimal@gmail.com

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  if (GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID")) {
      console.error("❌ Please edit this file and replace YOUR_GOOGLE_CLIENT_ID_HERE with your actual Google Client ID.");
      process.exit(1);
  }

  try {
    await client.connect();
    console.log(`Updating Google OAuth config for user: ${TARGET_USER_ID}`);

    const query = `
      UPDATE public.oauth_configurations
      SET 
        client_id = $1,
        client_secret = $2,
        is_active = true,
        updated_at = NOW()
      WHERE user_id = $3 AND provider = 'gmail';
    `;
    
    const res = await client.query(query, [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TARGET_USER_ID]);
    
    if (res.rowCount === 0) {
        console.log("⚠️ No existing configuration found. Creating one...");
        // Insert if not exists
        await client.query(`
            INSERT INTO public.oauth_configurations (user_id, provider, client_id, client_secret, is_active, redirect_uri)
            VALUES ($1, 'gmail', $2, $3, true, 'http://localhost:3000/auth/callback')
        `, [TARGET_USER_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET]);
    }
    
    console.log("✅ Google OAuth Configuration Updated Successfully.");
    console.log("👉 You can now try signing in with Google again.");

    await client.end();
  } catch (e) {
    console.error("❌ Error:", e);
  }
}

run();
