import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role to bypass RLS for diagnosis

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const quoteNumber = 'MGL-SYS-1770819021371';

async function main() {
  console.log(`Looking up quote number: ${quoteNumber}`);
  const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select('id, tenant_id')
            .eq('quote_number', quoteNumber)
            .single();

  if (quoteError || !quote) {
    console.error('Quote not found:', quoteError);
    return;
  }

  const quoteId = quote.id;
  console.log(`Verifying query for quote: ${quoteId}`);
  console.log(`Quote Tenant ID: ${quote.tenant_id}`);

  // Check versions existence first
  const { data: versions, error: versionsError } = await supabase
    .from('quotation_versions')
    .select('id, version_number')
    .eq('quote_id', quoteId);
  
  if (versionsError) {
      console.error('Error fetching simple versions:', versionsError);
      return;
  }
  console.log(`Found ${versions?.length} versions for quote ${quoteId}`);
  if (versions) {
      versions.forEach(v => console.log(`  Version ${v.version_number}: ${v.id}`));
  }

  // Simulate the query from useQuoteRepository.ts
  const { data: latestVersion, error: versionError } = await supabase
    .from('quotation_versions')
    .select(`
        id, 
        version_number, 
        quote_id,
        quotation_version_options (
            id, 
            is_selected, 
            total_amount, 
            quotation_version_id,
            quote_currency:quote_currency_id (code),
            total_transit_days, 
            quotation_version_option_legs (
                id,
                sort_order,
                mode,
                quotation_version_option_id,
                quotation_version_option_leg_charges:quote_charges (
                    id,
                    amount,
                    currency_id,
                    charge_code:category_id,
                    tenant_id,
                    leg_id,
                    quote_option_id
                )
            )
        )
    `)
    .eq('quote_id', quoteId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    console.error('Error fetching version with nested charges:', versionError);
    return;
  }

  if (!latestVersion) {
      console.log('No LATEST version found via nested query');
      return;
  }

  console.log(`Latest Version: ${latestVersion.version_number} (ID: ${latestVersion.id})`);
  
  if (latestVersion.quotation_version_options) {
      latestVersion.quotation_version_options.forEach((opt: any) => {
          console.log(`Option ${opt.id}: total_amount=${opt.total_amount}`);
          console.log(`  Option Version Link: ${opt.quotation_version_id}`);

          if (opt.quotation_version_option_legs) {
              opt.quotation_version_option_legs.forEach((leg: any) => {
                  console.log(`  Leg ${leg.id}`);
                  console.log(`    Leg Option Link: ${leg.quotation_version_option_id}`);
                  
                  const charges = leg.quotation_version_option_leg_charges;
                  if (charges) {
                      console.log(`    Charges found: ${charges.length}`);
                      charges.forEach((c: any) => {
                          console.log(`      Charge: ${c.id}, Amount: ${c.amount}, Tenant: ${c.tenant_id}`);
                          console.log(`      Charge Leg Link: ${c.leg_id}`);
                          console.log(`      Charge Option Link: ${c.quote_option_id}`);
                          
                          if (c.tenant_id !== quote.tenant_id) {
                              console.error(`      MISMATCH: Charge tenant ${c.tenant_id} != Quote tenant ${quote.tenant_id}`);
                          }
                          if (c.leg_id !== leg.id) {
                              console.error(`      MISMATCH: Charge leg ${c.leg_id} != Leg ${leg.id}`);
                          }
                          if (c.quote_option_id !== opt.id) {
                              console.error(`      MISMATCH: Charge option ${c.quote_option_id} != Option ${opt.id}`);
                          }
                      });
                  } else {
                      console.log(`    Charges property is MISSING or null`);
                  }
              });
              
              // Calculate total using the logic from useQuoteRepository
               const legs = opt.quotation_version_option_legs || [];
               const chargesTotal = legs.reduce((acc: number, leg: any) => {
                    const legCharges = leg.quotation_version_option_leg_charges || [];
                    return acc + legCharges.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
               }, 0);
               console.log(`  Calculated Total from script logic: ${chargesTotal}`);

          }
      });
  }
}

main();
