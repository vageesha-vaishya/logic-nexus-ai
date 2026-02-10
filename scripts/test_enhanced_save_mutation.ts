import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- Starting Enhanced Save Mutation Verification ---');

  // 1. Setup Tenant and Account (reuse logic)
  const { data: validTenant } = await supabase.from('tenants').select('id').limit(1).maybeSingle();
  // If no tenant table or no rows, fallback to a dummy UUID (some implementations use public schema without tenants table)
  // We'll check if we can insert without tenant_id or if we need one.
  // Assuming optional tenant_id for now if not found.
  const finalTenantId = validTenant?.id || null;

  // 2. Create Quote
  const quoteId = crypto.randomUUID();
  const quoteData: any = {
    id: quoteId,
    title: 'Enhanced Save Mutation Test',
    status: 'draft',
    transport_mode: 'air'
  };
  if (finalTenantId) quoteData.tenant_id = finalTenantId;

  const { error: qError } = await supabase.from('quotes').insert(quoteData);
  if (qError) {
      console.error('Failed to create quote:', qError);
      process.exit(1);
  }
  console.log('Quote created:', quoteId);

  // 3. Create Quotation Version
  const versionId = crypto.randomUUID();
  const versionData: any = {
      id: versionId,
      quote_id: quoteId,
      version_number: 1,
      valid_until: new Date(Date.now() + 86400000).toISOString()
  };
  if (finalTenantId) versionData.tenant_id = finalTenantId;

  const { error: vError } = await supabase.from('quotation_versions').insert(versionData);
  if (vError) {
      console.error('Failed to create version:', vError);
      process.exit(1);
  }

  // 4. Create Option
  const optionId = crypto.randomUUID();
  const optionData: any = {
      id: optionId,
      quotation_version_id: versionId,
      option_name: 'Test Option',
      is_selected: true,
      total_amount: 1000
  };
  if (finalTenantId) optionData.tenant_id = finalTenantId;

  const { error: oError } = await supabase.from('quotation_version_options').insert(optionData);
  if (oError) {
      console.error('Failed to create option:', oError);
      process.exit(1);
  }

  // 5. Create Leg with New Fields
  const legId = crypto.randomUUID();
  const departureDate = new Date().toISOString();
  const arrivalDate = new Date(Date.now() + 3600000).toISOString();
  const flightNumber = 'EK202';
  
  const legData: any = {
      id: legId,
      quotation_version_option_id: optionId,
      mode: 'air',
      leg_type: 'transport',
      sort_order: 1,
      flight_number: flightNumber,
      departure_date: departureDate,
      arrival_date: arrivalDate,
      transit_time_hours: 5
  };
  if (finalTenantId) legData.tenant_id = finalTenantId;

  console.log('Inserting Leg with enhanced details:', legData);
  const { error: lError } = await supabase.from('quotation_version_option_legs').insert(legData);
  
  if (lError) {
      console.error('Failed to insert leg:', lError);
      process.exit(1);
  }

  // 6. Verify Persistence
  const { data: fetchedLeg, error: fError } = await supabase
      .from('quotation_version_option_legs')
      .select('*')
      .eq('id', legId)
      .single();

  if (fError) {
      console.error('Failed to fetch leg:', fError);
      process.exit(1);
  }

  console.log('Fetched Leg:', fetchedLeg);

  // Normalize dates for comparison (DB might return slightly different precision)
  const dbDepDate = new Date(fetchedLeg.departure_date).toISOString();
  const dbArrDate = new Date(fetchedLeg.arrival_date).toISOString();

  if (
      fetchedLeg.flight_number === flightNumber &&
      dbDepDate === departureDate &&
      dbArrDate === arrivalDate
  ) {
      console.log('[SUCCESS] Enhanced leg details persisted correctly.');
  } else {
      console.error('[FAILURE] Leg details mismatch.');
      console.error('Expected:', { flightNumber, departureDate, arrivalDate });
      console.error('Actual:', { 
          flightNumber: fetchedLeg.flight_number, 
          departureDate: dbDepDate, 
          arrivalDate: dbArrDate 
      });
      process.exit(1);
  }

  // 7. Test Update (Simulation of Save Mutation update)
  console.log('Testing Update...');
  const newFlightNumber = 'QF1';
  const { error: uError } = await supabase
      .from('quotation_version_option_legs')
      .update({ flight_number: newFlightNumber })
      .eq('id', legId);

  if (uError) {
      console.error('Failed to update leg:', uError);
      process.exit(1);
  }

  const { data: updatedLeg } = await supabase
      .from('quotation_version_option_legs')
      .select('flight_number')
      .eq('id', legId)
      .single();

  if (updatedLeg && updatedLeg.flight_number === newFlightNumber) {
      console.log('[SUCCESS] Update verification passed.');
  } else {
      console.error('[FAILURE] Update verification failed.');
  }

  // Cleanup
  console.log('Cleaning up...');
  await supabase.from('quotes').delete().eq('id', quoteId); // Cascade should handle the rest
}

main().catch(console.error);
