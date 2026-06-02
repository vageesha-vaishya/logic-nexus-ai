// POST /v1/outcomes — record the downstream outcome of a previous
// invocation. Per design §6.6 + §2.3.
//
// Body shape (matches packages/llm-client recordOutcome(invocation_id, outcome)):
//   { invocation_id: string, outcome: Outcome }
//
// The gateway looks up gateway.llm_invocations.id to recover the audit
// context (tenant_id, prompt_key, prompt_version_id, experiment_id,
// variant_label) and writes one row to gateway.outcomes. If the
// invocation_id isn't found, returns 404 INVOCATION_NOT_FOUND.
//
// Scope: `record_outcome`.

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { GatewayError } from '../middleware/error.js';
import { requireScope } from '../middleware/auth.js';
import type { AuthLookup } from '../auth/serviceToken.js';
import {
  buildOutcomeRecord,
  buildOutcomeStore,
  type OutcomeStore,
} from '../outcomes/store.js';
import { OutcomeError, type Outcome, type OutcomeKind } from '../outcomes/types.js';

export const outcomesRouter = Router();

let outcomeStore: OutcomeStore | null = null;
function getOutcomeStore(): OutcomeStore {
  if (!outcomeStore) outcomeStore = buildOutcomeStore();
  return outcomeStore;
}

/** Test helper. */
export function setOutcomeStoreForTesting(store: OutcomeStore | null): void {
  outcomeStore = store;
}

const VALID_KINDS: OutcomeKind[] = ['accepted', 'accepted_after_edit', 'rejected', 'overridden', 'ignored'];

function validateOutcomeBody(raw: unknown): { invocation_id: string; outcome: Outcome } {
  if (!raw || typeof raw !== 'object') {
    throw new GatewayError('INVALID_REQUEST', 'body must be a JSON object', 400);
  }
  const b = raw as Record<string, unknown>;
  const invocation_id = typeof b.invocation_id === 'string' ? b.invocation_id : '';
  if (!invocation_id) throw new GatewayError('INVALID_REQUEST', 'invocation_id required', 400);

  const o = b.outcome as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') {
    throw new GatewayError('INVALID_REQUEST', 'outcome required', 400);
  }
  const kind = o.kind as string;
  if (!VALID_KINDS.includes(kind as OutcomeKind)) {
    throw new GatewayError('INVALID_REQUEST', `outcome.kind must be one of ${VALID_KINDS.join(',')}`, 400);
  }
  if (kind !== 'ignored') {
    if (typeof o.user_id !== 'string' || o.user_id.length === 0) {
      throw new GatewayError('INVALID_REQUEST', `outcome.user_id required for kind=${kind}`, 400);
    }
  }
  if ((kind === 'accepted_after_edit' || kind === 'overridden') && o.edited_output === undefined) {
    throw new GatewayError('INVALID_REQUEST', `outcome.edited_output required for kind=${kind}`, 400);
  }
  return { invocation_id, outcome: o as unknown as Outcome };
}

export function mountOutcomeRoutes(authLookup: () => AuthLookup): Router {
  outcomesRouter.post(
    '/outcomes',
    requireScope('record_outcome', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { invocation_id, outcome } = validateOutcomeBody(req.body);
        const ctx = await getOutcomeStore().getInvocationContext(invocation_id);
        if (!ctx) {
          throw new GatewayError('INVOCATION_NOT_FOUND', `invocation ${invocation_id} not found`, 404, { invocation_id });
        }
        const record = buildOutcomeRecord(invocation_id, outcome, ctx, 'sdk');
        try {
          const { id } = await getOutcomeStore().record(record);
          res.status(201).json({ outcome_id: id, invocation_id, kind: outcome.kind });
        } catch (err) {
          if (err instanceof OutcomeError) {
            throw new GatewayError('INTERNAL', err.message, 503, err.details);
          }
          throw err;
        }
      } catch (err) {
        next(err);
      }
    },
  );

  return outcomesRouter;
}
