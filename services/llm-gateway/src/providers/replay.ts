// Replay provider — serves canned responses from disk fixtures.
// Per design §1.6: "serves cached real responses from
// services/llm-gateway/fixtures/ for golden-output integration tests."
//
// Fixture path resolution:
//   1. exact:    fixtures/<prompt_key>.<variables_hash>.json
//   2. prompt:   fixtures/<prompt_key>.json
//   3. fallback: fixtures/_default.json (only in non-strict mode)
//
// Strict mode (LLM_GATEWAY_REPLAY_STRICT=1) throws PROVIDER_UNAVAILABLE
// when no fixture matches — catches missing fixtures in CI before they
// reach prod.

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve as resolvePath } from 'path';
import type {
  InvokeRequest,
  ProviderAdapter,
  ProviderContext,
  ProviderResult,
  InvokeUsage,
} from '../types/gateway.types.js';

interface FixturePayload {
  output: unknown;
  model_used?: string;
  usage?: Partial<InvokeUsage>;
  cost_usd?: number;
  warnings?: string[];
}

function fixturesDir(): string {
  const fromEnv = process.env.LLM_GATEWAY_FIXTURES_DIR;
  if (fromEnv) return resolvePath(fromEnv);
  // Default: ./fixtures relative to current working directory.
  return resolvePath(process.cwd(), 'fixtures');
}

function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalize).join(',')}]`;
  const entries = Object.entries(obj as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${k}:${canonicalize(v)}`).join(',')}}`;
}

function variablesHash(vars: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalize(vars)).digest('hex').slice(0, 16);
}

function loadFixture(promptKey: string, vars: Record<string, unknown>): { path: string; payload: FixturePayload } | null {
  const dir = fixturesDir();
  const hash = variablesHash(vars);
  const candidates = [
    `${dir}/${promptKey}.${hash}.json`,
    `${dir}/${promptKey}.json`,
  ];
  if (process.env.LLM_GATEWAY_REPLAY_STRICT !== '1') {
    candidates.push(`${dir}/_default.json`);
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const raw = readFileSync(candidate, 'utf8');
      return { path: candidate, payload: JSON.parse(raw) as FixturePayload };
    }
  }
  return null;
}

export const replayProvider: ProviderAdapter = {
  kind: 'replay',
  async invoke(req: InvokeRequest, _ctx: ProviderContext): Promise<ProviderResult> {
    const loaded = loadFixture(req.prompt_key, req.variables);
    if (!loaded) {
      throw new Error(`REPLAY_FIXTURE_NOT_FOUND:${req.prompt_key}`);
    }
    const { payload } = loaded;
    const usage: InvokeUsage = {
      prompt_tokens: payload.usage?.prompt_tokens ?? 0,
      completion_tokens: payload.usage?.completion_tokens ?? 0,
      total_tokens:
        payload.usage?.total_tokens ??
        ((payload.usage?.prompt_tokens ?? 0) + (payload.usage?.completion_tokens ?? 0)),
    };
    return {
      output: payload.output,
      model_used: payload.model_used ?? 'replay-v1',
      usage,
      cost_usd: payload.cost_usd ?? 0,
      warnings: ['replay_provider_used', ...(payload.warnings ?? [])],
    };
  },
};
