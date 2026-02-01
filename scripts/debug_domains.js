
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listDomains() {
  const { data, error } = await supabase.from('platform_domains').select('*');
  if (error) {
    console.error(error);
  } else {
    console.table(data);
  }
}

listDomains();
