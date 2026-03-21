export type ComplianceCaseStatus = 'queued' | 'in_review' | 'approved' | 'rejected' | 'escalated';

export type ComplianceEscalationState = 'none' | 'pending' | 'active' | 'resolved';

export type ComplianceScreeningCase = {
  id: string;
  caseNumber: string;
  subjectName: string;
  status: ComplianceCaseStatus;
  slaMinutesRemaining: number;
  assignedRole: 'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user';
  riskScore: number;
  policyVersion: string;
  ruleTrace: string[];
  escalationState: ComplianceEscalationState;
  decisionSummary: string;
};

export type ComplianceDocumentObligation = {
  id: string;
  documentName: string;
  expiryDate: string;
  alertState: 'normal' | 'expiring' | 'expired';
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
};

export type ComplianceEvidenceArtifact = {
  id: string;
  title: string;
  signedReference: string;
  sourceSystem: 'compliance' | 'logistics' | 'crm' | 'finance';
};

export type ComplianceRiskTimelineEntry = {
  id: string;
  occurredAt: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  event: string;
  sourcePointer: string;
};

export function canAdjudicateCase(isAuthorized: boolean, status: ComplianceCaseStatus): boolean {
  if (!isAuthorized) return false;
  return status === 'queued' || status === 'in_review' || status === 'escalated';
}

export function getCaseSlaPriority(slaMinutesRemaining: number): 'urgent' | 'high' | 'normal' {
  if (slaMinutesRemaining <= 30) return 'urgent';
  if (slaMinutesRemaining <= 120) return 'high';
  return 'normal';
}

export function sortCasesForTriage(cases: ComplianceScreeningCase[]): ComplianceScreeningCase[] {
  return [...cases].sort((left, right) => {
    const leftPriority = getCaseSlaPriority(left.slaMinutesRemaining);
    const rightPriority = getCaseSlaPriority(right.slaMinutesRemaining);
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    const priorityDelta = priorityOrder[leftPriority] - priorityOrder[rightPriority];
    if (priorityDelta !== 0) return priorityDelta;
    return right.riskScore - left.riskScore;
  });
}

export function isSignedEvidenceReference(reference: string): boolean {
  return reference.startsWith('sig://');
}

export function acknowledgeObligationAlert(
  obligations: ComplianceDocumentObligation[],
  obligationId: string,
  acknowledgedBy: string,
  acknowledgedAtIso: string
): ComplianceDocumentObligation[] {
  return obligations.map((obligation) =>
    obligation.id === obligationId
      ? { ...obligation, acknowledgedBy, acknowledgedAt: acknowledgedAtIso }
      : obligation
  );
}
