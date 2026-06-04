/**
 * Phase 8f.4f — extract the 6-callback materials/inventory/supplier
 * mutation group out of useAmroWorkspaceState. ~250 LOC.
 *
 * Returns {
 *   reservePartsAllocationForSelectedWorkOrder,
 *   processCriticalShortageResponse,
 *   applyRotableLlpTraceability,
 *   runInventoryOptimizationModel,
 *   syncSupplierEtaForSelectedWorkOrder,
 *   syncSupplierAsnAndErpProcurement,
 * }
 *
 * All 6 share api context (apiBaseUrl + authHeaders + circuit
 * breaker + setWorkOrdersError) plus materials + selectedWorkOrderId.
 *
 * Pure refactor — behavior identical.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
} from './amroWorkspaceHelpers';
import type {
  AmroMaterialPlanningRecord,
  AmroPredictiveRecommendation,
} from '../workspace/amroWorkspaceModel';

export interface UseAmroMaterialsMutationsInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;

  materials: AmroMaterialPlanningRecord[];
  setMaterials: React.Dispatch<React.SetStateAction<AmroMaterialPlanningRecord[]>>;
  predictiveRecommendations: AmroPredictiveRecommendation[];
  selectedWorkOrderId: string;

  setLastInventoryOptimizationRunId: React.Dispatch<React.SetStateAction<string>>;
  setLastProcurementSyncId: React.Dispatch<React.SetStateAction<string>>;

  /** reservePartsAllocation + processCriticalShortageResponse +
   *  syncSupplierEta all chain into module-surfaces refetch. */
  fetchModuleSurfaces: () => Promise<void>;
}

export interface UseAmroMaterialsMutationsReturn {
  reservePartsAllocationForSelectedWorkOrder: () => Promise<boolean>;
  processCriticalShortageResponse: () => Promise<boolean>;
  applyRotableLlpTraceability: (materialId: string) => Promise<boolean>;
  runInventoryOptimizationModel: () => Promise<boolean>;
  syncSupplierEtaForSelectedWorkOrder: () => Promise<boolean>;
  syncSupplierAsnAndErpProcurement: () => Promise<boolean>;
}

