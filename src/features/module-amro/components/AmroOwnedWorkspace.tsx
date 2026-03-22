import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { useAmroWorkspaceState } from '../hooks/useAmroWorkspaceState';
import type { AmroAuthorityLevel, AmroAssetType } from '../workspace/amroWorkspaceModel';

const assetTypeLabel: Record<AmroAssetType, string> = {
  aircraft: 'Aircraft',
  engine: 'Engine',
  serialized_component: 'Serialized Component',
  heavy_asset: 'Heavy Asset',
};

const authorityLabel: Record<AmroAuthorityLevel, string> = {
  technician: 'Technician',
  supervisor: 'Supervisor',
  engineering: 'Engineering',
  qa: 'QA',
  compliance: 'Compliance',
};

const authorityOptions: AmroAuthorityLevel[] = ['technician', 'supervisor', 'engineering', 'qa', 'compliance'];
const workPackageStatusFilters = ['all', 'planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'] as const;
const regulatorProfileOptions = ['FAA', 'EASA', 'CAAC'] as const;
const certificationAuthorityProfileOptions = ['FAA', 'EASA', 'CAAC'] as const;
const workspaceViewModes = ['kanban', 'card', 'grid', 'list'] as const;
const amroHeaderActionOrder = ['Search', 'Filter', 'View', 'Create', 'Refresh', 'Import/Export', 'Theme'] as const;

type AmroUxRole = 'technician' | 'engineer' | 'inspector' | 'planner' | 'management';

type AmroRoleVariant = {
  primaryViews: string;
  coreActions: string;
  restrictedActions: string;
};

const amroRoleVariants: Record<AmroUxRole, AmroRoleVariant> = {
  technician: {
    primaryViews: 'Task cards, assigned work package details',
    coreActions: 'Execute steps, capture evidence, request support',
    restrictedActions: 'Work package closure, compliance override',
  },
  engineer: {
    primaryViews: 'Work package detail, materials, schedule board',
    coreActions: 'Plan tasks, assign resources, adjust estimates',
    restrictedActions: 'Regulatory final sign-off',
  },
  inspector: {
    primaryViews: 'Compliance gate, audit timeline, evidence review',
    coreActions: 'Validate evidence, approve/reject tasks',
    restrictedActions: 'Parts allocation edits',
  },
  planner: {
    primaryViews: 'Work package list, scheduler board, capacity views',
    coreActions: 'Create/plan/schedule work packages',
    restrictedActions: 'Certifying release',
  },
  management: {
    primaryViews: 'Overview dashboards, SLA/compliance analytics',
    coreActions: 'Monitor KPIs, approve exceptions',
    restrictedActions: 'Direct task execution',
  },
};

