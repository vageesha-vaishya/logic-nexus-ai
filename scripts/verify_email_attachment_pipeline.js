
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
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
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || result.NEW_SUPABASE_URL,
    VITE_SUPABASE_SERVICE_ROLE_KEY: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || result.NEW_SUPABASE_SERVICE_ROLE_KEY,
  };
}

const env = loadEnvFromConfig();
const args = process.argv.slice(2);
const isLocal = args.includes('--local');

const supabaseUrl = isLocal ? 'http://localhost:54321' : env.VITE_SUPABASE_URL;
const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY; // Need service key to read system_logs

if (!supabaseUrl || !serviceKey) {
  console.error('Error: Missing Supabase URL or Service Role Key. Ensure env vars or config file are present.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// If local, we need a separate client for DB access (system_logs) if the local function is using a different DB
// But usually for "functions serve" with remote env, it connects to remote DB.
// The script also needs to connect to remote DB to read logs.
// So we might need TWO clients: one to invoke function (local), one to read logs (remote).

const dbClient = isLocal ? createClient(env.VITE_SUPABASE_URL, serviceKey) : supabase;


// --- Test Data ---
const validPdfBase64 = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXwKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCj4+CmVuZG9iagoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDE1NyAwMDAwMCBuIAp0cmFpbGVyCjw8CiAgL1NpemUgNAogIC9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgoxNzMKJSVFT0YK"; // Minimal valid PDF
const invalidPdfBase64 = Buffer.from("This is just text, not a PDF").toString('base64');
const emptyBase64 = "";
const largeBase64 = Buffer.alloc(11 * 1024 * 1024).toString('base64'); // 11MB dummy content

const correlationId = `test-att-${Date.now()}`;

async function runTest() {
  console.log(`Starting Email Attachment Pipeline Verification (Correlation ID: ${correlationId})`);
  
  const payload = {
    to: ["test-verification@example.com"], // Dummy email
    subject: `Attachment Verification ${correlationId}`,
    body: "Testing attachment validation logic.",
    provider: "resend",
    attachments: [
      {
        filename: "valid.pdf",
        content: validPdfBase64,
        contentType: "application/pdf"
      },
      {
        filename: "invalid_header.pdf",
        content: invalidPdfBase64, // Should fail PDF header check
        contentType: "application/pdf"
      },
      {
        filename: "empty.txt",
        content: emptyBase64, // Should fail empty check
        contentType: "text/plain"
      },
      {
        filename: "too_large.txt",
        content: largeBase64, // Should fail size check
        contentType: "text/plain"
      }
    ]
  };

  console.log('Invoking send-email function...');
  
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: payload,
    headers: {
      'x-correlation-id': correlationId
    }
  });

  if (error) {
    console.error('Function invocation failed:', error);
    // Even if invocation failed (e.g. 500), we want to check logs
  } else {
    console.log('Function invoked successfully. Response:', data);
  }

  console.log('Waiting 5 seconds for logs to persist...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Querying system_logs for validation errors...');
  
  const { data: logs, error: logError } = await dbClient
    .from('system_logs')
    .select('*')
    .eq('correlation_id', correlationId)
    .order('created_at', { ascending: true });

  if (logError) {
    console.error('Failed to query system_logs:', logError);
    return;
  }

  console.log(`Found ${logs.length} log entries.`);
  
  // Verification Rules
  let passed = true;

  // 1. Check for Invalid PDF Header Error
  const invalidPdfLog = logs.find(l => l.message.includes('content does not look like a PDF header'));
  if (invalidPdfLog) {
    console.log('✅ Correctly detected invalid PDF header.');
  } else {
    console.error('❌ Failed to detect invalid PDF header.');
    passed = false;
  }

  // 2. Check for Empty File Error
  const emptyFileLog = logs.find(l => l.message.includes('is empty') || l.message.includes('no content'));
  if (emptyFileLog) {
    console.log('✅ Correctly detected empty file.');
  } else {
    console.error('❌ Failed to detect empty file.');
    passed = false;
  }

  // 3. Check for Large File Error
  const largeFileLog = logs.find(l => l.message.includes('exceeds 10MB limit'));
  if (largeFileLog) {
    console.log('✅ Correctly detected oversized file.');
  } else {
    console.error('❌ Failed to detect oversized file.');
    passed = false;
  }

  // 4. Check for Valid PDF (Should NOT have an error log for "valid.pdf")
  const validPdfError = logs.find(l => l.message.includes('valid.pdf') && (l.level === 'ERROR' || l.level === 'WARNING'));
  if (validPdfError) {
    console.error('❌ Unexpected error log for valid PDF:', validPdfError.message);
    passed = false;
  } else {
    console.log('✅ No errors logged for valid PDF.');
  }

  if (passed) {
    console.log('\n✨ ALL CHECKS PASSED: Attachment pipeline validation is working correctly.');
  } else {
    console.error('\n⚠️ SOME CHECKS FAILED: See above for details.');
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
