/**
 * Phase 8f.4d — extract the 5-callback work-order CRUD group out of
 * useAmroWorkspaceState. Biggest mutation group yet.
 *
 * Returns {
 *   createWorkOrder,
 *   cloneWorkOrderFromTemplate,
 *   assignSelectedWorkOrderToNextSlot,
 *   updateWorkOrderStatusById,
 *   updateWorkOrderScheduling,
 * }
 *
 * Pure refactor — behavior identical.
 *
 * Cross-hook dependency note: updateWorkOrderStatusById is the
 * callback the existing useAmroWorkOrderHoldMutations consumes.
 * After this extraction the orchestrator passes it down from this
 * hook's return into the hold-mutations hook input.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
  isNotFoundErrorMessage,
  isMissingAircraftIdErrorMessage,
  mapLifecycleToStatus,
  mapStatusToLifecycle,
} from './amroWorkspaceHelpers';
import type {
  WorkOrderStatus,
  CreateWorkOrderOptions,
} from './amroWorkspaceTypes';
import type {
  AmroAssetRegistryRecord,
  AmroWorkOrder,
  AmroWorkOrderLifecycleStage,
} from '../workspace/amroWorkspaceModel';

export interface UseAmroWorkOrderMutationsInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;

  workOrders: AmroWorkOrder[];
  selectedWorkOrder: AmroWorkOrder | null;
  selectedWorkOrderId: string;
  setSelectedWorkOrderId: React.Dispatch<React.SetStateAction<string>>;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;

  assets: AmroAssetRegistryRecord[];
  assetsLoadedFromApi: boolean;
  activeRole: string;

  /** From the existing schedule fetch helpers — used by assignSelectedWorkOrderToNextSlot. */
  scheduleBoardRows: Array<{ slot_start: string; slot_end: string }>;
  fetchWorkOrders: () => Promise<void>;
  fetchScheduleBoard: () => Promise<void>;

  /** Local fallbacks (already inline at orchestrator); passed through. */
  shouldUseLocalWorkOrderFallback: (errorMessage: string) => boolean;
  applyLocalLifecycleTransition: (
    workOrderId: string,
    nextStage: AmroWorkOrderLifecycleStage,
  ) => AmroWorkOrderLifecycleStage | false;
  createLocalWorkOrder: (title: string) => boolean;
  appendLocalScheduleRow: (workOrderId: string) => boolean;
}

export interface UseAmroWorkOrderMutationsReturn {
  createWorkOrder: (title: string, options?: CreateWorkOrderOptions) => Promise<boolean>;
  cloneWorkOrderFromTemplate: (workOrderId?: string) => Promise<boolean>;
  assignSelectedWorkOrderToNextSlot: (workOrderId?: string) => Promise<boolean>;
  updateWorkOrderStatusById: (workOrderId: string, targetStatus: WorkOrderStatus) => Promise<boolean>;
  updateWorkOrderScheduling: (workOrderId?: string) => Promise<boolean>;
}

