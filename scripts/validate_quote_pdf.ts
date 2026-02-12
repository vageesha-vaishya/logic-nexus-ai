
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { generatePdfLocal } from './local_pdf_generator.ts'; // Ensure extension if ESM, or .ts if using ts-node

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function validatePdf() {
  const quoteNumber = 'MGL-SYS-1770819021371';
  console.log(`Validating PDF generation for: ${quoteNumber}`);

  // 1. Get Quote ID
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, quote_number')
    .eq('quote_number', quoteNumber)
    .single();

  if (quoteError || !quote) {
    console.error('Error finding quote:', quoteError);
    return;
  }
  
  console.log(`Quote found: ${quote.id}`);

  // 2. Get Version ID
  const { data: version, error: versionError } = await supabase
    .from('quotation_versions')
    .select('id')
    .eq('quote_id', quote.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (versionError) {
      console.warn('No version found, attempting PDF gen without version (might fail if required):', versionError.message);
  }
  
  const versionId = version?.id;
  console.log(`Version found: ${versionId || 'None'}`);

  // 3. Generate PDF
  try {
      console.log('Generating PDF...');
      // Note: generatePdfLocal returns { content: base64String } or similar?
      // Checking local_pdf_generator.ts usage in e2e_pdf_email.ts:
      // pdfData = await generatePdfLocal(quote.id, version.id);
      // fs.writeFileSync(..., Buffer.from(pdfData.content, 'base64'));
      
      const pdfData = await generatePdfLocal(quote.id, versionId);
      
      if (!pdfData || !pdfData.content) {
          throw new Error('No content returned from PDF generator');
      }
      
      const buffer = Buffer.from(pdfData.content, 'base64');
      const filename = `validate_${quoteNumber}.pdf`;
      fs.writeFileSync(filename, buffer);
      
      console.log(`PDF generated successfully: ${filename} (${buffer.length} bytes)`);
      
  } catch (err: any) {
      console.error('PDF Generation Failed:', err.message);
      console.error(err);
  }
}

validatePdf();
