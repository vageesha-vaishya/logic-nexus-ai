import { Client } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(projectRoot, '.env') });

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Error: Database URL not found in environment');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. Get a Tenant
    const tenantRes = await client.query('SELECT id FROM tenants LIMIT 1');
    if (tenantRes.rows.length === 0) {
      throw new Error('No tenants found.');
    }
    const tenantId = tenantRes.rows[0].id;
    console.log(`Using Tenant ID: ${tenantId}`);

    // 2. Create Target Queue
    const queueName = 'verify_routing_queue';
    let queueId;
    
    // Check if queue exists
    const queueCheck = await client.query('SELECT id FROM public.queues WHERE tenant_id = $1 AND name = $2', [tenantId, queueName]);
    
    if (queueCheck.rows.length === 0) {
        const createRes = await client.query(`
          INSERT INTO public.queues (tenant_id, name, description, type)
          VALUES ($1, $2, 'Verification Queue', 'round_robin')
          RETURNING id
        `, [tenantId, queueName]);
        queueId = createRes.rows[0].id;
        console.log(`Created queue '${queueName}' (ID: ${queueId}).`);
    } else {
        queueId = queueCheck.rows[0].id;
        console.log(`Queue '${queueName}' already exists (ID: ${queueId}).`);
    }

    // 3. Create Routing Rule
    const ruleName = 'Verify Header Rule';
    const criteria = {
      header_contains: { 'X-Verify-Routing': 'true' }
    };
    
    // Clean up existing rule first to ensure clean state
    await client.query(`DELETE FROM public.queue_rules WHERE tenant_id = $1 AND name = $2`, [tenantId, ruleName]);

    await client.query(`
      INSERT INTO public.queue_rules (tenant_id, queue_id, name, priority, criteria, target_queue_name, is_active)
      VALUES ($1, $2, $3, 100, $4, $5, true)
    `, [tenantId, queueId, ruleName, criteria, queueName]);
    console.log(`Created routing rule '${ruleName}'.`);

    // 4. Insert Test Email
    // We need a valid user_id for the email usually, but let's check constraints.
    // emails table usually requires tenant_id. user_id might be nullable or we can pick one.
    // Let's pick a user if possible, or null if allowed.
    // Based on schema `user_id UUID REFERENCES auth.users(id)`, it might be nullable?
    // Let's check schema or just try null. If fails, fetch a user.
    // Also `account_id` might be needed.
    
    // Fetch a user just in case
    const userRes = await client.query('SELECT id FROM auth.users LIMIT 1');
    const userId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

    // Fetch an account
    const accountRes = await client.query('SELECT id FROM email_accounts LIMIT 1');
    const accountId = accountRes.rows.length > 0 ? accountRes.rows[0].id : null;
    
    if (!accountId) {
         console.warn("No email account found, might fail if account_id is required.");
    }

    const emailSubject = `Verification Email ${Date.now()}`;
    const rawHeaders = { 'X-Verify-Routing': 'true', 'X-Other': 'ignore' };

    // Insert
    // Note: The trigger runs BEFORE INSERT.
    const messageId = `<${Date.now()}@example.com>`;
    const insertRes = await client.query(`
      INSERT INTO public.emails (
        tenant_id, 
        message_id,
        subject, 
        from_email, 
        to_emails, 
        body_text, 
        raw_headers,
        user_id,
        account_id,
        direction,
        received_at
      )
      VALUES ($1, $2, $3, 'tester@example.com', '["support@example.com"]', 'Test body', $4, $5, $6, 'inbound', now())
      RETURNING id, queue, metadata
    `, [tenantId, messageId, emailSubject, rawHeaders, userId, accountId]);

    const email = insertRes.rows[0];
    console.log('Inserted email:', email.id);
    console.log('Assigned Queue:', email.queue);

    // 5. Verify
    if (email.queue === queueName) {
      console.log('✅ SUCCESS: Email was correctly routed to ' + queueName);
    } else {
      console.error('❌ FAILURE: Email was NOT routed. Queue is: ' + email.queue);
      // Debug: check why
      // Maybe rule didn't match?
      // Check criteria again
      console.log('Expected Criteria:', JSON.stringify(criteria));
      console.log('Actual Headers:', JSON.stringify(rawHeaders));
    }

    // 6. Cleanup
    await client.query('DELETE FROM public.emails WHERE id = $1', [email.id]);
    await client.query('DELETE FROM public.queue_rules WHERE tenant_id = $1 AND name = $2', [tenantId, ruleName]);
    await client.query('DELETE FROM public.queues WHERE tenant_id = $1 AND name = $2', [tenantId, queueName]);
    console.log('Cleanup completed.');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

main();
