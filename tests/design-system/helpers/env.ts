import fs from 'node:fs';

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. Put it in the gitignored repo-root \`env\` file (see docs/design-system/verification/REPORT.md → "Running").`,
    );
  }
  return v;
}

export function supabaseEnv(): { supabaseUrl: string; anonKey: string } {
  return {
    supabaseUrl: requireEnv('VITE_SUPABASE_URL').replace(/\/$/, ''),
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
  };
}

interface StorageState {
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
}

/** supabase-js stores the session under `sb-<ref>-auth-token`; pull the access token out of the saved state. */
export function readAccessToken(storageStatePath: string): string {
  const state = JSON.parse(fs.readFileSync(storageStatePath, 'utf8')) as StorageState;
  for (const origin of state.origins) {
    const entry = origin.localStorage.find(e => /^sb-.*-auth-token$/.test(e.name));
    if (entry) {
      const parsed = JSON.parse(entry.value) as { access_token?: string };
      if (parsed.access_token) return parsed.access_token;
    }
  }
  throw new Error(`No supabase auth token in ${storageStatePath}; did auth.setup.ts run?`);
}
