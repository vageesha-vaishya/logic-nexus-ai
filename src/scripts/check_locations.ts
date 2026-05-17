import { supabase } from '../integrations/supabase/client';
import { logger } from "@/lib/logger";

async function checkLocations() {
  const { count, error } = await supabase
    .from('ports_locations')
    .select('*', { count: 'exact', head: true });

  if (error) {
    logger.error('Error:', error);
  } else {
    logger.debug('Total locations:', count);
  }
}

checkLocations();
