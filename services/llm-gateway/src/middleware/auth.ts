// Express middleware factory for the /v1/* endpoints. Reads
// Authorization: Bearer + X-Platform-Id headers, looks up the token,
// validates scope, attaches the result to req.serviceAuth.

import type { NextFunction, Request, Response } from 'express';
import { GatewayError } from './error.js';
import type { AuthLookup, AuthResult, Scope } from '../auth/serviceToken.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      serviceAuth?: AuthResult;
    }
  }
}

function readBearer(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]!.trim() : null;
}

export function requireScope(scope: Scope, lookup: () => AuthLookup) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = readBearer(req);

      // No token sent → only open-mode passes.
      if (!token) {
        const result = await lookup()('');
        if (!result.authenticated) {
          throw new GatewayError('UNAUTHORIZED', 'missing or invalid Authorization: Bearer header', 401);
        }
        // open-mode no-token: allow but mark
        req.serviceAuth = result;
        return next();
      }

      const result = await lookup()(token);
      if (!result.authenticated) {
        throw new GatewayError('UNAUTHORIZED', result.reason ?? 'invalid token', 401);
      }
      req.serviceAuth = result;

      // Open mode: skip scope + platform-id checks.
      if (result.open_mode) return next();

      // Scope check.
      if (!(result.scopes ?? []).includes(scope)) {
        throw new GatewayError('FORBIDDEN', `token missing required scope: ${scope}`, 403, {
          required_scope: scope,
          token_scopes: result.scopes ?? [],
          token_prefix: result.token_prefix,
        });
      }

      // Optional X-Platform-Id consistency check. When the header is
      // present, it must match the token's platform_id (catches
      // misconfigured callers early).
      const headerPlatform = req.header('x-platform-id');
      if (headerPlatform && result.platform_id && headerPlatform !== result.platform_id) {
        throw new GatewayError('FORBIDDEN', 'X-Platform-Id does not match token platform_id', 403, {
          header_platform_id: headerPlatform,
          token_platform_id: result.platform_id,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
