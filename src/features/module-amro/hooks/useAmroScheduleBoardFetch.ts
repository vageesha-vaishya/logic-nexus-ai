/**
 * Phase 8f.3f — extract fetchScheduleBoard out of useAmroWorkspaceState.
 * ~30 LOC, single v2 endpoint, no fallback. Pure refactor.
 *
 * Pattern matches 8f.3c (workOrders), 8f.3d (moduleSurfaces), 8f.3e
 * (tasks): typed dependency struct in, memoized async callback out.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
} from './amroWorkspaceHelpers';
import type {
  ApiScheduleRow,
  V2SchedulesResponse,
} from './amroWorkspaceTypes';

export interface UseAmroScheduleBoardFetchInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  hasAmroAccess: boolean;
  isAwaitingAmroDomainActivation: boolean;
  amroAccessErrorMessage: string;
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;
  setScheduleBoardRows: React.Dispatch<React.SetStateAction<ApiScheduleRow[]>>;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useAmroScheduleBoardFetch(input: UseAmroScheduleBoardFetchInput) {
  const {
    apiBaseUrl,
    authHeaders,
    hasAmroAccess,
    isAwaitingAmroDomainActivation,
    amroAccessErrorMessage,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setScheduleBoardRows,
    setWorkOrdersError,
  } = input;

  return useCallback(async () => {
    if (!authHeaders) {
      setScheduleBoardRows([]);
      return;
    }
    if (!hasAmroAccess) {
      setWorkOrdersError(
        isAwaitingAmroDomainActivation
          ? 'Switching to AMRO domain context...'
          : amroAccessErrorMessage,
      );
      return;
    }
    if (isApiTemporarilyUnavailable()) {
      return;
    }
    try {
      const todayIso = new Date().toISOString();
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/schedules?date=${encodeURIComponent(todayIso)}`,
        { headers: authHeaders },
      );
      const payload = await parseJsonSafe<V2SchedulesResponse>(response);
      const rows = payload?.output?.schedules;
      if (!response.ok || !Array.isArray(rows)) {
        throw new Error(payload?.error || `Failed to load schedules (${response.status})`);
      }
      setScheduleBoardRows(rows);
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to load scheduling board',
      );
    }
  }, [
    apiBaseUrl,
    amroAccessErrorMessage,
    authHeaders,
    hasAmroAccess,
    isApiTemporarilyUnavailable,
    isAwaitingAmroDomainActivation,
    markApiTemporarilyUnavailable,
    setScheduleBoardRows,
    setWorkOrdersError,
  ]);
}
