import { describe, expect, it } from 'vitest';
import {
  acknowledgeObligationAlert,
  canAdjudicateCase,
  getCaseSlaPriority,
  isSignedEvidenceReference,
  sortCasesForTriage,
  type ComplianceScreeningCase,
} from './complianceWorkspaceModel';

describe('complianceWorkspaceModel', () => {
  it('enforces adjudication workflow gate by authorization and case status', () => {
    expect(canAdjudicateCase(false, 'queued')).toBe(false);
    expect(canAdjudicateCase(true, 'approved')).toBe(false);
    expect(canAdjudicateCase(true, 'in_review')).toBe(true);
  });

  it('prioritizes triage queue by SLA urgency and risk score', () => {
    const queue: ComplianceScreeningCase[] = [
      {
        id: 'a',
        caseNumber: 'A',
        subjectName: 'A',
        status: 'queued',
        slaMinutesRemaining: 60,
        assignedRole: 'tenant_admin',
        riskScore: 55,
        policyVersion: 'P',
        ruleTrace: [],
        escalationState: 'none',
        decisionSummary: '',
      },
      {
        id: 'b',
        caseNumber: 'B',
        subjectName: 'B',
        status: 'queued',
        slaMinutesRemaining: 20,
        assignedRole: 'platform_admin',
        riskScore: 40,
        policyVersion: 'P',
        ruleTrace: [],
        escalationState: 'none',
        decisionSummary: '',
      },
      {
        id: 'c',
        caseNumber: 'C',
        subjectName: 'C',
        status: 'queued',
        slaMinutesRemaining: 20,
        assignedRole: 'platform_admin',
        riskScore: 95,
        policyVersion: 'P',
        ruleTrace: [],
        escalationState: 'none',
        decisionSummary: '',
      },
    ];
    expect(getCaseSlaPriority(20)).toBe('urgent');
    expect(getCaseSlaPriority(75)).toBe('high');
    expect(sortCasesForTriage(queue).map((item) => item.id)).toEqual(['c', 'b', 'a']);
  });

  it('preserves compliance ownership for signed evidence references', () => {
    expect(isSignedEvidenceReference('sig://evidence/case-1')).toBe(true);
    expect(isSignedEvidenceReference('/dashboard/files/evidence/case-1')).toBe(false);
  });

  it('supports auditable acknowledgment state for expiring obligations', () => {
    const obligations = [
      {
        id: 'doc-1',
        documentName: 'Permit',
        expiryDate: '2026-05-01T00:00:00.000Z',
        alertState: 'expired' as const,
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    ];
    const next = acknowledgeObligationAlert(obligations, 'doc-1', 'auditor@logicnexus.ai', '2026-03-21T10:00:00.000Z');
    expect(next[0].acknowledgedBy).toBe('auditor@logicnexus.ai');
    expect(next[0].acknowledgedAt).toBe('2026-03-21T10:00:00.000Z');
  });
});
