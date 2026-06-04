/**
 * Phase 8f.4e — extract advanceWorkOrderLifecycle out of
 * useAmroWorkspaceState.
 *
 * Orchestrates a single lifecycle stage advance:
 *   1. Resolve target WO (explicit id or selectedWorkOrder)
 *   2. Compute nextStage + validate the transition
 *   3. If transitioning to 'close': evaluate the closure quality
 *      gate via /api/v2/amro/compliance-gates (requires evidence
 *      coverage + completed tasks + signature readiness)
 *   4. v1 PATCH /work-orders/:id (legacy) with v2 transition-work-order
 *      fallback
 *   5. Re-fetch workOrders + tasks for this WO
 *
 * Behavior identical to the original inline implementation. Upgraded
 * to useCallback for identity stability + consistency with the
 * other extracted hooks.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
  mapLifecycleToStatus,
} from './amroWorkspaceHelpers';
import {
  getNextWorkOrderLifecycleStage,
  canTransitionWorkOrderLifecycle,
} from '../workspace/amroWorkspaceModel';
import type {
  AmroWorkOrder,
  AmroWorkOrderLifecycleStage,
  AmroEvidenceRecord,
} from '../workspace/amroWorkspaceModel';

export interface UseAmroAdvanceLifecycleInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  markApiTemporarilyUnavailable: () => void;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;

  workOrders: AmroWorkOrder[];
  selectedWorkOrder: AmroWorkOrder | null;

  /** Evidence is read to compute coverage_pct for the closure gate. */
  evidenceChain: AmroEvidenceRecord[];
  /** Drives the signaturePending count in the gate request. */
  canSignOff: boolean;

  /** Re-sync after a successful transition. */
  fetchWorkOrders: () => Promise<void>;
  fetchTasksForWorkOrder: (workOrderId: string) => Promise<void>;

  /** Local fallback path on disabled/404/timeout. */
  applyLocalLifecycleTransition: (
    workOrderId: string,
    nextStage: AmroWorkOrderLifecycleStage,
  ) => AmroWorkOrderLifecycleStage | false;
  shouldUseLocalWorkOrderFallback: (errorMessage: string) => boolean;
}

export function useAmroAdvanceLifecycle(input: UseAmroAdvanceLifecycleInput) {
  const {
    apiBaseUrl,
    authHeaders,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    workOrders,
    selectedWorkOrder,
    evidenceChain,
    canSignOff,
    fetchWorkOrders,
    fetchTasksForWorkOrder,
    applyLocalLifecycleTransition,
    shouldUseLocalWorkOrderFallback,
  } = input;

  return useCallback(
    async (workOrderId?: string) => {
      const targetWorkOrder = workOrderId
        ? workOrders.find((item) => item.id === workOrderId) ?? null
        : selectedWorkOrder;
      if (!targetWorkOrder) return false;
      const nextStage = getNextWorkOrderLifecycleStage(targetWorkOrder.lifecycleStage);
      if (!canTransitionWorkOrderLifecycle(targetWorkOrder.lifecycleStage, nextStage)) return false;
      if (!authHeaders) {
        return Boolean(applyLocalLifecycleTransition(targetWorkOrder.id, nextStage));
      }
      try {
        if (nextStage === 'close') {
          const selectedTasks = targetWorkOrder.tasks || [];
          const completedTasks = selectedTasks.filter((task) => task.completed).length;
          const evidenceForPackage = evidenceChain.filter(
            (record) =>
              (record.entityType === 'work_order' && record.entityId === targetWorkOrder.id) ||
              (record.entityType === 'task' &&
                selectedTasks.some((task) => task.id === record.entityId)),
          ).length;
          const signaturePending = canSignOff ? 0 : 1;
          const qualityGateResponse = await fetch(
            `${apiBaseUrl}/api/v2/amro/compliance-gates?interface=evaluate-closure-quality-gate`,
            {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({
                work_order_id: targetWorkOrder.id,
                open_findings: selectedTasks.length - completedTasks,
                unresolved_deferrals: 0,
                pending_signatures: signaturePending,
                evidence_coverage_pct:
                  selectedTasks.length > 0
                    ? Math.min(100, (evidenceForPackage / selectedTasks.length) * 100)
                    : 0,
              }),
            },
          );
          const qualityGatePayload = await parseJsonSafe<{
            output?: { release_ready?: boolean };
            error?: string;
          }>(qualityGateResponse);
          if (!qualityGateResponse.ok || !qualityGatePayload?.output?.release_ready) {
            throw new Error(qualityGatePayload?.error || 'Closure quality gate is not satisfied');
          }
        }
        try {
          const response = await fetch(`${apiBaseUrl}/api/v1/work-orders/${targetWorkOrder.id}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({
              status: mapLifecycleToStatus(nextStage),
            }),
          });
          if (!response.ok) {
            const payload = await parseJsonSafe<{ error?: string }>(response);
            throw new Error(payload?.error || `Failed to update work package (${response.status})`);
          }
        } catch {
          const v2Response = await fetch(
            `${apiBaseUrl}/api/v2/amro/work-orders?interface=transition-work-order`,
            {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({
                work_order_id: targetWorkOrder.id,
                current_status: mapLifecycleToStatus(targetWorkOrder.lifecycleStage),
                target_status: mapLifecycleToStatus(nextStage),
                reason_code: 'ui-transition',
                actor_signature: `ui-${Date.now()}`,
                idempotency_key: `wp-transition-${targetWorkOrder.id}-${Date.now()}`,
                decision_trace_id: `wp-transition-${targetWorkOrder.id}`,
                scope_context: {
                  domain_id: 'amro',
                },
              }),
            },
          );
          const v2Payload = await parseJsonSafe<{ error?: string }>(v2Response);
          if (!v2Response.ok) {
            throw new Error(v2Payload?.error || `Failed to update work package (${v2Response.status})`);
          }
        }
        await fetchWorkOrders();
        await fetchTasksForWorkOrder(targetWorkOrder.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to advance lifecycle';
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
        }
        if (shouldUseLocalWorkOrderFallback(message)) {
          setWorkOrdersError('Running in local fallback mode for lifecycle transition.');
          return Boolean(applyLocalLifecycleTransition(targetWorkOrder.id, nextStage));
        }
        setWorkOrdersError(message);
        return false;
      }
      return true;
    },
    [
      apiBaseUrl,
      applyLocalLifecycleTransition,
      authHeaders,
      canSignOff,
      evidenceChain,
      fetchTasksForWorkOrder,
      fetchWorkOrders,
      markApiTemporarilyUnavailable,
      selectedWorkOrder,
      setWorkOrdersError,
      shouldUseLocalWorkOrderFallback,
      workOrders,
    ],
  );
}
