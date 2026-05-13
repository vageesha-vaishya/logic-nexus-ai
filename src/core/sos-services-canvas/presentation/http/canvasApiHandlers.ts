import { UnauthorizedCanvasActionError } from '../../domain/errors';
import type { AuthenticationService } from '../../application/services/authenticationService';
import type { TenantIsolationService } from '../../application/services/tenantIsolationService';

export interface CanvasHttpRequest {
  headers: Record<string, string | undefined>;
  params: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}

export interface CanvasHttpResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface CanvasApiHandlerDependencies {
  authService: AuthenticationService;
  tenantIsolationService: TenantIsolationService;
}

function resolveBearerToken(request: CanvasHttpRequest): string {
  const authorization = request.headers.authorization ?? request.headers.Authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new UnauthorizedCanvasActionError('missing_bearer_token');
  }
  return authorization.slice('Bearer '.length).trim();
}

export function createCanvasApiHandlers(deps: CanvasApiHandlerDependencies) {
  return {
    async getTenantContext(request: CanvasHttpRequest): Promise<CanvasHttpResponse> {
      try {
        const token = resolveBearerToken(request);
        const claims = await deps.authService.authorize(token, 'tenant.read');
        const targetTenantId = request.params.tenantId;
        if (!targetTenantId) {
          return { status: 400, body: { error: 'tenantId is required' } };
        }

        deps.tenantIsolationService.enforceIsolation(claims.tenantId, targetTenantId);
        const tenant = await deps.tenantIsolationService.resolveTenantContext(targetTenantId);
        return { status: 200, body: { data: tenant } };
      } catch (error) {
        if (error instanceof UnauthorizedCanvasActionError) {
          return { status: 401, body: { error: error.message, code: error.code } };
        }
        return { status: 500, body: { error: 'internal_server_error' } };
      }
    },
  };
}
