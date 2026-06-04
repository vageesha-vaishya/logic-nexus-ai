/**
 * Phase 8f.3c — extract the fetchWorkOrders effect from
 * useAmroWorkspaceState. ~100 LOC of dual-versioned API fetch logic
 * (v1 with v2 fallback, plus client-side filter when v1 connects)
 * lifted into a focused hook.
 *
 * Pure refactor: behavior identical to the original god-hook
 * implementation. Orchestrator passes all dependencies as a typed
 * input struct and re-exposes the returned callback at every prior
 * call site (5 mutation callbacks + 2 effects + the returned
 * refreshWorkOrders).
 *
 * Net carve from useAmroWorkspaceState.ts: ~100 LOC. After this
 * slice the file drops below 2,600 LOC.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
  mapV2StatusToV1Status,
  mapLifecycleToStatus,
  sanitizeSavedWorkOrderViews,
} from './amroWorkspaceHelpers';
import type {
  ApiEnvelope,
  ApiWorkOrder,
  V2WorkOrdersResponse,
  V2SavedWorkOrderView,
} from './amroWorkspaceTypes';
import type { AmroWorkOrder } from '../workspace/amroWorkspaceModel';

export interface UseAmroWorkOrdersFetchInput {
  /** Base URL for amro-api (e.g. '' or '/api/amro'). */
  apiBaseUrl: string;
  /** Bearer headers if the session is loaded; null while loading. */
  authHeaders: Record<string, string> | null;
  /** Domain manifest exposes AMRO access; false when user shouldn't see. */
  hasAmroAccess: boolean;
  /** True briefly while the DomainContext is mid-switch. */
  isAwaitingAmroDomainActivation: boolean;
  /** Error message to display when hasAmroAccess is false and not switching. */
  amroAccessErrorMessage: string;
  /** Circuit-breaker checks from useAmroApiAvailability. */
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;

  /** Cached "v1 endpoint exists" flag. Drives v1/v2 fallback decisions. */
  hasV1WorkOrderConnectivity: boolean;
  setHasV1WorkOrderConnectivity: (v: boolean) => void;

  /** State setters from useAmroWorkOrdersState. */
  setWorkOrders: React.Dispatch<React.SetStateAction<AmroWorkOrder[]>>;
  setSelectedWorkOrderId: React.Dispatch<React.SetStateAction<string>>;
  setLoadingWorkOrders: React.Dispatch<React.SetStateAction<boolean>>;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;

  /** Filter inputs from useAmroWorkOrderFilters. */
  workOrderStatusFilter: string;
  workOrderSearch: string;
  selectedSavedViewId: string;
  setSavedWorkOrderViews: React.Dispatch<React.SetStateAction<V2SavedWorkOrderView[]>>;

  /** Orchestrator-local helper: builds AmroWorkOrder from raw fields. */
  mapWorkOrderRecord: (item: {
    id: string;
    packageNumber: string;
    status: string;
    assetId: string;
  }) => AmroWorkOrder;
}

export function useAmroWorkOrdersFetch(input: UseAmroWorkOrdersFetchInput) {
  const {
    apiBaseUrl,
    authHeaders,
    hasAmroAccess,
    isAwaitingAmroDomainActivation,
    amroAccessErrorMessage,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    hasV1WorkOrderConnectivity,
    setHasV1WorkOrderConnectivity,
    setWorkOrders,
    setSelectedWorkOrderId,
    setLoadingWorkOrders,
    setWorkOrdersError,
    workOrderStatusFilter,
    workOrderSearch,
    selectedSavedViewId,
    setSavedWorkOrderViews,
    mapWorkOrderRecord,
  } = input;

  return useCallback(async () => {
    if (!authHeaders) {
      setWorkOrders([]);
      setSelectedWorkOrderId('');
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
    setLoadingWorkOrders(true);
    setWorkOrdersError(null);
    try {
      let next: AmroWorkOrder[] = [];
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/work-orders`, { headers: authHeaders });
        const payload = await parseJsonSafe<ApiEnvelope<ApiWorkOrder[]> & { error?: string }>(response);
        if (!response.ok || !Array.isArray(payload?.data)) {
          throw new Error(payload?.error || `Failed to load work packages (${response.status})`);
        }
        setHasV1WorkOrderConnectivity(true);
        next = payload.data.map((item) =>
          mapWorkOrderRecord({
            id: item.id,
            packageNumber: item.work_order_number || item.work_order_number || item.id,
            status: item.status,
            assetId: item.aircraft_id,
          }),
        ) as AmroWorkOrder[];
      } catch (error) {
        setHasV1WorkOrderConnectivity(false);
        const query = new URLSearchParams();
        if (workOrderStatusFilter !== 'all') {
          query.set('status', workOrderStatusFilter);
        }
        if (workOrderSearch.trim()) {
          query.set('search', workOrderSearch.trim());
        }
        if (selectedSavedViewId && selectedSavedViewId !== 'default-all') {
          query.set('saved_view', selectedSavedViewId);
        }
        const endpoint = query.size
          ? `${apiBaseUrl}/api/v2/amro/work-orders?${query.toString()}`
          : `${apiBaseUrl}/api/v2/amro/work-orders`;
        const v2Response = await fetch(endpoint, { headers: authHeaders });
        const v2Payload = await parseJsonSafe<V2WorkOrdersResponse>(v2Response);
        const v2Items = v2Payload?.data?.workOrders;
        if (!v2Response.ok || !Array.isArray(v2Items)) {
          throw new Error(v2Payload?.error || `Failed to load work packages (${v2Response.status})`);
        }
        if (Array.isArray(v2Payload?.savedViews) && v2Payload.savedViews.length > 0) {
          setSavedWorkOrderViews(sanitizeSavedWorkOrderViews(v2Payload.savedViews));
        }
        next = v2Items.map((item) =>
          mapWorkOrderRecord({
            id: item.id,
            packageNumber: item.code || item.id,
            status: mapV2StatusToV1Status(item.status),
            assetId: '',
          }),
        ) as AmroWorkOrder[];
      }
      // Client-side filter when the v1 endpoint connected (v1 returns
      // unfiltered; v2 is filtered server-side).
      if (hasV1WorkOrderConnectivity) {
        const normalizedSearch = workOrderSearch.trim().toLowerCase();
        next = next.filter((item) => {
          const status = mapLifecycleToStatus(item.lifecycleStage);
          const statusMatch = workOrderStatusFilter === 'all' ? true : status === workOrderStatusFilter;
          const searchMatch = !normalizedSearch
            ? true
            : item.packageNumber.toLowerCase().includes(normalizedSearch) ||
              item.id.toLowerCase().includes(normalizedSearch);
          return statusMatch && searchMatch;
        });
      }
      setWorkOrders(next);
      setSelectedWorkOrderId((previous) => {
        if (previous && next.some((item) => item.id === previous)) {
          return previous;
        }
        return next[0]?.id || '';
      });
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to load work packages');
    } finally {
      setLoadingWorkOrders(false);
    }
  }, [
    apiBaseUrl,
    authHeaders,
    hasV1WorkOrderConnectivity,
    isApiTemporarilyUnavailable,
    mapWorkOrderRecord,
    markApiTemporarilyUnavailable,
    selectedSavedViewId,
    hasAmroAccess,
    amroAccessErrorMessage,
    workOrderSearch,
    workOrderStatusFilter,
    isAwaitingAmroDomainActivation,
    setHasV1WorkOrderConnectivity,
    setLoadingWorkOrders,
    setSavedWorkOrderViews,
    setSelectedWorkOrderId,
    setWorkOrders,
    setWorkOrdersError,
  ]);
}
