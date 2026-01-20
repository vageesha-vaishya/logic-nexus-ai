
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) return parseEnv(envPath);
  return {};
}

function parseEnv(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            result[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
        }
    });
    return result;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
    console.log("Fetching an SMTP email account...");
    const { data: accounts, error: accError } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('provider', 'smtp_imap')
        .limit(1);

    if (accError) {
        console.error("Error fetching accounts:", accError);
        return;
    }

    if (!accounts || accounts.length === 0) {
        console.error("No SMTP email accounts found in DB.");
        return;
    }

    const account = accounts[0];
    console.log(`Found account: ${account.email_address} (ID: ${account.id})`);

    const functionUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    
    console.log("Sending test email...");
    const payload = {
        accountId: account.id,
        to: ["bahuguna.vimal@gmail.com"], // Sending to the address mentioned in the error for safety/verification
        subject: "Test Email from SMTP Provider",
        body: "<h1>It works!</h1><p>This email was sent via the new SMTP Provider in Supabase Edge Functions.</p>",
        text: "It works! This email was sent via the new SMTP Provider in Supabase Edge Functions."
    };

    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        console.error(`❌ Send failed with status ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.error("Response body:", text);
    } else {
        const data = await response.json();
        console.log("✅ Send success:", data);
    }
}

run().catch(console.error);
