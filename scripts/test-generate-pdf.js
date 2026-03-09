
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Helper to load env
function loadEnvFromConfig() {
  const configPath = path.join(process.cwd(), 'supabase', 'migration-package', 'new-supabase-config.env');
  if (!fs.existsSync(configPath)) return {};
  const result = {};
  const lines = fs.readFileSync(configPath, 'utf-8')
    .split('\n')
    .filter(line => line && !line.trim().startsWith('#') && line.includes('='));
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    result[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
  return {
    VITE_SUPABASE_URL: result.NEW_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: result.VITE_SUPABASE_PUBLISHABLE_KEY || result.NEW_SUPABASE_ANON_KEY,
    SERVICE_ROLE_KEY: result.SERVICE_ROLE_KEY // Assuming it might be there, otherwise we use process.env
  };
}

const envFromConfig = loadEnvFromConfig();
const projectUrl = process.env.VITE_SUPABASE_URL || envFromConfig.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envFromConfig.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || envFromConfig.SERVICE_ROLE_KEY || '';

const supabase = createClient(projectUrl, serviceRoleKey);

async function testGeneratePdf() {
  const quoteId = process.argv[2];
  if (!quoteId) {
    console.error('Usage: node scripts/test-generate-pdf.js <quoteId>');
    process.exit(1);
  }

  console.log(`Generating PDF for Quote ID: ${quoteId}...`);
  console.log(`Using Supabase URL: ${projectUrl}`);

  const { data, error } = await supabase.functions.invoke('generate-quote-pdf', {
    body: {
      quoteId: quoteId,
      // Optional: templateId, versionId
    }
  });

  if (error) {
    console.error('❌ Error generating PDF:', error);
    if (error instanceof Error) {
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
    }
    // Try to read response body if possible
    if (error.context && error.context.json) {
        console.error('Response:', await error.context.json());
    }
    process.exit(1);
  }

  console.log('✅ PDF generated successfully!');
  
  // The function returns { pdf: base64string } or similar?
  // Let's check the response structure.
  if (data && data.pdf) {
    const buffer = Buffer.from(data.pdf, 'base64');
    fs.writeFileSync('output.pdf', buffer);
    console.log('PDF saved to output.pdf');
  } else if (data instanceof ArrayBuffer || data instanceof Buffer) {
      // If it returns raw binary
      fs.writeFileSync('output.pdf', Buffer.from(data));
      console.log('PDF saved to output.pdf');
  } else {
      console.log('Response data:', data);
      console.log('Could not find PDF data in response.');
  }
}

testGeneratePdf();
