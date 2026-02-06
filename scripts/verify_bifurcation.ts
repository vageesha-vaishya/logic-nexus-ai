
import { createClient } from '@supabase/supabase-js';
import { QuoteOptionService } from '../src/services/QuoteOptionService.ts';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyBifurcation() {
  console.log('Starting Bifurcation Verification...');

  // 1. Get Tenant ID
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (tenantError || !tenant) {
      console.error('Failed to fetch a valid tenant:', tenantError);
      return;
  }
  
  const tenantId = tenant.id;
  console.log('Using Tenant ID:', tenantId);

  // 2. Setup Test Data (Quote & Version)
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      status: 'draft',
      title: 'Bifurcation Test Quote'
    })
    .select()
    .single();

  if (quoteError) {
    console.error('Failed to create quote:', quoteError);
    return;
  }
  console.log('Created Quote:', quote.id);

  const { data: version, error: versionError } = await supabase
    .from('quotation_versions')
    .insert({
      tenant_id: tenantId,
      quote_id: quote.id,
      version_number: 1
    })
    .select()
    .single();

  if (versionError) {
    console.error('Failed to create version:', versionError);
    return;
  }
  console.log('Created Version:', version.id);

  // 3. Fetch Real IDs for Mapper
  const [
    { data: categories },
    { data: sides },
    { data: bases },
    { data: currencies },
    { data: serviceTypes },
    { data: serviceModes },
    { data: carriers }
  ] = await Promise.all([
    supabase.from('charge_categories').select('id, code, name'),
    supabase.from('charge_sides').select('id, code, name'),
    supabase.from('charge_bases').select('id, code, name'),
    supabase.from('currencies').select('id, code'),
    supabase.from('service_types').select('id, code, name, transport_modes(code)'),
    supabase.from('service_modes').select('id, code, name'),
    supabase.from('carriers').select('id, carrier_name, scac')
  ]);

  console.log('Available Service Modes:', serviceModes?.map(m => `${m.code} (${m.id})`));

  const mockMapper = {
      getCatId: (code: string) => categories?.find(c => c.code === code || c.name === code || c.name.toLowerCase().includes(code.toLowerCase()))?.id || categories?.[0]?.id,
      getSideId: (code: string) => sides?.find(s => s.code === code || s.name === code)?.id || sides?.[0]?.id,
      getBasisId: (code: string) => bases?.find(b => b.code === code || b.name === code)?.id || bases?.[0]?.id,
      getCurrId: (code: string) => currencies?.find(c => c.code === code)?.id || currencies?.[0]?.id,
      getServiceTypeId: (mode: string, tier: string) => serviceTypes?.[0]?.id,
      getModeId: (code: string) => {
          const mode = serviceModes?.find(m => m.code.toLowerCase() === code.toLowerCase() || m.name.toLowerCase() === code.toLowerCase());
          if (!mode) console.warn(`⚠️ Mode '${code}' not found in DB. Defaulting to ${serviceModes?.[0]?.code}`);
          return mode?.id || serviceModes?.[0]?.id;
      },
      getProviderId: (name: string) => carriers?.find(c => c.carrier_name === name)?.id || carriers?.[0]?.id
  };

  const quoteOptionService = new QuoteOptionService(supabase);

  // 4. Define Smart Quote with Multi-Leg and Ambiguous Charges
  const mockSmartQuote = {
      id: "smart-quote-option-bifurcation",
      carrier_name: "DHL Express",
      total_amount: 2500,
      currency: "USD",
      transit_time: "5 Days",
      source_attribution: "Smart Quote Engine",
      // Legs: Pickup (Road) -> Main (Air) -> Delivery (Road)
      legs: [
          { mode: "road", from: "Warehouse A", to: "JFK", transit_time: 4 }, // Pickup
          { mode: "air", from: "JFK", to: "LHR", transit_time: 8 },         // Main
          { mode: "road", from: "LHR", to: "Warehouse B", transit_time: 4 } // Delivery
      ],
      charges: [
          { description: "Pickup Fee", amount: 200, currency: "USD" },         // Should go to Leg 1
          { description: "Air Freight", amount: 1500, currency: "USD" },       // Should go to Leg 2
          { description: "Delivery Fee", amount: 300, currency: "USD" },       // Should go to Leg 3
          { description: "Fuel Surcharge", amount: 500, currency: "USD" }      // Should go to Leg 2 (Air) by keyword or Main Leg fallback
      ]
  };

  console.log('Inserting Smart Quote Option...');
  try {
      const optionId = await quoteOptionService.addOptionToVersion({
          tenantId: tenantId,
          versionId: version.id,
          rate: mockSmartQuote,
          rateMapper: mockMapper,
          source: 'smart_quote',
          context: {
              origin: 'Warehouse A',
              destination: 'Warehouse B'
          }
      });
      console.log('Option inserted:', optionId);

      // 5. Verification
      console.log('Verifying Leg Bifurcation...');

      // Fetch Legs
      const { data: legs } = await supabase
          .from('quotation_version_option_legs')
          .select('id, mode, sort_order')
          .eq('quotation_version_option_id', optionId)
          .order('sort_order', { ascending: true });

      if (!legs || legs.length !== 3) {
          console.error('❌ Leg count mismatch. Expected 3, got', legs?.length);
          return;
      }

      const leg1 = legs[0]; // Road (Pickup)
      const leg2 = legs[1]; // Air (Main)
      const leg3 = legs[2]; // Road (Delivery)

      console.log('Legs created:', legs);

      // Fetch Charges
      const { data: charges } = await supabase
          .from('quote_charges')
          .select('id, leg_id, category_id, amount')
          .eq('quote_option_id', optionId);

      if (!charges) {
          console.error('❌ No charges found');
          return;
      }

      // Check Mapping
      // Note: Amounts are doubled because insertCharges inserts Buy and Sell pair for each charge.
      // We check if AT LEAST ONE charge with the amount exists on the correct leg.
      
      const checkCharge = (desc: string, amount: number, expectedLegId: string, legName: string) => {
          // Find any charge with this amount on this leg
          // (We assume unique amounts for simplicity in this test, or we check existence)
          const match = charges.find(c => Math.abs(c.amount - amount) < 0.01 && c.leg_id === expectedLegId);
          if (match) {
              console.log(`✅ '${desc}' correctly assigned to ${legName} (Leg ID: ${expectedLegId})`);
          } else {
              // Find where it went
              const actual = charges.find(c => Math.abs(c.amount - amount) < 0.01);
              console.error(`❌ '${desc}' assigned INCORRECTLY. Expected: ${expectedLegId}, Actual: ${actual?.leg_id}`);
          }
      };

      checkCharge("Pickup Fee", 200, leg1.id, "Leg 1 (Pickup)");
      checkCharge("Air Freight", 1500, leg2.id, "Leg 2 (Main/Air)");
      checkCharge("Delivery Fee", 300, leg3.id, "Leg 3 (Delivery)");
      checkCharge("Fuel Surcharge", 500, leg2.id, "Leg 2 (Main/Air)");

  } catch (e) {
      console.error('Error inserting option:', e);
  }

  // Cleanup
  // await supabase.from('quotes').delete().eq('id', quote.id);
}

verifyBifurcation();
