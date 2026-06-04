/**
 * Phase 8f.4i — final inline-callback carve out of useAmroWorkspaceState.
 * Lifts saveCurrentWorkOrderView + deleteSelectedWorkOrder into one
 * focused hook. After this slice, the orchestrator has zero remaining
 * inline async useCallback definitions — every mutation has been
 * extracted.
 *
 * Returns {
 *   saveCurrentWorkOrderView,
 *   deleteSelectedWorkOrder,
 * }
 *
 * The two callbacks aren't conceptually related (save-view is a
 * filter persistence op; delete is a destructive WO op) but they're
 * the last two inline mutators and pairing them into one slice keeps
 * the carve tight. The hook's typed return makes the two operations
 * cleanly distinguishable at the call site.
 *
 * Pure refactor — behavior identical.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
  sanitizeSavedWorkOrderViews,
} from './amroWorkspaceHelpers';
import type { V2SavedWorkOrderView } from './amroWorkspaceTypes';

export interface UseAmroWorkOrderViewMutationsInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;

  /** save view: persist current filter state into the saved-views list. */
  workOrderStatusFilter: string;
  workOrderSearch: string;
  setSavedWorkOrderViews: React.Dispatch<React.SetStateAction<V2SavedWorkOrderView[]>>;
  setSelectedSavedViewId: React.Dispatch<React.SetStateAction<string>>;

  /** delete: needs selectedWorkOrderId + fetchWorkOrders to refresh after. */
  selectedWorkOrderId: string;
  fetchWorkOrders: () => Promise<void>;
}

export interface UseAmroWorkOrderViewMutationsReturn {
  saveCurrentWorkOrderView: (name: string) => Promise<boolean>;
  deleteSelectedWorkOrder: () => Promise<boolean>;
}

export function useAmroWorkOrderViewMutations(
  input: UseAmroWorkOrderViewMutationsInput,
): UseAmroWorkOrderViewMutationsReturn {
  const {
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    workOrderStatusFilter,
    workOrderSearch,
    setSavedWorkOrderViews,
    setSelectedSavedViewId,
    selectedWorkOrderId,
    fetchWorkOrders,
  } = input;

  const saveCurrentWorkOrderView = useCallback(
    async (name: string) => {
      if (!authHeaders) return false;
      const cleanName = name.trim();
      if (!cleanName) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v2/amro/work-orders?interface=save-work-order-view`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              view_name: cleanName,
              filters: {
                status: workOrderStatusFilter,
                search: workOrderSearch,
              },
            }),
          },
        );
        const payload = await parseJsonSafe<{
          output?: {
            saved_view_id?: string;
            view_name?: string;
            filters?: { status?: string; search?: string };
          };
          error?: string;
        }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to save view (${response.status})`);
        }
        const savedViewId = String(payload?.output?.saved_view_id || '').trim();
        if (savedViewId) {
          setSavedWorkOrderViews((previous) => {
            const next = previous.filter((item) => item.id !== savedViewId);
            next.push({
              id: savedViewId,
              name: String(payload?.output?.view_name || cleanName),
              filters: {
                status: String(payload?.output?.filters?.status || workOrderStatusFilter),
                search: String(payload?.output?.filters?.search || workOrderSearch),
              },
            });
            return sanitizeSavedWorkOrderViews(next);
          });
          setSelectedSavedViewId(savedViewId);
        }
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(
          error instanceof Error ? error.message : 'Failed to save work package view',
        );
        return false;
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      setSavedWorkOrderViews,
      setSelectedSavedViewId,
      setWorkOrdersError,
      workOrderSearch,
      workOrderStatusFilter,
    ],
  );

  const deleteSelectedWorkOrder = useCallback(async () => {
    if (!authHeaders || !selectedWorkOrderId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/work-orders/${selectedWorkOrderId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        if (!response.ok && response.status !== 204) {
          const payload = await parseJsonSafe<{ error?: string }>(response);
          throw new Error(payload?.error || `Failed to delete work package (${response.status})`);
        }
      } catch {
        const deleteIdempotencyKey = `wp-delete-${selectedWorkOrderId}-${Date.now()}`;
        const v2Response = await fetch(
          `${apiBaseUrl}/api/v2/amro/work-orders/${selectedWorkOrderId}`,
          {
            method: 'DELETE',
            headers: {
              ...authHeaders,
              'idempotency-key': deleteIdempotencyKey,
            },
            body: JSON.stringify({
              idempotency_key: deleteIdempotencyKey,
              decision_trace_id: `wp-delete-${selectedWorkOrderId}`,
              scope_context: {
                domain_id: 'amro',
              },
            }),
          },
        );
        const v2Payload = await parseJsonSafe<{ error?: string }>(v2Response);
        if (!v2Response.ok) {
          throw new Error(
            v2Payload?.error || `Failed to delete work package (${v2Response.status})`,
          );
        }
      }
      await fetchWorkOrders();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to delete work package');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    fetchWorkOrders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedWorkOrderId,
    setWorkOrdersError,
  ]);

  return {
    saveCurrentWorkOrderView,
    deleteSelectedWorkOrder,
  };
}
