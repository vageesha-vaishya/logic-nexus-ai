
import { createClient } from '@supabase/supabase-js';
import { QuoteOptionService } from '../src/services/QuoteOptionService.ts';
import { PluginRegistry } from '../src/services/plugins/PluginRegistry.ts';
import { LogisticsPlugin } from '../src/plugins/logistics/LogisticsPlugin.ts';
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

async function verifyAiQuoteTransfer() {
  console.log('Starting AI Quote Transfer Verification...');

  // 1. Get Tenant ID (Bypass Auth with Service Role)
  // Fetch the first valid tenant
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

  /* 
  // Authentication skipped - using Service Role
  const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL || 'admin@example.com',
    password: process.env.TEST_USER_PASSWORD || 'password'
  });
  */

  // 2. Setup Test Data (Quote & Version)

  // Create a Quote
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      status: 'draft',
      title: 'AI Transfer Test Quote'
    })
    .select()
    .single();

  if (quoteError) {
    console.error('Failed to create quote:', quoteError);
    return;
  }
  console.log('Created Quote:', quote.id);

  // Create a Version
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

  // 3. Simulate QuoteNew.tsx Logic: Update Version with Global AI Context
  const aiContextPayload = {
      marketAnalysis: "Market is volatile due to seasonal demand.",
      confidenceScore: 85.5,
      anomalies: ["High Fuel Surcharge Detected"]
  };

  console.log('Simulating QuoteNew.tsx version update with AI context...');
  const { error: versionUpdateError } = await supabase
      .from('quotation_versions')
      .update({
         market_analysis: aiContextPayload.marketAnalysis,
         confidence_score: aiContextPayload.confidenceScore,
         anomalies: aiContextPayload.anomalies
      })
      .eq('id', version.id);

  if (versionUpdateError) {
      console.error('Failed to update version with AI context:', versionUpdateError);
  } else {
      console.log('Version updated successfully.');
  }

  // 4. Simulate QuoteNew.tsx Logic: Insert Option via QuoteOptionService
  // Mock Master Data for Rate Mapper (Simplified)
  // We need to fetch real IDs for the mapper to work, or mock the mapper.
  // Let's fetch real IDs to be safe.
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

  const logisticsPlugin = new LogisticsPlugin(); // Assuming default constructor works or we need to look at it
  // Wait, LogisticsPlugin needs to be instantiated. Let's check its constructor.
  // Based on reading QuoteNew.tsx: const logisticsPlugin = PluginRegistry.getPlugin('plugin-logistics-core') as LogisticsPlugin;
  // We might not have PluginRegistry initialized in this script.
  // Let's just create the mapper manually if possible or use the plugin if it doesn't have complex dependencies.
  
  // Actually, QuoteOptionService expects a rateMapper. Let's construct a simple mock mapper that returns valid IDs.
  // This avoids dependency hell in the script.
  const mockMapper = {
      getCatId: (code: string) => categories?.find(c => c.code === code || c.name === code)?.id || categories?.[0]?.id,
      getSideId: (code: string) => sides?.find(s => s.code === code || s.name === code)?.id || sides?.[0]?.id,
      getBasisId: (code: string) => bases?.find(b => b.code === code || b.name === code)?.id || bases?.[0]?.id,
      getCurrId: (code: string) => currencies?.find(c => c.code === code)?.id || currencies?.[0]?.id,
      getServiceTypeId: (mode: string, tier: string) => serviceTypes?.[0]?.id, // Fallback
      getModeId: (code: string) => serviceModes?.find(m => m.code === code || m.name === code)?.id || serviceModes?.[0]?.id,
      getProviderId: (name: string) => carriers?.find(c => c.carrier_name === name)?.id || carriers?.[0]?.id
  };

  const quoteOptionService = new QuoteOptionService(supabase);

  const mockAiRate = {
      id: "ai-generated-option-1",
      carrier_name: "Maersk",
      total_amount: 1500,
      currency: "USD",
      service_type: "Port to Port",
      transit_time: "25 Days",
      // AI Fields
      reliability_score: 92,
      ai_generated: true,
      ai_explanation: "Selected for high reliability and optimal route.",
      source_attribution: "AI Smart Engine",
      // Legs
      legs: [
          { mode: "ocean", from: "CNSHA", to: "USLAX", transit_time: 25 }
      ],
      // Charges
      charges: [
          { description: "Ocean Freight", amount: 1200, currency: "USD" },
          { description: "THC", amount: 300, currency: "USD" }
      ]
  };

  console.log('Inserting AI Option...');
  try {
      const optionId = await quoteOptionService.addOptionToVersion({
          tenantId: tenantId,
          versionId: version.id,
          rate: mockAiRate,
          rateMapper: mockMapper,
          source: 'ai_generated',
          context: {
              origin: 'Shanghai',
              destination: 'Los Angeles'
          }
      });
      console.log('Option inserted:', optionId);

      // 5. Verify Persistence
      console.log('Verifying Database State...');

      // Verify Version Global Fields
      const { data: verifiedVersion, error: verifyVersionError } = await supabase
          .from('quotation_versions')
          .select('market_analysis, confidence_score, anomalies')
          .eq('id', version.id)
          .single();

      if (verifyVersionError || !verifiedVersion) {
          console.error('❌ Failed to fetch verified version:', verifyVersionError);
          process.exit(1);
      }

      console.log('Version Verification:', {
          market_analysis: verifiedVersion.market_analysis === aiContextPayload.marketAnalysis ? 'PASS' : 'FAIL',
          confidence_score: verifiedVersion.confidence_score === aiContextPayload.confidenceScore ? 'PASS' : 'FAIL',
          anomalies: JSON.stringify(verifiedVersion.anomalies) === JSON.stringify(aiContextPayload.anomalies) ? 'PASS' : 'FAIL'
      });

      // Verify AI fields were persisted
    const { data: verifiedOption, error: optionError } = await supabase
        .from('quotation_version_options')
        .select('*')
        .eq('id', optionId)
        .single();

    if (optionError || !verifiedOption) {
        console.error('❌ Failed to fetch created option:', optionError);
        process.exit(1);
    }

    console.log('✅ Quote Option created successfully:', verifiedOption.id);
    
    // Check specific AI fields
    if (verifiedOption.reliability_score === 92) {
        console.log('✅ Reliability Score persisted correctly: 92');
    } else {
        console.error('❌ Reliability Score mismatch:', verifiedOption.reliability_score);
    }

    if (verifiedOption.ai_generated === true) {
        console.log('✅ AI Generated flag persisted correctly: true');
    } else {
        console.error('❌ AI Generated flag mismatch:', verifiedOption.ai_generated);
    }

    if (verifiedOption.ai_explanation === "Selected for high reliability and optimal route.") {
        console.log('✅ AI Explanation persisted correctly');
    } else {
        console.error('❌ AI Explanation mismatch:', verifiedOption.ai_explanation);
    }

    if (verifiedOption.source === "AI Smart Engine" || verifiedOption.source === "ai_generated") {
        console.log(`✅ Source persisted correctly: ${verifiedOption.source}`);
    } else {
        console.error('❌ Source mismatch:', verifiedOption.source);
    }

  } catch (e) {
      console.error('Error inserting option:', e);
  }

  // Cleanup (Optional - kept for inspection)
  // await supabase.from('quotes').delete().eq('id', quote.id);
}

verifyAiQuoteTransfer();
