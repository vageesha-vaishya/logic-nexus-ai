import type { ApiRequest } from '../../../_utils/types';
import type { ApiResponse } from '../../../_utils/types';
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

export function tryHandleUimFormStorageError(
  res: ApiResponse,
  error: unknown,
  correlationId: string,
): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();
  if (normalized.includes('uim_form_records') && normalized.includes('does not exist')) {
    res.status(503).json({
      error: 'UIM form storage is not ready. Run migration 20260404212000_uim_form_records_crud.sql.',
      code: 'UIM_FORM_STORAGE_NOT_READY',
      correlationId,
      version: 'v2',
    });
    return true;
  }
  if (normalized.includes('permission denied') && normalized.includes('uim_form_records')) {
    res.status(403).json({
      error: 'Insufficient permissions for UIM form storage.',
      code: 'UIM_FORM_STORAGE_PERMISSION_DENIED',
      correlationId,
      version: 'v2',
    });
    return true;
  }
  return false;
}
