// Service-token auth. Resolves a Bearer token to a row in
// gateway.service_tokens (or to an entry in LLM_GATEWAY_DEV_TOKENS for
// local/test setups). Records last_used_at fire-and-forget.
//
// Three lookup modes, picked at boot via env:
//   1. LLM_GATEWAY_AUTH_MODE=open (default if no SUPABASE + no DEV_TOKENS)
//      → no enforcement, one boot-time warning. Same credential-deferred
//      pattern as the rest of the gateway.
//   2. LLM_GATEWAY_DEV_TOKENS='[{"token":"...","platform_id":"...","scopes":[...]}]'
//      → in-memory lookup. Useful for jest + local smoke. Plaintext
//      tokens in env are fine for dev; never use in prod.
//   3. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
//      → DB lookup by SHA-256 hash. Enforced.
//
// Production explicitly sets LLM_GATEWAY_AUTH_MODE=enforced so that
// "no DB by accident" → fail-closed instead of fail-open.

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export type Scope =
  | 'invoke'
  | 'invoke_stream'
  | 'record_outcome'
  | 'submit_job'
  | 'read_usage'
  | 'admin_prompts'
  | 'admin_configs'
  | 'read_budget';

export interface AuthResult {
  authenticated: boolean;
  open_mode?: boolean;
  token_id?: string;
  platform_id?: string;
  token_prefix?: string;
  scopes?: Scope[];
  reason?: string;
}

export type AuthLookup = (plaintextToken: string) => Promise<AuthResult>;

interface DevToken {
  token: string;
  platform_id: string;
  scopes: Scope[];
}

function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

function readDevTokens(): DevToken[] | null {
  const raw = process.env.LLM_GATEWAY_DEV_TOKENS;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DevToken[];
    if (!Array.isArray(parsed)) throw new Error('LLM_GATEWAY_DEV_TOKENS must be a JSON array');
    return parsed;
  } catch (err) {
    logger.error('failed to parse LLM_GATEWAY_DEV_TOKENS; treating as missing', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function readSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Builds an AuthLookup. Pure factory — exported so the route layer can
 * cache the result and tests can swap in a stub via setAuthLookupForTesting.
 */
export function buildAuthLookup(): AuthLookup {
  const explicitMode = process.env.LLM_GATEWAY_AUTH_MODE?.toLowerCase();
  const devTokens = readDevTokens();
  const supabaseEnv = readSupabaseEnv();

  // Explicit open mode (or default when nothing configured).
  if (explicitMode === 'open' || (!devTokens && !supabaseEnv && explicitMode !== 'enforced')) {
    logger.warn('service-token auth: OPEN MODE (no enforcement)', {
      reason: explicitMode === 'open' ? 'LLM_GATEWAY_AUTH_MODE=open' : 'no DEV_TOKENS and no SUPABASE env vars',
    });
    return async (_plaintext: string): Promise<AuthResult> => ({
      authenticated: true,
      open_mode: true,
    });
  }

  // Dev-tokens lookup (in-memory).
  if (devTokens) {
    logger.info('service-token auth: DEV_TOKENS in-memory', { count: devTokens.length });
    const byToken = new Map<string, DevToken>();
    for (const t of devTokens) byToken.set(t.token, t);
    return async (plaintext: string): Promise<AuthResult> => {
      const match = byToken.get(plaintext);
      if (!match) return { authenticated: false, reason: 'token not found in DEV_TOKENS' };
      return {
        authenticated: true,
        platform_id: match.platform_id,
        token_prefix: plaintext.slice(0, 12),
        scopes: match.scopes,
      };
    };
  }

  // Supabase-backed lookup.
  if (supabaseEnv) {
    logger.info('service-token auth: ENFORCED via supabase', { url_host: new URL(supabaseEnv.url).host });
    const client = createClient(supabaseEnv.url, supabaseEnv.key, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'gateway' },
    });
    // 30s positive cache: hot tokens don't hit the DB every call.
    const cache = new Map<string, { result: AuthResult; cachedAt: number }>();
    const TTL_MS = 30_000;

    return async (plaintext: string): Promise<AuthResult> => {
      const hash = hashToken(plaintext);
      const hit = cache.get(hash);
      if (hit && Date.now() - hit.cachedAt < TTL_MS) return hit.result;

      const { data, error } = await client
        .from('service_tokens')
        .select('id, platform_id, token_prefix, scopes, status, expires_at')
        .eq('token_hash', hash)
        .eq('status', 'active')
        .maybeSingle();

      let result: AuthResult;
      if (error) {
        logger.error('service-token lookup failed', { err: error.message, code: error.code });
        result = { authenticated: false, reason: 'lookup failed' };
      } else if (!data) {
        result = { authenticated: false, reason: 'token not found or revoked' };
      } else if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        result = { authenticated: false, reason: 'token expired' };
      } else {
        result = {
          authenticated: true,
          token_id: data.id,
          platform_id: data.platform_id,
          token_prefix: data.token_prefix,
          scopes: data.scopes as Scope[],
        };
        // Fire-and-forget last_used_at bump.
        void client
          .from('service_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', data.id)
          .then(({ error: e }) => {
            if (e) logger.warn('last_used_at update failed', { id: data.id, err: e.message });
          });
      }
      cache.set(hash, { result, cachedAt: Date.now() });
      return result;
    };
  }

  // enforced mode but no DB and no DEV_TOKENS → fail-closed.
  logger.error('service-token auth: ENFORCED mode requested but no lookup source configured; failing closed');
  return async (_plaintext: string): Promise<AuthResult> => ({
    authenticated: false,
    reason: 'no lookup source configured',
  });
}
