
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyEncryption() {
  console.log('Verifying Email Encryption Status...');

  // 1. Check for unencrypted emails
  const { count, error } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .is('body_encrypted', null)
    .or('body_html.neq.null,body_text.neq.null');

  if (error) {
    console.error('Error checking unencrypted emails:', error);
    process.exit(1);
  }

  console.log(`Found ${count} unencrypted emails.`);
  
  if (count === 0) {
    console.log('✅ All eligible emails are encrypted (or table is empty).');
  } else {
    console.warn('⚠️ Some emails remain unencrypted. Backfill might be incomplete.');
  }

  // 2. Verify we can decrypt a test email
  // Create a test email
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.error('No tenant found. Cannot proceed.');
    return;
  }
  
  // Need an account ID
  let accountId = await getAccountId(tenantId);
  if (!accountId) {
    console.log('No email account found. Creating a temporary one...');
    accountId = await createTempAccount(tenantId);
  }

  const { data: inserted, error: insertError } = await supabase
    .from('emails')
    .insert({
      tenant_id: tenantId,
      account_id: accountId,
      message_id: `test-encrypt-${Date.now()}`,
      direction: 'outbound',
      subject: 'Encryption Test',
      body_html: '<p>Secret Content</p>',
      from_email: 'test@example.com',
      to_emails: [{ email: 'recipient@example.com', name: 'Recipient' }],
      status: 'draft'
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to insert test email:', insertError);
    return;
  }

  console.log('Inserted test email:', inserted.id);
  console.log('Encrypted body (bytea):', inserted.body_encrypted ? 'Present' : 'Missing');

  // Decrypt
  const { data: decrypted, error: rpcError } = await supabase
    .rpc('get_decrypted_email_body', { p_email_id: inserted.id });

  if (rpcError) {
    console.error('Decryption RPC failed:', rpcError);
  } else {
    console.log('Decrypted content:', decrypted);
    if (decrypted === '<p>Secret Content</p>') {
      console.log('✅ Encryption/Decryption cycle verified.');
    } else {
      console.error('❌ Decrypted content does not match original.');
    }
  }

  // Cleanup
  await supabase.from('emails').delete().eq('id', inserted.id);
}

async function getTenantId() {
  const { data } = await supabase.from('tenants').select('id').limit(1);
  return data?.[0]?.id;
}

async function getAccountId(tenantId) {
    const { data } = await supabase.from('email_accounts').select('id').eq('tenant_id', tenantId).limit(1);
    return data?.[0]?.id;
}

async function createTempAccount(tenantId) {
    // Need a user_id
    const { data: users } = await supabase.from('user_roles').select('user_id').eq('tenant_id', tenantId).limit(1);
    const userId = users?.[0]?.user_id;
    
    if (!userId) {
        throw new Error('No user found for tenant to create account');
    }

    const { data, error } = await supabase.from('email_accounts').insert({
        user_id: userId,
        tenant_id: tenantId,
        provider: 'smtp_imap', // generic
        email_address: `temp-${Date.now()}@example.com`,
        display_name: 'Temp Account',
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        smtp_username: 'user',
        smtp_password: 'password',
        imap_host: 'imap.example.com',
        imap_port: 993,
        imap_username: 'user',
        imap_password: 'password'
    }).select().single();

    if (error) throw error;
    return data.id;
}

verifyEncryption().catch(console.error);
