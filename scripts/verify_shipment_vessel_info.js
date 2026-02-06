
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

async function verifyVesselInfo() {
  console.log('Starting Vessel Info Verification...');

  // 1. Get a tenant
  const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
  if (!tenant) throw new Error('No tenant found');
  console.log('Using Tenant:', tenant.id);

  // 2. Create Shipment with Vessel Info
  const shipmentData = {
    tenant_id: tenant.id,
    shipment_number: 'TEST-VESSEL-' + Date.now(),
    status: 'draft',
    shipment_type: 'ocean_freight',
    origin_address: { city: 'Shanghai', country: 'China' },
    destination_address: { city: 'Rotterdam', country: 'Netherlands' },
    vessel_name: 'EVER GIVEN',
    voyage_number: 'V12345',
    port_of_loading: 'Shanghai Port',
    port_of_discharge: 'Rotterdam Port',
    place_of_receipt: 'Shanghai Warehouse', // Check if this saves (if column exists)
    place_of_delivery: 'Rotterdam Terminal' // Check if this saves (if column exists)
  };

  console.log('Creating shipment with data:', JSON.stringify(shipmentData, null, 2));

  const { data: shipment, error } = await supabase
    .from('shipments')
    .insert(shipmentData)
    .select()
    .single();

  if (error) {
    console.error('Error creating shipment:', error);
    process.exit(1);
  }

  console.log('Shipment created:', shipment.id);

  // 3. Verify Fields
  console.log('Verifying fields...');
  if (shipment.vessel_name !== 'EVER GIVEN') console.error('FAIL: vessel_name mismatch');
  else console.log('PASS: vessel_name saved correctly');

  if (shipment.voyage_number !== 'V12345') console.error('FAIL: voyage_number mismatch');
  else console.log('PASS: voyage_number saved correctly');

  if (shipment.port_of_loading !== 'Shanghai Port') console.error('FAIL: port_of_loading mismatch');
  else console.log('PASS: port_of_loading saved correctly');

  if (shipment.port_of_discharge !== 'Rotterdam Port') console.error('FAIL: port_of_discharge mismatch');
  else console.log('PASS: port_of_discharge saved correctly');

  // Optional fields check
  if (shipment.place_of_receipt !== 'Shanghai Warehouse') console.warn('WARN: place_of_receipt not saved (maybe column missing or not in select?)');
  else console.log('PASS: place_of_receipt saved correctly');

  // 4. Simulate Document Viewer Fetch
  console.log('Simulating Document Viewer Fetch...');
  const { data: docData, error: docError } = await supabase
    .from('shipments')
    .select(`
      *,
      accounts(name)
    `)
    .eq('id', shipment.id)
    .single();

  if (docError) {
    console.error('Error fetching for document:', docError);
  } else {
    console.log('Document Data Fetched successfully.');
    if (docData.vessel_name === 'EVER GIVEN') console.log('PASS: Document data contains vessel info.');
    else console.error('FAIL: Document data missing vessel info.');
  }

  // Cleanup
  console.log('Cleaning up...');
  await supabase.from('shipments').delete().eq('id', shipment.id);
  console.log('Done.');
}

verifyVesselInfo().catch(console.error);
