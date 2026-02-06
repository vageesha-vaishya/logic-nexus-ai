import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEndToEnd() {
  console.log('Starting End-to-End Shipment Execution Test...');

  // Fetch a valid tenant
  const { data: tenantData, error: tErr } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (tErr) throw new Error('Failed to fetch tenant: ' + tErr.message);
  const tenantId = tenantData.id;
  console.log('Using Tenant ID:', tenantId);
  
  // 1. Create a Draft Shipment with Vessel Info
  console.log('1. Creating Test Shipment with Vessel Info...');
  const { data: shipment, error: sErr } = await supabase
    .from('shipments')
    .insert({
      tenant_id: tenantId,
      shipment_number: 'TEST-SHP-' + Date.now(),
      status: 'draft',
      shipment_type: 'ocean_freight',
      origin_address: { city: 'New York', country: 'USA' },
      destination_address: { city: 'London', country: 'UK' },
      aes_itn: 'X20240216123456',
      // New fields verification
      vessel_name: 'EVER GIVEN',
      voyage_number: 'V12345',
      port_of_loading: 'USNYC',
      port_of_discharge: 'GBLON',
      pickup_date: new Date().toISOString(),
      estimated_delivery_date: new Date(Date.now() + 86400000 * 10).toISOString()
    })
    .select()
    .single();

  if (sErr) throw new Error('Failed to create shipment: ' + sErr.message);
  console.log('   Shipment created:', shipment.id);

  // 2. Add Cargo Configuration
  console.log('2. Adding Cargo Configuration...');
  const { data: config, error: ccErr } = await supabase
    .from('shipment_cargo_configurations')
    .insert({
      shipment_id: shipment.id,
      tenant_id: tenantId,
      transport_mode: 'ocean',
      container_type: '40HC',
      cargo_type: 'General Cargo', // Required field
      quantity: 1
    })
    .select()
    .single();

  if (ccErr) throw new Error('Failed to create cargo config: ' + ccErr.message);
  console.log('   Cargo Config created:', config.id);

  // 3. Add Container (Execution)
  console.log('3. Adding Container Execution...');
  const { data: container, error: cErr } = await supabase
    .from('shipment_containers')
    .insert({
      shipment_id: shipment.id,
      tenant_id: tenantId,
      container_number: 'TEST' + Date.now().toString().slice(-7),
      seal_number: 'SEAL123',
      container_type: '40HC',
      cargo_configuration_id: config.id, // Linking to config
      gross_weight_kg: 15000
    })
    .select()
    .single();

  if (cErr) throw new Error('Failed to create container: ' + cErr.message);
  console.log('   Container created:', container.id);

  // 4. Verify Data Retrieval for BOL (Simulation)
  console.log('4. Verifying Data Retrieval for Document Generation...');
  const { data: fullShipment, error: fsErr } = await supabase
    .from('shipments')
    .select(`
      *,
      shipment_containers (*)
    `)
    .eq('id', shipment.id)
    .single();

  if (fsErr) throw new Error('Failed to fetch full shipment: ' + fsErr.message);
  
  if (fullShipment.shipment_containers.length !== 1) {
    throw new Error('Verification Failed: Container not linked correctly');
  }
  
  if (fullShipment.aes_itn !== 'X20240216123456') {
    throw new Error('Verification Failed: AES ITN not saved');
  }

  // Verify new fields
  if (fullShipment.vessel_name !== 'EVER GIVEN') throw new Error('Verification Failed: Vessel Name not saved');
  if (fullShipment.voyage_number !== 'V12345') throw new Error('Verification Failed: Voyage Number not saved');
  if (fullShipment.port_of_loading !== 'USNYC') throw new Error('Verification Failed: Port of Loading not saved');
  if (fullShipment.port_of_discharge !== 'GBLON') throw new Error('Verification Failed: Port of Discharge not saved');

  console.log('SUCCESS: End-to-End Test Passed!');
  console.log(' - Shipment created with AES ITN and Vessel Info');
  console.log(' - Cargo Config created');
  console.log(' - Container assigned and linked');
  console.log(' - Data retrieval confirmed for BOL generation');
  console.log(' - Verified fields: Vessel Name, Voyage Number, Ports');

  // Cleanup
  console.log('Cleaning up test data...');
  await supabase.from('shipments').delete().eq('id', shipment.id);
}

testEndToEnd().catch(console.error);
