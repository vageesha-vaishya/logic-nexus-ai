import { createClient } from '@supabase/supabase-js';

const supabase = createClient('http://localhost:54321', 'dummy-key');

async function run() {
  const { data, error } = await supabase.from('assembly_models').select('*').eq('tenant_id', 'some-id');
  console.log('Error:', error);
}

run();
