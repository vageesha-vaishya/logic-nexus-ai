/**
 * Phase 8f.4c — extract 4-callback schedule mutation group out of
 * useAmroWorkspaceState. ~180 LOC of cohesive scheduling operations
 * lifted into a focused hook.
 *
 * Returns { acknowledgeScheduleUpdate, fetchScheduleOptimizationRecommendations,
 *           runWorkOrderReplanSimulation, confirmWorkOrderReplan }.
 *
 * All four share the same input surface (api context, circuit
 * breaker, error setter) plus schedule-domain state setters.
 * Pure refactor — behavior identical.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
  mapLifecycleToStatus,
} from './amroWorkspaceHelpers';
import type {
  ApiScheduleRow,
  ApiScheduleOptimizationRecommendation,
  ApiWorkOrderReplanOption,
  V2ScheduleOptimizationResponse,
} from './amroWorkspaceTypes';
import type {
  AmroAssetRegistryRecord,
  AmroWorkOrder,
} from '../workspace/amroWorkspaceModel';

export interface UseAmroScheduleMutationsInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;

  /** Used by runWorkOrderReplanSimulation for the disruptionStart/End fallback. */
  scheduleBoardRows: ApiScheduleRow[];
  /** Used for tenantScope derivation in runWorkOrderReplanSimulation. */
  assets: AmroAssetRegistryRecord[];

  /** Current focus + selection helpers. */
  selectedWorkOrderId: string;
  selectedWorkOrder: AmroWorkOrder | null;
  activeRole: string;

  /** Replan flow state. */
  workOrderReplanOptions: ApiWorkOrderReplanOption[];
  setWorkOrderReplanOptions: React.Dispatch<React.SetStateAction<ApiWorkOrderReplanOption[]>>;
  setScheduleOptimizationRecommendations: React.Dispatch<
    React.SetStateAction<ApiScheduleOptimizationRecommendation[]>
  >;
  setLastConfirmedReplanScheduleId: React.Dispatch<React.SetStateAction<string>>;

  /** Cross-callback chaining: confirmWorkOrderReplan re-syncs board + WOs. */
  fetchScheduleBoard: () => Promise<void>;
  fetchWorkOrders: () => Promise<void>;
}

export interface UseAmroScheduleMutationsReturn {
  acknowledgeScheduleUpdate: (scheduleId: string, workOrderId: string) => Promise<boolean>;
  fetchScheduleOptimizationRecommendations: () => Promise<boolean>;
  runWorkOrderReplanSimulation: () => Promise<boolean>;
  confirmWorkOrderReplan: () => Promise<boolean>;
}

