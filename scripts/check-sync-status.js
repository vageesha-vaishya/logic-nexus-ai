
import { createClient } from '@supabase/supabase-js';

// Load .env manually since we might not be running with --env-file
import fs from 'fs';
import path from 'path';

function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const env = {};
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[match[1].trim()] = value;
      }
    });
    return env;
  } catch (e) {
    console.error("Could not load .env file", e);
    return {};
  }
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

console.log(`Connecting to ${SUPABASE_URL}...`);
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkStatus() {
  try {
    // 1. Check Email Accounts
    const { data: accounts, error: accError } = await supabase
      .from('email_accounts')
      .select('*');
    
    if (accError) {
      console.error("Error fetching email_accounts:", accError);
    } else {
      console.log(`\nFound ${accounts.length} email accounts:`);
      accounts.forEach(a => {
        console.log(`- ${a.email_address} (Provider: ${a.provider}, ID: ${a.id})`);
      });
    }

    // 2. Check Emails
    const { count: emailCount, error: emailError } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true });

    if (emailError) {
      console.error("Error fetching emails count:", emailError);
    } else {
      console.log(`\nTotal emails in DB: ${emailCount}`);
    }

    // 3. Check Sync Logs
    const { data: logs, error: logsError } = await supabase
      .from('email_sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5);

    if (logsError) {
       // Table might not exist if migration failed
       console.error("Error fetching email_sync_logs (Table might be missing?):", logsError);
    } else {
      console.log(`\nLast 5 Sync Logs:`);
      if (logs.length === 0) console.log("  (No logs found)");
      logs.forEach(l => {
        console.log(`- [${l.started_at}] Account: ${l.account_id} | Status: ${l.status} | Synced: ${l.emails_synced} | Details: ${JSON.stringify(l.details)}`);
      });
    }

  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

checkStatus();
