
import { Database } from '../src/types/supabase';

const test: Database['finance']['Tables']['tax_jurisdictions']['Row'] = {
  id: '123',
  code: 'US',
  name: 'United States',
  parent_id: null,
  type: 'country',
  created_at: null
};

console.log('Types are valid!');
