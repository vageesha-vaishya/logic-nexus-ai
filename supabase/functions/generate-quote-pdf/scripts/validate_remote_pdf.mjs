import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config'; // Make sure dotenv is installed or run with --env-file

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const QUOTE_NUMBER = 'QUO-260303-00002';

async function main() {
  console.log(`Validating PDF generation for ${QUOTE_NUMBER}...`);

  // 1. Get Quote ID
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, quote_number, tenant_id')
    .eq('quote_number', QUOTE_NUMBER)
    .single();

  if (quoteError) {
    console.error('Error fetching quote:', quoteError);
    process.exit(1);
  }

  console.log(`Quote found: ${quote.quote_number} (${quote.id})`);

  // 1.1 Fetch latest version and its options
  const { data: versions, error: versionsError } = await supabase
    .from('quotation_versions')
    .select('id, created_at')
    .eq('quote_id', quote.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (versionsError) {
      console.error("Error fetching versions:", versionsError);
  } else if (versions && versions.length > 0) {
      const latestVersionId = versions[0].id;
      console.log('Latest Version ID:', latestVersionId);

      const { data: options, error: optionsError } = await supabase
        .from('quotation_version_options')
        .select(`
            id,
            carrier_id,
            total_amount,
            transit_time,
            carriers (carrier_name),
            container_size_id,
            container_type_id
        `)
        .eq('quotation_version_id', latestVersionId);

      if (optionsError) {
          console.error("Error fetching options:", optionsError);
      } else {
          // console.log('--- OPTIONS DUMP ---');
          console.log('Options Count:', options.length);
          if (options.length > 0) {
              // console.log(JSON.stringify(options, null, 2));
              const amounts = options.map(o => o.total_amount);
              console.log('Option Amounts:', amounts);
          } else {
              console.log('No standard options found.');
          }
          // console.log('--- END OPTIONS DUMP ---');
      }
  } else {
      console.warn("No versions found for this quote.");
  }

  // 2. Fetch Templates
  const { data: templates, error: templatesError } = await supabase
    .from('quote_templates')
    .select('*')
    .eq('tenant_id', quote.tenant_id);

  if (templatesError) {
    console.error('Error fetching templates:', templatesError);
    process.exit(1);
  }

  const mglTemplates = templates.filter(t => t.name.includes('MGL'));
  console.log('Found MGL Templates:', mglTemplates.map(t => t.name));

  if (mglTemplates.length === 0) {
    console.error('No MGL templates found for this tenant.');
    process.exit(1);
  }

  // 3. Generate PDF for each template
  for (const template of mglTemplates) {
    if (template.name === 'MGL Standard Granular') {
         console.log('--- TEMPLATE STRUCTURE: MGL Standard Granular ---');
         console.log(JSON.stringify(template, null, 2));
         console.log('--- END TEMPLATE STRUCTURE ---');
    }
    
    console.log(`Testing template: ${template.name} (${template.id})`); const startTime = Date.now();
    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/generate-quote-pdf`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                quoteId: quote.id,
                templateId: template.id
            }),
        });

        const endTime = Date.now();
        console.log(`Response status: ${response.status} (${endTime - startTime}ms)`);

        if (response.status !== 200) {
            const text = await response.text();
            console.error(`Failed to generate PDF: ${text}`);
            continue;
        }

        const buffer = await response.arrayBuffer();
        const size = buffer.byteLength;
        console.log(`Generated PDF size: ${size} bytes`);

        if (size < 1000) {
            console.error('ERROR: Generated PDF is too small (likely blank or error).');
        } else {
            console.log('SUCCESS: PDF generated and appears valid.');
            // Save to disk
            const filename = `validate_${QUOTE_NUMBER}_${template.name.replace(/\s+/g, '_')}.pdf`;
            await fs.writeFile(filename, Buffer.from(buffer));
            console.log(`Saved to ${filename}`);
        }
    } catch (err) {
        console.error('Error invoking function:', err);
    }
  }
}

main();
