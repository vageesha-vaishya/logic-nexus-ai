import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useLogisticsWorkspaceState } from '../hooks/useLogisticsWorkspaceState';
import type { LogisticsLegDraft, LogisticsTransportMode } from '../workspace/logisticsWorkspaceModel';

function humanizeMode(mode: LogisticsTransportMode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function humanizeTrackingEvent(type: string) {
  return type
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function FederatedReferenceWidget({
  title,
  value,
  integrityState,
}: {
  title: string;
  value: string;
  integrityState: string;
}) {
  return (
    <Card data-federated-widget-readonly="true" className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input value={value} readOnly aria-readonly />
        <Badge variant="secondary">{integrityState}</Badge>
      </CardContent>
    </Card>
  );
}

function LogisticsLegEditor({
  leg,
  errorFields,
  onChange,
  onSave,
}: {
  leg: LogisticsLegDraft;
  errorFields: string[];
  onChange: (field: keyof LogisticsLegDraft, value: string) => void;
  onSave: () => void;
}) {
  const modeSpecificFields: Record<LogisticsTransportMode, Array<keyof LogisticsLegDraft>> = {
    ocean: ['vesselName', 'voyageNumber'],
    air: ['flightNumber'],
    trucking: ['truckReference'],
    rail: ['railServiceCode'],
  };
  return (
    <Card data-leg-editor-mode={leg.mode}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{humanizeMode(leg.mode)} Leg</span>
          <Badge variant={errorFields.length ? 'destructive' : 'secondary'}>
            {errorFields.length ? 'Validation Required' : 'Ready'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Origin</Label>
            <Input value={leg.origin} onChange={(event) => onChange('origin', event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Destination</Label>
            <Input value={leg.destination} onChange={(event) => onChange('destination', event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Carrier</Label>
            <Input value={leg.carrier} onChange={(event) => onChange('carrier', event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Departure</Label>
            <Input value={leg.departureAt} onChange={(event) => onChange('departureAt', event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Arrival</Label>
            <Input value={leg.arrivalAt} onChange={(event) => onChange('arrivalAt', event.target.value)} />
          </div>
          {modeSpecificFields[leg.mode].map((fieldKey) => (
            <div key={fieldKey} className="space-y-1">
              <Label>{fieldKey}</Label>
              <Input value={leg[fieldKey]} onChange={(event) => onChange(fieldKey, event.target.value)} />
            </div>
          ))}
        </div>
        {errorFields.length > 0 ? <p className="text-xs text-red-600">Missing: {errorFields.join(', ')}</p> : null}
        <Button type="button" onClick={onSave} size="sm">
          Save Leg
        </Button>
      </CardContent>
    </Card>
  );
}

export function LogisticsOwnedWorkspace() {
  const state = useLogisticsWorkspaceState();
  return (
    <section className="space-y-4" data-logistics-owned-surface="shipment-workspace">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Shipment Workspace</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Shipment</Label>
            <Select value={state.selectedShipmentId} onValueChange={state.setSelectedShipmentId} disabled={state.loadingShipments}>
              <SelectTrigger>
                <SelectValue placeholder="Select shipment" />
              </SelectTrigger>
              <SelectContent>
                {state.shipments.map((shipment) => (
                  <SelectItem key={shipment.id} value={shipment.id}>
                    {shipment.shipmentNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Franchise Filter</Label>
            <Select value={state.franchiseFilter} onValueChange={state.setFranchiseFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Franchises</SelectItem>
                {state.availableFranchises.map((franchiseId) => (
                  <SelectItem key={franchiseId} value={franchiseId}>
                    {franchiseId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Container Metadata</div>
            <div className="mt-1 text-sm font-medium">{state.selectedShipment?.containerNumber || 'Not available'}</div>
            <div className="text-xs text-muted-foreground">{state.selectedShipment?.containerType || 'Container type not set'}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card data-logistics-owned-surface="route-planning-board">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>Route Planning Board</span>
              <Badge variant={state.routeValidationSummary.invalid ? 'destructive' : 'secondary'}>
                {state.routeValidationSummary.valid}/{state.routeValidationSummary.total} valid
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.legs.map((leg) => (
              <LogisticsLegEditor
                key={leg.id}
                leg={leg}
                errorFields={state.legErrors[leg.id] || []}
                onChange={(field, value) => state.updateLegField(leg.id, field, value)}
                onSave={() => state.saveLeg(leg.id)}
              />
            ))}
          </CardContent>
        </Card>

        <Card data-logistics-owned-surface="tracking-timelines">
          <CardHeader className="pb-2">
            <CardTitle>Tracking Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.trackingLoading ? <p className="text-sm text-muted-foreground">Streaming updates...</p> : null}
            {state.trackingEvents.length === 0 ? <p className="text-sm text-muted-foreground">No events for current filter</p> : null}
            {state.trackingEvents.map((event) => (
              <div key={event.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{humanizeTrackingEvent(event.eventType)}</div>
                  <Badge variant="outline">{event.franchiseId || 'Global'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(event.eventDate).toLocaleString()}</p>
                {event.locationName ? <p className="text-xs">{event.locationName}</p> : null}
                {event.description ? <p className="text-xs text-muted-foreground">{event.description}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card data-logistics-owned-surface="operational-exception-panels">
          <CardHeader className="pb-2">
            <CardTitle>Operational Exception Panels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.exceptions.map((exceptionItem) => (
              <div key={exceptionItem.id} className="flex items-center justify-between rounded-md border p-2">
                <div>
                  <p className="text-sm font-medium">{exceptionItem.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {exceptionItem.severity} · {exceptionItem.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{state.actionState[exceptionItem.id] || 'idle'}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => state.resolveException(exceptionItem.id)}>
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-operator-console="logistics-only">
          <CardHeader className="pb-2">
            <CardTitle>Carrier Connector Operator Console</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.diagnostics.map((diagnostic) => (
              <div key={diagnostic.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{diagnostic.connector}</p>
                  <Badge variant="outline">{diagnostic.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pending jobs {diagnostic.pendingJobs} · Retries {diagnostic.retryAttempts}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary">{state.actionState[diagnostic.id] || 'idle'}</Badge>
                  <Button size="sm" onClick={() => state.retryCarrierConnector(diagnostic.id)}>
                    Retry Connector
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FederatedReferenceWidget title="Pricing Reference" value="Rate card snapshot · Read only" integrityState="Federated Read-Only" />
        <FederatedReferenceWidget title="Compliance Reference" value="Screening profile status · Read only" integrityState="Federated Read-Only" />
        <FederatedReferenceWidget title="Finance Reference" value="Margin exposure pointer · Read only" integrityState="Federated Read-Only" />
      </div>
    </section>
  );
}
