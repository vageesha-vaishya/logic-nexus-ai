
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Hardcoded for reliability as per previous scripts
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PDF_BASE64 = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXwKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgLUNvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSC4gIC9SZXNvdXJjZXMgPDwKICAgIC9Gb250IDw8CiAgICAgIC9FMSA0IDAgUgogICAgPj4KICA+PgogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKICAvVHlwZSAvRm9udAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagoKNSAwIG9iago8PAogIC9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCjcwIDUwIFRECi9FMSAxMiBUZgooSGVsbG8sIHdvcmxkISkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAgCjAwMDAwMDAxNTcgMDAwMDAgbiAgCjAwMDAwMDAyNTUgMDAwMDAgbiAgCjAwMDAwMDAzNDMgMDAwMDAgbiAgCnRyYWlsZXIKPDwKICAvU2l6ZSA2CiAgL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjQzOAolJUVPRgo=";

async function run() {
    console.log('Starting Email Attachment Pipeline Verification...');
    console.log('Target Email: bahuguna.vimal@gmail.com');

    // 1. Valid PDF Attachment Test
    console.log('\n--- Test 1: Sending with Valid PDF Attachment ---');
    try {
        console.log("Sending request to:", `${SUPABASE_URL}/functions/v1/send-email`);
        console.log("Using Key (first 10 chars):", SUPABASE_KEY.substring(0, 10));

        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${SUPABASE_KEY}`,
                 'X-E2E-Key': 'trae-bypass-verification-2026'
             },
             body: JSON.stringify({
                to: ['bahuguna.vimal@gmail.com'],
                subject: 'Pipeline Verification - Valid PDF',
                body: '<p>This is a test email with a valid PDF attachment to verify the pipeline.</p>',
                attachments: [
                    {
                        filename: 'test_valid.pdf',
                        content: PDF_BASE64,
                        contentType: 'application/pdf'
                    }
                ]
            })
        });

        if (!response.ok) {
            console.error(`Test 1 Failed: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error("Error Response Body:", errorText);
        } else {
            const data = await response.json();
            console.log('Test 1 Success:', data);
        }
    } catch (e) {
        console.error('Test 1 Exception:', e);
    }

    // 2. Invalid Attachment Test (Empty Content)
    console.log('\n--- Test 2: Sending with Empty Attachment Content ---');
    try {
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                to: ['bahuguna.vimal@gmail.com'],
                subject: 'Pipeline Verification - Empty Attachment',
                body: '<p>This email should have a warning in logs about empty attachment.</p>',
                attachments: [
                    {
                        filename: 'test_empty.pdf',
                        content: '', // Empty
                        contentType: 'application/pdf'
                    }
                ]
            }
        });

        if (error) {
             // We expect the function to handle it gracefully (skip or warn), so it might succeed but log a warning on server
             console.log('Test 2 Result:', error);
        } else {
             console.log('Test 2 Success (Function returned success, check logs for warning):', data);
        }
    } catch (e) {
        console.error('Test 2 Exception:', e);
    }

    // 3. Corrupt PDF Header Test
    console.log('\n--- Test 3: Sending with Corrupt PDF Header ---');
    try {
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                to: ['bahuguna.vimal@gmail.com'],
                subject: 'Pipeline Verification - Corrupt PDF',
                body: '<p>This attachment claims to be PDF but has random text.</p>',
                attachments: [
                    {
                        filename: 'test_corrupt.pdf',
                        content: Buffer.from('This is not a PDF').toString('base64'),
                        contentType: 'application/pdf'
                    }
                ]
            }
        });
        
        if (error) {
            console.log('Test 3 Result:', error);
        } else {
            console.log('Test 3 Success (Function returned success, check logs for warning):', data);
        }

    } catch (e) {
        console.error('Test 3 Exception:', e);
    }
}

run().catch(console.error);
