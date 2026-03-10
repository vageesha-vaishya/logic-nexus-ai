import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

type FunctionCheck = {
  name: string;
  hasRequireAuth: boolean;
  hasConfigSection: boolean;
  verifyJwtIsFalse: boolean;
};

const REPO_ROOT = process.cwd();
const FUNCTIONS_DIR = path.join(REPO_ROOT, 'supabase', 'functions');
const CONFIG_PATH = path.join(REPO_ROOT, 'supabase', 'config.toml');
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_PUBLIC_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';

function parseFunctionConfigToml(toml: string): Map<string, { verifyJwt?: boolean }> {
  const map = new Map<string, { verifyJwt?: boolean }>();
  let current: string | null = null;
  for (const rawLine of toml.split('\n')) {
    const line = rawLine.trim();
    const section = line.match(/^\[functions\.([^\]]+)\]$/);
    if (section) {
      current = section[1];
      map.set(current, {});
      continue;
    }
    if (!current) continue;
    const verify = line.match(/^verify_jwt\s*=\s*(true|false)$/i);
    if (verify) {
      map.get(current)!.verifyJwt = verify[1].toLowerCase() === 'true';
    }
  }
  return map;
}

function listFunctionFolders(functionsDir: string): string[] {
  return fs
    .readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function hasRequireAuth(indexSource: string): boolean {
  return indexSource.includes('requireAuth') && indexSource.includes('_shared/auth.ts');
}

function analyze(): FunctionCheck[] {
  const toml = fs.readFileSync(CONFIG_PATH, 'utf8');
  const configMap = parseFunctionConfigToml(toml);
  const folders = listFunctionFolders(FUNCTIONS_DIR);
  const results: FunctionCheck[] = [];

  for (const name of folders) {
    const indexPath = path.join(FUNCTIONS_DIR, name, 'index.ts');
    if (!fs.existsSync(indexPath)) continue;
    const source = fs.readFileSync(indexPath, 'utf8');
    const requireAuthUsed = hasRequireAuth(source);
    const configSection = configMap.get(name);
    results.push({
      name,
      hasRequireAuth: requireAuthUsed,
      hasConfigSection: Boolean(configSection),
      verifyJwtIsFalse: configSection?.verifyJwt === false,
    });
  }

  return results;
}

async function smokeTest(functionName: string): Promise<{ functionName: string; missingAuth: number; invalidToken: number }> {
  const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${functionName}`;
  const missingAuthRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_PUBLIC_KEY ? { apikey: SUPABASE_PUBLIC_KEY } : {}),
    },
    body: JSON.stringify({}),
  });

  const invalidTokenRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_PUBLIC_KEY ? { apikey: SUPABASE_PUBLIC_KEY } : {}),
      Authorization: 'Bearer invalid-token-123',
    },
    body: JSON.stringify({}),
  });

  return {
    functionName,
    missingAuth: missingAuthRes.status,
    invalidToken: invalidTokenRes.status,
  };
}

async function run() {
  const checks = analyze();
  const authFunctions = checks.filter((c) => c.hasRequireAuth);
  const missingConfig = authFunctions.filter((c) => !c.hasConfigSection);
  const wrongVerify = authFunctions.filter((c) => !c.verifyJwtIsFalse);

  console.log(`Functions scanned: ${checks.length}`);
  console.log(`Functions using requireAuth: ${authFunctions.length}`);
  console.log(`Missing config section: ${missingConfig.length}`);
  console.log(`verify_jwt not false: ${wrongVerify.length}`);

  if (missingConfig.length > 0) {
    console.log('Missing sections:');
    for (const f of missingConfig) console.log(` - ${f.name}`);
  }

  if (wrongVerify.length > 0) {
    console.log('Invalid verify_jwt settings:');
    for (const f of wrongVerify) console.log(` - ${f.name}`);
  }

  const shouldRunLive = process.argv.includes('--live');
  if (!shouldRunLive) return;

  if (!SUPABASE_URL) {
    console.error('SUPABASE_URL is required for --live mode');
    process.exit(1);
  }

  const liveTargets = authFunctions.slice(0, 5).map((f) => f.name);
  for (const fn of liveTargets) {
    const result = await smokeTest(fn);
    console.log(`${result.functionName}: missing-auth=${result.missingAuth}, invalid-token=${result.invalidToken}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
