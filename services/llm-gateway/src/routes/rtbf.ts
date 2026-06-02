// POST /v1/admin/right-to-be-forgotten — GDPR §17 / design §9.5.
// Scope: admin_configs (high-impact operation).

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { GatewayError } from '../middleware/error.js';
import { requireScope } from '../middleware/auth.js';
import type { AuthLookup } from '../auth/serviceToken.js';
import { buildRtbfStore, type RtbfStore } from '../rtbf/store.js';
import { logger } from '../utils/logger.js';

export const rtbfRouter = Router();

let rtbfStore: RtbfStore | null = null;
function getRtbfStore(): RtbfStore {
  if (!rtbfStore) rtbfStore = buildRtbfStore();
  return rtbfStore;
}

/** Test helper. */
export function setRtbfStoreForTesting(store: RtbfStore | null): void {
  rtbfStore = store;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mountRtbfRoutes(authLookup: () => AuthLookup): Router {
  rtbfRouter.post(
    '/admin/right-to-be-forgotten',
    requireScope('admin_configs', authLookup),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const tenant_id = typeof body.tenant_id === 'string' ? body.tenant_id : '';
        const subject_type = typeof body.subject_type === 'string' ? body.subject_type : '';
        const subject_id = typeof body.subject_id === 'string' ? body.subject_id : '';
        const actor_user_id = typeof body.actor_user_id === 'string' ? body.actor_user_id : null;
        const reason = typeof body.reason === 'string' ? body.reason : null;

        if (!tenant_id || !UUID_RE.test(tenant_id)) {
          throw new GatewayError('INVALID_REQUEST', 'tenant_id (uuid) required', 400);
        }
        if (!subject_type || subject_type.length > 32) {
          throw new GatewayError('INVALID_REQUEST', 'subject_type required (max 32 chars)', 400);
        }
        if (!subject_id || subject_id.length > 256) {
          throw new GatewayError('INVALID_REQUEST', 'subject_id required (max 256 chars)', 400);
        }
        if (subject_type === 'user' && !UUID_RE.test(subject_id)) {
          throw new GatewayError('INVALID_REQUEST', 'when subject_type=user, subject_id must be a uuid', 400);
        }

        const result = await getRtbfStore().scrub({
          tenant_id,
          subject_type,
          subject_id,
          actor_user_id,
          reason,
        });

        logger.warn('rtbf executed', {
          tenant_id,
          subject_type,
          subject_id_prefix: subject_id.slice(0, 8) + '…',
          scrubbed_invocations: result.scrubbed_invocations,
          scrubbed_outcomes: result.scrubbed_outcomes,
          rtbf_log_id: result.rtbf_log_id,
        });

        res.status(200).json({
          tenant_id,
          subject_type,
          // We DO NOT echo the full subject_id back in the response, only
          // the first 8 chars. Caller already knows what it asked for;
          // the full id never lands in shared logs/responses again.
          subject_id_prefix: subject_id.slice(0, 8) + '…',
          ...result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return rtbfRouter;
}
