import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const TENANT_ID = 'bb451198-2877-4345-a578-d404c5720f1a'; // SOS Services

const CARRIERS = [
  { carrier_name: 'Maersk', mode: 'ocean', carrier_type: 'ocean' },
  { carrier_name: 'MSC', mode: 'ocean', carrier_type: 'ocean' },
  { carrier_name: 'CMA CGM', mode: 'ocean', carrier_type: 'ocean' },
  { carrier_name: 'COSCO', mode: 'ocean', carrier_type: 'ocean' },
  { carrier_name: 'Hapag-Lloyd', mode: 'ocean', carrier_type: 'ocean' },
  
  { carrier_name: 'Emirates SkyCargo', mode: 'air', carrier_type: 'air_cargo' },
  { carrier_name: 'Lufthansa Cargo', mode: 'air', carrier_type: 'air_cargo' },
  { carrier_name: 'FedEx Express', mode: 'air', carrier_type: 'air_cargo' },
  { carrier_name: 'Cathay Pacific Cargo', mode: 'air', carrier_type: 'air_cargo' },
  { carrier_name: 'Qatar Airways Cargo', mode: 'air', carrier_type: 'air_cargo' },
  
  { carrier_name: 'DHL Freight', mode: 'inland_trucking', carrier_type: 'trucking' },
  { carrier_name: 'UPS Freight', mode: 'inland_trucking', carrier_type: 'trucking' },
  { carrier_name: 'XPO Logistics', mode: 'inland_trucking', carrier_type: 'trucking' },
  { carrier_name: 'DB Schenker', mode: 'inland_trucking', carrier_type: 'trucking' },
  { carrier_name: 'DSV Road', mode: 'inland_trucking', carrier_type: 'trucking' }
];

async function seedCarriers() {
  console.log('Seeding carriers for tenant:', TENANT_ID);
  
  for (const carrier of CARRIERS) {
    // Check if exists for this tenant
    const { data: existing } = await supabase
      .from('carriers')
      .select('id')
      .eq('carrier_name', carrier.carrier_name)
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('carriers').insert([{
        ...carrier,
        tenant_id: TENANT_ID,
        is_active: true
      }]);
      
      if (error) {
        console.error(`Failed to insert ${carrier.carrier_name}:`, error.message);
      } else {
        console.log(`Inserted ${carrier.carrier_name}`);
      }
    } else {
      console.log(`Skipped ${carrier.carrier_name} (exists)`);
      // Update mode if it's missing/wrong
      await supabase.from('carriers').update({ mode: carrier.mode }).eq('id', existing.id);
    }
  }
  
  console.log('Seeding complete.');
}

seedCarriers();
