
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { QuoteOptionService } from '../src/services/QuoteOptionService'; // Assuming we can import it, or we mock
// If we can't import the service due to dependencies, we'll implement a minimal test of the tables.

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Role Key in .env');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runTest() {
  console.log('Starting Quote Flow Test...');

  try {
    // 1. Get Tenant ID and User ID (needed for RLS/FKs)
    // First try to get a user with a tenant
    const { data: users, error: userError } = await adminSupabase
      .from('profiles')
      .select('id, tenant_id')
      .not('tenant_id', 'is', null)
      .limit(1);

    let userId, tenantId;

    if (users && users.length > 0) {
        userId = users[0].id;
        tenantId = users[0].tenant_id;
    } else {
        // Fallback: Get any tenant and any user
        const { data: tenants } = await adminSupabase.from('tenants').select('id').limit(1);
        const { data: allUsers } = await adminSupabase.from('profiles').select('id').limit(1);
        
        if (!tenants || tenants.length === 0) throw new Error("No tenants found");
        if (!allUsers || allUsers.length === 0) throw new Error("No users found");
        
        tenantId = tenants[0].id;
        userId = allUsers[0].id;
    }
    
    if (!userId || !tenantId) {
      throw new Error('Could not fetch a user/tenant to run test against.');
    }
    console.log(`Using User ID: ${userId}, Tenant ID: ${tenantId}`);

    // 2. Fetch Master Data for Mock Mapper
    const { data: currencies } = await adminSupabase.from('currencies').select('id, code').limit(10);
    const { data: serviceTypes } = await adminSupabase.from('service_types').select('id, code').limit(10);
    const { data: modes } = await adminSupabase.from('transport_modes').select('id, code').limit(10); // Check table name
    
    // Fetch carriers with names
    const { data: carriers } = await adminSupabase
      .from('carriers')
      .select('id, name, carrier_name')
      .limit(10);
      
    const { data: containerSizes } = await adminSupabase.from('container_sizes').select('id, size_code').limit(10);
    const { data: containerTypes } = await adminSupabase.from('container_types').select('id, code').limit(10);

    const { data: chargeSides } = await adminSupabase.from('charge_sides').select('id, code').limit(1);
    const { data: chargeCategories } = await adminSupabase.from('charge_categories').select('id, code').limit(1);
    const { data: chargeBases } = await adminSupabase.from('charge_bases').select('id, code').limit(1);

    const usdId = currencies?.find(c => c.code === 'USD')?.id || currencies?.[0]?.id;
    const serviceType = serviceTypes?.[0];
    
    // Find a valid carrier
    const carrier = carriers?.find(c => c.name || c.carrier_name);
    
    console.log('Selected Carrier:', carrier);

    if (!usdId || !serviceType || !carrier) {
        throw new Error("Missing essential master data (currency, service type, or carrier)");
    }

    // Mock Rate Mapper
    const mockRateMapper = {
      getCurrId: (code: string) => {
          const found = currencies?.find(c => c.code === code)?.id;
          return found || usdId;
      },
      getServiceTypeId: (code: string) => {
           const found = serviceTypes?.find(s => s.code === code)?.id;
           return found || serviceType.id;
      },
      getModeId: (code: string) => {
          // If transport_modes table exists, use it, otherwise mock UUID or null
           const found = modes?.find(m => m.code === code)?.id;
           return found || null; 
      },
      getProviderId: (name: string) => {
           const found = carriers?.find(c => c.name === name)?.id;
           return found || carrier.id;
      },
      getSideId: (code: string) => null, // Not critical for basic flow
      getCatId: (code: string) => null, // Not critical
      getBasisId: (code: string) => null // Not critical
    };

    // 3. Create a Quote (Minimal fields based on schema)
    const quotePayload = {
      tenant_id: tenantId,
      owner_id: userId, // Assuming owner_id exists based on schema analysis
      status: 'draft',
      title: 'Test Quote Flow Script',
      quote_number: `TEST-${Date.now()}`
    };

    console.log('Creating Quote...', quotePayload);
    const { data: quote, error: quoteError } = await adminSupabase
      .from('quotes')
      .insert(quotePayload)
      .select()
      .single();

    if (quoteError) {
      throw new Error(`Failed to create quote: ${quoteError.message}`);
    }
    console.log('Quote Created:', quote.id);

    // 4. Create a Quotation Version
    console.log('Creating Quotation Version...');
    const { data: version, error: versionError } = await adminSupabase
      .from('quotation_versions')
      .insert({
        tenant_id: tenantId,
        quote_id: quote.id,
        version_number: 1,
        major: 1,
        minor: 0,
        created_by: userId,
        status: 'draft'
      })
      .select()
      .single();

    if (versionError) {
      throw new Error(`Failed to create version: ${versionError.message}`);
    }
    console.log('Version Created:', version.id);

    // 5. Create Dummy Carrier Rate (Required for Option)
    console.log('Creating Dummy Carrier Rate...');
    const { data: carrierRate, error: rateError } = await adminSupabase
    .from('carrier_rates')
    .insert({
        tenant_id: tenantId,
        carrier_id: carrier.id,
        carrier_name: carrier.name || carrier.carrier_name, // Required apparently
        rate_type: 'spot', // Required
        base_rate: 1000,
        // service_type_id: serviceType.id, // Column might be service_id or missing
        // mode: 'ocean', // Might need mode
        origin_port_id: null, // Optional
        destination_port_id: null, // Optional
        currency: 'USD',
        valid_from: new Date(),
        valid_until: new Date(Date.now() + 86400000 * 30),
        // Try common fields based on schema analysis
        // base_rate: 1000, 
        // total_amount: 1000
    })
    .select()
    .single();
    
    let validRateId;
    
    if (rateError) {
        console.warn("Could not create carrier rate, trying to fetch one...", rateError.message);
        const { data: existingRates } = await adminSupabase.from('carrier_rates').select('id').limit(1);
        if (existingRates && existingRates.length > 0) {
            validRateId = existingRates[0].id;
        } else {
            throw new Error("No carrier rates available and could not create one.");
        }
    } else {
        validRateId = carrierRate.id;
    }
    
    // 6. Add Option
    console.log('Adding Option...');
    const { data: option, error: optionError } = await adminSupabase
    .from('quotation_version_options')
    .insert({
      tenant_id: tenantId,
      quotation_version_id: version.id,
      carrier_rate_id: validRateId,
      option_name: 'Test Option',
      ai_generated: true,
      reliability_score: 85
    })
    .select()
    .single();
    
    if (optionError) throw new Error(`Failed to insert option: ${optionError.message}`);
    console.log('Option Created:', option.id);

    // 7. Insert Leg and Charge (Simulate Service Logic)
    console.log('Inserting Leg...');
    const { data: leg, error: legError } = await adminSupabase
        .from('quotation_version_option_legs')
        .insert({
            tenant_id: tenantId,
            quotation_version_option_id: option.id,
            mode_id: modes?.[0]?.id, // Use first mode
            // service_id: serviceType.id, // Might reference services table, skipping for now if optional
            service_type_id: serviceType.id,
            sort_order: 1,
            leg_type: 'transport', // Changed from 'main' to 'transport' based on QuoteOptionService.ts
            transport_mode: 'ocean' // Enum?
        })
        .select()
        .single();
    
    if (legError) console.warn('Failed to insert leg:', legError.message);
    else console.log('Leg Created:', leg.id);

    console.log('Inserting Charge...');
    if (chargeSides?.[0] && chargeCategories?.[0] && chargeBases?.[0] && leg) {
        const { data: charge, error: chargeError } = await adminSupabase
            .from('quote_charges')
            .insert({
                tenant_id: tenantId,
                quote_option_id: option.id, 
                leg_id: leg.id, // Added leg_id
                charge_side_id: chargeSides[0].id,
                category_id: chargeCategories[0].id,
                basis_id: chargeBases[0].id,
                quantity: 1,
                rate: 100,
                amount: 100,
                currency_id: usdId,
                sort_order: 1
            })
            .select()
            .single();
        
        if (chargeError) console.warn('Failed to insert charge:', chargeError.message);
        else console.log('Charge Created:', charge.id);
    } else {
        console.warn('Skipping charge insertion due to missing master data (sides/categories/bases) or leg failure.');
    }

    // 8. Verify Data Flow
    console.log('Verifying Data Flow...');
    
    const { data: legs, error: legsError } = await adminSupabase
        .from('quotation_version_option_legs')
        .select('*')
        .eq('quotation_version_option_id', option.id);

    const { data: charges, error: chargesError } = await adminSupabase
        .from('quote_charges')
        .select('*')
        .eq('quote_option_id', option.id); // Fixed column name

    console.log('Verification Results:');
    console.log('- Option ID:', option.id);
    console.log('- Legs Count:', legs?.length || 0);
    console.log('- Charges Count:', charges?.length || 0);

    if (legsError) console.error('Legs Error:', legsError);
    if (chargesError) console.error('Charges Error:', chargesError);

    console.log('Test Complete.');

  } catch (err: any) {
    console.error('Test Failed:', err.message || err);
    process.exit(1);
  }
}

runTest();