export function useAmroWorkOrderMutations(
  input: UseAmroWorkOrderMutationsInput,
): UseAmroWorkOrderMutationsReturn {
  const {
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    workOrders,
    selectedWorkOrder,
    selectedWorkOrderId,
    setSelectedWorkOrderId,
    setWorkOrdersError,
    assets,
    assetsLoadedFromApi,
    activeRole,
    scheduleBoardRows,
    fetchWorkOrders,
    fetchScheduleBoard,
    shouldUseLocalWorkOrderFallback,
    applyLocalLifecycleTransition,
    createLocalWorkOrder,
    appendLocalScheduleRow,
  } = input;

  // ── createWorkOrder ───────────────────────────────────────────────
  const createWorkOrder = useCallback(
    async (title: string, options?: CreateWorkOrderOptions) => {
      if (!authHeaders) return createLocalWorkOrder(title);
      const cleanTitle = title.trim();
      if (!cleanTitle) return false;
      const configuredAircraftId = String(import.meta.env.VITE_AMRO_DEFAULT_AIRCRAFT_ID || '').trim();
      const seededAircraftId = String(assets[0]?.id || '').trim();
      const defaultAircraftId = configuredAircraftId || (assetsLoadedFromApi ? seededAircraftId : '');
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const v2AircraftId = String(
          options?.aircraftId || defaultAircraftId || seededAircraftId || 'amro-fallback-aircraft',
        ).trim();
        const now = Date.now();
        const plannedStart = options?.plannedStartIso
          ? new Date(options.plannedStartIso).toISOString()
          : new Date(now).toISOString();
        const plannedEnd = options?.plannedEndIso
          ? new Date(options.plannedEndIso).toISOString()
          : new Date(now + 86400000).toISOString();
        const plannedWindow = `${plannedStart}|${plannedEnd}`;
        const defaultStation = String(
          options?.station || import.meta.env.VITE_AMRO_DEFAULT_STATION || 'station-a',
        ).trim() || 'station-a';
        const scopeItems = Array.isArray(options?.scopeItems) && options.scopeItems.length > 0
          ? options.scopeItems
          : [cleanTitle];
        const taskPlan = Array.isArray(options?.taskPlan) && options.taskPlan.length > 0
          ? options.taskPlan
          : scopeItems;
        const v2Response = await fetch(
          `${apiBaseUrl}/api/v2/amro/work-orders?interface=create-work-order`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              aircraft_id: v2AircraftId,
              maintenance_type: options?.maintenanceType || 'line',
              planned_window: plannedWindow,
              station: defaultStation,
              priority: options?.priority || 'medium',
              scope_items: scopeItems,
              task_plan: taskPlan,
              revision: options?.revision || '1',
              assigned_role: options?.assignedRole || 'planner',
              workflow_status: options?.workflowStatus || 'planning',
              task_snapshot: Array.isArray(options?.taskSnapshot) ? options.taskSnapshot : [],
              client_metadata: options?.clientMetadata || {},
              idempotency_key: `wp-create-${now}`,
              decision_trace_id: `wp-create-${now}`,
              scope_context: {
                domain_id: 'amro',
              },
            }),
          },
        );
        const v2Payload = await parseJsonSafe<{ error?: string }>(v2Response);
        if (!v2Response.ok) {
          throw new Error(v2Payload?.error || `Failed to create work package (${v2Response.status})`);
        }
        await fetchWorkOrders();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create work package';
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
        }
        if (shouldUseLocalWorkOrderFallback(message)) {
          setWorkOrdersError('Running in local fallback mode for work package creation.');
          return createLocalWorkOrder(cleanTitle);
        }
        setWorkOrdersError(message);
        return false;
      }
    },
    [
      apiBaseUrl,
      assets,
      assetsLoadedFromApi,
      authHeaders,
      fetchWorkOrders,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      createLocalWorkOrder,
      shouldUseLocalWorkOrderFallback,
      setWorkOrdersError,
    ],
  );

  // ── cloneWorkOrderFromTemplate ────────────────────────────────────
  const cloneWorkOrderFromTemplate = useCallback(
    async (workOrderId?: string) => {
      const targetWorkOrder = workOrderId
        ? workOrders.find((item) => item.id === workOrderId) ?? null
        : selectedWorkOrder;
      if (!targetWorkOrder) return false;
      const cloneTitle = `${targetWorkOrder.packageNumber} Clone`;
      if (!authHeaders) {
        return createLocalWorkOrder(cloneTitle);
      }
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const now = Date.now();
        const defaultAircraftId = String(import.meta.env.VITE_AMRO_DEFAULT_AIRCRAFT_ID || '').trim();
        const fallbackAircraftId = String(assets[0]?.id || '').trim();
        const aircraftId = String(
          targetWorkOrder.assetId || defaultAircraftId || fallbackAircraftId || 'amro-fallback-aircraft',
        ).trim();
        const normalizedTemplateToken = targetWorkOrder.packageNumber
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const templateId = `tmpl-${normalizedTemplateToken || targetWorkOrder.id}`;
        const response = await fetch(
          `${apiBaseUrl}/api/v2/amro/work-orders?interface=clone-template`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              template_id: templateId,
              aircraft_id: aircraftId,
              registry_version: 'latest',
              override_fields: {
                source_work_order_id: targetWorkOrder.id,
                source_package_number: targetWorkOrder.packageNumber,
                clone_reason: 'ui-clone-action',
                requested_at: new Date(now).toISOString(),
              },
            }),
          },
        );
        const payload = await parseJsonSafe<{ error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to clone work package (${response.status})`);
        }
        await fetchWorkOrders();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to clone work package';
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
        }
        if (shouldUseLocalWorkOrderFallback(message)) {
          setWorkOrdersError('Running in local fallback mode for work package clone.');
          return createLocalWorkOrder(cloneTitle);
        }
        setWorkOrdersError(message);
        return false;
      }
    },
    [
      apiBaseUrl,
      assets,
      authHeaders,
      createLocalWorkOrder,
      fetchWorkOrders,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      selectedWorkOrder,
      setWorkOrdersError,
      shouldUseLocalWorkOrderFallback,
      workOrders,
    ],
  );

  // ── assignSelectedWorkOrderToNextSlot ─────────────────────────────
  const assignSelectedWorkOrderToNextSlot = useCallback(
    async (workOrderId?: string) => {
      const resolvedFallbackWorkOrderId = workOrders[0]?.id || `local-wp-${Date.now()}`;
      const targetWorkOrderId = workOrderId || selectedWorkOrderId || resolvedFallbackWorkOrderId;
      setSelectedWorkOrderId(targetWorkOrderId);
      if (!authHeaders) return appendLocalScheduleRow(targetWorkOrderId);
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('Running in local fallback mode for scheduling.');
        return appendLocalScheduleRow(targetWorkOrderId);
      }
      try {
        const now = Date.now();
        const defaultSlotStartMs = now + 3600000;
        const latestScheduledEndMs = scheduleBoardRows
          .map((item) => Date.parse(item.slot_end))
          .filter((value) => Number.isFinite(value))
          .reduce((max, value) => Math.max(max, value), 0);
        const slotStartMs = latestScheduledEndMs > 0 ? latestScheduledEndMs + 300000 : defaultSlotStartMs;
        const slotEndMs = slotStartMs + 3600000;
        const slotStart = new Date(slotStartMs).toISOString();
        const slotEnd = new Date(slotEndMs).toISOString();
        const requestPayload = {
          work_order_id: targetWorkOrderId,
          station_code: 'station-a',
          slot_start: slotStart,
          slot_end: slotEnd,
          station_capacity: 2,
          existing_slots: scheduleBoardRows.map((item) => ({
            slot_start: item.slot_start,
            slot_end: item.slot_end,
          })),
          assigned_team: [{ member_id: 'tech-ui-1', qualifications: ['station-a'] }],
        };
        const schedulesResponse = await fetch(
          `${apiBaseUrl}/api/v2/amro/schedules?interface=assign-maintenance-slot`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(requestPayload),
          },
        );
        const schedulesPayload = await parseJsonSafe<{ error?: string }>(schedulesResponse);
        if (schedulesResponse.ok) {
          await fetchScheduleBoard();
          setWorkOrdersError(null);
          return true;
        }
        const schedulesError =
          schedulesPayload?.error || `Failed to assign maintenance slot (${schedulesResponse.status})`;
        if (!isNotFoundErrorMessage(schedulesError)) {
          throw new Error(schedulesError);
        }
        const workOrderResponse = await fetch(
          `${apiBaseUrl}/api/v2/amro/work-orders?interface=assign-maintenance-slot`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(requestPayload),
          },
        );
        const workOrderPayload = await parseJsonSafe<{ error?: string }>(workOrderResponse);
        if (isMissingAircraftIdErrorMessage(workOrderPayload?.error || '')) {
          setWorkOrdersError(null);
          return appendLocalScheduleRow(targetWorkOrderId);
        }
        if (!workOrderResponse.ok) {
          throw new Error(
            workOrderPayload?.error || `Failed to assign maintenance slot (${workOrderResponse.status})`,
          );
        }
        setWorkOrdersError(null);
        return appendLocalScheduleRow(targetWorkOrderId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to assign maintenance slot';
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
        }
        if (
          isNotFoundErrorMessage(message) ||
          isMissingAircraftIdErrorMessage(message) ||
          shouldUseLocalWorkOrderFallback(message)
        ) {
          setWorkOrdersError(null);
          return appendLocalScheduleRow(targetWorkOrderId);
        }
        setWorkOrdersError(
          `Scheduling API rejected request. Applied local fallback assignment. (${message})`,
        );
        return appendLocalScheduleRow(targetWorkOrderId);
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      appendLocalScheduleRow,
      fetchScheduleBoard,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      scheduleBoardRows,
      selectedWorkOrderId,
      setSelectedWorkOrderId,
      setWorkOrdersError,
      shouldUseLocalWorkOrderFallback,
      workOrders,
    ],
  );

  // ── updateWorkOrderStatusById ─────────────────────────────────────
  const updateWorkOrderStatusById = useCallback(
    async (workOrderId: string, targetStatus: WorkOrderStatus) => {
      const targetWorkOrder = workOrders.find((item) => item.id === workOrderId) ?? null;
      if (!targetWorkOrder) return false;
      if (!authHeaders) {
        return Boolean(applyLocalLifecycleTransition(workOrderId, mapStatusToLifecycle(targetStatus)));
      }
      const currentStatus = mapLifecycleToStatus(targetWorkOrder.lifecycleStage) as WorkOrderStatus;
      if (currentStatus === targetStatus) {
        setWorkOrdersError(null);
        return true;
      }
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const idempotencyKey = `wp-status-${workOrderId}-${targetStatus}-${Date.now()}`;
        const patchResponse = await fetch(
          `${apiBaseUrl}/api/v2/amro/work-orders/${workOrderId}`,
          {
            method: 'PATCH',
            headers: {
              ...authHeaders,
              'idempotency-key': idempotencyKey,
            },
            body: JSON.stringify({
              current_status: currentStatus,
              status: targetStatus,
              idempotency_key: idempotencyKey,
              decision_trace_id: `wp-status-${workOrderId}-${targetStatus}`,
              scope_context: {
                domain_id: 'amro',
                role: activeRole,
              },
            }),
          },
        );
        const patchPayload = await parseJsonSafe<{ error?: string }>(patchResponse);
        if (!patchResponse.ok) {
          throw new Error(patchPayload?.error || `Failed to update status (${patchResponse.status})`);
        }
        await fetchWorkOrders();
        setWorkOrdersError(null);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update work package status';
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          return Boolean(applyLocalLifecycleTransition(workOrderId, mapStatusToLifecycle(targetStatus)));
        }
        if (shouldUseLocalWorkOrderFallback(message)) {
          setWorkOrdersError('Running in local fallback mode for work package status update.');
          return Boolean(applyLocalLifecycleTransition(workOrderId, mapStatusToLifecycle(targetStatus)));
        }
        setWorkOrdersError(message);
        return false;
      }
    },
    [
      activeRole,
      apiBaseUrl,
      applyLocalLifecycleTransition,
      authHeaders,
      fetchWorkOrders,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      setWorkOrdersError,
      shouldUseLocalWorkOrderFallback,
      workOrders,
    ],
  );

  // ── updateWorkOrderScheduling (composes two above) ────────────────
  const updateWorkOrderScheduling = useCallback(
    async (workOrderId?: string) => {
      const targetId = workOrderId || selectedWorkOrderId || workOrders[0]?.id || '';
      if (!targetId) return false;
      const scheduled = await assignSelectedWorkOrderToNextSlot(targetId);
      if (!scheduled) return false;
      const statusUpdated = await updateWorkOrderStatusById(targetId, 'scheduled');
      if (!statusUpdated) return false;
      await fetchScheduleBoard();
      return true;
    },
    [
      assignSelectedWorkOrderToNextSlot,
      fetchScheduleBoard,
      selectedWorkOrderId,
      updateWorkOrderStatusById,
      workOrders,
    ],
  );

  return {
    createWorkOrder,
    cloneWorkOrderFromTemplate,
    assignSelectedWorkOrderToNextSlot,
    updateWorkOrderStatusById,
    updateWorkOrderScheduling,
  };
}
