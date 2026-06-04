/**
 * Phase 8f.4g — extract the 12-callback compliance + certification
 * mutation group out of useAmroWorkspaceState. Largest single hook
 * by callback count.
 *
 * Returns {
 *   loadComplianceGateExplainability,
 *   loadAuditReplayTimeline,
 *   detectComplianceAnomalies,
 *   loadRegulatorProfilePack,
 *   ingestAdSbObligations,
 *   evaluateMelCdlDeferral,
 *   validateCertifyingPrivilege,
 *   submitCertificationDecision,
 *   runExpiryWarningAndSuspension,
 *   loadCompetencyAnalyticsDashboard,
 *   loadAuthorityCertificationTemplate,
 * }
 *
 * Internal helpers callComplianceInterface + callCertificationInterface
 * are kept as closures (not exported) — downstream consumers don't
 * call them directly.
 *
 * Pure refactor — behavior identical.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
} from './amroWorkspaceHelpers';
import type {
  ComplianceRegulatorProfile,
  ComplianceExplainabilityState,
  ComplianceAuditReplayState,
  ComplianceAnomalyAlert,
  ComplianceRegulatorProfilePackState,
  CertificationAuthorityProfile,
  CertificationDecisionOption,
  CertificationDecisionState,
  CertificationExpiryAutomationState,
  CertificationCompetencyAnalyticsState,
  CertificationTemplateState,
} from './amroWorkspaceTypes';
import type {
  AmroComplianceRulePack,
  AmroQualification,
  AmroWorkOrder,
} from '../workspace/amroWorkspaceModel';

export interface UseAmroComplianceMutationsInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;

  selectedWorkOrderId: string;
  selectedWorkOrder: AmroWorkOrder | null;
  selectedQualification: AmroQualification | null;
  selectedRegulatorProfile: ComplianceRegulatorProfile;
  selectedCertificationAuthorityProfile: CertificationAuthorityProfile;
  qualifications: AmroQualification[];

  /** Derived memos from the orchestrator: complianceCoverage.activePacks,
   *  materialsSummary.shortageCount. Passed as raw numbers to keep the
   *  hook decoupled from the memo derivations. */
  compliancePackCount: number;
  shortageCount: number;

  /** State setters. */
  setComplianceExplainability: React.Dispatch<
    React.SetStateAction<ComplianceExplainabilityState | null>
  >;
  setComplianceGateModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setComplianceAuditReplay: React.Dispatch<
    React.SetStateAction<ComplianceAuditReplayState | null>
  >;
  setComplianceAnomalyAlerts: React.Dispatch<React.SetStateAction<ComplianceAnomalyAlert[]>>;
  setRegulatorProfilePack: React.Dispatch<
    React.SetStateAction<ComplianceRegulatorProfilePackState | null>
  >;
  setRulePacks: React.Dispatch<React.SetStateAction<AmroComplianceRulePack[]>>;
  setObligationIngestionSummary: React.Dispatch<
    React.SetStateAction<{ total: number; adCount: number; sbCount: number } | null>
  >;
  setDeferralDecision: React.Dispatch<
    React.SetStateAction<{ decision: string; actions: string[] } | null>
  >;
  setCertifyingPrivilegeValidated: React.Dispatch<React.SetStateAction<boolean>>;
  setLatestCertificationDecision: React.Dispatch<
    React.SetStateAction<CertificationDecisionState | null>
  >;
  setExpiryAutomationSummary: React.Dispatch<
    React.SetStateAction<CertificationExpiryAutomationState | null>
  >;
  setCompetencyAnalytics: React.Dispatch<
    React.SetStateAction<CertificationCompetencyAnalyticsState | null>
  >;
  setAuthorityCertificationTemplate: React.Dispatch<
    React.SetStateAction<CertificationTemplateState | null>
  >;
}

