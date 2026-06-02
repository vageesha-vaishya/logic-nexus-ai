// Prompt endpoints. Per design §2.3.
//   GET  /v1/prompts/:key            — fetch active version (requires invoke scope)
//   POST /v1/prompts/:key/render     — substitute variables, NO LLM call (invoke scope)
//   POST /v1/admin/prompts           — create/bump version (admin_prompts scope)

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import { GatewayError } from '../middleware/error.js';
import { requireScope } from '../middleware/auth.js';
import type { AuthLookup } from '../auth/serviceToken.js';
import { buildPromptStore, type PromptStore, type PromptUpsertInput } from '../prompts/store.js';
import { renderPrompt, pickBodyForProvider } from '../prompts/renderer.js';
import { PromptError } from '../prompts/types.js';

export const promptsRouter = Router();

let promptStore: PromptStore | null = null;
function getPromptStore(): PromptStore {
  if (!promptStore) promptStore = buildPromptStore();
  return promptStore;
}

/** Test helper: inject custom prompt store. Production code never calls this. */
export function setPromptStoreForTesting(store: PromptStore | null): void {
  promptStore = store;
}

function mapPromptError(err: PromptError): GatewayError {
  const status =
    err.code === 'PROMPT_NOT_FOUND' || err.code === 'PROMPT_VERSION_NOT_FOUND' ? 404 :
    err.code === 'PROMPT_NO_ACTIVE_VERSION' ? 409 :
    err.code === 'PROMPT_RENDER_FAILED' ? 422 :
    503;
  // PROMPT_NOT_FOUND is a known gateway code; the others alias to INVALID_REQUEST / INTERNAL.
  const code = err.code === 'PROMPT_NOT_FOUND' ? 'PROMPT_NOT_FOUND' :
               err.code === 'PROMPT_RENDER_FAILED' ? 'INVALID_REQUEST' :
               'INTERNAL';
  return new GatewayError(code, err.message, status, err.details);
}

/** Returns the auth lookup factory wired by the invoke route. */
function lookupSupplier(authLookup: () => AuthLookup) {
  return authLookup;
}

export function mountPromptRoutes(authLookup: () => AuthLookup): Router {
  // ── GET /v1/prompts/:key ──
  promptsRouter.get(
    '/prompts/:key',
    requireScope('invoke', lookupSupplier(authLookup)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = req.params.key;
        if (!key) throw new GatewayError('INVALID_REQUEST', 'prompt key required in path', 400);
        const { prompt, active_version } = await getPromptStore().getActive(key);
        res.json({ prompt, active_version });
      } catch (err) {
        if (err instanceof PromptError) return next(mapPromptError(err));
        next(err);
      }
    },
  );

  // ── POST /v1/prompts/:key/render ──
  promptsRouter.post(
    '/prompts/:key/render',
    requireScope('invoke', lookupSupplier(authLookup)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = req.params.key;
        if (!key) throw new GatewayError('INVALID_REQUEST', 'prompt key required in path', 400);
        const body = req.body as { variables?: Record<string, unknown>; provider_kind?: string };
        const variables = body.variables ?? {};
        if (typeof variables !== 'object' || Array.isArray(variables)) {
          throw new GatewayError('INVALID_REQUEST', 'variables must be an object', 400);
        }
        const { active_version } = await getPromptStore().getActive(key);
        const bodyText = pickBodyForProvider(
          active_version.body,
          active_version.body_variants,
          body.provider_kind ?? '',
        );
        const result = renderPrompt(bodyText, variables);
        res.json({
          prompt_key: key,
          version_id: active_version.id,
          version_number: active_version.version_number,
          rendered: result.rendered,
          missing_paths: result.missing_paths,
          applied_paths: result.applied_paths,
          provider_kind: body.provider_kind ?? null,
        });
      } catch (err) {
        if (err instanceof PromptError) return next(mapPromptError(err));
        next(err);
      }
    },
  );

  // ── POST /v1/admin/prompts ──
  promptsRouter.post(
    '/admin/prompts',
    requireScope('admin_prompts', lookupSupplier(authLookup)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as Partial<PromptUpsertInput>;
        const missing: string[] = [];
        if (!body.key || typeof body.key !== 'string') missing.push('key');
        if (!body.module || typeof body.module !== 'string') missing.push('module');
        if (!body.feature || typeof body.feature !== 'string') missing.push('feature');
        if (!body.body || typeof body.body !== 'string') missing.push('body');
        if (missing.length > 0) {
          throw new GatewayError('INVALID_REQUEST', `missing required fields: ${missing.join(', ')}`, 400, { missing });
        }
        const result = await getPromptStore().upsert(body as PromptUpsertInput);
        res.status(201).json(result);
      } catch (err) {
        if (err instanceof PromptError) return next(mapPromptError(err));
        next(err);
      }
    },
  );

  return promptsRouter;
}
