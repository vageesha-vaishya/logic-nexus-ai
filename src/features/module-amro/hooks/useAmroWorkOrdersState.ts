/**
 * Phase 8f.3b — work-orders core state lifted from useAmroWorkspaceState.
 *
 * Owns the 6 foundational state variables that the work-order fetch
 * effect and every mutation callback in the orchestrator builds on.
 * This slice is a pure state lift — no callbacks moved. Each fetch /
 * mutation in the orchestrator continues to call the setters returned
 * here (same setter names, just sourced from this hook).
 *
 * Splitting the callbacks + the fetch effect out is the next sub-slice.
 * Doing them together would have shipped ~600 LOC of carved code; doing
 * just the state lift keeps the slice reviewable.
 */
import { useState } from "react";

import type { AmroWorkOrder } from "../workspace/amroWorkspaceModel";

export interface UseAmroWorkOrdersStateReturn {
  /** All AMRO work orders in the active workspace. */
  workOrders: AmroWorkOrder[];
  setWorkOrders: React.Dispatch<React.SetStateAction<AmroWorkOrder[]>>;

  /** ID of the work order the workspace is focused on; '' when none. */
  selectedWorkOrderId: string;
  setSelectedWorkOrderId: React.Dispatch<React.SetStateAction<string>>;

  /** True while a fetchWorkOrders() call is in flight. */
  loadingWorkOrders: boolean;
  setLoadingWorkOrders: React.Dispatch<React.SetStateAction<boolean>>;

  /** Last error from a fetchWorkOrders / mutation call; null when clean. */
  workOrdersError: string | null;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;

  /**
   * True once we've successfully reached the v1 work-orders endpoint at
   * least once; used to decide whether to fall back to v2 / cached data.
   */
  hasV1WorkOrderConnectivity: boolean;
  setHasV1WorkOrderConnectivity: React.Dispatch<React.SetStateAction<boolean>>;

  /**
   * Realtime channel state — true while the Supabase realtime channel
   * is connected and pushing work-order updates. The api-availability
   * hook's onUnavailable callback drops this to false.
   */
  realtimeConnected: boolean;
  setRealtimeConnected: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAmroWorkOrdersState(): UseAmroWorkOrdersStateReturn {
  const [workOrders, setWorkOrders] = useState<AmroWorkOrder[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>("");
  const [loadingWorkOrders, setLoadingWorkOrders] = useState<boolean>(false);
  const [workOrdersError, setWorkOrdersError] = useState<string | null>(null);
  const [hasV1WorkOrderConnectivity, setHasV1WorkOrderConnectivity] = useState<boolean>(false);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);

  return {
    workOrders,
    setWorkOrders,
    selectedWorkOrderId,
    setSelectedWorkOrderId,
    loadingWorkOrders,
    setLoadingWorkOrders,
    workOrdersError,
    setWorkOrdersError,
    hasV1WorkOrderConnectivity,
    setHasV1WorkOrderConnectivity,
    realtimeConnected,
    setRealtimeConnected,
  };
}
