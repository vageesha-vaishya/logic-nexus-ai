import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AmroOwnedWorkspace } from './AmroOwnedWorkspace';

const mockUseAmroWorkspaceState = vi.fn();
const mockScopedDbFrom = vi.fn();
const mockScopedDb = {
  from: (...args: unknown[]) => mockScopedDbFrom(...args),
};
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockWorkbook = {};
const mockWorksheet = {};
const mockPdfSave = vi.fn();
const mockXlsxWriteFile = vi.fn();
const mockAutoTable = vi.fn();
const mockOpenWorkPackageDetails = vi.fn().mockResolvedValue(true);
const mockUpdateWorkPackageScheduling = vi.fn().mockResolvedValue(true);
const mockToggleWorkPackageHold = vi.fn().mockResolvedValue(true);
const mockSoftDeleteWorkPackage = vi.fn().mockResolvedValue(true);
const mockRestoreSoftDeletedWorkPackage = vi.fn().mockResolvedValue(true);

vi.mock('../hooks/useAmroWorkspaceState', () => ({
  useAmroWorkspaceState: () => mockUseAmroWorkspaceState(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => mockWorkbook),
    json_to_sheet: vi.fn(() => mockWorksheet),
    book_append_sheet: vi.fn(),
  },
  writeFile: (...args: unknown[]) => mockXlsxWriteFile(...args),
}));

vi.mock('jspdf', () => ({
  jsPDF: function MockJsPdf() {
    return {
      save: (...args: unknown[]) => mockPdfSave(...args),
    };
  },
}));

vi.mock('jspdf-autotable', () => ({
  default: (...args: unknown[]) => mockAutoTable(...args),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb,
  }),
}));

const buildQueryMock = (payload: unknown) => ({
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue(payload),
});

