
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedServiceDefinitions() {
  console.log('🌱 Seeding Service Attribute Definitions...');

  // 1. Get Service Types
  const { data: serviceTypes, error: typesError } = await supabase
    .from('service_types')
    .select('id, name, code')
    .in('name', ['Ocean Freight', 'Air Freight', 'Warehousing']);

  if (typesError) {
    console.error('Error fetching service types:', typesError);
    return;
  }

  const oceanType = serviceTypes.find(t => t.name === 'Ocean Freight' || t.code === 'ocean');
  const airType = serviceTypes.find(t => t.name === 'Air Freight' || t.code === 'air');
  const warehouseType = serviceTypes.find(t => t.name === 'Warehousing' || t.code === 'warehousing');

  const definitions = [];

  // 2. Define Ocean Attributes
  if (oceanType) {
    definitions.push(
      {
        service_type_id: oceanType.id,
        attribute_key: 'container_type',
        label: 'Container Type',
        data_type: 'select',
        validation_rules: { options: ['20GP', '40GP', '40HC', 'LCL'] },
        is_required: true,
        display_order: 10
      },
      {
        service_type_id: oceanType.id,
        attribute_key: 'incoterms',
        label: 'Supported Incoterms',
        data_type: 'select', // Multi-select logic would be handled in UI or json array
        validation_rules: { options: ['EXW', 'FOB', 'CIF', 'DDP'] },
        is_required: false,
        display_order: 20
      }
    );
  }

  // 3. Define Air Attributes
  if (airType) {
    definitions.push(
      {
        service_type_id: airType.id,
        attribute_key: 'awb_type',
        label: 'AWB Type',
        data_type: 'select',
        validation_rules: { options: ['Direct', 'Consolidated'] },
        is_required: true,
        display_order: 10
      },
      {
        service_type_id: airType.id,
        attribute_key: 'iata_agent',
        label: 'IATA Agent',
        data_type: 'boolean',
        is_required: false,
        display_order: 20
      }
    );
  }

  // 4. Define Warehousing Attributes
  if (warehouseType) {
    definitions.push(
      {
        service_type_id: warehouseType.id,
        attribute_key: 'facility_type',
        label: 'Facility Type',
        data_type: 'select',
        validation_rules: { options: ['Bonded', 'General', 'Temperature Controlled'] },
        is_required: true,
        display_order: 10
      },
      {
        service_type_id: warehouseType.id,
        attribute_key: 'total_area_sqm',
        label: 'Total Area (sqm)',
        data_type: 'number',
        validation_rules: { min: 0 },
        is_required: false,
        display_order: 20
      }
    );
  }

  // 5. Upsert Definitions
  if (definitions.length > 0) {
    const { error: upsertError } = await supabase
      .from('service_attribute_definitions')
      .upsert(definitions, { onConflict: 'service_type_id, attribute_key' });

    if (upsertError) {
      console.error('Error upserting definitions:', upsertError);
    } else {
      console.log(`✅ Successfully seeded ${definitions.length} attribute definitions.`);
    }
  } else {
    console.log('⚠️ No matching service types found to seed definitions.');
  }
}

seedServiceDefinitions().catch(console.error);
