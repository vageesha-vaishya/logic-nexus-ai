/**
 * Phase 8f.3d — extract the fetchModuleSurfaces compound fetch out of
 * useAmroWorkspaceState. 6 parallel API calls (assets, qualifications,
 * compliance summary, evidence chain, materials per selected WO,
 * predictive recommendations) lifted into a focused hook.
 *
 * Pure refactor — behavior identical. Pattern matches 8f.3c.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
} from './amroWorkspaceHelpers';
import type {
  ApiEnvelope,
  ApiAsset,
  ApiQualification,
  ApiComplianceSummary,
  ApiEvidence,
  ApiMaterial,
  ApiRecommendation,
} from './amroWorkspaceTypes';
import type {
  AmroAssetRegistryRecord,
  AmroAuthorityLevel,
  AmroQualification,
  AmroComplianceRulePack,
  AmroEvidenceRecord,
  AmroMaterialPlanningRecord,
  AmroPredictiveRecommendation,
} from '../workspace/amroWorkspaceModel';

export interface UseAmroModuleSurfacesFetchInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  hasAmroAccess: boolean;
  isAwaitingAmroDomainActivation: boolean;
  amroAccessErrorMessage: string;
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;

  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;
  selectedWorkOrderId: string;

  setAssets: React.Dispatch<React.SetStateAction<AmroAssetRegistryRecord[]>>;
  setAssetsLoadedFromApi: React.Dispatch<React.SetStateAction<boolean>>;
  setQualifications: React.Dispatch<React.SetStateAction<AmroQualification[]>>;
  setSelectedQualificationId: React.Dispatch<React.SetStateAction<string>>;
  setRulePacks: React.Dispatch<React.SetStateAction<AmroComplianceRulePack[]>>;
  setEvidenceChain: React.Dispatch<React.SetStateAction<AmroEvidenceRecord[]>>;
  setMaterials: React.Dispatch<React.SetStateAction<AmroMaterialPlanningRecord[]>>;
  setPredictiveRecommendations: React.Dispatch<React.SetStateAction<AmroPredictiveRecommendation[]>>;
}

export function useAmroModuleSurfacesFetch(input: UseAmroModuleSurfacesFetchInput) {
  const {
    apiBaseUrl,
    authHeaders,
    hasAmroAccess,
    isAwaitingAmroDomainActivation,
    amroAccessErrorMessage,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    selectedWorkOrderId,
    setAssets,
    setAssetsLoadedFromApi,
    setQualifications,
    setSelectedQualificationId,
    setRulePacks,
    setEvidenceChain,
    setMaterials,
    setPredictiveRecommendations,
  } = input;

  return useCallback(async () => {
    if (!authHeaders) {
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
      const [
        assetsResponse,
        qualificationsResponse,
        complianceResponse,
        evidenceResponse,
        materialsResponse,
        recommendationsResponse,
      ] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/assets`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/api/v1/qualifications`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/api/v1/compliance/summary`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/api/v1/evidence`, { headers: authHeaders }),
        selectedWorkOrderId
          ? fetch(`${apiBaseUrl}/api/v1/work-orders/${selectedWorkOrderId}/materials`, { headers: authHeaders })
          : Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 })),
        fetch(`${apiBaseUrl}/api/v1/forecast/recommendations`, { headers: authHeaders }),
      ]);

      if (assetsResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiAsset[]>>(assetsResponse);
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          setAssets(
            payload.data.map((item) => ({
              id: item.id,
              assetTag: item.registration,
              assetType: item.aircraft_type.toLowerCase().includes('engine') ? 'engine' : 'aircraft',
              serialNumber: item.serial_number,
              configurationState: `Operational status: ${item.status}`,
              tenantId: item.tenant_id,
              franchiseId: item.franchise_id || 'unassigned',
            })),
          );
          setAssetsLoadedFromApi(true);
        } else {
          setAssetsLoadedFromApi(false);
        }
      } else {
        setAssetsLoadedFromApi(false);
      }

      if (qualificationsResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiQualification[]>>(qualificationsResponse);
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          const mapped = payload.data.map((item) => ({
            id: item.id,
            staffName: item.qualification_name,
            authorityLevel: (String(item.rating || '').toLowerCase() === 'compliance'
              ? 'compliance'
              : String(item.rating || '').toLowerCase() === 'engineering'
                ? 'engineering'
                : String(item.rating || '').toLowerCase() === 'qa'
                  ? 'qa'
                  : String(item.rating || '').toLowerCase() === 'supervisor'
                    ? 'supervisor'
                    : 'technician') as AmroAuthorityLevel,
            roleConstraint: item.qualification_name,
            signOffAuthority: item.can_certify_release,
            validUntil: item.expiration_date || new Date(Date.now() + 86400000 * 365).toISOString(),
          }));
          setQualifications(mapped);
          setSelectedQualificationId((previous) => previous || mapped[0]?.id || '');
        }
      }

      if (complianceResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiComplianceSummary>>(complianceResponse);
        const authorities = payload?.data?.authorityCoverage ?? [];
        const activeCount = payload?.data?.activeRulePacks ?? authorities.length;
        const mappedAuthorities = authorities.length > 0 ? authorities : ['FAA', 'EASA'];
        const mappedRulePacks = mappedAuthorities.map((authority, index) => ({
          id: `rule-pack-${index + 1}`,
          authority: (authority as AmroComplianceRulePack['authority']) || 'FAA',
          ruleVersion: '2026.1',
          active: index < activeCount,
        }));
        if (mappedRulePacks.length > 0) {
          setRulePacks(mappedRulePacks);
        }
      }

      if (evidenceResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiEvidence[]>>(evidenceResponse);
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          setEvidenceChain(
            payload.data.map((item) => ({
              id: item.id,
              entityType: item.entity_type,
              entityId: item.entity_id,
              hash: item.hash,
              immutable: item.immutable,
              createdAt: item.created_at,
            })),
          );
        }
      }

      if (materialsResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiMaterial[]>>(materialsResponse);
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          setMaterials(
            payload.data.map((item) => ({
              id: item.id,
              partNumber: item.part_number,
              reservationStatus:
                item.status === 'pending' || item.status === 'ordered'
                  ? 'pending'
                  : item.status === 'received' || item.status === 'installed'
                    ? 'reserved'
                    : 'shortage',
              repairAction: item.action === 'inspect' ? 'repair' : item.action,
              supplierEta: item.received_date || new Date(Date.now() + 86400000 * 3).toISOString(),
              shortageSeverity:
                item.status === 'cancelled' || item.status === 'returned'
                  ? 'critical'
                  : item.status === 'pending' || item.status === 'ordered'
                    ? 'watch'
                    : 'none',
              etaStatus:
                item.status === 'cancelled' || item.status === 'returned'
                  ? 'late'
                  : item.status === 'pending' || item.status === 'ordered'
                    ? 'at_risk'
                    : 'on_time',
              rotableStatus:
                item.status === 'cancelled' || item.status === 'returned'
                  ? 'quarantined'
                  : 'serviceable',
              llpRemainingCycles: item.status === 'installed' ? 1200 : item.status === 'received' ? 800 : 460,
              traceabilityStatus:
                item.status === 'cancelled' || item.status === 'returned'
                  ? 'quarantined'
                  : 'verified',
            })),
          );
        }
      }

      if (recommendationsResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiRecommendation[]>>(recommendationsResponse);
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          setPredictiveRecommendations(
            payload.data.map((item) => ({
              id: item.id,
              digitalTwinReference: item.digital_twin_reference,
              riskScore: item.risk_score,
              trigger: item.trigger,
              recommendation: item.recommendation,
            })),
          );
        }
      }
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to load AMRO module data');
    }
  }, [
    apiBaseUrl,
    amroAccessErrorMessage,
    authHeaders,
    hasAmroAccess,
    isApiTemporarilyUnavailable,
    isAwaitingAmroDomainActivation,
    markApiTemporarilyUnavailable,
    selectedWorkOrderId,
    setAssets,
    setAssetsLoadedFromApi,
    setEvidenceChain,
    setMaterials,
    setPredictiveRecommendations,
    setQualifications,
    setRulePacks,
    setSelectedQualificationId,
    setWorkOrdersError,
  ]);
}
