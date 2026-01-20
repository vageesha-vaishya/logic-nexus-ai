
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const sql = `
SELECT count(*)::int FROM email_audit_log;
`;

async function run() {
  console.log("Checking email_audit_log count...");
    
    const { data, error } = await supabase.functions.invoke('execute-sql-external', {
        body: {
            action: 'query', // Assuming query action returns rows
            useLocalDb: true,
            query: sql
        }
    });

    if (error) {
        console.error("Error invoking function:", error);
    } else {
        console.log("Result:", JSON.stringify(data, null, 2));
    }
}

run().catch(console.error);
