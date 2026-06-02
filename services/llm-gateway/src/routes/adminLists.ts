// Admin list endpoints — read-only views into the gateway DB so an
// operator UI can browse prompts, experiments, and recent invocations
// without poking SQL directly. All admin_configs-scoped.
//
//   GET /v1/admin/prompts
//        → { items: [{ key, module, feature, active_version_id, total_versions, updated_at, default_capability, safety_class }] }
//
//   GET /v1/admin/experiments
//        → { items: [{ id, prompt_key, status, traffic_split, variant_a_version_id, variant_b_version_id, started_at, evaluated_at, verdict, sample_size }] }
//
//   GET /v1/admin/audit?prompt_key=&status=&limit=
//        → { items: [{ id, ts, prompt_key, version_id, provider_kind, model_id, status, error_code, latency_ms, cost_usd, tenant_id, user_id }] }
//        limit defaults to 50, capped at 200.
//
// Implementation uses its own Supabase service-role client so we don't
// have to bolt list() methods onto the existing PromptStore /
// ExperimentStore / InvocationAuditWriter interfaces (those are
// hot-path write interfaces; keeping them lean is intentional). In
// dev without env vars, all endpoints return `{ items: [], note: ... }`.

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

import { GatewayError } from '../middleware/error.js';
import { requireScope } from '../middleware/auth.js';
import type { AuthLookup } from '../auth/serviceToken.js';
import { logger } from '../utils/logger.js';

export const adminListsRouter = Router();

// Use a structural type so the gateway-schema generic doesn't clash with
// the default public-schema SupabaseClient declaration; we only need
// from()/select() shape here.
type AdminListClient = ReturnType<typeof createClient>;

let cachedClient: AdminListClient | null = null;
function readEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}
function getClient(): AdminListClient | null {
  if (cachedClient) return cachedClient;
  const env = readEnv();
  if (!env) return null;
  // The default SupabaseClient is typed for schema='public'; the
  // gateway schema isn't in the generated types, so we cast through
  // unknown to keep TS quiet without leaking `any` through the file.
  cachedClient = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' as never },
  }) as unknown as AdminListClient;
  logger.info('admin-lists: supabase initialized', { url_host: new URL(env.url).host });
  return cachedClient;
}

/** Test helper — never invoked in production. */
export function setAdminListClientForTesting(client: AdminListClient | null): void {
  cachedClient = client;
}

const NOTE_NO_DB = 'gateway DB not configured (Supabase env vars missing); list returned empty';

function clampLimit(raw: unknown, fallback = 50, hardMax = 200): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), hardMax);
}

export function mountAdminListRoutes(authLookup: () => AuthLookup): Router {
  // ── GET /v1/admin/prompts ────────────────────────────────────────
  adminListsRouter.get(
    '/admin/prompts',
    requireScope('admin_configs', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = clampLimit(req.query.limit, 100, 500);
        const client = getClient();
        if (!client) {
          res.json({ items: [], note: NOTE_NO_DB });
          return;
        }
        // Pull prompts + a per-key version count from prompt_versions.
        const [promptsRes, versionsRes] = await Promise.all([
          client.from('prompts').select('*').order('updated_at', { ascending: false }).limit(limit),
          client.from('prompt_versions').select('prompt_key'),
        ]);
        if (promptsRes.error) throw promptsRes.error;
        const versionCounts = new Map<string, number>();
        for (const row of (versionsRes.data ?? []) as Array<{ prompt_key: string }>) {
          versionCounts.set(row.prompt_key, (versionCounts.get(row.prompt_key) ?? 0) + 1);
        }
        const items = (promptsRes.data ?? []).map((p) => {
          const r = p as Record<string, unknown>;
          const key = String(r.key);
          return {
            key,
            module: r.module,
            feature: r.feature,
            description: r.description ?? null,
            active_version_id: r.active_version_id ?? null,
            total_versions: versionCounts.get(key) ?? 0,
            updated_at: r.updated_at,
            default_capability: r.default_capability ?? null,
            safety_class: r.safety_class ?? null,
          };
        });
        res.json({ items });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── GET /v1/admin/experiments ────────────────────────────────────
  adminListsRouter.get(
    '/admin/experiments',
    requireScope('admin_configs', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = clampLimit(req.query.limit, 100, 500);
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const client = getClient();
        if (!client) {
          res.json({ items: [], note: NOTE_NO_DB });
          return;
        }
        let q = client
          .from('prompt_experiments')
          .select('*')
          .order('started_at', { ascending: false, nullsFirst: false })
          .limit(limit);
        if (status) q = q.eq('status', status);
        const { data, error } = await q;
        if (error) throw error;
        const items = (data ?? []).map((e) => {
          const r = e as Record<string, unknown>;
          return {
            id: r.id,
            prompt_key: r.prompt_key,
            status: r.status,
            traffic_split: r.traffic_split,
            variant_a_version_id: r.variant_a_version_id,
            variant_b_version_id: r.variant_b_version_id,
            started_at: r.started_at,
            evaluated_at: r.evaluated_at ?? null,
            verdict: r.verdict ?? null,
            sample_size: r.sample_size ?? null,
            note: r.note ?? null,
          };
        });
        res.json({ items });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── GET /v1/admin/audit ──────────────────────────────────────────
  adminListsRouter.get(
    '/admin/audit',
    requireScope('admin_configs', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = clampLimit(req.query.limit, 50, 200);
        const promptKey = typeof req.query.prompt_key === 'string' ? req.query.prompt_key : undefined;
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const tenantId = typeof req.query.tenant_id === 'string' ? req.query.tenant_id : undefined;
        const client = getClient();
        if (!client) {
          res.json({ items: [], note: NOTE_NO_DB });
          return;
        }
        let q = client
          .from('invocation_audit')
          .select('id, ts, prompt_key, version_id, provider_kind, model_id, status, error_code, latency_ms, cost_usd, tenant_id, user_id, experiment_id, variant_label')
          .order('ts', { ascending: false })
          .limit(limit);
        if (promptKey) q = q.eq('prompt_key', promptKey);
        if (status) q = q.eq('status', status);
        if (tenantId) q = q.eq('tenant_id', tenantId);
        const { data, error } = await q;
        if (error) throw error;
        res.json({ items: data ?? [] });
      } catch (err) {
        // Surface a clean envelope when the audit table column set
        // doesn't match (e.g. older migration); helps the operator
        // see what's going on instead of getting a generic 500.
        if (err && typeof err === 'object' && 'message' in (err as object)) {
          const msg = String((err as { message?: unknown }).message ?? '');
          if (/relation .* does not exist|column .* does not exist/i.test(msg)) {
            throw new GatewayError('INTERNAL', `audit query failed: ${msg}`, 500);
          }
        }
        next(err);
      }
    },
  );

  return adminListsRouter;
}
