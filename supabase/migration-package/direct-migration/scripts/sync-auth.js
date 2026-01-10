const { Client } = require('pg');
const fs = require('fs');

async function syncAuth() {
  const sourceUrl = process.argv[2];
  const targetUrl = process.argv[3];

  if (!sourceUrl || !targetUrl) {
    console.error('Usage: node sync-auth.js <SOURCE_DB_URL> <TARGET_DB_URL>');
    process.exit(1);
  }

  const sourceClient = new Client({ connectionString: sourceUrl });
  const targetClient = new Client({ connectionString: targetUrl });

  try {
    await sourceClient.connect();
    await targetClient.connect();

    console.log('Connected to source and target databases.');

    // 1. Sync Users
    console.log('Fetching users from source...');
    const usersRes = await sourceClient.query('SELECT * FROM auth.users');
    const users = usersRes.rows;
    console.log(`Found ${users.length} users.`);

    for (const user of users) {
      // Construct INSERT query dynamically or map fields
      // We use ON CONFLICT to avoid duplicates
      // Note: We only map essential fields to avoid schema drift issues if auth schema versions differ slightly
      // But for full migration we want mostly everything.
      
      const query = `
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
          invited_at, confirmation_token, confirmation_sent_at, recovery_token, 
          recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, 
          last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, 
          created_at, updated_at, phone, phone_confirmed_at, phone_change, 
          phone_change_token, phone_change_sent_at, email_change_token_current, 
          email_change_confirm_status, banned_until, reauthentication_token, 
          reauthentication_sent_at, is_sso_user, deleted_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, 
          $29, $30, $31, $32, $33
        )
        ON CONFLICT (id) DO NOTHING;
      `;
      
      const values = [
        user.instance_id, user.id, user.aud, user.role, user.email, user.encrypted_password, user.email_confirmed_at,
        user.invited_at, user.confirmation_token, user.confirmation_sent_at, user.recovery_token,
        user.recovery_sent_at, user.email_change_token_new, user.email_change, user.email_change_sent_at,
        user.last_sign_in_at, user.raw_app_meta_data, user.raw_user_meta_data, user.is_super_admin,
        user.created_at, user.updated_at, user.phone, user.phone_confirmed_at, user.phone_change,
        user.phone_change_token, user.phone_change_sent_at, user.email_change_token_current,
        user.email_change_confirm_status, user.banned_until, user.reauthentication_token,
        user.reauthentication_sent_at, user.is_sso_user, user.deleted_at
      ];

      try {
        await targetClient.query(query, values);
      } catch (e) {
        console.error(`Failed to insert user ${user.id}: ${e.message}`);
      }
    }
    console.log('Users synced.');

    // 2. Sync Identities
    console.log('Fetching identities from source...');
    const identitiesRes = await sourceClient.query('SELECT * FROM auth.identities');
    const identities = identitiesRes.rows;
    console.log(`Found ${identities.length} identities.`);

    for (const identity of identities) {
      const query = `
        INSERT INTO auth.identities (
          id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
        ON CONFLICT (provider, id) DO NOTHING;
      `;
      // Note: 'email' column might not exist in older schemas, check target schema if needed.
      // Assuming standard schema compatibility for now.
      
      const values = [
        identity.id, identity.user_id, identity.identity_data, identity.provider, 
        identity.last_sign_in_at, identity.created_at, identity.updated_at, identity.email
      ];

      try {
        await targetClient.query(query, values);
      } catch (e) {
        // If 'email' column is missing in target (older supabase), try without it
         if (e.message.includes('column "email" of relation "identities" does not exist')) {
            const fallbackQuery = `
                INSERT INTO auth.identities (
                id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (provider, id) DO NOTHING;
            `;
             const fallbackValues = [
                identity.id, identity.user_id, identity.identity_data, identity.provider, 
                identity.last_sign_in_at, identity.created_at, identity.updated_at
            ];
            await targetClient.query(fallbackQuery, fallbackValues);
         } else {
             console.error(`Failed to insert identity ${identity.id}: ${e.message}`);
         }
      }
    }
    console.log('Identities synced.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
}

syncAuth();
