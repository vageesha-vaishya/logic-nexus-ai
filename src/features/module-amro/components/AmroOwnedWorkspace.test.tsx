import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AmroOwnedWorkspace } from './AmroOwnedWorkspace';

const mockUseAmroWorkspaceState = vi.fn();

vi.mock('../hooks/useAmroWorkspaceState', () => ({
  useAmroWorkspaceState: () => mockUseAmroWorkspaceState(),
}));

function createWorkspaceState(overrides: Record<string, unknown> = {}) {
  return {
    assets: [
      {
        id: 'asset-1',
        assetTag: 'A320',
        assetType: 'aircraft',
        serialNumber: 'SN-1',
        configurationState: 'configured',
      },
    ],
    isAmroAuthorized: true,
    realtimeConnected: true,
    workPackages: [
      {
        id: 'wp-1',
        packageNumber: 'WP-1',
        lifecycleStage: 'plan',
        assetId: 'asset-1',
        tasks: [
          {
            id: 'task-1',
            workPackageId: 'wp-1',
            title: 'Inspect',
            lifecycleStage: 'execute',
            assignedRole: 'technician',
            completed: false,
          },
        ],
      },
    ],
    selectedWorkPackage: {
      id: 'wp-1',
      packageNumber: 'WP-1',
      lifecycleStage: 'plan',
      assetId: 'asset-1',
      tasks: [
        {
          id: 'task-1',
          workPackageId: 'wp-1',
          title: 'Inspect',
          lifecycleStage: 'execute',
          assignedRole: 'technician',
          completed: false,
        },
      ],
    },
    selectedWorkPackageId: 'wp-1',
    setSelectedWorkPackageId: vi.fn(),
    workPackagesError: null,
    canCreateWorkPackage: true,
    canDeleteWorkPackage: true,
    canAdvanceLifecycle: true,
    activeRole: 'planner',
    loadingWorkPackages: false,
    refreshWorkPackages: vi.fn(),
    createWorkPackage: vi.fn().mockResolvedValue(true),
    deleteSelectedWorkPackage: vi.fn().mockResolvedValue(true),
    advanceWorkPackageLifecycle: vi.fn(),
    workPackageStatusFilter: 'all',
    setWorkPackageStatusFilter: vi.fn(),
    workPackageSearch: '',
    setWorkPackageSearch: vi.fn(),
    selectedSavedViewId: 'default-all',
    setSelectedSavedViewId: vi.fn(),
    savedWorkPackageViews: [{ id: 'default-all', name: 'All Work Packages', filters: { status: 'all', search: '' } }],
    saveCurrentWorkPackageView: vi.fn().mockResolvedValue(true),
    updateTaskExecutionStatus: vi.fn().mockResolvedValue(true),
    uploadTaskEvidence: vi.fn().mockResolvedValue(true),
    submitTaskSignature: vi.fn().mockResolvedValue(true),
    assignSelectedWorkPackageToNextSlot: vi.fn().mockResolvedValue(true),
    fetchScheduleOptimizationRecommendations: vi.fn().mockResolvedValue(true),
    acknowledgeScheduleUpdate: vi.fn().mockResolvedValue(true),
    scheduleBoardRows: [],
    scheduleOptimizationRecommendations: [],
    complianceGateModalOpen: false,
    setComplianceGateModalOpen: vi.fn(),
    complianceExplainability: null,
    complianceAuditReplay: null,
    complianceAnomalyAlerts: [],
    selectedRegulatorProfile: 'FAA',
    setSelectedRegulatorProfile: vi.fn(),
    regulatorProfilePack: null,
    obligationIngestionSummary: null,
    deferralDecision: null,
    selectedQualificationId: 'qual-1',
    setSelectedQualificationId: vi.fn(),
    selectedQualification: { id: 'qual-1', staffName: 'QA One', signOffAuthority: true, validUntil: '2026-05-01T00:00:00.000Z' },
    qualifications: [{ id: 'qual-1', staffName: 'QA One', signOffAuthority: true, validUntil: '2026-05-01T00:00:00.000Z' }],
    requiredAuthority: 'supervisor',
    setRequiredAuthority: vi.fn(),
    selectedCertificationAuthorityProfile: 'FAA',
    setSelectedCertificationAuthorityProfile: vi.fn(),
    qualificationStatusIndicator: { lifecycle: 'active', daysUntilExpiry: 45, reason: 'Qualification valid' },
    certifyingPrivilegeValidated: false,
    latestCertificationDecision: null,
    expiryAutomationSummary: null,
    competencyAnalytics: null,
    authorityCertificationTemplate: null,
    canSignOff: true,
    complianceCoverage: { totalPacks: 1, activePacks: 1, authorityCoverage: ['FAA'] },
    evidenceChain: [],
    materialsSummary: { shortageCount: 0, pendingReservations: 0, atRiskEtaCount: 0, llpAlertCount: 0 },
    materials: [
      {
        id: 'mat-1',
        partNumber: 'PN-1',
        reservationStatus: 'reserved',
        repairAction: 'install',
        supplierEta: '2026-03-22T00:00:00.000Z',
        shortageSeverity: 'none',
        etaStatus: 'on_time',
        rotableStatus: 'serviceable',
        llpRemainingCycles: 1200,
        traceabilityStatus: 'verified',
      },
    ],
    reservePartsAllocationForSelectedWorkPackage: vi.fn().mockResolvedValue(true),
    processCriticalShortageResponse: vi.fn().mockResolvedValue(true),
    applyRotableLlpTraceability: vi.fn().mockResolvedValue(true),
    runInventoryOptimizationModel: vi.fn().mockResolvedValue(true),
    syncSupplierAsnAndErpProcurement: vi.fn().mockResolvedValue(true),
    lastInventoryOptimizationRunId: '',
    lastProcurementSyncId: '',
    loadComplianceGateExplainability: vi.fn().mockResolvedValue(true),
    loadAuditReplayTimeline: vi.fn().mockResolvedValue(true),
    detectComplianceAnomalies: vi.fn().mockResolvedValue(true),
    loadRegulatorProfilePack: vi.fn().mockResolvedValue(true),
    ingestAdSbObligations: vi.fn().mockResolvedValue(true),
    evaluateMelCdlDeferral: vi.fn().mockResolvedValue(true),
    validateCertifyingPrivilege: vi.fn().mockResolvedValue(true),
    submitCertificationDecision: vi.fn().mockResolvedValue(true),
    runExpiryWarningAndSuspension: vi.fn().mockResolvedValue(true),
    loadCompetencyAnalyticsDashboard: vi.fn().mockResolvedValue(true),
    loadAuthorityCertificationTemplate: vi.fn().mockResolvedValue(true),
    predictiveSummary: { highRisk: 0, telemetryTriggers: 0, averageRisk: 0, totalRecommendations: 0 },
    predictiveRecommendations: [],
    ...overrides,
  };
}

