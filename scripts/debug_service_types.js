
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkServiceTypes() {
  const { data, error } = await supabase
    .from('service_types')
    .select('id, code, name');
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Current Service Types:');
  data.forEach(t => {
    console.log(`${t.code} | ${t.name} | ${t.id}`);
  });
}

checkServiceTypes();