export function AmroOwnedWorkspace() {
  const state = useAmroWorkspaceState();
  const [newWorkPackageTitle, setNewWorkPackageTitle] = useState('');
  const [savedViewName, setSavedViewName] = useState('');
  const [detailTab, setDetailTab] = useState('overview');
  const [detailDraft, setDetailDraft] = useState('');
  const [lastSavedDetailDraft, setLastSavedDetailDraft] = useState('');
  const [workspaceViewMode, setWorkspaceViewMode] = useState<(typeof workspaceViewModes)[number]>('kanban');
  const [closureConfirmOpen, setClosureConfirmOpen] = useState(false);
  const [closureRationale, setClosureRationale] = useState('');
  const [overrideConfirmOpen, setOverrideConfirmOpen] = useState(false);
  const [overrideRationale, setOverrideRationale] = useState('');
  const [deferralConfirmOpen, setDeferralConfirmOpen] = useState(false);
  const [deferralRationale, setDeferralRationale] = useState('');
  const hasUnsavedDetailChanges = detailDraft.trim() !== lastSavedDetailDraft.trim();
  const activeUxRole: AmroUxRole = state.activeRole === 'technician'
    ? 'technician'
    : state.activeRole === 'engineer'
      ? 'engineer'
      : state.activeRole === 'inspector'
        ? 'inspector'
        : state.activeRole === 'planner'
          ? 'planner'
          : 'management';
  const roleVariant = amroRoleVariants[activeUxRole];
  const selectedTask = state.selectedWorkPackage?.tasks?.[0] ?? null;
  const mobileQueuedEvents = Math.max(0, (state.selectedWorkPackage?.tasks?.filter((task) => !task.completed).length ?? 0) - 1);
  const canRunWorkPackageClosure = activeUxRole !== 'technician';
  const canRunComplianceOverride = activeUxRole !== 'technician';
  const canEditPartsAllocation = activeUxRole !== 'inspector';
  const canDirectTaskExecution = activeUxRole !== 'management';
  const canRunRegulatoryFinalSignOff = activeUxRole !== 'engineer';
  const canRunCertifyingRelease = activeUxRole !== 'planner';

  const handleCreateWorkPackage = async () => {
    const ok = await state.createWorkPackage(newWorkPackageTitle);
    if (ok) {
      setNewWorkPackageTitle('');
    }
  };

  const handleSaveCurrentView = async () => {
    const ok = await state.saveCurrentWorkPackageView(savedViewName);
    if (ok) {
      setSavedViewName('');
    }
  };

  const handlePersistDetailDraft = () => {
    setLastSavedDetailDraft(detailDraft);
  };

  const handleConfirmWorkPackageClosure = async () => {
    if (!closureRationale.trim()) return;
    await state.advanceWorkPackageLifecycle();
    setClosureConfirmOpen(false);
    setClosureRationale('');
  };

  const handleConfirmComplianceOverride = () => {
    if (!overrideRationale.trim()) return;
    setOverrideConfirmOpen(false);
    setOverrideRationale('');
  };

  const handleConfirmDeferral = async () => {
    if (!deferralRationale.trim()) return;
    await state.submitCertificationDecision('defer');
    setDeferralConfirmOpen(false);
    setDeferralRationale('');
  };

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedDetailChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  }, [hasUnsavedDetailChanges]);

  return (
    <section className="space-y-4">
      <Card data-amro-boundary="tenant-franchise-isolation">
        <CardHeader className="pb-2">
          <CardTitle>AMRO Bounded Context Boundary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="outline">Platform → Admin → Multi-Tenant → Multi-Franchisee</Badge>
          <Badge variant="outline">{state.isAmroAuthorized ? 'AMRO Authorized Context' : 'AMRO Authorization Required'}</Badge>
          <Badge variant={state.realtimeConnected ? 'secondary' : 'outline'}>
            {state.realtimeConnected ? 'Realtime Connected' : 'Realtime Disconnected'}
          </Badge>
        </CardContent>
      </Card>

      <Card data-amro-uiux-shell="ux-amro-architecture">
        <CardHeader className="pb-2">
          <CardTitle>AMRO UI/UX Unified Module Shell</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Header Controls</Badge>
            <Badge variant="outline">Workspace</Badge>
            <Badge variant="outline">Context Panel</Badge>
            <Badge variant="outline">Bottom Summary</Badge>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs font-semibold">Header Controls</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {amroHeaderActionOrder.map((action) => (
                <Badge key={action} variant="secondary">
                  {action}
                </Badge>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
              <Input value={state.workPackageSearch} onChange={(event) => state.setWorkPackageSearch(event.target.value)} placeholder="Search" />
              <Select value={state.workPackageStatusFilter} onValueChange={state.setWorkPackageStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  {workPackageStatusFilters.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={workspaceViewMode} onValueChange={(value) => setWorkspaceViewMode(value as (typeof workspaceViewModes)[number])}>
                <SelectTrigger>
                  <SelectValue placeholder="View" />
                </SelectTrigger>
                <SelectContent>
                  {workspaceViewModes.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreateWorkPackage} disabled={!newWorkPackageTitle.trim() || !state.canCreateWorkPackage}>
                Create
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <Button variant="outline" onClick={state.refreshWorkPackages} disabled={state.loadingWorkPackages}>
                {state.loadingWorkPackages ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button variant="outline">Import/Export</Button>
              <Button variant="outline">Theme</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr]">
            <div className="rounded-md border p-3">
              <p className="text-xs font-semibold">Workspace</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Active role: {activeUxRole}. Primary view set: {roleVariant.primaryViews}.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs font-semibold">Context Panel</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Audit feed, validation hints, and activity timeline are rendered through compliance replay and qualification status.
              </p>
            </div>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs font-semibold">Bottom Summary</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <div className="rounded-md border p-2">MTTR: 6.4h</div>
              <div className="rounded-md border p-2">Schedule Adherence: 93%</div>
              <div className="rounded-md border p-2">Compliance: {state.complianceCoverage.activePacks}/{state.complianceCoverage.totalPacks}</div>
              <div className="rounded-md border p-2">Parts Fill Rate: {Math.max(0, 100 - state.materialsSummary.shortageCount * 5)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-amro-uiux-shell="ux-amro-role-variants">
        <CardHeader className="pb-2">
          <CardTitle>AMRO Role-Based UX Variants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3 text-xs">
            <p className="font-semibold">Current Role Context</p>
            <p className="mt-1 text-muted-foreground">Role: {activeUxRole}</p>
            <p className="mt-1 text-muted-foreground">Core Actions: {roleVariant.coreActions}</p>
            <p className="mt-1 text-muted-foreground">Restricted Actions: {roleVariant.restrictedActions}</p>
          </div>
          <div className="space-y-2">
            {Object.entries(amroRoleVariants).map(([role, variant]) => (
              <div key={role} className="rounded-md border p-3 text-xs">
                <p className="font-semibold">{role}</p>
                <p className="mt-1 text-muted-foreground">Primary Views: {variant.primaryViews}</p>
                <p className="mt-1 text-muted-foreground">Core Actions: {variant.coreActions}</p>
                <p className="mt-1 text-muted-foreground">Restricted Actions: {variant.restrictedActions}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Button variant="outline" disabled={!canRunWorkPackageClosure} onClick={() => setClosureConfirmOpen(true)} aria-label="Run work package closure transition">
              Work Package Closure
            </Button>
            <Button variant="outline" disabled={!canRunComplianceOverride} onClick={() => setOverrideConfirmOpen(true)} aria-label="Run compliance override transition">
              Compliance Override
            </Button>
            <Button variant="outline" disabled={!canEditPartsAllocation}>
              Parts Allocation Edits
            </Button>
            <Button variant="outline" disabled={!canRunRegulatoryFinalSignOff}>
              Regulatory Final Sign-off
            </Button>
            <Button variant="outline" disabled={!canRunCertifyingRelease}>
              Certifying Release
            </Button>
            <Button variant="outline" disabled={!canDirectTaskExecution}>
              Direct Task Execution
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card data-amro-screen="ux-amro-001-overview-dashboard">
        <CardHeader className="pb-2">
          <CardTitle>Overview Dashboard (UX-AMRO-001)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <Button variant="outline" size="sm">Date Range</Button>
            <Button variant="outline" size="sm">Regulator</Button>
            <Button variant="outline" size="sm">Export</Button>
            <Button variant="outline" size="sm" onClick={state.refreshWorkPackages}>Refresh</Button>
            <Button variant="outline" size="sm">Theme</Button>
            <Badge variant="secondary" className="justify-center">View: {workspaceViewMode}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <div className="rounded-md border p-2 text-xs">Open WPs: {state.workPackages.length}</div>
            <div className="rounded-md border p-2 text-xs">In Progress: {state.workPackages.filter((wp) => wp.lifecycleStage === 'execute').length}</div>
            <div className="rounded-md border p-2 text-xs">Deferred: {state.materialsSummary.pendingReservations}</div>
            <div className="rounded-md border p-2 text-xs">Compliance Risk: {state.complianceAnomalyAlerts.length}</div>
            <div className="rounded-md border p-2 text-xs">AOG Count: {state.materialsSummary.shortageCount}</div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-md border p-2 text-xs">
              Pipeline Snapshot: planning/scheduled/in_progress with blocked counters from lifecycle + shortage signals.
            </div>
            <div className="rounded-md border p-2 text-xs">
              Forecast and Reliability Signals: recommendations {state.predictiveSummary.totalRecommendations}, high risk {state.predictiveSummary.highRisk}.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <div className="rounded-md border p-2">MTTR 6.4h</div>
            <div className="rounded-md border p-2">Schedule Adherence 93%</div>
            <div className="rounded-md border p-2">Compliance 98%</div>
            <div className="rounded-md border p-2">Parts Fill Rate {Math.max(0, 100 - state.materialsSummary.shortageCount * 5)}%</div>
          </div>
        </CardContent>
      </Card>

      <Card data-amro-owned-surface="asset-registry-configuration-state">
        <CardHeader className="pb-2">
          <CardTitle>Asset Registry and Configuration State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.assets.map((asset) => (
            <div key={asset.id} className="rounded-md border p-2 text-sm">
              <p className="font-medium">{asset.assetTag}</p>
              <p className="text-xs text-muted-foreground">
                {assetTypeLabel[asset.assetType]} · {asset.serialNumber}
              </p>
              <p className="text-xs text-muted-foreground">{asset.configurationState}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-amro-owned-surface="work-package-task-lifecycle-orchestration">
        <CardHeader className="pb-2">
          <CardTitle>Work Package and Task Lifecycle Orchestration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3" data-amro-screen="ux-amro-003-work-package-list">
            <p className="text-sm font-semibold">Work Package List (UX-AMRO-003)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Columns: WO# | Aircraft | Priority | Type | Station | Due | Status | Owner
            </p>
            <div className="mt-2 space-y-2">
              {state.workPackages.map((workPackage) => (
                <div key={`list-${workPackage.id}`} className="rounded-md border p-2 text-xs">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-8">
                    <span>{workPackage.packageNumber}</span>
                    <span>{workPackage.assetId}</span>
                    <span>normal</span>
                    <span>line</span>
                    <span>{state.scheduleBoardRows.find((row) => row.work_package_id === workPackage.id)?.station_code || 'N/A'}</span>
                    <span>{state.scheduleBoardRows.find((row) => row.work_package_id === workPackage.id)?.slot_end || 'TBD'}</span>
                    <span>{workPackage.lifecycleStage}</span>
                    <span>{activeUxRole}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" aria-label={`Open work package ${workPackage.packageNumber}`}>Open</Button>
                    <Button variant="outline" size="sm" aria-label={`Schedule work package ${workPackage.packageNumber}`}>Schedule</Button>
                    <Button variant="outline" size="sm" aria-label={`Hold work package ${workPackage.packageNumber}`}>Hold</Button>
                    <Button variant="outline" size="sm" aria-label={`Clone work package ${workPackage.packageNumber}`}>Clone</Button>
                    <Button variant="outline" size="sm" aria-label={`Export work package ${workPackage.packageNumber}`}>Export</Button>
                    <Button variant="outline" size="sm" aria-label={`Drag handle for ${workPackage.packageNumber}`}>
                      Drag Handle
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm">Assign</Button>
              <Button variant="outline" size="sm">Shift Window</Button>
              <Button variant="outline" size="sm" disabled={!canEditPartsAllocation}>Material Reserve</Button>
              <Button variant="outline" size="sm">Compliance Precheck</Button>
            </div>
          </div>
          {state.workPackagesError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {state.workPackagesError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              value={newWorkPackageTitle}
              onChange={(event) => setNewWorkPackageTitle(event.target.value)}
              placeholder="New work package title"
            />
            <Button onClick={handleCreateWorkPackage} disabled={!newWorkPackageTitle.trim() || !state.canCreateWorkPackage}>
              Create Work Package
            </Button>
            <Button variant="outline" onClick={state.refreshWorkPackages} disabled={state.loadingWorkPackages}>
              {state.loadingWorkPackages ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>Status Filter</Label>
              <Select value={state.workPackageStatusFilter} onValueChange={state.setWorkPackageStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workPackageStatusFilters.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Search</Label>
              <Input value={state.workPackageSearch} onChange={(event) => state.setWorkPackageSearch(event.target.value)} placeholder="Search code or id" />
            </div>
            <div className="space-y-1">
              <Label>Saved View</Label>
              <Select value={state.selectedSavedViewId} onValueChange={state.setSelectedSavedViewId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.savedWorkPackageViews.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Save Current View</Label>
              <div className="flex gap-2">
                <Input value={savedViewName} onChange={(event) => setSavedViewName(event.target.value)} placeholder="View name" />
                <Button variant="outline" onClick={handleSaveCurrentView} disabled={!savedViewName.trim()}>
                  Save
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Work Package</Label>
              <Select value={state.selectedWorkPackageId} onValueChange={state.setSelectedWorkPackageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select work package" />
                </SelectTrigger>
                <SelectContent>
                  {state.workPackages.map((workPackage) => (
                    <SelectItem key={workPackage.id} value={workPackage.id}>
                      {workPackage.packageNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Lifecycle Stage</p>
              <p className="text-sm font-medium">{state.selectedWorkPackage?.lifecycleStage ?? 'N/A'}</p>
            </div>
            <div className="flex items-center">
              <Button onClick={state.advanceWorkPackageLifecycle} disabled={!state.canAdvanceLifecycle}>
                Advance Stage
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Role: {state.activeRole}</Badge>
            <Badge variant={state.canCreateWorkPackage ? 'secondary' : 'outline'}>
              {state.canCreateWorkPackage ? 'Create Allowed' : 'Create Restricted'}
            </Badge>
            <Badge variant={state.canDeleteWorkPackage ? 'secondary' : 'outline'}>
              {state.canDeleteWorkPackage ? 'Delete Allowed' : 'Delete Restricted'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              onClick={state.deleteSelectedWorkPackage}
              disabled={!state.selectedWorkPackageId || !state.canDeleteWorkPackage}
            >
              Delete Selected
            </Button>
          </div>
          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-2">
              <div className="rounded-md border p-2 text-xs" data-amro-screen="ux-amro-005-work-package-detail">
                <p className="font-medium">Work Package Detail (UX-AMRO-005)</p>
                <p className="mt-1 text-muted-foreground">
                  Sticky actions: Assign | Schedule | Gate Check | Close
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" aria-label="Assign work package">Assign</Button>
                  <Button variant="outline" size="sm" aria-label="Schedule work package">Schedule</Button>
                  <Button variant="outline" size="sm" aria-label="Run compliance gate check">Gate Check</Button>
                  <Button size="sm" disabled={!canRunWorkPackageClosure} onClick={() => setClosureConfirmOpen(true)} aria-label="Close work package with confirmation">
                    Close
                  </Button>
                </div>
              </div>
              <div className="rounded-md border p-2 text-xs">
                <p className="font-medium">Detail Draft</p>
                <Textarea
                  value={detailDraft}
                  onChange={(event) => setDetailDraft(event.target.value)}
                  placeholder="Enter work package detail notes"
                  className="mt-2 min-h-[96px]"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="outline" onClick={handlePersistDetailDraft} disabled={!hasUnsavedDetailChanges}>
                    Save Draft
                  </Button>
                  <Badge variant={hasUnsavedDetailChanges ? 'destructive' : 'secondary'}>
                    {hasUnsavedDetailChanges ? 'Unsaved Changes' : 'All Changes Saved'}
                  </Badge>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="tasks" className="space-y-2">
              {(state.selectedWorkPackage?.tasks ?? []).map((task) => (
                <div key={task.id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.lifecycleStage} · {task.assignedRole}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => state.updateTaskExecutionStatus(task.id, 'start')} aria-label={`Start task ${task.id}`}>
                      Start
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => state.updateTaskExecutionStatus(task.id, 'complete')} aria-label={`Complete task ${task.id}`}>
                      Complete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => state.updateTaskExecutionStatus(task.id, 'block')} aria-label={`Block task ${task.id}`}>
                      Block
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => state.uploadTaskEvidence(task.id)} aria-label={`Upload evidence for task ${task.id}`}>
                      Bind Evidence
                    </Button>
                    <Button size="sm" onClick={() => state.submitTaskSignature(task.id)} disabled={!state.canSignOff} aria-label={`Submit signature for task ${task.id}`}>
                      E-Sign
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="materials" className="space-y-2">
              {state.materials.map((material) => (
                <div key={`detail-material-${material.id}`} className="rounded-md border p-2 text-xs">
                  <p className="font-medium">{material.partNumber}</p>
                  <p className="text-muted-foreground">
                    Required/Allocated status: {material.reservationStatus} · shortage: {material.shortageSeverity}
                  </p>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="compliance" className="space-y-2">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Regulator Profile</Label>
                  <Select
                    value={state.selectedRegulatorProfile}
                    onValueChange={(value) => state.setSelectedRegulatorProfile(value as 'FAA' | 'EASA' | 'CAAC')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {regulatorProfileOptions.map((profile) => (
                        <SelectItem key={profile} value={profile}>
                          {profile}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border p-2">Rule Packs: {state.complianceCoverage.totalPacks}</div>
                <div className="rounded-md border p-2">Active Packs: {state.complianceCoverage.activePacks}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={state.ingestAdSbObligations} disabled={!state.selectedWorkPackageId}>
                  Ingest AD/SB
                </Button>
                <Button variant="outline" size="sm" onClick={state.evaluateMelCdlDeferral} disabled={!state.selectedWorkPackageId}>
                  Evaluate MEL/CDL
                </Button>
                <Button variant="outline" size="sm" onClick={state.loadComplianceGateExplainability} disabled={!state.selectedWorkPackageId}>
                  Open Gate Modal
                </Button>
                <Button variant="outline" size="sm" onClick={state.loadAuditReplayTimeline}>
                  Load Audit Replay
                </Button>
                <Button variant="outline" size="sm" onClick={state.detectComplianceAnomalies}>
                  Detect Anomalies
                </Button>
                <Button variant="outline" size="sm" onClick={state.loadRegulatorProfilePack}>
                  Load Profile Pack
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="rounded-md border p-2 text-xs">
                  AD/SB Mapping: {state.obligationIngestionSummary ? `${state.obligationIngestionSummary.total} total` : 'not loaded'}
                </div>
                <div className="rounded-md border p-2 text-xs">
                  Deferral Decision: {state.deferralDecision?.decision || 'not evaluated'}
                </div>
                <div className="rounded-md border p-2 text-xs">
                  Audit Replay Events: {state.complianceAuditReplay?.eventCount || 0}
                </div>
                <div className="rounded-md border p-2 text-xs">
                  Anomaly Alerts: {state.complianceAnomalyAlerts.length}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {state.complianceCoverage.authorityCoverage.map((authority) => (
                  <Badge key={authority} variant="outline">
                    {authority}
                  </Badge>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="notes" className="space-y-2">
              <Textarea
                value={detailDraft}
                onChange={(event) => setDetailDraft(event.target.value)}
                placeholder="Operational notes and escalation context"
                className="min-h-[96px]"
              />
            </TabsContent>
            <TabsContent value="attachments" className="space-y-2">
              <div className="rounded-md border p-2 text-xs">Attachment tray for evidence packets and signed forms.</div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card data-amro-screen="ux-amro-007-mobile-execution-card">
        <CardHeader className="pb-2">
          <CardTitle>Mobile Execution Card (UX-AMRO-007/008/009)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3 text-sm">
            <p className="font-semibold">
              Task {selectedTask ? selectedTask.id : 'N/A'} [{selectedTask?.lifecycleStage || 'pending'}]
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Procedure: ATA 32-41-00</p>
            <div className="mt-2 space-y-1 text-xs">
              <p>[ ] Step 1</p>
              <p>[ ] Step 2</p>
              <p>[ ] Step 3</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline">Photo</Button>
              <Button size="sm" variant="outline">Video</Button>
              <Button size="sm" variant="outline">Note</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline">PIN</Button>
              <Button size="sm" variant="outline">Digital Cert</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Offline Sync Status: {mobileQueuedEvents > 0 ? 'Queued events pending upload' : 'All events synced'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-11 min-w-[120px]" aria-label="Capture photo evidence">Photo</Button>
              <Button size="sm" variant="outline" className="h-11 min-w-[120px]" aria-label="Capture video evidence">Video</Button>
              <Button size="sm" variant="outline" className="h-11 min-w-[120px]" aria-label="Add note evidence">Note</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-11 min-w-[120px]" aria-label="Sign using PIN">PIN</Button>
              <Button size="sm" variant="outline" className="h-11 min-w-[120px]" aria-label="Sign using digital certificate">Digital Cert</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Sync Queue: {mobileQueuedEvents} queued events</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-11 min-w-[140px]" aria-label="Save signed task event to offline queue">Save Offline</Button>
              <Button size="sm" disabled={!canDirectTaskExecution} className="h-11 min-w-[140px]" aria-label="Submit task actions">Submit</Button>
              <Button size="sm" variant="outline" className="h-11 min-w-[140px]" aria-label="Request execution support">Request Support</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-amro-owned-surface="scheduling-board-slot-timeline">
        <CardHeader className="pb-2">
          <CardTitle>Scheduling Board and Slot Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={state.assignSelectedWorkPackageToNextSlot}
              disabled={!state.selectedWorkPackageId}
            >
              Assign Next Slot
            </Button>
            <Button variant="outline" onClick={state.fetchScheduleOptimizationRecommendations}>
              Refresh Optimization Recommendations
            </Button>
          </div>
          <div className="space-y-2">
            {state.scheduleBoardRows.length === 0 ? (
              <div className="rounded-md border p-2 text-xs text-muted-foreground">No schedule rows available.</div>
            ) : (
              state.scheduleBoardRows.map((row) => (
                <div key={row.schedule_id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{row.schedule_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.work_package_id} · {row.station_code}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.slot_start).toLocaleString()} → {new Date(row.slot_end).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Team {row.assigned_team_size} / Capacity {row.capacity} · {row.status}
                  </p>
                  <div className="mt-2">
                    <Button
                      variant="secondary"
                      onClick={() => state.acknowledgeScheduleUpdate(row.schedule_id, row.work_package_id)}
                    >
                      Acknowledge Schedule Update
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="space-y-2">
            {state.scheduleOptimizationRecommendations.map((item) => (
              <div key={item.recommendation_id} className="rounded-md border p-2 text-xs">
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground">
                  {item.station_code} · {item.schedule_date}
                </p>
                <p className="text-muted-foreground">
                  Delay reduction {item.expected_delay_reduction_pct}% · Confidence {item.confidence}
                </p>
                <p className="text-muted-foreground">{item.rationale}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-amro-owned-surface="qualification-authority-validation" data-amro-boundary="signoff-authority-control">
        <CardHeader className="pb-2">
          <CardTitle>Qualification and Authority Validation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Certifying Staff</Label>
              <Select value={state.selectedQualificationId} onValueChange={state.setSelectedQualificationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.qualifications.map((qualification) => (
                    <SelectItem key={qualification.id} value={qualification.id}>
                      {qualification.staffName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Required Sign-off Authority</Label>
              <Select
                value={state.requiredAuthority}
                onValueChange={(value) => state.setRequiredAuthority(value as AmroAuthorityLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {authorityOptions.map((authority) => (
                    <SelectItem key={authority} value={authority}>
                      {authorityLabel[authority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Badge variant={state.canSignOff ? 'secondary' : 'destructive'}>
            {state.canSignOff ? 'Sign-off Authority Validated' : 'Sign-off Authority Not Satisfied'}
          </Badge>
        </CardContent>
      </Card>

      <Card data-amro-owned-surface="certification-management-workflow">
        <CardHeader className="pb-2">
          <CardTitle>Certification Management and Authority Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Authority Profile Template</Label>
              <Select
                value={state.selectedCertificationAuthorityProfile}
                onValueChange={(value) => state.setSelectedCertificationAuthorityProfile(value as 'FAA' | 'EASA' | 'CAAC')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {certificationAuthorityProfileOptions.map((profile) => (
                    <SelectItem key={profile} value={profile}>
                      {profile}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Selected Certifier</Label>
              <div className="rounded-md border p-2 text-sm">
                {state.selectedQualification ? state.selectedQualification.staffName : 'No certifier selected'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                state.qualificationStatusIndicator?.lifecycle === 'active'
                  ? 'secondary'
                  : state.qualificationStatusIndicator?.lifecycle === 'warning'
                    ? 'outline'
                    : 'destructive'
              }
            >
              Qualification {state.qualificationStatusIndicator?.lifecycle || 'unknown'}
            </Badge>
            <Badge variant={state.certifyingPrivilegeValidated ? 'secondary' : 'outline'}>
              {state.certifyingPrivilegeValidated ? 'Certifying Privilege Valid' : 'Certifying Privilege Unverified'}
            </Badge>
            <Badge variant="outline">
              Days to Expiry {state.qualificationStatusIndicator?.daysUntilExpiry ?? 'n/a'}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={state.validateCertifyingPrivilege}>
              Validate Privilege
            </Button>
            <Button size="sm" onClick={() => state.submitCertificationDecision('approve')} disabled={!state.selectedWorkPackageId}>
              Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => state.submitCertificationDecision('reject')} disabled={!state.selectedWorkPackageId}>
              Reject
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeferralConfirmOpen(true)} disabled={!state.selectedWorkPackageId} aria-label="Defer certification decision with rationale">
              Defer
            </Button>
            <Button variant="outline" size="sm" onClick={state.runExpiryWarningAndSuspension}>
              Run Expiry Automation
            </Button>
            <Button variant="outline" size="sm" onClick={state.loadCompetencyAnalyticsDashboard}>
              Load Competency Analytics
            </Button>
            <Button variant="outline" size="sm" onClick={state.loadAuthorityCertificationTemplate}>
              Load Authority Template
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-md border p-2 text-xs">
              Decision Status: {state.latestCertificationDecision?.actionStatus || 'not submitted'}
            </div>
            <div className="rounded-md border p-2 text-xs">
              Next Action: {state.latestCertificationDecision?.nextAction || 'none'}
            </div>
            <div className="rounded-md border p-2 text-xs">
              Blockers: {state.latestCertificationDecision?.blockers.length || 0}
            </div>
            <div className="rounded-md border p-2 text-xs">
              Expiry Warnings: {state.expiryAutomationSummary?.warningCount || 0}
            </div>
            <div className="rounded-md border p-2 text-xs">
              Suspensions: {state.expiryAutomationSummary?.suspensionCount || 0}
            </div>
            <div className="rounded-md border p-2 text-xs">
              Qualified Staff: {state.competencyAnalytics?.totalQualifiedStaff || 0}
            </div>
          </div>
          {state.competencyAnalytics ? (
            <div className="space-y-1 rounded-md border p-2 text-xs">
              <p className="font-medium">Competency Analytics Dashboard</p>
              <div className="grid grid-cols-2 gap-2">
                <div>Active Certifiers: {state.competencyAnalytics.activeCertifiers}</div>
                <div>Warning Window: {state.competencyAnalytics.warningWindowStaff}</div>
                <div>Suspended Certifiers: {state.competencyAnalytics.suspendedCertifiers}</div>
                <div>Authority Bands: {Object.keys(state.competencyAnalytics.authorityDistribution).length}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(state.competencyAnalytics.authorityDistribution).map(([authority, count]) => (
                  <Badge key={authority} variant="outline">
                    {authority}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {state.authorityCertificationTemplate ? (
            <div className="space-y-1 rounded-md border p-2 text-xs">
              <p className="font-medium">
                {state.authorityCertificationTemplate.templateId} · {state.authorityCertificationTemplate.authorityProfile}
              </p>
              <p className="text-muted-foreground">
                Max Defer Days: {state.authorityCertificationTemplate.deferMaxDays}
              </p>
              <div>
                <p className="font-medium">Required Signatures</p>
                <div className="flex flex-wrap gap-1">
                  {state.authorityCertificationTemplate.requiredSignatures.map((signature) => (
                    <Badge key={signature} variant="outline">
                      {signature}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium">Mandatory Checks</p>
                <div className="flex flex-wrap gap-1">
                  {state.authorityCertificationTemplate.mandatoryChecks.map((check) => (
                    <Badge key={check} variant="outline">
                      {check}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card data-amro-owned-surface="compliance-evidence-controls" data-amro-boundary="immutable-evidence-chain">
        <CardHeader className="pb-2">
          <CardTitle>Compliance and Evidence Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border p-2">Rule Packs: {state.complianceCoverage.totalPacks}</div>
            <div className="rounded-md border p-2">Active Packs: {state.complianceCoverage.activePacks}</div>
          </div>
          <div className="rounded-md border p-2 text-xs">
            Regulator Pack: {state.regulatorProfilePack ? `${state.regulatorProfilePack.regulatorProfile} loaded` : 'not loaded'}
          </div>
          {state.regulatorProfilePack ? (
            <div className="space-y-1 rounded-md border p-2 text-xs">
              <p className="font-medium">Gate Rules</p>
              {state.regulatorProfilePack.gateRules.map((rule) => (
                <p key={rule} className="text-muted-foreground">{rule}</p>
              ))}
            </div>
          ) : null}
          {state.complianceAuditReplay ? (
            <div className="space-y-1 rounded-md border p-2 text-xs">
              <p className="font-medium">Audit Replay Timeline</p>
              {state.complianceAuditReplay.events.slice(0, 5).map((event) => (
                <p key={`${event.recordId}-${event.sequence}`} className="text-muted-foreground">
                  {event.sequence}. {event.action} · {new Date(event.createdAt).toLocaleString()}
                </p>
              ))}
            </div>
          ) : null}
          {state.complianceAnomalyAlerts.length > 0 ? (
            <div className="space-y-1 rounded-md border p-2 text-xs">
              <p className="font-medium">Anomaly Alerts</p>
              {state.complianceAnomalyAlerts.map((alert) => (
                <p key={alert.code} className="text-muted-foreground">
                  {alert.severity.toUpperCase()} · {alert.code} · {alert.metric}
                </p>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {state.complianceCoverage.authorityCoverage.map((authority) => (
              <Badge key={authority} variant="outline">
                {authority}
              </Badge>
            ))}
          </div>
          {state.evidenceChain.map((evidence) => (
            <div key={evidence.id} className="rounded-md border p-2 text-xs">
              <p className="font-medium">{evidence.entityType} · {evidence.entityId}</p>
              <p className="text-muted-foreground">{evidence.hash}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card data-amro-owned-surface="materials-repair-loop-orchestration">
          <CardHeader className="pb-2">
            <CardTitle>Materials Planning and Repair Loop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">Shortages: {state.materialsSummary.shortageCount}</div>
              <div className="rounded-md border p-2">Pending Reservations: {state.materialsSummary.pendingReservations}</div>
              <div className="rounded-md border p-2">ETA At Risk: {state.materialsSummary.atRiskEtaCount}</div>
              <div className="rounded-md border p-2">LLP Alerts: {state.materialsSummary.llpAlertCount}</div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button variant="outline" onClick={state.reservePartsAllocationForSelectedWorkPackage} disabled={!state.selectedWorkPackageId}>
                Build Allocation
              </Button>
              <Button variant="outline" onClick={state.processCriticalShortageResponse} disabled={state.materialsSummary.shortageCount === 0}>
                Process Shortage
              </Button>
              <Button variant="outline" onClick={state.runInventoryOptimizationModel} disabled={!state.selectedWorkPackageId}>
                Run Optimization
              </Button>
              <Button variant="outline" onClick={state.syncSupplierAsnAndErpProcurement}>
                Sync ASN + ERP
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="rounded-md border p-2">
                Optimization Run: {state.lastInventoryOptimizationRunId || 'Not started'}
              </div>
              <div className="rounded-md border p-2">
                Procurement Sync: {state.lastProcurementSyncId || 'Not started'}
              </div>
            </div>
            {state.materials.map((material) => (
              <div key={material.id} className="space-y-2 rounded-md border p-2 text-xs">
                <p className="font-medium">{material.partNumber}</p>
                <p className="text-muted-foreground">
                  {material.reservationStatus} · {material.repairAction}
                </p>
                <p className="text-muted-foreground">
                  ETA {material.etaStatus} · Shortage {material.shortageSeverity}
                </p>
                <p className="text-muted-foreground">
                  Rotable {material.rotableStatus} · LLP {material.llpRemainingCycles} cycles · Traceability {material.traceabilityStatus}
                </p>
                <div>
                  <Button variant="secondary" size="sm" onClick={() => state.applyRotableLlpTraceability(material.id)}>
                    Trace Rotable/LLP
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-amro-owned-surface="predictive-maintenance-digital-twin">
          <CardHeader className="pb-2">
            <CardTitle>Predictive Maintenance and Digital Twin Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">High Risk: {state.predictiveSummary.highRisk}</div>
              <div className="rounded-md border p-2">Telemetry Triggers: {state.predictiveSummary.telemetryTriggers}</div>
              <div className="rounded-md border p-2">Avg Risk: {state.predictiveSummary.averageRisk}</div>
              <div className="rounded-md border p-2">Recommendations: {state.predictiveSummary.totalRecommendations}</div>
            </div>
            {state.predictiveRecommendations.map((recommendation) => (
              <div key={recommendation.id} className="rounded-md border p-2 text-xs">
                <p className="font-medium">{recommendation.digitalTwinReference}</p>
                <p className="text-muted-foreground">Risk {recommendation.riskScore} · {recommendation.trigger}</p>
                <p className="text-muted-foreground">{recommendation.recommendation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Dialog open={state.complianceGateModalOpen} onOpenChange={state.setComplianceGateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compliance Gate Modal</DialogTitle>
          </DialogHeader>
          {state.complianceExplainability ? (
            <div className="space-y-2 text-sm">
              <div className="rounded-md border p-2">
                Decision: {state.complianceExplainability.decision.toUpperCase()} · Blockers: {state.complianceExplainability.blockerCount}
              </div>
              <div className="rounded-md border p-2 text-xs">
                Policy Snapshot: {state.complianceExplainability.policyVersion}
              </div>
              <div className="space-y-1 rounded-md border p-2 text-xs">
                <p className="font-medium">Explainability Panel</p>
                {state.complianceExplainability.blockers.length > 0 ? (
                  state.complianceExplainability.blockers.map((blocker) => (
                    <p key={blocker} className="text-muted-foreground">{blocker}</p>
                  ))
                ) : (
                  <p className="text-muted-foreground">No blockers detected.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No explainability data loaded.</div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={closureConfirmOpen} onOpenChange={setClosureConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Work Package Closure</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Closure requires explicit rationale and acknowledgement.</p>
            <Textarea
              value={closureRationale}
              onChange={(event) => setClosureRationale(event.target.value)}
              placeholder="Enter closure rationale"
              aria-label="Closure rationale"
              className="min-h-[96px]"
            />
            <Button onClick={() => void handleConfirmWorkPackageClosure()} disabled={!closureRationale.trim()} aria-label="Confirm closure with rationale">
              Confirm Closure
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={overrideConfirmOpen} onOpenChange={setOverrideConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Compliance Override</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Compliance override requires documented rationale.</p>
            <Textarea
              value={overrideRationale}
              onChange={(event) => setOverrideRationale(event.target.value)}
              placeholder="Enter override rationale"
              aria-label="Compliance override rationale"
              className="min-h-[96px]"
            />
            <Button onClick={handleConfirmComplianceOverride} disabled={!overrideRationale.trim()} aria-label="Confirm compliance override">
              Confirm Override
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deferralConfirmOpen} onOpenChange={setDeferralConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Certification Deferral</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Deferral requires rationale before submission.</p>
            <Textarea
              value={deferralRationale}
              onChange={(event) => setDeferralRationale(event.target.value)}
              placeholder="Enter deferral rationale"
              aria-label="Certification deferral rationale"
              className="min-h-[96px]"
            />
            <Button onClick={() => void handleConfirmDeferral()} disabled={!deferralRationale.trim()} aria-label="Confirm certification deferral">
              Confirm Deferral
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Separator />
    </section>
  );
}
