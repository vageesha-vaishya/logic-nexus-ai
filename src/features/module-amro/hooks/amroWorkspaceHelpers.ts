// Pure helpers extracted from useAmroWorkspaceState.ts (Slice D).
// Behavior-preserving 1:1 lifts; no React state involved.

import type { AmroWorkOrderLifecycleStage } from '../workspace/amroWorkspaceModel';
import { DEFAULT_WORK_PACKAGE_SAVED_VIEW, type V2SavedWorkOrderView } from './amroWorkspaceTypes';

export async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw.trim()) {
    return null;
  }
  return JSON.parse(raw) as T;
}

export function isNetworkConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('econnrefused')
  );
}

export function isNotFoundErrorMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return normalized === 'not found' || normalized.includes('(404)') || normalized.includes('404 not found');
}

export function isMissingAircraftIdErrorMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes('missing required field: aircraft_id') ||
    normalized.includes('missing required fields: aircraft_id')
  );
}

export function mapV2StatusToV1Status(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'planned') return 'planning';
  if (normalized === 'blocked') return 'on_hold';
  return normalized;
}

export function getAmroApiBaseUrl(): string {
  const runtimeEnv =
    typeof window !== 'undefined'
      ? ((window as unknown as { __ENV__?: Record<string, unknown>; __APP_CONFIG__?: Record<string, unknown> }).__ENV__ ||
        (window as unknown as { __APP_CONFIG__?: Record<string, unknown> }).__APP_CONFIG__ ||
        {})
      : {};
  const rawBase = String(import.meta.env.VITE_AMRO_API_BASE_URL || runtimeEnv.VITE_AMRO_API_BASE_URL || '/api/amro').trim();
  const normalizedBase = rawBase === '' || rawBase === '/' ? '/api/amro' : rawBase;
  const withoutTrailingSlash = normalizedBase.replace(/\/$/, '');
  const withoutLegacyProxyPrefix = withoutTrailingSlash.replace(/\/api\/amro$/i, '').replace(/\/api$/i, '');
  return withoutLegacyProxyPrefix === '/' ? '' : withoutLegacyProxyPrefix;
}

export function mapStatusToLifecycle(status: string): AmroWorkOrderLifecycleStage {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'approved') return 'plan';
  if (normalized === 'planning') return 'create';
  if (normalized === 'scheduled') return 'schedule';
  if (normalized === 'blocked' || normalized === 'on_hold') return 'blocked';
  if (normalized === 'in_progress') return 'execute';
  if (normalized === 'completed' || normalized === 'closed' || normalized === 'cancelled') return 'close';
  return 'create';
}

export function mapLifecycleToStatus(stage: AmroWorkOrderLifecycleStage): string {
  if (stage === 'create') return 'planning';
  if (stage === 'plan') return 'approved';
  if (stage === 'schedule') return 'scheduled';
  if (stage === 'execute') return 'in_progress';
  if (stage === 'blocked') return 'blocked';
  return 'closed';
}

export function sanitizeSavedWorkOrderViews(views: unknown): V2SavedWorkOrderView[] {
  if (!Array.isArray(views)) {
    return [DEFAULT_WORK_PACKAGE_SAVED_VIEW];
  }
  const dedupe = new Map<string, V2SavedWorkOrderView>();
  views.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const item = entry as Partial<V2SavedWorkOrderView>;
    const id = String(item.id || '').trim();
    const name = String(item.name || '').trim();
    if (!id || !name) {
      return;
    }
    dedupe.set(id, {
      id,
      name,
      filters: {
        status: String(item.filters?.status || 'all').trim() || 'all',
        search: String(item.filters?.search || ''),
      },
    });
  });
  if (!dedupe.has(DEFAULT_WORK_PACKAGE_SAVED_VIEW.id)) {
    dedupe.set(DEFAULT_WORK_PACKAGE_SAVED_VIEW.id, DEFAULT_WORK_PACKAGE_SAVED_VIEW);
  }
  return Array.from(dedupe.values());
}

export function resolveRoleTransitionTargets(role: string): string[] {
  if (role === 'tenant_admin') return ['planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'];
  if (role === 'planner') return ['planning', 'scheduled', 'blocked'];
  if (role === 'engineer') return ['scheduled', 'in_progress', 'blocked'];
  if (role === 'technician') return ['in_progress'];
  if (role === 'inspector') return ['completed', 'blocked'];
  return [];
}
