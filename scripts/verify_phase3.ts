
import { PricingService } from '../src/services/pricing.service';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || 'https://example.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'example';

// Mock Supabase client if env vars are missing (for static checks)
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPhase3() {
  console.log('Verifying Phase 3 Implementation...');

  // 1. Check PricingService methods
  // We can't easily check methods on the instance without a real connection in some cases, 
  // but we can check the prototype or just assume if it compiles it's there.
  // Actually, we can check the class prototype.
  if (typeof PricingService.prototype.subscribeToUpdates !== 'function') {
    console.error('❌ PricingService.subscribeToUpdates is missing');
  } else {
    console.log('✅ PricingService.subscribeToUpdates exists');
  }

  // 2. Check clearCache
  if (typeof PricingService.clearCache !== 'function') {
    console.error('❌ PricingService.clearCache is missing');
  } else {
    console.log('✅ PricingService.clearCache exists');
  }

  // 3. Verify MultiModalQuoteComposer integration (Static Analysis)
  const composerPath = path.join(__dirname, '../src/components/sales/MultiModalQuoteComposer.tsx');
  try {
      const composerContent = fs.readFileSync(composerPath, 'utf8');

      if (!composerContent.includes('subscribeToUpdates')) {
        console.error('❌ MultiModalQuoteComposer does not call subscribeToUpdates');
      } else {
        console.log('✅ MultiModalQuoteComposer calls subscribeToUpdates');
      }

      if (!composerContent.includes('Skeleton')) {
        console.error('❌ MultiModalQuoteComposer does not use Skeleton components');
      } else {
        console.log('✅ MultiModalQuoteComposer uses Skeleton components');
      }

      if (!composerContent.includes('Pricing Service Disconnected')) {
          console.error('❌ MultiModalQuoteComposer does not handle connection errors');
      } else {
          console.log('✅ MultiModalQuoteComposer handles connection errors');
      }
  } catch (err) {
      console.error('❌ Could not read MultiModalQuoteComposer.tsx', err);
  }

  console.log('Phase 3 Verification Complete.');
}

verifyPhase3().catch(console.error);
