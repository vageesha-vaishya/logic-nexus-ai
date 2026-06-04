/**
 * Phase 8f.3e — extract fetchTasksForWorkOrder out of
 * useAmroWorkspaceState. ~65 LOC of v1/v2 dual-endpoint task
 * loading + merge-into-work-orders mutation lifted into a focused
 * hook. Pure refactor.
 *
 * Pattern matches 8f.3c (fetchWorkOrders) and 8f.3d
 * (fetchModuleSurfaces): typed dependency struct in, memoized
 * async callback out.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
  mapV2StatusToV1Status,
  mapStatusToLifecycle,
} from './amroWorkspaceHelpers';
import type {
  ApiEnvelope,
  ApiTask,
  V2TaskItem,
} from './amroWorkspaceTypes';
import type { AmroWorkOrder } from '../workspace/amroWorkspaceModel';

export interface UseAmroTasksFetchInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  hasAmroAccess: boolean;
  isAwaitingAmroDomainActivation: boolean;
  amroAccessErrorMessage: string;
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;
  setWorkOrders: React.Dispatch<React.SetStateAction<AmroWorkOrder[]>>;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useAmroTasksFetch(input: UseAmroTasksFetchInput) {
  const {
    apiBaseUrl,
    authHeaders,
    hasAmroAccess,
    isAwaitingAmroDomainActivation,
    amroAccessErrorMessage,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrders,
    setWorkOrdersError,
  } = input;

  return useCallback(
    async (workOrderId: string) => {
      if (!authHeaders || !workOrderId) {
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
        let tasks: ApiTask[] = [];
        try {
          const response = await fetch(`${apiBaseUrl}/api/v1/work-orders/${workOrderId}/tasks`, {
            headers: authHeaders,
          });
          const payload = await parseJsonSafe<ApiEnvelope<ApiTask[]> & { error?: string }>(response);
          if (!response.ok || !Array.isArray(payload?.data)) {
            throw new Error(payload?.error || `Failed to load tasks (${response.status})`);
          }
          tasks = payload.data;
        } catch (error) {
          const v2Response = await fetch(
            `${apiBaseUrl}/api/v2/amro/tasks?workOrderId=${encodeURIComponent(workOrderId)}`,
            { headers: authHeaders },
          );
          const v2Payload = await parseJsonSafe<{ data?: { tasks?: V2TaskItem[] }; error?: string }>(
            v2Response,
          );
          const v2Tasks = v2Payload?.data?.tasks;
          if (!v2Response.ok || !Array.isArray(v2Tasks)) {
            throw new Error(v2Payload?.error || `Failed to load tasks (${v2Response.status})`);
          }
          tasks = v2Tasks.map((task) => ({
            id: task.id,
            work_order_id: task.workOrderId,
            title: task.title,
            status: mapV2StatusToV1Status(task.status),
          }));
        }
        setWorkOrders((previous) =>
          previous.map((item) =>
            item.id === workOrderId
              ? {
                  ...item,
                  tasks: tasks.map((task) => ({
                    id: task.id,
                    workOrderId: task.work_order_id,
                    title: task.title,
                    lifecycleStage: mapStatusToLifecycle(task.status),
                    assignedRole: 'planner',
                    completed: mapStatusToLifecycle(task.status) === 'close',
                  })),
                }
              : item,
          ),
        );
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return;
        }
        setWorkOrdersError(error instanceof Error ? error.message : 'Failed to load tasks');
      }
    },
    [
      apiBaseUrl,
      amroAccessErrorMessage,
      authHeaders,
      hasAmroAccess,
      isApiTemporarilyUnavailable,
      isAwaitingAmroDomainActivation,
      markApiTemporarilyUnavailable,
      setWorkOrders,
      setWorkOrdersError,
    ],
  );
}
