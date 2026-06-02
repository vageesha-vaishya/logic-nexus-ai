// Prompt store. Supabase-backed when env vars are set; in-memory
// fallback otherwise so the gateway boots zero-config.
//
// The in-memory store accepts admin writes (POST /v1/admin/prompts)
// during a single process lifetime — useful for local dev + jest.
// Production uses the supabase store + gateway.prompts table.

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import {
  PromptError,
  type Prompt,
  type PromptVersion,
} from './types.js';

export interface PromptUpsertInput {
  key: string;
  module: string;
  feature: string;
  body: string;
  description?: string;
  body_variants?: Record<string, string>;
  frontmatter?: Record<string, unknown>;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  default_capability?: string;
  default_temperature?: number;
  default_max_tokens?: number;
  cache_ttl_seconds?: number;
  safety_class?: 'standard' | 'elevated' | 'restricted';
  source?: 'git' | 'admin_ui';
  git_sha?: string;
  promote_active?: boolean;
}

export interface PromptStore {
  /** Fetch a prompt + its active version. Throws PROMPT_NOT_FOUND. */
  getActive(key: string): Promise<{ prompt: Prompt; active_version: PromptVersion }>;
  /** Fetch a specific version by id. Used by experiment picker to load variant_b. */
  getVersionById(version_id: string): Promise<PromptVersion>;
  /** Create/bump version. Returns the new version id + number. */
  upsert(input: PromptUpsertInput): Promise<{ version_id: string; version_number: number }>;
}

function readEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

// ── In-memory implementation (dev + jest) ──────────────────────────

interface InMemoryEntry {
  prompt: Prompt;
  versions: PromptVersion[];
}

export function buildInMemoryPromptStore(): PromptStore {
  const store = new Map<string, InMemoryEntry>();

  return {
    async getActive(key: string) {
      const entry = store.get(key);
      if (!entry) throw new PromptError('PROMPT_NOT_FOUND', `prompt ${key} not found`, { key });
      const active = entry.versions.find((v) => v.id === entry.prompt.active_version_id);
      if (!active) {
        throw new PromptError('PROMPT_NO_ACTIVE_VERSION', `prompt ${key} has no active version`, { key });
      }
      return { prompt: entry.prompt, active_version: active };
    },
    async getVersionById(version_id: string) {
      for (const entry of store.values()) {
        const v = entry.versions.find((vv) => vv.id === version_id);
        if (v) return v;
      }
      throw new PromptError('PROMPT_VERSION_NOT_FOUND', `version ${version_id} not found`, { version_id });
    },
    async upsert(input: PromptUpsertInput) {
      const existing = store.get(input.key);
      const now = new Date().toISOString();
      const versionNumber = (existing?.versions.length ?? 0) + 1;
      const version_id = `inmem-${input.key}-v${versionNumber}-${now}`;
      const promote = input.promote_active ?? true;

      const newVersion: PromptVersion = {
        id: version_id,
        prompt_key: input.key,
        version_number: versionNumber,
        body: input.body,
        body_variants: input.body_variants ?? {},
        frontmatter: input.frontmatter ?? {},
        input_schema: input.input_schema ?? null,
        output_schema: input.output_schema ?? null,
        default_capability: input.default_capability ?? null,
        default_temperature: input.default_temperature ?? null,
        default_max_tokens: input.default_max_tokens ?? null,
        cache_ttl_seconds: input.cache_ttl_seconds ?? 0,
        safety_class: input.safety_class ?? 'standard',
        status: promote ? 'active' : 'draft',
        source: input.source ?? 'admin_ui',
        git_sha: input.git_sha ?? null,
        created_at: now,
        promoted_at: promote ? now : null,
      };

      if (existing) {
        if (promote) {
          for (const v of existing.versions) if (v.status === 'active') v.status = 'superseded';
          existing.prompt.active_version_id = version_id;
        }
        existing.versions.push(newVersion);
        existing.prompt.module = input.module;
        existing.prompt.feature = input.feature;
        existing.prompt.description = input.description ?? existing.prompt.description;
        existing.prompt.updated_at = now;
      } else {
        const prompt: Prompt = {
          key: input.key,
          module: input.module,
          feature: input.feature,
          description: input.description ?? null,
          status: 'active',
          active_version_id: promote ? version_id : null,
          created_at: now,
          updated_at: now,
        };
        store.set(input.key, { prompt, versions: [newVersion] });
      }
      return { version_id, version_number: versionNumber };
    },
  };
}

