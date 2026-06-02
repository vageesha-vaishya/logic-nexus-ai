// Memoized aircraft-search sub-section extracted from AmroOwnedWorkspace.tsx
// (Slice E). Memoization is load-bearing: it prevents flicker caused by
// parent re-renders during the work-order create flow.

import { memo } from 'react';
import { Button, Input as TextInput, Label } from '@/design-system';
import type { WorkOrderCreateAircraftOption } from './amroOwnedWorkspaceConstants';

interface AircraftSearchSectionProps {
  aircraftSearchTerm: string;
  onSearchChange: (value: string) => void;
  filteredAircraftOptions: WorkOrderCreateAircraftOption[];
  selectedAircraftId: string | undefined;
  onSelectAircraft: (id: string) => void;
  isLoading: boolean;
  selectedAircraft: WorkOrderCreateAircraftOption | null;
}

export const AircraftSearchSection = memo(function AircraftSearchSection({
  aircraftSearchTerm,
  onSearchChange,
  filteredAircraftOptions,
  selectedAircraftId,
  onSelectAircraft,
  isLoading,
  selectedAircraft,
}: AircraftSearchSectionProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor="wp-aircraft-search">Aircraft</Label>
      <TextInput
        id="wp-aircraft-search"
        value={aircraftSearchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search model, registration, serial"
      />
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading aircraft...</p>
        ) : filteredAircraftOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No aircraft found in tenant scope.</p>
        ) : (
          filteredAircraftOptions.map((aircraft) => (
            <Button
              key={aircraft.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectAircraft(aircraft.id)}
              className={`h-auto w-full justify-start rounded-md border px-3 py-2 text-left text-xs ${selectedAircraftId === aircraft.id ? 'border-primary bg-primary/10' : 'border-border'}`}
              aria-pressed={selectedAircraftId === aircraft.id}
            >
              <p className="font-medium">{aircraft.aircraftModel || 'Unknown Model'} · {aircraft.registration || '-'}</p>
              <p className="text-muted-foreground">SN {aircraft.serialNumber || '-'} · Station {aircraft.stationCode || '-'}</p>
            </Button>
          ))
        )}
      </div>
      {selectedAircraft ? (
        <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-xs">
          <div>Model: {selectedAircraft.aircraftModel || '-'}</div>
          <div>Serial: {selectedAircraft.serialNumber || '-'}</div>
          <div>Registration: {selectedAircraft.registration || '-'}</div>
          <div>Hours/Cycles: {selectedAircraft.currentFlightHours}/{selectedAircraft.currentCycles}</div>
          <div>Status: {selectedAircraft.status || '-'}</div>
          <div>Operator: {selectedAircraft.operatorCode || '-'}</div>
        </div>
      ) : null}
    </div>
  );
});
