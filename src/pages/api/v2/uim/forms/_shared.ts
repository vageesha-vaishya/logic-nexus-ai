import type { ApiRequest } from '../../../_utils/types';
import {
  authenticateRequest,
  enforceAnyPermission,
  resolveAndApplyAccessContext,
  type ApiContext,
} from '../../../_utils/http';

export const UIM_FORM_NODE_KEYS = [
  'overview',
  'item-master',
  'stock-ledger',
  'reservations',
  'issue-consume',
  'restock',
  'locations',
  'analytics',
] as const;

export type UimFormNodeKey = (typeof UIM_FORM_NODE_KEYS)[number];

export function parseNodeKey(value: unknown): UimFormNodeKey | null {
  const normalized = String(value || '').trim();
  return UIM_FORM_NODE_KEYS.find((key) => key === normalized) || null;
}

export function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePayload(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

export async function resolveUimFormAccess(req: ApiRequest, ctx: ApiContext): Promise<{
  userId: string;
  tenantId: string;
  franchiseId: string;
}> {
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
