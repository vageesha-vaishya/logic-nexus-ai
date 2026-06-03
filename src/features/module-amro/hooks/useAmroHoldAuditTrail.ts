/**
 * Phase 8f.2 — second slice extracted from useAmroWorkspaceState.
 *
 * Owns the 3 hold / soft-delete tracking maps + the
 * append-only hold audit trail. Pure tracking state — the
 * orchestrator's toggleWorkOrderHold / softDeleteWorkOrder /
 * restoreSoftDeletedWorkOrder callbacks call the helpers here.
 *
 * The full work-orders concern (155 setter touchpoints across 13
 * state vars) is too big for one slice. This extracts the most
 * self-contained sub-piece first; the rest of the work-orders
 * state ships in follow-up slices.
 */
import { useCallback, useState } from "react";

import type { WorkOrderStatus } from "./amroWorkspaceTypes";

export interface HoldAuditTrailEntry {
  workOrderId: string;
  packageNumber: string;
  action: "hold" | "release";
  fromStatus: WorkOrderStatus;
  toStatus: WorkOrderStatus;
  actorRole: string;
  occurredAt: string;
}

export interface UseAmroHoldAuditTrailReturn {
  /** Per-work-order: status the row should go back to when released. */
  holdReleaseStatusByWorkOrder: Record<string, WorkOrderStatus>;
  /** Per-work-order: status that existed when the row was soft-deleted. */
  softDeletedWorkOrderStatusById: Record<string, WorkOrderStatus>;
  /** Append-only audit log of hold/release transitions (newest first). */
  holdAuditTrail: HoldAuditTrailEntry[];
  /** Stash the pre-hold status so we know what to release back to. */
  rememberPreHoldStatus: (workOrderId: string, status: WorkOrderStatus) => void;
  /** Drop the stash (called when the row is released). */
  forgetPreHoldStatus: (workOrderId: string) => void;
  /** Stash the pre-soft-delete status for restore. */
  rememberPreSoftDeleteStatus: (workOrderId: string, status: WorkOrderStatus) => void;
  /** Drop the stash (called when the row is restored from soft-delete). */
  forgetPreSoftDeleteStatus: (workOrderId: string) => void;
  /** Prepend an audit-trail entry (newest first). */
  appendHoldAuditEntry: (entry: HoldAuditTrailEntry) => void;
}

export function useAmroHoldAuditTrail(): UseAmroHoldAuditTrailReturn {
  const [holdReleaseStatusByWorkOrder, setHoldReleaseStatusByWorkOrder] = useState<
    Record<string, WorkOrderStatus>
  >({});
  const [softDeletedWorkOrderStatusById, setSoftDeletedWorkOrderStatusById] = useState<
    Record<string, WorkOrderStatus>
  >({});
  const [holdAuditTrail, setHoldAuditTrail] = useState<HoldAuditTrailEntry[]>([]);

  const rememberPreHoldStatus = useCallback(
    (workOrderId: string, status: WorkOrderStatus) => {
      setHoldReleaseStatusByWorkOrder((current) => ({ ...current, [workOrderId]: status }));
    },
    [],
  );

  const forgetPreHoldStatus = useCallback((workOrderId: string) => {
    setHoldReleaseStatusByWorkOrder((current) => {
      const next = { ...current };
      delete next[workOrderId];
      return next;
    });
  }, []);

  const rememberPreSoftDeleteStatus = useCallback(
    (workOrderId: string, status: WorkOrderStatus) => {
      setSoftDeletedWorkOrderStatusById((current) => ({ ...current, [workOrderId]: status }));
    },
    [],
  );

  const forgetPreSoftDeleteStatus = useCallback((workOrderId: string) => {
    setSoftDeletedWorkOrderStatusById((current) => {
      const next = { ...current };
      delete next[workOrderId];
      return next;
    });
  }, []);

  const appendHoldAuditEntry = useCallback((entry: HoldAuditTrailEntry) => {
    setHoldAuditTrail((current) => [entry, ...current]);
  }, []);

  return {
    holdReleaseStatusByWorkOrder,
    softDeletedWorkOrderStatusById,
    holdAuditTrail,
    rememberPreHoldStatus,
    forgetPreHoldStatus,
    rememberPreSoftDeleteStatus,
    forgetPreSoftDeleteStatus,
    appendHoldAuditEntry,
  };
}
