
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');

function checkFileExists(filePath: string) {
  const fullPath = path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }
  return true;
}

function checkContent(filePath: string, pattern: RegExp, description: string) {
  const fullPath = path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) return false;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  if (!pattern.test(content)) {
    console.error(`❌ ${description} not found in ${filePath}`);
    return false;
  }
  console.log(`✅ ${description} found in ${filePath}`);
  return true;
}

function verifyEmailPhase1() {
  console.log("Starting Email Phase 1 Verification...");
  let success = true;

  // 1. Check Migration File
  const migrationDir = path.join(projectRoot, 'supabase/migrations');
  if (fs.existsSync(migrationDir)) {
      const files = fs.readdirSync(migrationDir);
      const migrationFile = files.find(f => f.includes('email_infrastructure_phase1'));
      if (migrationFile) {
          console.log(`✅ Migration file found: ${migrationFile}`);
      } else {
          console.error("❌ Migration file not found!");
          success = false;
      }
  }

  // 2. Check UI Components
  success = checkFileExists('src/components/email/DomainManagement.tsx') && success;
  success = checkFileExists('src/components/email/EmailDelegationDialog.tsx') && success;
  
  // 3. Check Integration in Settings
  success = checkContent(
    'src/components/email/EmailClientSettings.tsx',
    /DomainManagement/,
    'DomainManagement component usage'
  ) && success;

  // 4. Check Types
  success = checkContent(
    'src/integrations/supabase/types.ts',
    /tenant_domains/,
    'tenant_domains type definition'
  ) && success;
  
  success = checkContent(
    'src/integrations/supabase/types.ts',
    /email_account_delegations/,
    'email_account_delegations type definition'
  ) && success;

  // 5. Check Edge Functions
  success = checkFileExists('supabase/functions/domains-register/index.ts') && success;
  success = checkFileExists('supabase/functions/domains-verify/index.ts') && success;

  if (success) {
    console.log("🎉 Email Phase 1 Code Verification PASSED!");
  } else {
    console.error("FAILED: Some checks failed.");
    process.exit(1);
  }
}

verifyEmailPhase1();
