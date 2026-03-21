import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
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

export function AmroOwnedWorkspace() {
  const state = useAmroWorkspaceState();
  const [newWorkPackageTitle, setNewWorkPackageTitle] = useState('');

  const handleCreateWorkPackage = async () => {
    const ok = await state.createWorkPackage(newWorkPackageTitle);
    if (ok) {
      setNewWorkPackageTitle('');
    }
  };

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
            <Button onClick={handleCreateWorkPackage} disabled={!newWorkPackageTitle.trim()}>
              Create Work Package
            </Button>
            <Button variant="outline" onClick={state.refreshWorkPackages} disabled={state.loadingWorkPackages}>
              {state.loadingWorkPackages ? 'Refreshing...' : 'Refresh'}
            </Button>
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
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              onClick={state.deleteSelectedWorkPackage}
              disabled={!state.selectedWorkPackageId}
            >
              Delete Selected
            </Button>
          </div>
          <div className="space-y-2">
            {(state.selectedWorkPackage?.tasks ?? []).map((task) => (
              <div key={task.id} className="rounded-md border p-2 text-sm">
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.lifecycleStage} · {task.assignedRole}
                </p>
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

      <Card data-amro-owned-surface="compliance-evidence-controls" data-amro-boundary="immutable-evidence-chain">
        <CardHeader className="pb-2">
          <CardTitle>Compliance and Evidence Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border p-2">Rule Packs: {state.complianceCoverage.totalPacks}</div>
            <div className="rounded-md border p-2">Active Packs: {state.complianceCoverage.activePacks}</div>
          </div>
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
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">Shortages: {state.materialsSummary.shortageCount}</div>
              <div className="rounded-md border p-2">Pending Reservations: {state.materialsSummary.pendingReservations}</div>
            </div>
            {state.materials.map((material) => (
              <div key={material.id} className="rounded-md border p-2 text-xs">
                <p className="font-medium">{material.partNumber}</p>
                <p className="text-muted-foreground">
                  {material.reservationStatus} · {material.repairAction}
                </p>
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
      <Separator />
    </section>
  );
}