export interface UseAmroComplianceMutationsReturn {
  loadComplianceGateExplainability: () => Promise<boolean>;
  loadAuditReplayTimeline: () => Promise<boolean>;
  detectComplianceAnomalies: () => Promise<boolean>;
  loadRegulatorProfilePack: () => Promise<boolean>;
  ingestAdSbObligations: () => Promise<boolean>;
  evaluateMelCdlDeferral: () => Promise<boolean>;
  validateCertifyingPrivilege: () => Promise<boolean>;
  submitCertificationDecision: (decision: CertificationDecisionOption) => Promise<boolean>;
  runExpiryWarningAndSuspension: () => Promise<boolean>;
  loadCompetencyAnalyticsDashboard: () => Promise<boolean>;
  loadAuthorityCertificationTemplate: () => Promise<boolean>;
}

export function useAmroComplianceMutations(
  input: UseAmroComplianceMutationsInput,
): UseAmroComplianceMutationsReturn {
  const {
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    selectedWorkOrderId,
    selectedWorkOrder,
    selectedQualification,
    selectedRegulatorProfile,
    selectedCertificationAuthorityProfile,
    qualifications,
    compliancePackCount,
    shortageCount,
    setComplianceExplainability,
    setComplianceGateModalOpen,
    setComplianceAuditReplay,
    setComplianceAnomalyAlerts,
    setRegulatorProfilePack,
    setRulePacks,
    setObligationIngestionSummary,
    setDeferralDecision,
    setCertifyingPrivilegeValidated,
    setLatestCertificationDecision,
    setExpiryAutomationSummary,
    setCompetencyAnalytics,
    setAuthorityCertificationTemplate,
  } = input;

  // ── Internal interface helpers ────────────────────────────────────
  const callComplianceInterface = useCallback(
    async (interfaceName: string, body: Record<string, unknown>) => {
      if (!authHeaders) {
        throw new Error('Authorization required');
      }
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/compliance-gates?interface=${interfaceName}`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(body),
        },
      );
      const payload = await parseJsonSafe<{ output?: Record<string, unknown>; error?: string }>(
        response,
      );
      if (!response.ok) {
        throw new Error(payload?.error || `Compliance request failed (${response.status})`);
      }
      return payload;
    },
    [apiBaseUrl, authHeaders],
  );

  const callCertificationInterface = useCallback(
    async (interfaceName: string, body: Record<string, unknown>) => {
      if (!authHeaders) {
        throw new Error('Authorization required');
      }
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/certification?interface=${interfaceName}`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(body),
        },
      );
      const payload = await parseJsonSafe<{ output?: Record<string, unknown>; error?: string }>(
        response,
      );
      if (!response.ok) {
        throw new Error(payload?.error || `Certification request failed (${response.status})`);
      }
      return payload;
    },
    [apiBaseUrl, authHeaders],
  );

  // ── Compliance gate explainability ────────────────────────────────
  const loadComplianceGateExplainability = useCallback(async () => {
    if (!selectedWorkOrderId || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('load-compliance-gate-explainability', {
        context: { type: 'work_order', id: selectedWorkOrderId },
        policy_version_snapshot: 'policy-v2026.03.22',
        required_obligations: [
          { obligation_id: `${selectedWorkOrderId}-ad-1`, fulfilled: true },
          { obligation_id: `${selectedWorkOrderId}-sb-1`, fulfilled: true },
        ],
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const explainabilityPanel = (output.explainability_panel || {}) as Record<string, unknown>;
      const blockers = Array.isArray(explainabilityPanel.blockers)
        ? explainabilityPanel.blockers.map((item) => String(item))
        : [];
      setComplianceExplainability({
        decision: String(output.decision || 'fail').toLowerCase() === 'pass' ? 'pass' : 'fail',
        blockerCount: Number(
          (output.gate_modal as Record<string, unknown> | undefined)?.blocker_count ||
            blockers.length ||
            0,
        ),
        blockers,
        policyVersion: String(explainabilityPanel.policy_version_snapshot || 'policy-v2026.03.22'),
      });
      setComplianceGateModalOpen(true);
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to load compliance gate explainability',
      );
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedWorkOrderId,
    setComplianceExplainability,
    setComplianceGateModalOpen,
    setWorkOrdersError,
  ]);

  // ── Audit replay timeline ─────────────────────────────────────────
  const loadAuditReplayTimeline = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('load-audit-replay-timeline', {
        export_filters: {
          capability: 'compliance-gates',
          action: 'evaluate-compliance-gate',
          format: 'csv',
          limit: 50,
        },
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const replayTimeline = (output.replay_timeline || {}) as Record<string, unknown>;
      const exportFilters = (output.export_filters || {}) as Record<string, unknown>;
      const events = Array.isArray(replayTimeline.events) ? replayTimeline.events : [];
      setComplianceAuditReplay({
        capability: String(exportFilters.capability || 'compliance-gates') as
          | 'work-orders'
          | 'tasks'
          | 'compliance-gates',
        format: String(exportFilters.format || 'csv') as 'csv' | 'json',
        eventCount: Number(replayTimeline.event_count || events.length || 0),
        events: events.map((entry) => {
          const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
          return {
            sequence: Number(item.sequence || 0),
            recordId: String(item.record_id || ''),
            action: String(item.action || ''),
            createdAt: String(item.created_at || ''),
          };
        }),
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to load audit replay timeline',
      );
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setComplianceAuditReplay,
    setWorkOrdersError,
  ]);

  // ── Anomaly detection ────────────────────────────────────────────
  const detectComplianceAnomalies = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('detect-compliance-anomalies', {
        detection_window: 'P30D',
        review_population: Math.max(10, compliancePackCount * 15),
        overdue_obligations: Math.max(2, shortageCount * 3),
        exception_escalations: Math.max(1, compliancePackCount - 1),
        mel_cdl_deferral_count: Math.max(1, compliancePackCount),
        anomaly_threshold: 0.2,
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const alertsRaw = Array.isArray(output.alerts) ? output.alerts : [];
      const alerts = alertsRaw.map((entry) => {
        const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
        return {
          severity: String(item.severity || 'low'),
          code: String(item.code || 'unclassified-anomaly'),
          metric: Number(item.metric || 0),
        };
      });
      setComplianceAnomalyAlerts(alerts);
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to detect compliance anomalies',
      );
      return false;
    }
  }, [
    callComplianceInterface,
    compliancePackCount,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setComplianceAnomalyAlerts,
    setWorkOrdersError,
    shortageCount,
  ]);

  // ── Regulator profile pack ────────────────────────────────────────
  const loadRegulatorProfilePack = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('load-regulator-profile-pack', {
        regulator_profile: selectedRegulatorProfile,
        effective_at: new Date().toISOString(),
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const profilePack = (output.profile_pack || {}) as Record<string, unknown>;
      const obligations = Array.isArray(profilePack.obligations)
        ? profilePack.obligations.map((item) => String(item))
        : [];
      const gateRules = Array.isArray(profilePack.gateRules)
        ? profilePack.gateRules.map((item) => String(item))
        : [];
      setRegulatorProfilePack({
        regulatorProfile: selectedRegulatorProfile,
        obligations,
        gateRules,
      });
      const packVersion =
        selectedRegulatorProfile === 'FAA'
          ? '2026.1'
          : selectedRegulatorProfile === 'EASA'
            ? '2026.2'
            : '2026.1';
      setRulePacks((previous) => {
        const next = previous.map((pack) =>
          pack.authority === selectedRegulatorProfile
            ? { ...pack, ruleVersion: packVersion, active: true }
            : pack,
        );
        if (next.some((pack) => pack.authority === selectedRegulatorProfile)) {
          return next;
        }
        return [
          ...next,
          {
            id: `rc-${Date.now()}`,
            authority: selectedRegulatorProfile,
            ruleVersion: packVersion,
            active: true,
          },
        ];
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to load regulator profile pack',
      );
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedRegulatorProfile,
    setRegulatorProfilePack,
    setRulePacks,
    setWorkOrdersError,
  ]);

  // ── AD/SB obligations ingestion ───────────────────────────────────
  const ingestAdSbObligations = useCallback(async () => {
    if (!selectedWorkOrderId || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('ingest-ad-sb-obligations', {
        work_order_id: selectedWorkOrderId,
        regulator_profile: selectedRegulatorProfile,
        source_adapter: 'ad-sb-feed-v1',
        obligations: [
          {
            obligation_id: `${selectedWorkOrderId}-ad-001`,
            obligation_type: 'ad',
            reference_number: 'AD-2026-001',
            due_at: new Date(Date.now() + 86400000 * 10).toISOString(),
            applicability: { aircraft_id: selectedWorkOrder?.assetId || 'asset-1' },
          },
          {
            obligation_id: `${selectedWorkOrderId}-sb-001`,
            obligation_type: 'sb',
            reference_number: 'SB-A320-27-1121',
            due_at: new Date(Date.now() + 86400000 * 14).toISOString(),
            applicability: { aircraft_id: selectedWorkOrder?.assetId || 'asset-1' },
          },
        ],
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const summary = (output.mapping_summary || {}) as Record<string, unknown>;
      setObligationIngestionSummary({
        total: Number(summary.total || 0),
        adCount: Number(summary.ad_count || 0),
        sbCount: Number(summary.sb_count || 0),
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to ingest AD/SB obligations',
      );
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedRegulatorProfile,
    selectedWorkOrder?.assetId,
    selectedWorkOrderId,
    setObligationIngestionSummary,
    setWorkOrdersError,
  ]);

  // ── MEL/CDL deferral evaluation ───────────────────────────────────
  const evaluateMelCdlDeferral = useCallback(async () => {
    if (!selectedWorkOrderId || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('evaluate-mel-cdl-deferral', {
        work_order_id: selectedWorkOrderId,
        deferral_type: 'mel',
        item_reference: `${selectedWorkOrderId}-mel-001`,
        deferral_category: 'B',
        dispatch_conditions: ['operational-limitation-logged', 'next-flight-crew-briefed'],
        expires_at: new Date(Date.now() + 3600000 * 36).toISOString(),
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const actions = Array.isArray(output.required_actions)
        ? output.required_actions.map((item) => String(item))
        : [];
      setDeferralDecision({
        decision: String(output.deferral_decision || 'reject'),
        actions,
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to evaluate MEL/CDL deferral',
      );
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedWorkOrderId,
    setDeferralDecision,
    setWorkOrdersError,
  ]);

  // ── Certifying privilege validation ───────────────────────────────
  const validateCertifyingPrivilege = useCallback(async () => {
    if (!selectedQualification || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('validate-certifying-authority', {
        actor_id: selectedQualification.id,
        timestamp: new Date().toISOString(),
        aircraft_scope: [selectedWorkOrder?.assetId || 'asset-1'],
        maintenance_scope: ['line'],
        required_privileges: ['release_approval'],
        authority: {
          valid_from: new Date(Date.now() - 86_400_000).toISOString(),
          valid_to: selectedQualification.validUntil,
          aircraft_scope: ['*'],
          maintenance_scope: ['line', 'base'],
          can_certify_release: selectedQualification.signOffAuthority,
          granted_privileges: selectedQualification.signOffAuthority ? ['release_approval'] : [],
        },
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      setCertifyingPrivilegeValidated(
        String(output.validation_result || '').toLowerCase() === 'valid',
      );
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setCertifyingPrivilegeValidated(false);
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to validate certifying privilege',
      );
      return false;
    }
  }, [
    callCertificationInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedQualification,
    selectedWorkOrder?.assetId,
    setCertifyingPrivilegeValidated,
    setWorkOrdersError,
  ]);

  // ── Certification decision submission ─────────────────────────────
  const submitCertificationDecision = useCallback(
    async (decision: CertificationDecisionOption) => {
      if (!selectedWorkOrderId || !selectedQualification || isApiTemporarilyUnavailable())
        return false;
      try {
        const payload = await callCertificationInterface('submit-certification-decision', {
          work_order_id: selectedWorkOrderId,
          decision,
          unresolved_blockers: ['none'],
          defer_reason: decision === 'defer' ? 'Additional engineering review required' : undefined,
          follow_up_due_at:
            decision === 'defer' ? new Date(Date.now() + 172_800_000).toISOString() : undefined,
          signatures: [
            {
              signer_id: selectedQualification.id,
              mandatory: true,
              signature: selectedQualification.signOffAuthority
                ? `sig-${selectedQualification.id}-${Date.now()}`
                : '',
            },
          ],
        });
        const output = (payload?.output || {}) as Record<string, unknown>;
        const workflow = (output.workflow || {}) as Record<string, unknown>;
        setLatestCertificationDecision({
          actionStatus: String(output.action_status || 'pending'),
          nextAction: String(workflow.next_action || ''),
          blockers: Array.isArray(output.blockers)
            ? output.blockers.map((item) => String(item))
            : [],
        });
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(
          error instanceof Error ? error.message : 'Failed to submit certification decision',
        );
        return false;
      }
    },
    [
      callCertificationInterface,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      selectedQualification,
      selectedWorkOrderId,
      setLatestCertificationDecision,
      setWorkOrdersError,
    ],
  );

  // ── Expiry warning + suspension automation ────────────────────────
  const runExpiryWarningAndSuspension = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('automate-expiry-suspension', {
        timestamp: new Date().toISOString(),
        warning_window_days: 30,
        qualifications: qualifications.map((qualification) => ({
          id: qualification.id,
          valid_to: qualification.validUntil,
          can_certify_release: qualification.signOffAuthority,
          status: 'active',
        })),
      });
      const summary = ((payload?.output || {}) as Record<string, unknown>).summary as
        | Record<string, unknown>
        | undefined;
      setExpiryAutomationSummary({
        warningCount: Number(summary?.warning_count || 0),
        suspensionCount: Number(summary?.suspension_count || 0),
        evaluatedCount: Number(summary?.evaluated_count || 0),
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to run expiry warning automation',
      );
      return false;
    }
  }, [
    callCertificationInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    qualifications,
    setExpiryAutomationSummary,
    setWorkOrdersError,
  ]);

  // ── Competency analytics dashboard ────────────────────────────────
  const loadCompetencyAnalyticsDashboard = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('load-competency-analytics-dashboard', {
        qualifications: qualifications.map((qualification) => ({
          id: qualification.id,
          authority_level: qualification.authorityLevel,
          valid_to: qualification.validUntil,
          can_certify_release: qualification.signOffAuthority,
        })),
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const cards = (output.kpi_cards || {}) as Record<string, unknown>;
      const distribution = (output.authority_distribution || {}) as Record<string, unknown>;
      setCompetencyAnalytics({
        totalQualifiedStaff: Number(cards.total_qualified_staff || 0),
        activeCertifiers: Number(cards.active_certifiers || 0),
        warningWindowStaff: Number(cards.warning_window_staff || 0),
        suspendedCertifiers: Number(cards.suspended_certifiers || 0),
        authorityDistribution: Object.keys(distribution).reduce<Record<string, number>>(
          (acc, key) => {
            acc[key] = Number(distribution[key] || 0);
            return acc;
          },
          {},
        ),
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(
        error instanceof Error ? error.message : 'Failed to load competency analytics',
      );
      return false;
    }
  }, [
    callCertificationInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    qualifications,
    setCompetencyAnalytics,
    setWorkOrdersError,
  ]);

  // ── Authority certification template ──────────────────────────────
  const loadAuthorityCertificationTemplate = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('load-authority-certification-template', {
        authority_profile: selectedCertificationAuthorityProfile,
      });
      const template = (((payload?.output || {}) as Record<string, unknown>).template ||
        {}) as Record<string, unknown>;
      const deferPolicy = (template.defer_policy || {}) as Record<string, unknown>;
      setAuthorityCertificationTemplate({
        templateId: String(template.template_id || ''),
        authorityProfile: selectedCertificationAuthorityProfile,
        requiredSignatures: Array.isArray(template.required_signatures)
          ? template.required_signatures.map((item) => String(item))
          : [],
        mandatoryChecks: Array.isArray(template.mandatory_checks)
          ? template.mandatory_checks.map((item) => String(item))
          : [],
        deferMaxDays: Number(deferPolicy.max_defer_days || 0),
      });
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
          : 'Failed to load authority certification template',
      );
      return false;
    }
  }, [
    callCertificationInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedCertificationAuthorityProfile,
    setAuthorityCertificationTemplate,
    setWorkOrdersError,
  ]);

  return {
    loadComplianceGateExplainability,
    loadAuditReplayTimeline,
    detectComplianceAnomalies,
    loadRegulatorProfilePack,
    ingestAdSbObligations,
    evaluateMelCdlDeferral,
    validateCertifyingPrivilege,
    submitCertificationDecision,
    runExpiryWarningAndSuspension,
    loadCompetencyAnalyticsDashboard,
    loadAuthorityCertificationTemplate,
  };
}
