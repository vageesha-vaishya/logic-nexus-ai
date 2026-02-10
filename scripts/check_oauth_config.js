
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOAuthConfig() {
  console.log('Checking oauth_configurations table...');
  
  const { data, error } = await supabase
    .from('oauth_configurations')
    .select('user_id, provider, client_id, is_active');

  if (error) {
    console.error('Error fetching oauth_configurations:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No OAuth configurations found.');
  } else {
    console.log('Found OAuth configurations:');
    data.forEach(config => {
      console.log(`- User: ${config.user_id}`);
      console.log(`  Provider: ${config.provider}`);
      console.log(`  Client ID: ${config.client_id}`);
      console.log(`  Active: ${config.is_active}`);
      console.log('---');
    });
  }
}

checkOAuthConfig();