// ── Supabase-backed implementation ─────────────────────────────────

export function buildSupabasePromptStore(): PromptStore | null {
  const env = readEnv();
  if (!env) return null;
  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' },
  });
  logger.info('prompt store: supabase initialized', { url_host: new URL(env.url).host });

  return {
    async getActive(key: string) {
      const { data: prompt, error: promptErr } = await client
        .from('prompts')
        .select('key, module, feature, description, status, active_version_id, created_at, updated_at')
        .eq('key', key)
        .maybeSingle();
      if (promptErr || !prompt) {
        throw new PromptError('PROMPT_NOT_FOUND', `prompt ${key} not found`, { key, err: promptErr?.message });
      }
      if (!prompt.active_version_id) {
        throw new PromptError('PROMPT_NO_ACTIVE_VERSION', `prompt ${key} has no active version`, { key });
      }
      const { data: version, error: vErr } = await client
        .from('prompt_versions')
        .select('id, prompt_key, version_number, body, body_variants, frontmatter, input_schema, output_schema, default_capability, default_temperature, default_max_tokens, cache_ttl_seconds, safety_class, status, source, git_sha, created_by_user_id, created_at, promoted_at')
        .eq('id', prompt.active_version_id)
        .maybeSingle();
      if (vErr || !version) {
        throw new PromptError('PROMPT_VERSION_NOT_FOUND', `active version not found`, { key, err: vErr?.message });
      }
      return {
        prompt: prompt as Prompt,
        active_version: version as PromptVersion,
      };
    },
    async getVersionById(version_id: string) {
      const { data, error } = await client
        .from('prompt_versions')
        .select('id, prompt_key, version_number, body, body_variants, frontmatter, input_schema, output_schema, default_capability, default_temperature, default_max_tokens, cache_ttl_seconds, safety_class, status, source, git_sha, created_by_user_id, created_at, promoted_at')
        .eq('id', version_id)
        .maybeSingle();
      if (error || !data) {
        throw new PromptError('PROMPT_VERSION_NOT_FOUND', `version ${version_id} not found`, { version_id, err: error?.message });
      }
      return data as PromptVersion;
    },
    async upsert(input: PromptUpsertInput) {
      const { data, error } = await client.rpc('upsert_prompt_version', {
        p_key: input.key,
        p_module: input.module,
        p_feature: input.feature,
        p_body: input.body,
        p_description: input.description ?? null,
        p_body_variants: input.body_variants ?? {},
        p_frontmatter: input.frontmatter ?? {},
        p_input_schema: input.input_schema ?? null,
        p_output_schema: input.output_schema ?? null,
        p_default_capability: input.default_capability ?? null,
        p_default_temperature: input.default_temperature ?? null,
        p_default_max_tokens: input.default_max_tokens ?? null,
        p_cache_ttl_seconds: input.cache_ttl_seconds ?? 0,
        p_safety_class: input.safety_class ?? 'standard',
        p_source: input.source ?? 'admin_ui',
        p_git_sha: input.git_sha ?? null,
        p_promote_active: input.promote_active ?? true,
      });
      if (error || !data || !Array.isArray(data) || data.length === 0) {
        throw new PromptError('PROMPT_STORE_UNAVAILABLE', `upsert failed`, { err: error?.message });
      }
      const row = data[0] as { version_id: string; version_number: number };
      return { version_id: row.version_id, version_number: row.version_number };
    },
  };
}

/** Build the store: prefer supabase; fall back to in-memory. */
export function buildPromptStore(): PromptStore {
  const supa = buildSupabasePromptStore();
  if (supa) return supa;
  logger.info('prompt store: env vars missing, using in-memory store');
  return buildInMemoryPromptStore();
}
