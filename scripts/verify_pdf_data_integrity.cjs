const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' }
});

const quoteId = '38f327ac-ba09-4502-aacb-5ac2536c2a12';

async function safeSelect(table, columns, fallbackColumns, applyFilter, context) {
    try {
        let query = client.from(table).select(columns);
        if (applyFilter) query = applyFilter(query);
        const { data, error } = await query;
        if (error) {
            // Check if error is related to missing table
            if (error.message.includes('Could not find the table') || error.code === '42P01') {
                return { data: null, error };
            }
            throw error;
        }
        return { data, error: null };
    } catch (e) {
        return { data: null, error: e };
    }
}

async function fetchQuoteItemsWithFallbacks(quoteId) {
    console.log('Fetching items with fallbacks...');
    
    // 1. Try quote_items
    const { data: items, error } = await safeSelect(
        'quote_items',
        '*, container_types:container_type_id(name, code), master_commodities:commodity_id(name)',
        '*',
        (q) => q.eq('quote_id', quoteId),
        'quote_items fetch'
    );

    if (!error && items && items.length > 0) {
        console.log('Found items in quote_items');
        return items;
    }

    if (error && (error.message.includes('Could not find the table') || error.code === '42P01')) {
        console.log('quote_items table missing, trying quote_items_core...');
        
        // 2. Try quote_items_core
        const { data: coreItems, error: coreError } = await safeSelect(
            'quote_items_core',
            '*',
            '*',
            (q) => q.eq('quote_id', quoteId),
            'quote_items_core fetch'
        );

        if (!coreError && coreItems && coreItems.length > 0) {
            console.log(`Found ${coreItems.length} items in quote_items_core`);
            
            // Manual Commodity Join Logic
            const commodityIds = [...new Set(coreItems.map(i => i.commodity_id).filter(Boolean))];
            
            if (commodityIds.length > 0) {
                const { data: comms, error: cError } = await client
                    .from('master_commodities')
                    .select('id, name')
                    .in('id', commodityIds);
                
                if (!cError && comms) {
                    const commMap = new Map(comms.map(c => [c.id, c.name]));
                    coreItems.forEach(item => {
                        if (item.commodity_id && commMap.has(item.commodity_id)) {
                            item.master_commodities = { name: commMap.get(item.commodity_id) };
                            item.commodity = commMap.get(item.commodity_id);
                        }
                    });
                }
            }
            
            coreItems.forEach(item => {
                if (!item.commodity && !item.master_commodities?.name) {
                    item.commodity = item.product_name || "General Cargo";
                }
            });
            
            return coreItems;
        }
    }
    
    console.log('No items found in any table.');
    return [];
}

function mapQuoteItemsToRawItems(items) {
    if (!items) return [];
    return items.map((i) => {
      const weight = Number(
        typeof i.weight_kg !== "undefined" && i.weight_kg !== null
          ? i.weight_kg
          : i.total_weight
      ) || 0;
      const volume = Number(
        typeof i.volume_cbm !== "undefined" && i.volume_cbm !== null
          ? i.volume_cbm
          : i.total_volume
      ) || 0;
      return {
        container_type: i.container_types?.name || i.container_types?.code || "Container",
        quantity: i.quantity,
        commodity: i.commodity || i.master_commodities?.name || i.commodity_description || "General Cargo",
        weight,
        volume,
      };
    });
}

function validateForPdf(raw) {
    const blockers = [];
    const warnings = [];

    const items = Array.isArray(raw.items) ? raw.items : [];
    
    if (items.length > 0) {
        items.forEach((item, index) => {
            const commodity = item?.commodity;
            if (!commodity || commodity === "General Cargo") {
                warnings.push(`Item ${index + 1}: commodity missing or too generic (${commodity})`);
            }

            const weight = Number(item?.weight ?? 0);
            const volume = Number(item?.volume ?? 0);

            if (weight < 0) {
                blockers.push(`Item ${index + 1}: weight must be zero or greater`);
            } else if (!(weight > 0)) {
                warnings.push(`Item ${index + 1}: weight is missing or zero`);
            }
            if (volume < 0) {
                blockers.push(`Item ${index + 1}: volume must be zero or greater`);
            }
        });
    } else {
        warnings.push("No items found");
    }

    return { blockers, warnings };
}

(async () => {
    console.log('--- Simulating PDF Generation Data Flow ---');
    
    // 1. Fetch Quote
    const { data: quote, error: qError } = await client.from('quotes').select('*').eq('id', quoteId).single();
    if (qError) {
        console.error('Error fetching quote:', qError);
        return;
    }
    console.log('Quote fetched:', quote.quote_number);

    // 2. Fetch Items
    const items = await fetchQuoteItemsWithFallbacks(quoteId);
    quote.items = items;

    // 3. Map Items
    const rawItems = mapQuoteItemsToRawItems(quote.items);
    console.log('Mapped Items:', JSON.stringify(rawItems, null, 2));

    // 4. Validate
    const rawData = { items: rawItems }; // Simplified for validation check
    const validation = validateForPdf(rawData);
    
    console.log('Validation Results:');
    console.log('Blockers:', validation.blockers);
    console.log('Warnings:', validation.warnings);

    if (validation.blockers.length === 0) {
        console.log('SUCCESS: PDF Generation would proceed (with warnings if any).');
    } else {
        console.log('FAILURE: PDF Generation would be blocked.');
    }
})();
