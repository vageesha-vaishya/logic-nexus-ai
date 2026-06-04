/**
 * Phase 8f.4b — extract openWorkOrderDetails out of useAmroWorkspaceState.
 * Single ~50 LOC callback: focuses the workspace on a WO, fetches its
 * detail row from v2, merges the canonical fields back into the
 * orchestrator's workOrders state, then chains fetchTasksForWorkOrder.
 *
 * Pure refactor — behavior identical.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
  mapLifecycleToStatus,
  mapStatusToLifecycle,
} from './amroWorkspaceHelpers';
import type { AmroWorkOrder } from '../workspace/amroWorkspaceModel';

export interface UseAmroOpenWorkOrderDetailsInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;
  setSelectedWorkOrderId: React.Dispatch<React.SetStateAction<string>>;
  setWorkOrders: React.Dispatch<React.SetStateAction<AmroWorkOrder[]>>;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;
  fetchTasksForWorkOrder: (workOrderId: string) => Promise<void>;
}

export function useAmroOpenWorkOrderDetails(input: UseAmroOpenWorkOrderDetailsInput) {
  const {
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setSelectedWorkOrderId,
    setWorkOrders,
    setWorkOrdersError,
    fetchTasksForWorkOrder,
  } = input;

  return useCallback(
    async (workOrderId: string) => {
      setSelectedWorkOrderId(workOrderId);
      if (!authHeaders) return true;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v2/amro/work-orders/${workOrderId}`,
          { method: 'GET', headers: authHeaders },
        );
        const payload = await parseJsonSafe<{
          data?: {
            work_order?: {
              id?: string;
              status?: string;
              aircraft_id?: string;
              code?: string;
            };
          };
          error?: string;
        }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to load work package detail (${response.status})`);
        }
        const detail = payload?.data?.work_order;
        if (detail?.id) {
          setWorkOrders((current) =>
            current.map((item) =>
              item.id === detail.id
                ? {
                    ...item,
                    packageNumber: String(detail.code || item.packageNumber),
                    lifecycleStage: mapStatusToLifecycle(
                      String(detail.status || mapLifecycleToStatus(item.lifecycleStage)),
                    ),
                    assetId: String(detail.aircraft_id || item.assetId),
                  }
                : item,
            ),
          );
        }
        await fetchTasksForWorkOrder(workOrderId);
        setWorkOrdersError(null);
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
        }
        setWorkOrdersError(error instanceof Error ? error.message : 'Failed to open work package');
        return false;
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      fetchTasksForWorkOrder,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      setSelectedWorkOrderId,
      setWorkOrders,
      setWorkOrdersError,
    ],
  );
}