describe('AmroOwnedWorkspace', () => {
  it('renders work package filters, tabs, and role gating badges', () => {
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState());
    render(<AmroOwnedWorkspace />);

    expect(screen.getByText('Work Package and Task Lifecycle Orchestration')).toBeTruthy();
    expect(screen.getByText('Status Filter')).toBeTruthy();
    expect(screen.getByText('Save Current View')).toBeTruthy();
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Tasks')).toBeTruthy();
    expect(screen.getByText('Compliance')).toBeTruthy();
    expect(screen.getAllByText('Role: planner').length).toBeGreaterThan(0);
    expect(screen.getByText('Create Allowed')).toBeTruthy();
    expect(screen.getByText('Delete Allowed')).toBeTruthy();
  });

  it('tracks unsaved detail changes in detail sheet', () => {
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState());
    render(<AmroOwnedWorkspace />);

    const textarea = screen.getByPlaceholderText('Enter work package detail notes');
    fireEvent.change(textarea, { target: { value: 'Draft detail notes' } });

    expect(screen.getByText('Unsaved Changes')).toBeTruthy();
  });

  it('renders certification management controls and triggers validation action', () => {
    const validateCertifyingPrivilege = vi.fn().mockResolvedValue(true);
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState({ validateCertifyingPrivilege }));
    render(<AmroOwnedWorkspace />);

    expect(screen.getByText('Certification Management and Authority Templates')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Validate Privilege' }));
    expect(validateCertifyingPrivilege).toHaveBeenCalledTimes(1);
  });

  it('requires rationale before closure and certification deferral actions', async () => {
    const advanceWorkPackageLifecycle = vi.fn().mockResolvedValue(true);
    const submitCertificationDecision = vi.fn().mockResolvedValue(true);
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState({
      advanceWorkPackageLifecycle,
      submitCertificationDecision,
    }));
    render(<AmroOwnedWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Close work package with confirmation' }));
    expect(screen.getByText('Confirm Work Package Closure')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Closure rationale'), { target: { value: 'All checks passed and signed.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm closure with rationale' }));
    expect(advanceWorkPackageLifecycle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Defer certification decision with rationale'));
    expect(screen.getByText('Confirm Certification Deferral')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Certification deferral rationale'), { target: { value: 'Awaiting authority package update.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm certification deferral' }));
    expect(submitCertificationDecision).toHaveBeenCalledWith('defer');
  });
});
