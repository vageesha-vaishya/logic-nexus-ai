const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillAesHtsId() {
  console.log('Starting backfill of aes_hts_id in cargo_details...');

  // 1. Fetch records needing backfill
  const { data: records, error: fetchError } = await supabase
    .from('cargo_details')
    .select('id, hs_code, commodity_description') 
    .is('aes_hts_id', null);

  if (fetchError) {
    console.error('Error fetching cargo_details:', fetchError);
    return;
  }

  console.log(`Found ${records.length} records to process.`);

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const record of records) {
    let matchId = null;
    let matchMethod = null;

    // A. Try exact match on HS Code first
    if (record.hs_code) {
      // Clean HS code (remove dots)
      const cleanHs = record.hs_code.replace(/[^0-9]/g, '');
      
      // Try to find in aes_hts_codes (assuming stored with dots or without, try likely format)
      // The schema constraint says format is with dots usually, but let's check exact match first
      const { data: exactMatches, error: exactError } = await supabase
        .from('aes_hts_codes')
        .select('id')
        .eq('hts_code', record.hs_code) // Try exact string first
        .limit(1);

      if (exactMatches && exactMatches.length > 0) {
        matchId = exactMatches[0].id;
        matchMethod = 'exact_hs_code';
      } else {
        // Try searching by stripping dots or similar
         const { data: fuzzyHsMatches, error: fuzzyHsError } = await supabase
          .rpc('search_hts_codes_smart', { 
            p_search_term: cleanHs,
            p_limit: 1 
          });
          
          if (fuzzyHsMatches && fuzzyHsMatches.length > 0) {
             // Check if the rank is high enough to be confident? 
             // rank 3.0 is exact match on cleaned code.
             if (fuzzyHsMatches[0].rank >= 2.0) {
                 matchId = fuzzyHsMatches[0].id;
                 matchMethod = 'fuzzy_hs_code';
             }
          }
      }
    }

    // B. If no match yet, try description search
    if (!matchId) {
      const description = record.commodity_description;
      
      if (description) {
        const { data: descMatches, error: descError } = await supabase
          .rpc('search_hts_codes_smart', { 
            p_search_term: description,
            p_limit: 1 
          });

        if (descError) {
          console.error(`Error searching description for record ${record.id}:`, descError);
        } else if (descMatches && descMatches.length > 0) {
           // Use the best match
           matchId = descMatches[0].id;
           matchMethod = 'smart_description_search';
           console.log(`Matched "${description}" -> ${descMatches[0].hts_code} (${descMatches[0].description.substring(0,30)}...) [Rank: ${descMatches[0].rank}]`);
        }
      }
    }

    // C. Update record if match found
    if (matchId) {
      const { error: updateError } = await supabase
        .from('cargo_details')
        .update({ aes_hts_id: matchId })
        .eq('id', record.id);

      if (updateError) {
        console.error(`Failed to update record ${record.id}:`, updateError);
        failedCount++;
      } else {
        console.log(`Updated record ${record.id} using ${matchMethod}`);
        updatedCount++;
      }
    } else {
      console.warn(`No match found for record ${record.id} (HS: ${record.hs_code}, Desc: ${record.commodity_description})`);
      skippedCount++;
    }
  }

  console.log('------------------------------------------------');
  console.log(`Backfill Complete.`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Failed:  ${failedCount}`);
}

backfillAesHtsId();
