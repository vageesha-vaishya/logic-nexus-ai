
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectOtherTables() {
  console.log('Checking ai_quote_requests table...');
  const { data: aiRequests, error: aiError } = await supabase
    .from('ai_quote_requests')
    .select('*');

  if (aiError) {
    console.error('Error fetching ai_quote_requests:', aiError);
  } else {
    console.log(`Found ${aiRequests?.length} AI quote requests.`);
    if (aiRequests && aiRequests.length > 0) {
      console.log('AI Quote Request sample:', JSON.stringify(aiRequests[0], null, 2));
      // Check if any match the ID
      const match = aiRequests.find(r => JSON.stringify(r).includes('MGL-SYS-1770819021371'));
      if (match) {
          console.log('Found match in ai_quote_requests:', match);
      }
    }
  }

  console.log('Checking emails table...');
  const { data: emails, error: emailError } = await supabase
    .from('emails')
    .select('*');

  if (emailError) {
      console.error('Error fetching emails:', emailError);
  } else {
      console.log(`Found ${emails?.length} emails.`);
      if (emails && emails.length > 0) {
           const match = emails.find(e => JSON.stringify(e).includes('MGL-SYS-1770819021371'));
           if (match) {
               console.log('Found match in emails:', match);
           }
      }
  }
}

inspectOtherTables();
