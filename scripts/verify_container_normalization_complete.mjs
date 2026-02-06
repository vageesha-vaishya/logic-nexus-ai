import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyNormalization() {
  console.log('Starting Container Normalization Verification...');
  let errors = 0;

  // 1. Verify Master Data
  console.log('\n1. Verifying Master Data...');
  const { count: typeCount, error: typeErr } = await supabase.from('container_types').select('*', { count: 'exact', head: true });
  if (typeErr) {
    console.error('❌ Error checking container_types:', typeErr.message);
    errors++;
  } else {
    console.log(`✅ container_types count: ${typeCount}`);
    if (typeCount === 0) {
      console.error('❌ container_types is empty!');
      errors++;
    }
  }

  const { count: sizeCount, error: sizeErr } = await supabase.from('container_sizes').select('*', { count: 'exact', head: true });
  if (sizeErr) {
    console.error('❌ Error checking container_sizes:', sizeErr.message);
    errors++;
  } else {
    console.log(`✅ container_sizes count: ${sizeCount}`);
    if (sizeCount === 0) {
        console.error('❌ container_sizes is empty!');
        errors++;
    }
  }

  // 2. Verify Quote Cargo Configurations
  console.log('\n2. Verifying Quote Cargo Configurations...');
  const { data: quoteCargo, error: qcErr } = await supabase
    .from('quote_cargo_configurations')
    .select('id, container_type, container_type_id')
    .not('container_type', 'is', null);
  
  if (qcErr) {
      // If column doesn't exist, this will fail
      console.error('❌ Error checking quote_cargo_configurations:', qcErr.message);
      errors++;
  } else {
      const missingId = quoteCargo.filter(r => r.container_type && !r.container_type_id);
      if (missingId.length > 0) {
          console.error(`❌ ${missingId.length} rows in quote_cargo_configurations have text but missing UUID!`);
          errors++;
      } else {
          console.log(`✅ All ${quoteCargo.length} quote configurations with container_type have container_type_id.`);
      }
  }

  // 3. Verify Shipment Cargo Configurations
  console.log('\n3. Verifying Shipment Cargo Configurations...');
  const { data: shipCargo, error: scErr } = await supabase
    .from('shipment_cargo_configurations')
    .select('id, container_type, container_type_id')
    .not('container_type', 'is', null);

  if (scErr) {
      console.error('❌ Error checking shipment_cargo_configurations:', scErr.message);
      errors++;
  } else {
      const missingId = shipCargo.filter(r => r.container_type && !r.container_type_id);
      if (missingId.length > 0) {
          console.error(`❌ ${missingId.length} rows in shipment_cargo_configurations have text but missing UUID!`);
          errors++;
      } else {
          console.log(`✅ All ${shipCargo.length} shipment configurations with container_type have container_type_id.`);
      }
  }

  // 4. Verify Shipment Containers
  console.log('\n4. Verifying Shipment Containers...');
  const { data: shipCont, error: sContErr } = await supabase
    .from('shipment_containers')
    .select('id, container_type, container_type_id')
    .not('container_type', 'is', null);

  if (sContErr) {
      console.error('❌ Error checking shipment_containers:', sContErr.message);
      errors++;
  } else {
      const missingId = shipCont.filter(r => r.container_type && !r.container_type_id);
      if (missingId.length > 0) {
          console.error(`❌ ${missingId.length} rows in shipment_containers have text but missing UUID!`);
          errors++;
      } else {
          console.log(`✅ All ${shipCont.length} shipment containers with container_type have container_type_id.`);
      }
  }

  // 5. Verify Constraints (via Schema Inspection RPC if possible, or just implicit by previous checks)
  // We'll trust the migration logs for constraints, but we can try to violate them?
  // No, better not to insert bad data in verification.

  if (errors === 0) {
      console.log('\n🎉 VERIFICATION SUCCESSFUL: All container references are normalized.');
  } else {
      console.error(`\n❌ VERIFICATION FAILED with ${errors} errors.`);
      process.exit(1);
  }
}

verifyNormalization().catch(console.error);
