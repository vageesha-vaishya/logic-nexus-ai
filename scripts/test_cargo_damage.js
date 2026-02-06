import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID;
const FUNCTION_URL = PROJECT_REF 
  ? `https://${PROJECT_REF}.supabase.co/functions/v1/analyze-cargo-damage`
  : 'http://localhost:54321/functions/v1/analyze-cargo-damage';

// Sample Image: Damaged Cardboard Box (Public URL)
// This is a placeholder. In a real test, we'd use a known damaged image.
// Using a generic "cardboard box" image, AI might say "none" or "low" wear.
// Let's try to find a URL that looks like a box.
const SAMPLE_IMAGE_URL = 'https://t4.ftcdn.net/jpg/02/61/06/61/360_F_261066127_M7y7c6u9t2g7t2g7t2g7t2g7t2g7t2g7.jpg'; // Placeholder broken link, let's use a reliable one.
// Using the known working invoice image to test connectivity and logic (should return "not cargo")
const RELIABLE_SAMPLE_URL = 'https://templates.invoicehome.com/invoice-template-us-neat-750px.png';

async function testCargoDamageAnalysis() {
  console.log(`Testing Cargo Damage Analysis Function at ${FUNCTION_URL}...`);
  console.log(`Using sample image: ${RELIABLE_SAMPLE_URL}`);

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        file_url: RELIABLE_SAMPLE_URL
      })
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
        const data = await response.json();
        console.log('\n--- Analysis Result ---');
        console.log(JSON.stringify(data, null, 2));
    } else {
        const text = await response.text();
        console.error('Error Body:', text);
    }

  } catch (err) {
    console.error('Fetch Error:', err);
    console.log('Ensure the Supabase Edge Function is running and deployed.');
  }
}

testCargoDamageAnalysis();
