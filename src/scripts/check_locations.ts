import { supabase } from '../integrations/supabase/client';

async function checkLocations() {
  const { count, error } = await supabase
    .from('ports_locations')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Total locations:', count);
  }
}

checkLocations();