export function useAmroMaterialsMutations(
  input: UseAmroMaterialsMutationsInput,
): UseAmroMaterialsMutationsReturn {
  const {
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    materials,
    setMaterials,
    predictiveRecommendations,
    selectedWorkOrderId,
    setLastInventoryOptimizationRunId,
    setLastProcurementSyncId,
    fetchModuleSurfaces,
  } = input;

  const reservePartsAllocationForSelectedWorkOrder = useCallback(async () => {
    if (!authHeaders || !selectedWorkOrderId || materials.length === 0) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const demandLines = materials.slice(0, 2).map((material, index) => ({
        part_number: material.partNumber,
        quantity: index === 0 ? 1 : 2,
        serial: index === 0 ? `${material.id}-serial` : undefined,
      }));
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-orders?interface=reserve-parts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          work_order_id: selectedWorkOrderId,
          demand_lines: demandLines,
        }),
      });
      const payload = await parseJsonSafe<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to reserve parts (${response.status})`);
      }
      await fetchModuleSurfaces();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to reserve parts');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    fetchModuleSurfaces,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    materials,
    selectedWorkOrderId,
    setWorkOrdersError,
  ]);

  const processCriticalShortageResponse = useCallback(async () => {
    if (!authHeaders) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const shortageMaterial =
        materials.find((item) => item.reservationStatus === 'shortage') || materials[0];
      if (!shortageMaterial) return false;
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/work-orders?interface=process-shortage-response`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            shortage_id: shortageMaterial.id,
            action: 'escalate',
            supplier_ref: shortageMaterial.partNumber,
          }),
        },
      );
      const payload = await parseJsonSafe<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to process shortage response (${response.status})`);
      }
      await fetchModuleSurfaces();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to process shortage response',
      );
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    fetchModuleSurfaces,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    materials,
    setWorkOrdersError,
  ]);

  const applyRotableLlpTraceability = useCallback(
    async (materialId: string) => {
      if (!authHeaders) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const targetMaterial = materials.find((item) => item.id === materialId);
        if (!targetMaterial) return false;
        const response = await fetch(
          `${apiBaseUrl}/api/v2/amro/work-orders?interface=trace-rotable-llp`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              component_id: targetMaterial.id,
              part_number: targetMaterial.partNumber,
              serial_number: `${targetMaterial.id}-serial`,
              rotable_status: targetMaterial.rotableStatus,
              llp_remaining_cycles: targetMaterial.llpRemainingCycles,
              traceability_action:
                targetMaterial.rotableStatus === 'quarantined' ? 'release' : 'verify',
            }),
          },
        );
        const payload = await parseJsonSafe<{
          output?: { traceability_status?: 'verified' | 'quarantined' | 'released' };
          error?: string;
        }>(response);
        if (!response.ok) {
          throw new Error(
            payload?.error || `Failed to apply traceability controls (${response.status})`,
          );
        }
        const nextStatus = payload?.output?.traceability_status || 'verified';
        setMaterials((previous) =>
          previous.map((material) =>
            material.id === materialId
              ? {
                  ...material,
                  traceabilityStatus: nextStatus,
                  rotableStatus: nextStatus === 'quarantined' ? 'quarantined' : 'serviceable',
                }
              : material,
          ),
        );
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(
          error instanceof Error ? error.message : 'Failed to apply rotable/LLP traceability',
        );
        return false;
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      materials,
      setMaterials,
      setWorkOrdersError,
    ],
  );

  const runInventoryOptimizationModel = useCallback(async () => {
    if (!authHeaders || !selectedWorkOrderId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/work-orders?interface=run-inventory-optimization`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            work_order_id: selectedWorkOrderId,
            forecast_signal_ids: predictiveRecommendations.slice(0, 3).map((item) => item.id),
            optimization_window: 'P14D',
          }),
        },
      );
      const payload = await parseJsonSafe<{
        output?: { optimization_run_id?: string };
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(
          payload?.error || `Failed to run inventory optimization (${response.status})`,
        );
      }
      setLastInventoryOptimizationRunId(String(payload?.output?.optimization_run_id || ''));
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to run inventory optimization',
      );
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    predictiveRecommendations,
    selectedWorkOrderId,
    setLastInventoryOptimizationRunId,
    setWorkOrdersError,
  ]);

  const syncSupplierEtaForSelectedWorkOrder = useCallback(async () => {
    if (!authHeaders || !selectedWorkOrderId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const targetMaterial =
        materials.find((item) => item.reservationStatus === 'shortage') || materials[0];
      if (!targetMaterial) return false;
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/work-orders?interface=sync-supplier-eta`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            supplier_event_id: `supplier-eta-${Date.now()}`,
            part_number: targetMaterial.partNumber,
            eta: new Date(Date.now() + 86400000).toISOString(),
            quantity_confirmed: targetMaterial.reservationStatus === 'shortage' ? 0 : 1,
            supplier_source: 'vendor_portal',
            impacted_work_orders: [selectedWorkOrderId],
          }),
        },
      );
      const payload = await parseJsonSafe<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to sync supplier ETA (${response.status})`);
      }
      await fetchModuleSurfaces();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to sync supplier ETA');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    fetchModuleSurfaces,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    materials,
    selectedWorkOrderId,
    setWorkOrdersError,
  ]);

  const syncSupplierAsnAndErpProcurement = useCallback(async () => {
    if (!authHeaders) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/work-orders?interface=sync-supplier-asn-erp`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            asn_event_id: `asn-${Date.now()}`,
            procurement_source: 'sap-pm',
            po_number: `PO-${Date.now()}`,
            line_items: materials.slice(0, 2).map((material) => ({
              part_number: material.partNumber,
              qty: material.reservationStatus === 'shortage' ? 2 : 1,
            })),
            impacted_work_orders: selectedWorkOrderId ? [selectedWorkOrderId] : [],
          }),
        },
      );
      const payload = await parseJsonSafe<{
        output?: { procurement_sync_id?: string };
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(
          payload?.error || `Failed to sync supplier ASN and ERP procurement (${response.status})`,
        );
      }
      setLastProcurementSyncId(String(payload?.output?.procurement_sync_id || ''));
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error
          ? error.message
          : 'Failed to sync supplier ASN and ERP procurement',
      );
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    materials,
    selectedWorkOrderId,
    setLastProcurementSyncId,
    setWorkOrdersError,
  ]);

  return {
    reservePartsAllocationForSelectedWorkOrder,
    processCriticalShortageResponse,
    applyRotableLlpTraceability,
    runInventoryOptimizationModel,
    syncSupplierEtaForSelectedWorkOrder,
    syncSupplierAsnAndErpProcurement,
  };
}
