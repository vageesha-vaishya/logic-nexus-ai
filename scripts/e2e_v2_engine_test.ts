
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
    console.log('Starting V2 Engine E2E Test...');

    // 1. Get Latest Quote
    const { data: quote, error } = await supabase
        .from('quotes')
        .select('id, quote_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !quote) {
        console.error('No quotes found. Please run a seed script first.');
        process.exit(1);
    }

    console.log(`Using Quote: ${quote.quote_number} (${quote.id})`);

    // 2. Invoke Function with V2 Engine
    console.log('Invoking generate-quote-pdf with engine_v2: true...');
    
    // We use a custom fetch here to ensure we get binary data correctly if the client tries to parse JSON
    // Or just trust the client. Let's trust the client first.
    const { data: pdfBlob, error: funcError } = await supabase.functions.invoke('generate-quote-pdf', {
        body: {
            quoteId: quote.id,
            engine_v2: true
        }
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

    // 3. Save PDF
    const outputPath = path.join(__dirname, 'e2e_v2_output.pdf');
    
    let buffer;
    if (pdfBlob instanceof Blob) {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
    } else if (pdfBlob instanceof ArrayBuffer) {
        buffer = Buffer.from(pdfBlob);
    } else {
        // If it returns something else, log it
        console.warn('Unknown data type, trying to convert...', pdfBlob);
        buffer = Buffer.from(pdfBlob);
    }

    fs.writeFileSync(outputPath, buffer);
    console.log(`PDF saved to ${outputPath}`);
    
    // Check file size
    const stats = fs.statSync(outputPath);
    console.log(`PDF Size: ${stats.size} bytes`);
    
    if (stats.size < 1000) {
        console.warn('PDF size is suspiciously small. It might contain an error message.');
    } else {
        console.log('Test Passed!');
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
