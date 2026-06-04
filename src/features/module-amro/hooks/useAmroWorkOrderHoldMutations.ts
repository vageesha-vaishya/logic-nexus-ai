/**
 * Phase 8f.4a — first mutation-callback group extraction.
 *
 * Lifts the 3 cohesive hold + soft-delete mutators out of
 * useAmroWorkspaceState:
 *   - toggleWorkOrderHold
 *   - softDeleteWorkOrder
 *   - restoreSoftDeletedWorkOrder
 *
 * All three:
 *   - Resolve a target WO from either explicit id or selectedWorkOrder
 *   - Call updateWorkOrderStatusById to flip the status
 *   - Stash / restore the pre-transition status in the audit trail
 *     hook (useAmroHoldAuditTrail already provides the remember/
 *     forget helpers + the snapshot maps)
 *   - toggleWorkOrderHold additionally appends to the hold audit
 *     log + dispatches a browser-level CustomEvent for any UI that
 *     wants to listen
 *
 * Pure refactor — behavior identical.
 */

import { useCallback } from 'react';

import { mapLifecycleToStatus } from './amroWorkspaceHelpers';
import type { WorkOrderStatus } from './amroWorkspaceTypes';
import type { AmroWorkOrder } from '../workspace/amroWorkspaceModel';
import type { HoldAuditTrailEntry } from './useAmroHoldAuditTrail';

export interface UseAmroWorkOrderHoldMutationsInput {
  /** Current work-orders list (used to resolve workOrderId → row). */
  workOrders: AmroWorkOrder[];
  /** Currently focused WO (default target when no explicit id passed). */
  selectedWorkOrder: AmroWorkOrder | null;
  /** Role string included in the audit entry. */
  activeRole: string;
  /** Orchestrator helper: PATCH work_orders.status by id; returns ok bool. */
  updateWorkOrderStatusById: (
    workOrderId: string,
    nextStatus: WorkOrderStatus | string,
  ) => Promise<boolean>;

  /** From useAmroHoldAuditTrail. */
  holdReleaseStatusByWorkOrder: Record<string, WorkOrderStatus>;
  softDeletedWorkOrderStatusById: Record<string, WorkOrderStatus>;
  rememberPreHoldStatus: (workOrderId: string, status: WorkOrderStatus) => void;
  forgetPreHoldStatus: (workOrderId: string) => void;
  rememberPreSoftDeleteStatus: (workOrderId: string, status: WorkOrderStatus) => void;
  forgetPreSoftDeleteStatus: (workOrderId: string) => void;
  appendHoldAuditEntry: (entry: HoldAuditTrailEntry) => void;
}

export interface UseAmroWorkOrderHoldMutationsReturn {
  toggleWorkOrderHold: (workOrderId?: string) => Promise<boolean>;
  softDeleteWorkOrder: (workOrderId?: string) => Promise<boolean>;
  restoreSoftDeletedWorkOrder: (workOrderId: string) => Promise<boolean>;
}

export function useAmroWorkOrderHoldMutations(
  input: UseAmroWorkOrderHoldMutationsInput,
): UseAmroWorkOrderHoldMutationsReturn {
  const {
    workOrders,
    selectedWorkOrder,
    activeRole,
    updateWorkOrderStatusById,
    holdReleaseStatusByWorkOrder,
    softDeletedWorkOrderStatusById,
    rememberPreHoldStatus,
    forgetPreHoldStatus,
    rememberPreSoftDeleteStatus,
    forgetPreSoftDeleteStatus,
    appendHoldAuditEntry,
  } = input;

  const toggleWorkOrderHold = useCallback(
    async (workOrderId?: string) => {
      const targetWorkOrder = workOrderId
        ? workOrders.find((item) => item.id === workOrderId) ?? null
        : selectedWorkOrder;
      if (!targetWorkOrder) return false;
      const workOrderStatus = mapLifecycleToStatus(targetWorkOrder.lifecycleStage) as WorkOrderStatus;
      const releaseStatus = holdReleaseStatusByWorkOrder[targetWorkOrder.id] || 'scheduled';
      const nextStatus = workOrderStatus === 'blocked' ? releaseStatus : 'blocked';
      const ok = await updateWorkOrderStatusById(targetWorkOrder.id, nextStatus);
      if (!ok) return false;
      if (workOrderStatus === 'blocked') {
        forgetPreHoldStatus(targetWorkOrder.id);
      } else {
        rememberPreHoldStatus(targetWorkOrder.id, workOrderStatus);
      }
      const occurredAt = new Date().toISOString();
      appendHoldAuditEntry({
        workOrderId: targetWorkOrder.id,
        packageNumber: targetWorkOrder.packageNumber,
        action: workOrderStatus === 'blocked' ? 'release' : 'hold',
        fromStatus: workOrderStatus,
        toStatus: nextStatus,
        actorRole: activeRole,
        occurredAt,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('amro:work-order-hold-audit', {
            detail: {
              workOrderId: targetWorkOrder.id,
              packageNumber: targetWorkOrder.packageNumber,
              action: workOrderStatus === 'blocked' ? 'release' : 'hold',
              fromStatus: workOrderStatus,
              toStatus: nextStatus,
              actorRole: activeRole,
              occurredAt,
            },
          }),
        );
      }
      return true;
    },
    [
      activeRole,
      appendHoldAuditEntry,
      forgetPreHoldStatus,
      holdReleaseStatusByWorkOrder,
      rememberPreHoldStatus,
      selectedWorkOrder,
      updateWorkOrderStatusById,
      workOrders,
    ],
  );

  const softDeleteWorkOrder = useCallback(
    async (workOrderId?: string) => {
      const targetWorkOrder = workOrderId
        ? workOrders.find((item) => item.id === workOrderId) ?? null
        : selectedWorkOrder;
      if (!targetWorkOrder) return false;
      const previousStatus = mapLifecycleToStatus(targetWorkOrder.lifecycleStage) as WorkOrderStatus;
      const ok = await updateWorkOrderStatusById(targetWorkOrder.id, 'cancelled');
      if (!ok) return false;
      rememberPreSoftDeleteStatus(targetWorkOrder.id, previousStatus);
      return true;
    },
    [rememberPreSoftDeleteStatus, selectedWorkOrder, updateWorkOrderStatusById, workOrders],
  );

  const restoreSoftDeletedWorkOrder = useCallback(
    async (workOrderId: string) => {
      const restoreStatus = softDeletedWorkOrderStatusById[workOrderId] || 'planning';
      const ok = await updateWorkOrderStatusById(workOrderId, restoreStatus);
      if (!ok) return false;
      forgetPreSoftDeleteStatus(workOrderId);
      return true;
    },
    [forgetPreSoftDeleteStatus, softDeletedWorkOrderStatusById, updateWorkOrderStatusById],
  );

  return {
    toggleWorkOrderHold,
    softDeleteWorkOrder,
    restoreSoftDeletedWorkOrder,
  };
}
