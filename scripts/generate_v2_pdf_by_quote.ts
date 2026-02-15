import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const quoteNumber = process.argv[2];

  if (!quoteNumber) {
    console.error('Usage: node scripts/generate_v2_pdf_by_quote.ts <quote_number>');
    process.exit(1);
  }

  console.log('Starting V2 PDF generation for quote', quoteNumber);

  const { data: quote, error } = await supabase
    .from('quotes')
    .select('id, quote_number')
    .eq('quote_number', quoteNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !quote) {
    console.error('Quote not found or error fetching quote', error);
    process.exit(1);
  }

  console.log(`Using Quote: ${quote.quote_number} (${quote.id})`);

  const { data: pdfBlob, error: funcError } = await supabase.functions.invoke('generate-quote-pdf', {
    body: {
      quoteId: quote.id,
      engine_v2: true,
    },
  });

  if (funcError) {
    console.error('Function invocation failed:', funcError);
    process.exit(1);
  }

  if (!pdfBlob) {
    console.error('No PDF returned (data is null)');
    process.exit(1);
  }

  console.log('Function returned data type:', typeof pdfBlob);

  const outputPath = path.join(__dirname, `v2_pdf_${quote.quote_number}.pdf`);

  let buffer;
  if (pdfBlob instanceof Blob) {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else if (pdfBlob instanceof ArrayBuffer) {
    buffer = Buffer.from(pdfBlob);
  } else {
    buffer = Buffer.from(pdfBlob as any);
  }

  fs.writeFileSync(outputPath, buffer);
  console.log(`PDF saved to ${outputPath}`);

  const stats = fs.statSync(outputPath);
  console.log(`PDF Size: ${stats.size} bytes`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

