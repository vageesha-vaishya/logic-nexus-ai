import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  ComplianceCaseStatus,
  ComplianceDocumentObligation,
  ComplianceEvidenceArtifact,
  ComplianceRiskTimelineEntry,
  ComplianceScreeningCase,
} from '../workspace/complianceWorkspaceModel';
import {
  acknowledgeObligationAlert,
  canAdjudicateCase,
  isSignedEvidenceReference,
  sortCasesForTriage,
} from '../workspace/complianceWorkspaceModel';

const initialCases: ComplianceScreeningCase[] = [
  {
    id: 'cmp-1',
    caseNumber: 'CMP-2026-001',
    subjectName: 'Helios Maritime GmbH',
    status: 'queued',
    slaMinutesRemaining: 24,
    assignedRole: 'platform_admin',
    riskScore: 91,
    policyVersion: 'POL-RPS-4.2',
    ruleTrace: ['RPS.ACCT.SDN', 'SANCTIONS.EU.ENTITY', 'EXPORT_CTRL.DUAL_USE'],
    escalationState: 'pending',
    decisionSummary: 'Potential sanctions overlap found in dual-use cargo scenario.',
  },
  {
    id: 'cmp-2',
    caseNumber: 'CMP-2026-002',
    subjectName: 'Blue Ridge Logistics LLC',
    status: 'in_review',
    slaMinutesRemaining: 78,
    assignedRole: 'tenant_admin',
    riskScore: 66,
    policyVersion: 'POL-RPS-4.2',
    ruleTrace: ['RPS.NAME.FUZZY', 'KYC.ADDRESS.MISMATCH'],
    escalationState: 'none',
    decisionSummary: 'Address mismatch requires manual KYC confirmation.',
  },
  {
    id: 'cmp-3',
    caseNumber: 'CMP-2026-003',
    subjectName: 'Northern Freight Pte Ltd',
    status: 'escalated',
    slaMinutesRemaining: 15,
    assignedRole: 'platform_admin',
    riskScore: 95,
    policyVersion: 'POL-RPS-4.1',
    ruleTrace: ['SANCTIONS.OFAC.SDN', 'AML.BENEFICIAL_OWNER.RISK'],
    escalationState: 'active',
    decisionSummary: 'Escalated due to OFAC direct hit and beneficial ownership risk.',
  },
];

const initialObligations: ComplianceDocumentObligation[] = [
  {
    id: 'doc-1',
    documentName: 'End-User Certificate',
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
    alertState: 'expiring',
    acknowledgedAt: null,
    acknowledgedBy: null,
  },
  {
    id: 'doc-2',
    documentName: 'Import Permit',
    expiryDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    alertState: 'expired',
    acknowledgedAt: null,
    acknowledgedBy: null,
  },
];

const initialEvidence: ComplianceEvidenceArtifact[] = [
  { id: 'ev-1', title: 'Screening Raw Match JSON', signedReference: 'sig://evidence/cmp-1/raw-match', sourceSystem: 'compliance' },
  { id: 'ev-2', title: 'Shipment Manifest Extract', signedReference: 'sig://evidence/cmp-1/manifest', sourceSystem: 'logistics' },
  { id: 'ev-3', title: 'Customer KYC Snapshot', signedReference: 'sig://evidence/cmp-2/kyc', sourceSystem: 'crm' },
];

const initialTimeline: ComplianceRiskTimelineEntry[] = [
  {
    id: 'tl-1',
    occurredAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    severity: 'critical',
    event: 'Potential denied-party match detected',
    sourcePointer: '/dashboard/restricted-party-screening?case=CMP-2026-003',
  },
  {
    id: 'tl-2',
    occurredAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    severity: 'high',
    event: 'Document obligation expired without acknowledgment',
    sourcePointer: '/dashboard/restricted-party-screening?obligation=doc-2',
  },
];

export function useComplianceWorkspaceState() {
  const { hasPermission, hasRole, isPlatformAdmin, user } = useAuth();
  const [cases, setCases] = useState<ComplianceScreeningCase[]>(initialCases);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialCases[0]?.id ?? '');
  const [documentObligations, setDocumentObligations] = useState<ComplianceDocumentObligation[]>(initialObligations);
  const [evidenceArtifacts] = useState<ComplianceEvidenceArtifact[]>(initialEvidence);
  const [riskTimeline] = useState<ComplianceRiskTimelineEntry[]>(initialTimeline);
  const [decisionStatus, setDecisionStatus] = useState<ComplianceCaseStatus>('in_review');
  const [decisionExplanation, setDecisionExplanation] = useState<string>('Policy trace reviewed. Awaiting adjudication note.');
  const [decisionWriteState, setDecisionWriteState] = useState<'idle' | 'saved' | 'blocked'>('idle');

  const triageQueue = useMemo(() => sortCasesForTriage(cases), [cases]);
  const selectedCase = useMemo(
    () => triageQueue.find((item) => item.id === selectedCaseId) ?? triageQueue[0] ?? null,
    [triageQueue, selectedCaseId]
  );

  const canManageCompliance = useMemo(() => {
    if (isPlatformAdmin()) return true;
    return hasPermission('admin.settings.manage') && (hasRole('platform_admin') || hasRole('tenant_admin'));
  }, [hasPermission, hasRole, isPlatformAdmin]);

  const canAdjudicateSelectedCase = useMemo(() => {
    if (!selectedCase) return false;
    const matchesAssignedRole = isPlatformAdmin() || hasRole(selectedCase.assignedRole);
    return matchesAssignedRole && canAdjudicateCase(canManageCompliance, selectedCase.status);
  }, [canManageCompliance, hasRole, isPlatformAdmin, selectedCase]);

  const saveDecision = useCallback(() => {
    if (!selectedCase || !canAdjudicateSelectedCase) {
      setDecisionWriteState('blocked');
      return;
    }
    setCases((previous) =>
      previous.map((item) =>
        item.id === selectedCase.id
          ? {
              ...item,
              status: decisionStatus,
              decisionSummary: decisionExplanation,
              escalationState: decisionStatus === 'escalated' ? 'active' : item.escalationState,
            }
          : item
      )
    );
    setDecisionWriteState('saved');
  }, [canAdjudicateSelectedCase, decisionExplanation, decisionStatus, selectedCase]);

  const acknowledgeObligation = useCallback(
    (obligationId: string) => {
      const actor = user?.email || user?.id || 'compliance-actor';
      setDocumentObligations((previous) =>
        acknowledgeObligationAlert(previous, obligationId, actor, new Date().toISOString())
      );
    },
    [user]
  );

  const evidenceContractPreview = useMemo(
    () =>
      evidenceArtifacts.map((item) => ({
        ...item,
        isSigned: isSignedEvidenceReference(item.signedReference),
      })),
    [evidenceArtifacts]
  );

  return {
    triageQueue,
    selectedCase,
    selectedCaseId,
    setSelectedCaseId,
    documentObligations,
    evidenceContractPreview,
    riskTimeline,
    decisionStatus,
    setDecisionStatus,
    decisionExplanation,
    setDecisionExplanation,
    decisionWriteState,
    canManageCompliance,
    canAdjudicateSelectedCase,
    saveDecision,
    acknowledgeObligation,
  };
}
