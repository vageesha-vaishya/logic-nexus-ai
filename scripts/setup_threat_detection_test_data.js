import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Get an account
  const { data: accounts, error: accError } = await supabase.from('email_accounts').select('id, tenant_id').limit(1);
  if (accError) {
    console.error("Error fetching accounts:", accError);
    return;
  }
  if (!accounts || accounts.length === 0) {
    console.error("No email accounts found. Please create one first.");
    return;
  }
  const account = accounts[0];

  console.log(`Using account: ${account.id} (Tenant: ${account.tenant_id})`);

  // 2. Insert Malicious Email
  const { data: malicious, error: err1 } = await supabase.from('emails').insert({
    account_id: account.id,
    tenant_id: account.tenant_id,
    subject: "URGENT: Verify your bank account (TEST MALICIOUS)",
    from_email: "attacker@evil.com",
    from_name: "Bank Support",
    body_text: "Click here to download the virus.exe",
    folder: "quarantine",
    security_status: "malicious",
    is_read: false,
    received_at: new Date().toISOString(),
    quarantine_reason: "Detected malicious keyword: virus",
    message_id: `test-malicious-${Date.now()}`,
    direction: 'inbound'
  }).select().single();

  if (err1) console.error("Error inserting malicious:", err1);
  else console.log("Inserted Malicious Email:", malicious.id);

  // 3. Insert Suspicious Email
  const { data: suspicious, error: err2 } = await supabase.from('emails').insert({
    account_id: account.id,
    tenant_id: account.tenant_id,
    subject: "You won a lottery! (TEST SUSPICIOUS)",
    from_email: "promo@spam.com",
    from_name: "Lottery",
    body_text: "Click here to claim your prize.",
    folder: "inbox",
    security_status: "suspicious",
    is_read: false,
    received_at: new Date().toISOString(),
    message_id: `test-suspicious-${Date.now()}`,
    direction: 'inbound'
  }).select().single();

  if (err2) console.error("Error inserting suspicious:", err2);
  else console.log("Inserted Suspicious Email:", suspicious.id);

  // 4. Insert Clean Email
  const { data: clean, error: err3 } = await supabase.from('emails').insert({
    account_id: account.id,
    tenant_id: account.tenant_id,
    subject: "Meeting Notes (TEST CLEAN)",
    from_email: "colleague@work.com",
    from_name: "Colleague",
    body_text: "Here are the notes.",
    folder: "inbox",
    security_status: "clean",
    is_read: false,
    received_at: new Date().toISOString(),
    message_id: `test-clean-${Date.now()}`,
    direction: 'inbound'
  }).select().single();

  if (err3) console.error("Error inserting clean:", err3);
  else console.log("Inserted Clean Email:", clean.id);
}

main();
