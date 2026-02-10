import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const TEST_EMAILS = [
  {
    email: 'Bahuguna.vimal@outlook.com',
    password: '#SOS@beegee@1234',
    provider: 'office365'
  },
  {
    email: 'vimal_s390@hotmail.com',
    password: 'vcbbeegee@1234',
    provider: 'office365'
  },
  {
    email: 'bahuguna.vimal@gmail.com',
    password: 'SOS@July@2024',
    provider: 'gmail'
  },
  {
    email: 'dinusaundarya@gmail.com',
    password: 'Dinu1234',
    provider: 'gmail'
  }
];

async function run() {
  try {
    await client.connect();
    
    // 1. Get a valid user and tenant (We'll use 'admin-user-tenant001@gmail.com')
    const userRes = await client.query(`
      SELECT id, tenant_id FROM public.profiles 
      WHERE email = 'admin-user-tenant001@gmail.com' 
      LIMIT 1
    `);

    let user = userRes.rows[0];
    
    // Fallback if that user isn't in profiles (it was in auth.users)
    if (!user) {
      console.log("Profile not found for admin-user-tenant001, fetching from auth.users...");
      const authUserRes = await client.query(`
        SELECT id FROM auth.users WHERE email = 'admin-user-tenant001@gmail.com' LIMIT 1
      `);
      if (authUserRes.rows.length === 0) throw new Error("No admin user found to attach emails to.");
      
      const userId = authUserRes.rows[0].id;
      // Get any tenant
      const tenantRes = await client.query(`SELECT id FROM public.tenants LIMIT 1`);
      const tenantId = tenantRes.rows[0].id;
      user = { id: userId, tenant_id: tenantId };
    }

    console.log(`Attaching emails to User: ${user.id}, Tenant: ${user.tenant_id}`);

    for (const acc of TEST_EMAILS) {
      // Upsert into email_accounts
      // Note: We are storing the password in smtp/imap password fields. 
      // In a real OAuth flow, we'd store tokens. This is for E2E simulation.
      const query = `
        INSERT INTO public.email_accounts (
          user_id, tenant_id, provider, email_address, display_name, 
          is_active, is_primary, 
          smtp_username, smtp_password, 
          imap_username, imap_password
        ) VALUES (
          $1, $2, $3, $4, $4, 
          true, false,
          $4, $5,
          $4, $5
        )
        ON CONFLICT (user_id, email_address) DO UPDATE SET
          smtp_password = EXCLUDED.smtp_password,
          imap_password = EXCLUDED.imap_password,
          is_active = true;
      `;
      
      await client.query(query, [
        user.id, 
        user.tenant_id, 
        acc.provider, 
        acc.email, 
        acc.password
      ]);
      console.log(`✅ Configured: ${acc.email}`);
    }

    await client.end();
  } catch (e) {
    console.error("❌ Error:", e);
  }
}
run();
