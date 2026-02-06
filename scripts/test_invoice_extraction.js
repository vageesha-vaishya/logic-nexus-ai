import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID;
const FUNCTION_URL = PROJECT_REF 
  ? `https://${PROJECT_REF}.supabase.co/functions/v1/extract-invoice-items`
  : 'http://localhost:54321/functions/v1/extract-invoice-items';

// Use a generic sample invoice image URL
const SAMPLE_INVOICE_URL = 'https://templates.invoicehome.com/invoice-template-us-neat-750px.png'; 

async function testInvoiceExtraction() {
  console.log(`Testing Invoice Extraction Function at ${FUNCTION_URL}...`);
  console.log(`Using sample invoice: ${SAMPLE_INVOICE_URL}`);

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        file_url: SAMPLE_INVOICE_URL,
        file_type: 'image/png'
      })
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
        const data = await response.json();
        console.log('\n--- Extraction Result ---');
        console.log(JSON.stringify(data, null, 2));
    } else {
        const text = await response.text();
        console.error('Error Body:', text);
    }

  } catch (err) {
    console.error('Fetch Error:', err);
    console.log('Ensure the Supabase Edge Function is running locally via: npx supabase functions serve extract-invoice-items --no-verify-jwt --env-file .env');
  }
}

testInvoiceExtraction();