export function useAmroScheduleMutations(
  input: UseAmroScheduleMutationsInput,
): UseAmroScheduleMutationsReturn {
  const {
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    scheduleBoardRows,
    assets,
    selectedWorkOrderId,
    selectedWorkOrder,
    activeRole,
    workOrderReplanOptions,
    setWorkOrderReplanOptions,
    setScheduleOptimizationRecommendations,
    setLastConfirmedReplanScheduleId,
    fetchScheduleBoard,
    fetchWorkOrders,
  } = input;

  const acknowledgeScheduleUpdate = useCallback(
    async (scheduleId: string, workOrderId: string) => {
      if (!authHeaders) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v2/amro/schedules?interface=acknowledge-schedule-update`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              schedule_id: scheduleId,
              work_order_id: workOrderId,
              acknowledged_at: new Date().toISOString(),
              device_id: 'mobile-ui-emulator',
            }),
          },
        );
        const payload = await parseJsonSafe<{ error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to acknowledge schedule (${response.status})`);
        }
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(error instanceof Error ? error.message : 'Failed to acknowledge schedule');
        return false;
      }
    },
    [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, setWorkOrdersError],
  );

  const fetchScheduleOptimizationRecommendations = useCallback(async () => {
    if (!authHeaders) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/schedules/replan?interface=generate-schedule-optimization-recommendations`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            schedule_date: new Date().toISOString().slice(0, 10),
            station_code: 'station-a',
            demand_pressure: 0.74,
            disruption_risk: 0.58,
            recommendation_count: 3,
          }),
        },
      );
      const payload = await parseJsonSafe<V2ScheduleOptimizationResponse>(response);
      const recommendations = payload?.output?.recommendations;
      if (!response.ok || !Array.isArray(recommendations)) {
        throw new Error(
          payload?.error || `Failed to load schedule optimization recommendations (${response.status})`,
        );
      }
      setScheduleOptimizationRecommendations(recommendations);
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to load schedule optimization recommendations',
      );
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setScheduleOptimizationRecommendations,
    setWorkOrdersError,
  ]);

  const runWorkOrderReplanSimulation = useCallback(async () => {
    if (!authHeaders || !selectedWorkOrderId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const tenantScope = String(assets[0]?.tenantId || 'tenant-ops-01').trim() || 'tenant-ops-01';
      const disruptionStart = scheduleBoardRows[0]?.slot_start || new Date().toISOString();
      const disruptionEnd = scheduleBoardRows[0]?.slot_end || new Date(Date.now() + 3600000).toISOString();
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/work-orders?interface=run-replan-simulation`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            disrupted_slots: [
              {
                slot_id: scheduleBoardRows[0]?.schedule_id || `${selectedWorkOrderId}-slot`,
                work_order_id: selectedWorkOrderId,
                slot_start: disruptionStart,
                slot_end: disruptionEnd,
              },
            ],
            priority_rules: {
              preserve_critical: true,
              minimize_total_delay: true,
            },
            planning_horizon: 'P7D',
            active_constraints: [
              { id: 'station-capacity', enabled: true },
              { id: 'qualified-team', enabled: true },
            ],
            tenant_calendar_id: `${tenantScope}:maintenance-calendar`,
          }),
        },
      );
      const payload = await parseJsonSafe<{
        output?: { replan_options?: ApiWorkOrderReplanOption[] };
        error?: string;
      }>(response);
      const options = payload?.output?.replan_options;
      if (!response.ok || !Array.isArray(options)) {
        throw new Error(payload?.error || `Failed to run replan simulation (${response.status})`);
      }
      setWorkOrderReplanOptions(options);
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to run replan simulation');
      return false;
    }
  }, [
    apiBaseUrl,
    assets,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    scheduleBoardRows,
    selectedWorkOrderId,
    setWorkOrderReplanOptions,
    setWorkOrdersError,
  ]);

  const confirmWorkOrderReplan = useCallback(async () => {
    if (!authHeaders || !selectedWorkOrderId || workOrderReplanOptions.length === 0) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const selectedOption = workOrderReplanOptions[0];
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/work-orders?interface=confirm-replan`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            selected_option_id: selectedOption.option_id,
            approver_id: activeRole,
            reason: 'ui-replan-approval',
            affected_work_orders: [
              {
                work_order_id: selectedWorkOrderId,
                current_state: mapLifecycleToStatus(selectedWorkOrder?.lifecycleStage || 'create'),
              },
            ],
          }),
        },
      );
      const payload = await parseJsonSafe<{
        output?: { updated_schedule?: { schedule_id?: string } };
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to confirm replan (${response.status})`);
      }
      const confirmedScheduleId = String(payload?.output?.updated_schedule?.schedule_id || '').trim();
      setLastConfirmedReplanScheduleId(confirmedScheduleId);
      setWorkOrderReplanOptions([]);
      await fetchScheduleBoard();
      await fetchWorkOrders();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to confirm replan');
      return false;
    }
  }, [
    activeRole,
    apiBaseUrl,
    authHeaders,
    fetchScheduleBoard,
    fetchWorkOrders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedWorkOrder,
    selectedWorkOrderId,
    setLastConfirmedReplanScheduleId,
    setWorkOrderReplanOptions,
    setWorkOrdersError,
    workOrderReplanOptions,
  ]);

  return {
    acknowledgeScheduleUpdate,
    fetchScheduleOptimizationRecommendations,
    runWorkOrderReplanSimulation,
    confirmWorkOrderReplan,
  };
}
