// Admin endpoints for experiment evaluation + auto-promote.
//   POST /v1/admin/experiments/:id/evaluate     — read-only verdict
//   POST /v1/admin/experiments/:id/auto-promote — runs verdict, promotes if significant
// Both require admin_configs scope (admin operations).

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { GatewayError } from '../middleware/error.js';
import { requireScope } from '../middleware/auth.js';
import type { AuthLookup } from '../auth/serviceToken.js';
import { buildEvaluatorStore, type EvaluatorStore } from '../prompts/evaluatorStore.js';
import { evaluate, type EvalOptions } from '../prompts/evaluator.js';

export const experimentsRouter = Router();

let evaluatorStore: EvaluatorStore | null = null;
function getEvaluatorStore(): EvaluatorStore {
  if (!evaluatorStore) evaluatorStore = buildEvaluatorStore();
  return evaluatorStore;
}

/** Test helper. */
export function setEvaluatorStoreForTesting(store: EvaluatorStore | null): void {
  evaluatorStore = store;
}

function readEvalOptionsFromBody(body: unknown): EvalOptions {
  const b = (body ?? {}) as Record<string, unknown>;
  const opts: EvalOptions = {};
  if (typeof b.p_threshold === 'number' && b.p_threshold > 0 && b.p_threshold < 1) {
    opts.p_threshold = b.p_threshold;
  }
  if (typeof b.min_per_variant === 'number' && b.min_per_variant >= 0) {
    opts.min_per_variant = b.min_per_variant;
  }
  return opts;
}

export function mountExperimentRoutes(authLookup: () => AuthLookup): Router {
  // ── POST /v1/admin/experiments/:id/evaluate ──
  experimentsRouter.post(
    '/admin/experiments/:id/evaluate',
    requireScope('admin_configs', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id;
        if (!id) throw new GatewayError('INVALID_REQUEST', 'experiment id required', 400);
        const stats = await getEvaluatorStore().fetchContingency(id);
        if (!stats) {
          throw new GatewayError('INVOCATION_NOT_FOUND', `experiment ${id} not found`, 404, { experiment_id: id });
        }
        const opts = readEvalOptionsFromBody(req.body);
        const verdict = evaluate(stats, opts);
        res.json({
          experiment_id: id,
          prompt_key: stats.prompt_key,
          stats,
          verdict,
          options: { p_threshold: opts.p_threshold ?? 0.05, min_per_variant: opts.min_per_variant ?? 30 },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST /v1/admin/experiments/:id/auto-promote ──
  experimentsRouter.post(
    '/admin/experiments/:id/auto-promote',
    requireScope('admin_configs', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id;
        if (!id) throw new GatewayError('INVALID_REQUEST', 'experiment id required', 400);
        const stats = await getEvaluatorStore().fetchContingency(id);
        if (!stats) {
          throw new GatewayError('INVOCATION_NOT_FOUND', `experiment ${id} not found`, 404, { experiment_id: id });
        }
        if (stats.status !== 'active') {
          throw new GatewayError('INVALID_REQUEST', `experiment is not active (status=${stats.status})`, 409, {
            experiment_id: id,
            status: stats.status,
          });
        }
        const opts = readEvalOptionsFromBody(req.body);
        const verdict = evaluate(stats, opts);

        if (verdict.kind !== 'significant') {
          res.status(202).json({
            experiment_id: id,
            promoted: false,
            reason: verdict.kind,
            verdict,
          });
          return;
        }

        const promoted = await getEvaluatorStore().promoteWinner(id, verdict.winner_version_id);
        res.status(200).json({
          experiment_id: id,
          promoted: true,
          winner_version_id: verdict.winner_version_id,
          loser_version_id: verdict.loser_version_id,
          prior_active_version_id: promoted.prior_active_version_id,
          verdict,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return experimentsRouter;
}
