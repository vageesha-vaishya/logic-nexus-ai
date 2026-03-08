import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchQuoteData(quoteNumber: string) {
  console.log(`Fetching quote ${quoteNumber}...`);
  
  // 1. Fetch Quote
  // Note: Fetching raw first, then manual joins if needed
  const { data: quotes, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('quote_number', quoteNumber);

  if (quoteError) {
    console.error('Error fetching quote:', quoteError);
    return;
  }

  if (!quotes || quotes.length === 0) {
    console.error('Quote not found');
    return;
  }

  const quote = quotes[0];
  console.log('Quote fetched:', quote.id);

  // Manual joins
  if (quote.customer_id) {
      const { data: customer } = await supabase.from('customers').select('*').eq('id', quote.customer_id).single();
      quote.customer = customer;
  }
  
  if (quote.origin_port_id) {
      const { data: origin } = await supabase.from('locations').select('*').eq('id', quote.origin_port_id).single();
      quote.origin = origin;
      quote.origin_port_data = origin;
  }

  if (quote.destination_port_id) {
      const { data: dest } = await supabase.from('locations').select('*').eq('id', quote.destination_port_id).single();
      quote.destination = dest;
      quote.destination_port_data = dest;
  }


  // Debug Versions
  const { data: versions, error: versionsError } = await supabase
    .from('quotation_versions') // Check table name, might be quote_versions or quotation_versions
    .select('*')
    .eq('quote_id', quote.id);
  
  if (versionsError) {
      console.error('Error fetching versions:', versionsError);
      // Try 'quote_versions' if 'quotation_versions' fails
      const { data: v2, error: v2Error } = await supabase.from('quote_versions').select('*').eq('quote_id', quote.id);
      if (v2Error) console.error('Error fetching quote_versions:', v2Error);
      else console.log('Found versions in quote_versions:', v2.length);
  } else {
      console.log('Found versions:', versions.length);
      for (const v of versions) {
          const { count } = await supabase.from('quote_options').select('*', { count: 'exact', head: true }).eq('quote_version_id', v.id);
          console.log(`Version ${v.version_number} (${v.id}): ${count} options`);
      }
  }

  // 2. Fetch Options (Raw)
  const { data: options, error: optionsError } = await supabase
    .from('quote_options')
    .select('*')
    .eq('quote_version_id', quote.current_version_id);

  if (optionsError) console.error('Error fetching options:', optionsError);

  let legs = [];
  let charges = [];

  if (options && options.length > 0) {
      const optionIds = options.map((o: any) => o.id);
      
      // 3. Fetch Legs
      const { data: legsData, error: legsError } = await supabase
        .from('quote_legs')
        .select('*')
        .in('quote_option_id', optionIds);
      
      if (legsError) console.error('Error fetching legs:', legsError);
      legs = legsData || [];

      // 4. Fetch Charges
      const { data: chargesData, error: chargesError } = await supabase
        .from('quote_charges')
        .select('*')
        .in('quote_option_id', optionIds);

      if (chargesError) console.error('Error fetching charges:', chargesError);
      charges = chargesData || [];
  }

  // 5. Fetch Items (Try core if main fails)
  let items = [];
  const { data: itemsData, error: itemsError } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quote.id);
    
  if (itemsError) {
      console.log('quote_items failed, trying quote_items_core');
      const { data: coreItems, error: coreError } = await supabase
        .from('quote_items_core')
        .select('*')
        .eq('quote_id', quote.id);
      
      if (coreError) console.error('Error fetching quote_items_core:', coreError);
      items = coreItems || [];
  } else {
      items = itemsData || [];
  }

  // 6. Fetch MGL Template
  console.log('Fetching MGL Standard Granular template...');
  const { data: templates, error: templateError } = await supabase
    .from('quote_templates')
    .select('*')
    .ilike('name', '%MGL Standard Granular%')
    .limit(1);

  let template = null;
  if (templateError) {
      console.error('Error fetching template:', templateError);
  } else if (templates && templates.length > 0) {
      template = templates[0];
      console.log('Template fetched:', template.id, template.name);
  } else {
      console.log('Template not found by name');
  }

  // Manually assemble structure if needed, or just dump raw
  // We want to mimic the structure passed to renderer
  
  // Attach legs/charges to options if possible
  if (options && options.length > 0) {
      options.forEach((opt: any) => {
          // If legs are linked to option_id
          if (legs) {
              opt.legs = legs.filter((l: any) => l.option_id === opt.id || l.quote_id === quote.id); // heuristic
          }
          if (charges) {
              opt.charges = charges.filter((c: any) => c.option_id === opt.id || c.quote_id === quote.id);
          }
      });
  }

  const fullData = {
    quote,
    options,
    items,
    legs, 
    charges,
    template
  };

  const outputPath = path.join(process.cwd(), 'supabase/functions/generate-quote-pdf/scripts/quote_data.json');
  await fs.writeFile(outputPath, JSON.stringify(fullData, null, 2));
  console.log(`Data saved to ${outputPath}`);
}

fetchQuoteData('QUO-260303-00002');
