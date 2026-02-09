const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyEncryption() {
  console.log('🔐 Verifying Email Encryption...');

  const testSubject = `Encryption Test ${Date.now()}`;
  const testBody = `<h1>Secret Content</h1><p>This should be encrypted at rest.</p>`;

  // 1. Get an Account ID (any)
  const { data: accounts } = await supabase.from('email_accounts').select('id').limit(1);
  if (!accounts || accounts.length === 0) {
    console.error('No email accounts found. Cannot insert email.');
    return;
  }
  const accountId = accounts[0].id;

  // 2. Insert Email
  console.log('Inserting email...');
  const { data: email, error: insertError } = await supabase
    .from('emails')
    .insert({
      account_id: accountId,
      message_id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      direction: 'inbound',
      subject: testSubject,
      body_html: testBody,
      from_email: 'test@example.com',
      to_emails: [{ email: 'admin@example.com' }],
      received_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('Insert failed:', insertError);
    return;
  }

  console.log(`Email inserted. ID: ${email.id}`);

  // 3. Verify Raw Data (should have body_encrypted)
  // We re-fetch to ensure we get the trigger result (though .select() might return it if trigger runs before return)
  const { data: rawEmail, error: fetchError } = await supabase
    .from('emails')
    .select('body_encrypted, body_html')
    .eq('id', email.id)
    .single();

  if (fetchError) {
    console.error('Fetch failed:', fetchError);
    return;
  }

  if (rawEmail.body_encrypted) {
    console.log('✓ body_encrypted is present (Trigger worked)');
  } else {
    console.error('❌ body_encrypted is NULL! Trigger did not fire or failed.');
  }

  // 4. Verify Decryption RPC
  console.log('Testing Decryption RPC...');
  const { data: decryptedText, error: rpcError } = await supabase
    .rpc('get_decrypted_email_body', { p_email_id: email.id });

  if (rpcError) {
    console.error('RPC failed:', rpcError);
  } else {
    if (decryptedText === testBody) {
      console.log('✅ Decryption successful! Content matches.');
    } else {
      console.error('❌ Decryption mismatch!');
      console.log('Expected:', testBody);
      console.log('Received:', decryptedText);
    }
  }
  
  // Cleanup
  await supabase.from('emails').delete().eq('id', email.id);
}

verifyEncryption();
