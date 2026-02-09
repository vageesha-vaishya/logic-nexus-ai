const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testBackfill() {
  console.log('🧪 Testing Backfill Trigger Logic...');

  // 1. Insert a raw email WITHOUT triggering encryption (bypass trigger? No, trigger is always on)
  // Wait, I can't easily bypass the trigger unless I disable it. 
  // But I can insert a row, then manually set body_encrypted to NULL if I could, but the trigger would just re-encrypt it on update.
  // Actually, if I insert, it gets encrypted. 
  // To simulate "old data", I need to temporarily disable the trigger or use a row that was inserted BEFORE the trigger existed.
  // Since I can't travel in time, I will disable the trigger, insert, then re-enable.
  
  // NOTE: I cannot execute DDL (ALTER TABLE) easily via supabase-js client unless I use an RPC or direct SQL connection.
  // I'll use the direct SQL connection via 'pg'.

  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    // Disable trigger
    console.log('Disabling trigger...');
    await client.query('ALTER TABLE emails DISABLE TRIGGER encrypt_email_body_on_insert');

    // Insert "Old" Email
    console.log('Inserting "Old" unencrypted email...');
    const testSubject = `Old Email ${Date.now()}`;
    const testBody = `<p>This is an old email.</p>`;
    
    // Get account id
    const { data: accounts } = await supabase.from('email_accounts').select('id').limit(1);
    const accountId = accounts[0].id;

    const { data: email, error } = await supabase.from('emails').insert({
      account_id: accountId,
      message_id: `old-${Date.now()}`,
      direction: 'inbound',
      subject: testSubject,
      body_html: testBody,
      from_email: 'old@example.com',
      to_emails: [],
      body_encrypted: null // Explicitly null
    }).select().single();

    if (error) throw error;
    console.log(`Inserted Old Email ID: ${email.id}`);

    // Verify it is NOT encrypted
    const { rows: [rawEmail] } = await client.query('SELECT body_encrypted FROM emails WHERE id = $1', [email.id]);
    if (rawEmail.body_encrypted) {
      console.error('❌ Unexpected: Email was encrypted despite trigger disabled!');
    } else {
      console.log('✓ Email is unencrypted as expected.');
    }

    // Re-enable trigger
    console.log('Re-enabling trigger...');
    await client.query('ALTER TABLE emails ENABLE TRIGGER encrypt_email_body_on_insert');

    // Perform Backfill Update (Touch the row)
    console.log('Running Backfill Update...');
    // We update a field that isn't body_encrypted. e.g. updated_at
    const { error: updateError } = await supabase
      .from('emails')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', email.id);
    
    if (updateError) throw updateError;

    // Verify Encryption
    const { rows: [updatedEmail] } = await client.query('SELECT body_encrypted FROM emails WHERE id = $1', [email.id]);
    if (updatedEmail.body_encrypted) {
      console.log('✅ Backfill Successful: Email is now encrypted.');
      
      // Cleanup
      await supabase.from('emails').delete().eq('id', email.id);
    } else {
      console.error('❌ Backfill Failed: Email is still unencrypted.');
    }

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await client.end();
  }
}

testBackfill();
