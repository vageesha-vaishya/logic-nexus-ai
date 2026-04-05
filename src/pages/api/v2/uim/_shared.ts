import type { ApiRequest } from '../../_utils/types';
import {
  authenticateRequest,
  enforceAnyPermission,
  resolveAndApplyAccessContext,
  type ApiContext,
} from '../../_utils/http';

export type UimAccessContext = {
  userId: string;
  tenantId: string;
  franchiseId: string;
};

export async function resolveUimAccess(req: ApiRequest, ctx: ApiContext): Promise<UimAccessContext> {
  const authUser = await authenticateRequest(req);
  ctx.userId = authUser.userId;
  ctx.role = authUser.role;
  enforceAnyPermission(authUser.permissions, ['dashboards.view']);
  const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
  const tenantId = String(scopedAccess.tenantId || '');
  const franchiseId = String(scopedAccess.franchiseId || '');
  if (!tenantId) throw new Error('Tenant context is required');
  return {
    userId: authUser.userId,
    tenantId,
    franchiseId,
  };
}
