// RTBF (right-to-be-forgotten) store. Calls gateway.scrub_subject_pii.
// Falls back to in-memory (returns zero-count log) when SUPABASE env
// vars are missing, so dev/test never crashes.

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export interface RtbfRequest {
  tenant_id: string;
  subject_type: 'user' | 'party' | string;
  subject_id: string;
  actor_user_id?: string | null;
  reason?: string | null;
}

export interface RtbfResult {
  scrubbed_invocations: number;
  scrubbed_outcomes: number;
  rtbf_log_id: string;
}

export interface RtbfStore {
  scrub(req: RtbfRequest): Promise<RtbfResult>;
}

function readEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function buildInMemoryRtbfStore(): RtbfStore & {
  calls(): RtbfRequest[];
  setResult(result: RtbfResult): void;
  clear(): void;
} {
  const calls: RtbfRequest[] = [];
  let nextResult: RtbfResult = {
    scrubbed_invocations: 0,
    scrubbed_outcomes: 0,
    rtbf_log_id: 'inmem-rtbf-log',
  };
  return {
    async scrub(req: RtbfRequest) {
      calls.push(req);
      return nextResult;
    },
    calls() {
      return [...calls];
    },
    setResult(result) {
      nextResult = result;
    },
    clear() {
      calls.length = 0;
      nextResult = { scrubbed_invocations: 0, scrubbed_outcomes: 0, rtbf_log_id: 'inmem-rtbf-log' };
    },
  };
}

export function buildSupabaseRtbfStore(): RtbfStore | null {
  const env = readEnv();
  if (!env) return null;
  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' },
  });
  logger.info('rtbf store: supabase initialized', { url_host: new URL(env.url).host });

  return {
    async scrub(req: RtbfRequest) {
      const { data, error } = await client.rpc('scrub_subject_pii', {
        p_tenant_id: req.tenant_id,
        p_subject_type: req.subject_type,
        p_subject_id: req.subject_id,
        p_actor_user_id: req.actor_user_id ?? null,
        p_reason: req.reason ?? null,
      });
      if (error || !data || !Array.isArray(data) || data.length === 0) {
        throw new Error(`scrub_subject_pii failed: ${error?.message ?? 'no row returned'}`);
      }
      const row = data[0] as Record<string, unknown>;
      return {
        scrubbed_invocations: Number(row.scrubbed_invocations),
        scrubbed_outcomes: Number(row.scrubbed_outcomes),
        rtbf_log_id: String(row.rtbf_log_id),
      };
    },
  };
}

export function buildRtbfStore(): RtbfStore {
  return buildSupabaseRtbfStore() ?? buildInMemoryRtbfStore();
}
