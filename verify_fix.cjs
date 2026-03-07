const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(supabaseUrl, supabaseServiceKey);

async function verifyFix() {
  const quoteId = '38f327ac-ba09-4502-aacb-5ac2536c2a12'; // QUO-260202-00005
  console.log(`Verifying Fix for Quote: ${quoteId}`);

  // Mimic fetchQuoteItemsWithFallbacks logic
  // 1. Try quote_items (we know it fails)
  let items = [];
  const { data: vData, error: vError } = await client.from('quote_items').select('*');
  
  if (vError) {
      console.log('quote_items failed as expected:', vError.message);
      
      // 2. Try quote_items_core
      const { data: cData, error: cError } = await client.from('quote_items_core').select('*').eq('quote_id', quoteId);
      
      if (!cError && cData) {
          items = cData;
          console.log(`Fetched ${items.length} items from quote_items_core.`);
          
          // 3. Manual Join Logic
          const commodityIds = [...new Set(items.map(i => i.commodity_id).filter(Boolean))];
          console.log('Commodity IDs to fetch:', commodityIds);
          
          if (commodityIds.length > 0) {
              const { data: comms, error: commError } = await client
                  .from('master_commodities')
                  .select('id, name')
                  .in('id', commodityIds);
                  
              if (!commError && comms) {
                  const commMap = new Map(comms.map(c => [c.id, c.name]));
                  items.forEach(item => {
                      if (item.commodity_id && commMap.has(item.commodity_id)) {
                          item.master_commodities = { name: commMap.get(item.commodity_id) };
                          item.commodity = commMap.get(item.commodity_id);
                      }
                  });
              }
          }
          
          // 4. Fallback to product_name
          items.forEach(item => {
             if (!item.commodity && !item.master_commodities?.name) {
                 item.commodity = item.product_name || "General Cargo";
             }
          });
          
          // 5. Verify Result
          console.log('Final Items with Mapped Commodity:');
          items.forEach(i => {
              console.log(`- Item ${i.id}: Commodity="${i.commodity}", MasterCommodity=${JSON.stringify(i.master_commodities)}`);
          });
          
      } else {
          console.log('quote_items_core failed:', cError);
      }
  }
}

verifyFix();
