// Phase 7 UIM Step 4b.9 — shared helpers for the forms surface.
//
// Carved from src/pages/api/v2/uim/forms/_shared.ts (84 LOC).
// Kept service-side (not in middleware) so per-node mapper slices
// can import these without dragging in Express.

import type { Response } from 'express';

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

/**
 * Translate uim_form_records storage errors into the right HTTP shape.
 * Returns true if the error was handled — caller should not write a
 * second response.
 */
export function tryHandleUimFormStorageError(res: Response, error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();
  if (normalized.includes('uim_form_records') && normalized.includes('does not exist')) {
    res.status(503).json({
      error: 'UIM form storage is not ready. Run migration 20260404212000_uim_form_records_crud.sql.',
      code: 'UIM_FORM_STORAGE_NOT_READY',
      statusCode: 503,
    });
    return true;
  }
  if (normalized.includes('permission denied') && normalized.includes('uim_form_records')) {
    res.status(403).json({
      error: 'Insufficient permissions for UIM form storage.',
      code: 'UIM_FORM_STORAGE_PERMISSION_DENIED',
      statusCode: 403,
    });
    return true;
  }
  return false;
}