beforeEach(() => {
  mockUseAmroWorkspaceState.mockReset();
  mockScopedDbFrom.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockPdfSave.mockReset();
  mockXlsxWriteFile.mockReset();
  mockAutoTable.mockReset();
  mockOpenWorkPackageDetails.mockReset();
  mockOpenWorkPackageDetails.mockResolvedValue(true);
  mockUpdateWorkPackageScheduling.mockReset();
  mockUpdateWorkPackageScheduling.mockResolvedValue(true);
  mockToggleWorkPackageHold.mockReset();
  mockToggleWorkPackageHold.mockResolvedValue(true);
  mockSoftDeleteWorkPackage.mockReset();
  mockSoftDeleteWorkPackage.mockResolvedValue(true);
  mockRestoreSoftDeletedWorkPackage.mockReset();
  mockRestoreSoftDeletedWorkPackage.mockResolvedValue(true);
  mockScopedDbFrom.mockImplementation((table: string) => {
    if (table === 'aircraft') {
      return buildQueryMock({
        data: [
          {
            id: 'ac-1',
            registration: 'N123AB',
            serial_number: 'SN-001',
            aircraft_model: 'A320-200',
            aircraft_type: 'Narrow Body',
            operator_code: 'OPS',
            owner_name: 'Tenant Airline',
            station_code: 'DXB',
            status: 'active',
            current_flight_hours: 12543,
            current_cycles: 6501,
          },
        ],
        error: null,
      });
    }
    if (table === 'maintenance_tasks') {
      return buildQueryMock({
        data: [
          {
            id: 'mt-1',
            code_form_no: 'TASK-001',
            description: 'A320 engine borescope inspection',
            interval_hours: 500,
            interval_cycles: null,
            interval_months: null,
            estimated_man_hours: 8,
            category_code: 'ENG',
            revision_status: 'released',
          },
          {
            id: 'mt-2',
            code_form_no: 'TASK-002',
            description: 'A320 avionics operational check',
            interval_hours: null,
            interval_cycles: 200,
            interval_months: null,
            estimated_man_hours: 3,
            category_code: 'AVN',
            revision_status: 'released',
          },
        ],
        error: null,
      });
    }
    if (table === 'aircraft_maintenance_tasks') {
      return buildQueryMock({
        data: [],
        error: null,
      });
    }
    return buildQueryMock({
      data: [],
      error: null,
    });
  });
});

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
    openWorkPackageDetails: mockOpenWorkPackageDetails,
    updateWorkPackageScheduling: mockUpdateWorkPackageScheduling,
    toggleWorkPackageHold: mockToggleWorkPackageHold,
    softDeleteWorkPackage: mockSoftDeleteWorkPackage,
    restoreSoftDeletedWorkPackage: mockRestoreSoftDeletedWorkPackage,
    holdAuditTrail: [],
    advanceWorkPackageLifecycle: vi.fn(),
    workPackageStatusFilter: 'all',
    setWorkPackageStatusFilter: vi.fn(),
    workPackageSearch: '',
    setWorkPackageSearch: vi.fn(),
    selectedSavedViewId: 'default-all',
    setSelectedSavedViewId: vi.fn(),
    savedWorkPackageViews: [{ id: 'default-all', name: 'All Work Packages', filters: { status: 'all', search: '' } }],
    saveCurrentWorkPackageView: vi.fn().mockResolvedValue(true),
    cloneWorkPackageFromTemplate: vi.fn().mockResolvedValue(true),
    updateTaskExecutionStatus: vi.fn().mockResolvedValue(true),
    uploadTaskEvidence: vi.fn().mockResolvedValue(true),
    submitTaskSignature: vi.fn().mockResolvedValue(true),
    assignSelectedWorkPackageToNextSlot: vi.fn().mockResolvedValue(true),
    fetchScheduleOptimizationRecommendations: vi.fn().mockResolvedValue(true),
    runWorkPackageReplanSimulation: vi.fn().mockResolvedValue(true),
    confirmWorkPackageReplan: vi.fn().mockResolvedValue(true),
    acknowledgeScheduleUpdate: vi.fn().mockResolvedValue(true),
    scheduleBoardRows: [],
    scheduleOptimizationRecommendations: [],
    workPackageReplanOptions: [],
    lastConfirmedReplanScheduleId: '',
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
    syncSupplierEtaForSelectedWorkPackage: vi.fn().mockResolvedValue(true),
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
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState({
      complianceAuditReplay: {
        eventCount: 1,
        events: [{ sequence: 1, action: 'gate-approved', createdAt: '2026-03-22T00:00:00.000Z', recordId: 'rec-1' }],
      },
    }));
    render(<AmroOwnedWorkspace />);

    expect(screen.getAllByText('Work Packages').length).toBeGreaterThan(0);
    expect(screen.getByText('Status Filter')).toBeTruthy();
    expect(screen.getByText('Save Current View')).toBeTruthy();
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Tasks')).toBeTruthy();
    expect(screen.getByText('Compliance')).toBeTruthy();
    expect(screen.getAllByText('Role: planner').length).toBeGreaterThan(0);
    expect(screen.getByText('Create Allowed')).toBeTruthy();
    expect(screen.getByText('Delete Allowed')).toBeTruthy();
    expect(screen.getByText('SCR-AMRO-001 AMRO Command Center')).toBeTruthy();
    expect(screen.queryByText('SCR-AMRO-002 Work Package List')).toBeNull();
    expect(screen.getByText('SCR-AMRO-005 Task Execution Card')).toBeTruthy();
    expect(screen.getByText('SCR-AMRO-011 Integration Monitor Console')).toBeTruthy();
    expect(screen.getByText('SCR-AMRO-012 Forecast Recommendation Hub')).toBeTruthy();
    expect(screen.getByText('SCR-AMRO-010 Audit Replay Timeline')).toBeTruthy();
    expect(screen.getByText('Overview dashboard UI has been cleared.')).toBeTruthy();
  });

  it('renders cleared overview dashboard surface in overview module scope', () => {
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState());
    render(
      <AmroOwnedWorkspace
        moduleKey="overview"
        overviewTelemetry={{
          openWorkPackages: 38,
          aogCount: 3,
        }}
      />,
    );

    expect(screen.getByText('SCR-AMRO-001 AMRO Command Center')).toBeTruthy();
    expect(screen.getByText('Overview dashboard UI has been cleared.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
  });

  it('does not render SCR-AMRO-001 controls after UI deletion', () => {
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState());
    render(
      <AmroOwnedWorkspace
        moduleKey="overview"
        overviewControls={{
          dateRange: '30d',
          regulatorProfile: 'FAA',
          fleetFilter: 'all',
          stationFilter: 'all',
          onCycleDateRange: vi.fn(),
          onCycleRegulatorProfile: vi.fn(),
          onFleetFilterChange: vi.fn(),
          onStationFilterChange: vi.fn(),
          onRefresh: vi.fn(),
          onExport: vi.fn(),
          exporting: false,
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Date Range: 30d' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Regulator: FAA' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
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

    expect(screen.getByText('SCR-AMRO-009 Certification Decision Panel')).toBeTruthy();
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Close work package with confirmation' })[0]);
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

  it('renders interactive work package surfaces on work-packages route', () => {
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState());
    render(<AmroOwnedWorkspace moduleKey="work-packages" />);

    expect(screen.getAllByText('Work Packages').length).toBeGreaterThan(0);
    expect(screen.queryByText('AMRO > Work Packages')).toBeNull();
    expect(screen.getByRole('button', { name: 'New WP' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compliance Precheck' })).toBeTruthy();
    expect(screen.queryByText('Work Packages Redesign Baseline')).toBeNull();
  });

  it('validates and submits work package creation flow with aircraft-first gating', async () => {
    const createWorkPackage = vi.fn().mockResolvedValue(true);
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState({ createWorkPackage }));
    render(<AmroOwnedWorkspace moduleKey="work-packages" />);

    fireEvent.click(screen.getByRole('button', { name: 'Add WP' }));
    expect(screen.getByLabelText('Package Number')).toBeTruthy();
    expect(screen.getByLabelText('Topic')).toBeTruthy();
    expect(screen.getByLabelText('Planning Date')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getAllByText('Aircraft is required before task selection.').length).toBeGreaterThan(0);
    expect(createWorkPackage).toHaveBeenCalledTimes(0);

    fireEvent.click(await screen.findByRole('button', { name: /A320-200/ }));
    fireEvent.change(screen.getByLabelText('Package Number'), { target: { value: 'WP-A320-001' } });
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'C-Check package for fleet A1' } });
    fireEvent.change(screen.getByLabelText('Location/Station'), { target: { value: 'DXB' } });
    fireEvent.change(screen.getByLabelText('Work Package Details'), { target: { value: 'C-Check package for fleet A1' } });
    await waitFor(() => {
      expect(screen.getByText('TASK-001')).toBeTruthy();
      expect(screen.getByText('TASK-002')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select all valid' }));
    await waitFor(() => {
      expect(screen.getByText('2 selected')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));
    await waitFor(() => {
      expect(createWorkPackage).toHaveBeenCalledWith('C-Check package for fleet A1', expect.objectContaining({
        aircraftId: 'ac-1',
        maintenanceType: 'line',
        priority: 'medium',
        taskPlan: expect.arrayContaining(['mt-1', 'mt-2']),
      }));
    });
  });

  it('disables duplicate task selections for selected aircraft', async () => {
    mockScopedDbFrom.mockImplementation((table: string) => {
      if (table === 'aircraft') {
        return buildQueryMock({
          data: [
            {
              id: 'ac-1',
              registration: 'N123AB',
              serial_number: 'SN-001',
              aircraft_model: 'A320-200',
              aircraft_type: 'Narrow Body',
              operator_code: 'OPS',
              owner_name: 'Tenant Airline',
              station_code: 'DXB',
              status: 'active',
              current_flight_hours: 12543,
              current_cycles: 6501,
            },
          ],
          error: null,
        });
      }
      if (table === 'maintenance_tasks') {
        return buildQueryMock({
          data: [
            {
              id: 'mt-1',
              code_form_no: 'TASK-001',
              description: 'A320 engine borescope inspection',
              interval_hours: 500,
              interval_cycles: null,
              interval_months: null,
              estimated_man_hours: 8,
              category_code: 'ENG',
              revision_status: 'released',
            },
          ],
          error: null,
        });
      }
      if (table === 'aircraft_maintenance_tasks') {
        return buildQueryMock({
          data: [{ task_id: 'mt-1' }],
          error: null,
        });
      }
      return buildQueryMock({ data: [], error: null });
    });
    const createWorkPackage = vi.fn().mockResolvedValue(true);
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState({ createWorkPackage }));
    render(<AmroOwnedWorkspace moduleKey="work-packages" />);

    fireEvent.click(screen.getByRole('button', { name: 'Add WP' }));
    const aircraftOption = await screen.findByRole('button', { name: /A320-200/ });
    fireEvent.click(aircraftOption);

    await waitFor(() => {
      expect(screen.getByText('Task already assigned to this aircraft.')).toBeTruthy();
    });
    const selectAllValid = screen.getByRole('button', { name: 'Select all valid' });
    fireEvent.click(selectAllValid);
    expect(screen.getByText('0 selected')).toBeTruthy();
  });

  it('shows UX-AMRO-005 detail tabs and side panel headings on work-packages route', () => {
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState());
    render(<AmroOwnedWorkspace moduleKey="work-packages" />);

    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Tasks')).toBeTruthy();
    expect(screen.getByText('Materials')).toBeTruthy();
    expect(screen.getByText('Compliance')).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.getByText('Attachments')).toBeTruthy();
    expect(screen.getByText('Activity Feed')).toBeTruthy();
    expect(screen.getByText('Signatures')).toBeTruthy();
    expect(screen.getByText('Overrides')).toBeTruthy();
    expect(screen.getByText('Gate Outcomes')).toBeTruthy();
  });

  it('runs integration monitor actions from integration module page', () => {
    const refreshWorkPackages = vi.fn().mockResolvedValue(true);
    const loadAuditReplayTimeline = vi.fn().mockResolvedValue(true);
    mockUseAmroWorkspaceState.mockReturnValue(
      createWorkspaceState({
        refreshWorkPackages,
        loadAuditReplayTimeline,
      }),
    );
    render(<AmroOwnedWorkspace moduleKey="integration" />);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Integration Status' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Replay Console' }));

    expect(refreshWorkPackages).toHaveBeenCalledTimes(1);
    expect(loadAuditReplayTimeline).toHaveBeenCalledTimes(2);
  });

  it('wires shell and sticky action buttons to interactive handlers', async () => {
    const setSelectedWorkPackageId = vi.fn();
    const updateWorkPackageScheduling = vi.fn().mockResolvedValue(true);
    const advanceWorkPackageLifecycle = vi.fn().mockResolvedValue(true);
    const toggleWorkPackageHold = vi.fn().mockResolvedValue(true);
    mockUseAmroWorkspaceState.mockReturnValue(
      createWorkspaceState({
        setSelectedWorkPackageId,
        updateWorkPackageScheduling,
        advanceWorkPackageLifecycle,
        toggleWorkPackageHold,
      }),
    );
    render(<AmroOwnedWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Import/Export' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Assign work package' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Update work package status' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Bulk Actions' }));

    await waitFor(() => {
      expect(updateWorkPackageScheduling).toHaveBeenCalledTimes(1);
      expect(toggleWorkPackageHold).toHaveBeenCalledTimes(1);
    });
    expect(setSelectedWorkPackageId).toHaveBeenCalledWith('wp-1');
    expect(advanceWorkPackageLifecycle).toHaveBeenCalledTimes(1);
  });

  it('handles Open, Schedule, Hold, Clone, Export, Delete actions with feedback and recovery', async () => {
    const cloneWorkPackageFromTemplate = vi.fn().mockResolvedValue(true);
    const updateWorkPackageScheduling = vi.fn().mockResolvedValue(true);
    const toggleWorkPackageHold = vi.fn().mockResolvedValue(true);
    const openWorkPackageDetails = vi.fn().mockResolvedValue(true);
    const softDeleteWorkPackage = vi.fn().mockResolvedValue(true);
    const restoreSoftDeletedWorkPackage = vi.fn().mockResolvedValue(true);
    const originalConfirm = window.confirm;
    window.confirm = vi.fn().mockReturnValue(true);
    mockUseAmroWorkspaceState.mockReturnValue(
      createWorkspaceState({
        cloneWorkPackageFromTemplate,
        updateWorkPackageScheduling,
        toggleWorkPackageHold,
        openWorkPackageDetails,
        softDeleteWorkPackage,
        restoreSoftDeletedWorkPackage,
      }),
    );
    render(<AmroOwnedWorkspace moduleKey="work-packages" />);

    fireEvent.click(screen.getByRole('button', { name: 'Open work package WP-1' }));
    await waitFor(() => {
      expect(openWorkPackageDetails).toHaveBeenCalledWith('wp-1');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule work package WP-1' }));
    await waitFor(() => {
      expect(updateWorkPackageScheduling).toHaveBeenCalledWith('wp-1');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hold work package WP-1' }));
    await waitFor(() => {
      expect(toggleWorkPackageHold).toHaveBeenCalledWith('wp-1');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clone work package WP-1' }));
    await waitFor(() => {
      expect(cloneWorkPackageFromTemplate).toHaveBeenCalledWith('wp-1');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export work package WP-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete work package WP-1' }));

    await waitFor(() => {
      expect(softDeleteWorkPackage).toHaveBeenCalledWith('wp-1');
    });

    expect(mockXlsxWriteFile).toHaveBeenCalledWith(mockWorkbook, 'WP-1-export.xlsx');
    expect(mockAutoTable).toHaveBeenCalledTimes(1);
    expect(mockPdfSave).toHaveBeenCalledWith('WP-1-export.pdf');
    expect(mockToastSuccess).toHaveBeenCalled();

    const deleteToastCall = mockToastSuccess.mock.calls.find((call) => String(call[0]).includes('Deleted WP-1'));
    expect(deleteToastCall).toBeTruthy();
    const toastOptions = deleteToastCall?.[1] as { action?: { onClick?: () => void } } | undefined;
    toastOptions?.action?.onClick?.();
    await waitFor(() => {
      expect(restoreSoftDeletedWorkPackage).toHaveBeenCalledWith('wp-1');
    });
    window.confirm = originalConfirm;
  });

  it('persists drag reorder in local storage', async () => {
    const originalSetItem = window.localStorage.setItem;
    const localStorageSetItem = vi.fn();
    Object.defineProperty(window.localStorage, 'setItem', {
      configurable: true,
      value: localStorageSetItem,
    });
    mockUseAmroWorkspaceState.mockReturnValue(createWorkspaceState({
      workPackages: [
        {
          id: 'wp-1',
          packageNumber: 'WP-1',
          lifecycleStage: 'plan',
          assetId: 'asset-1',
          tasks: [],
        },
        {
          id: 'wp-2',
          packageNumber: 'WP-2',
          lifecycleStage: 'plan',
          assetId: 'asset-1',
          tasks: [],
        },
      ],
    }));
    render(<AmroOwnedWorkspace moduleKey="work-packages" />);

    const sourceRow = screen.getByRole('button', { name: 'Drag handle for WP-1' }).closest('[draggable="true"]');
    const targetRow = screen.getByRole('button', { name: 'Drag handle for WP-2' }).closest('[draggable="true"]');
    expect(sourceRow).toBeTruthy();
    expect(targetRow).toBeTruthy();
    if (!sourceRow || !targetRow) return;
    fireEvent.dragStart(sourceRow);
    fireEvent.drop(targetRow);

    await waitFor(() => {
      expect(localStorageSetItem).toHaveBeenCalledWith('amro.workspace.work-package-order', expect.any(String));
    });

    Object.defineProperty(window.localStorage, 'setItem', {
      configurable: true,
      value: originalSetItem,
    });
  });

  it('opens compliance gate modal after loading explainability', async () => {
    const loadComplianceGateExplainability = vi.fn().mockResolvedValue(true);
    const setComplianceGateModalOpen = vi.fn();
    mockUseAmroWorkspaceState.mockReturnValue(
      createWorkspaceState({
        loadComplianceGateExplainability,
        setComplianceGateModalOpen,
      }),
    );
    render(<AmroOwnedWorkspace moduleKey="compliance" />);

    fireEvent.click(screen.getByRole('button', { name: 'Load Compliance Gate' }));

    await waitFor(() => {
      expect(loadComplianceGateExplainability).toHaveBeenCalledTimes(1);
      expect(setComplianceGateModalOpen).toHaveBeenCalledWith(true);
    });
  });
});
