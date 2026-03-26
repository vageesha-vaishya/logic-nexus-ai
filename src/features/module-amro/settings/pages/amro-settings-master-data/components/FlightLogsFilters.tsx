import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FlightLogsFiltersProps = {
  flightDateFrom: string;
  setFlightDateFrom: (value: string) => void;
  flightDateTo: string;
  setFlightDateTo: (value: string) => void;
  flightAircraftFilter: string;
  setFlightAircraftFilter: (value: string) => void;
  flightPilotFilter: string;
  setFlightPilotFilter: (value: string) => void;
  flightRegistrationFilter: string;
  setFlightRegistrationFilter: (value: string) => void;
  flightNumberFilter: string;
  setFlightNumberFilter: (value: string) => void;
};

export function FlightLogsFilters({
  flightDateFrom,
  setFlightDateFrom,
  flightDateTo,
  setFlightDateTo,
  flightAircraftFilter,
  setFlightAircraftFilter,
  flightPilotFilter,
  setFlightPilotFilter,
  flightRegistrationFilter,
  setFlightRegistrationFilter,
  flightNumberFilter,
  setFlightNumberFilter,
}: FlightLogsFiltersProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="flight-date-from-filter" className="mdm-template-label">Flight Date From</Label>
        <Input
          id="flight-date-from-filter"
          type="date"
          value={flightDateFrom}
          onChange={(event) => setFlightDateFrom(event.target.value)}
          className="mdm-template-input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="flight-date-to-filter" className="mdm-template-label">Flight Date To</Label>
        <Input
          id="flight-date-to-filter"
          type="date"
          value={flightDateTo}
          onChange={(event) => setFlightDateTo(event.target.value)}
          className="mdm-template-input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="flight-aircraft-filter" className="mdm-template-label">Aircraft Id</Label>
        <Input
          id="flight-aircraft-filter"
          value={flightAircraftFilter}
          onChange={(event) => setFlightAircraftFilter(event.target.value)}
          className="mdm-template-input"
          placeholder="Filter by aircraft id"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="flight-pilot-filter" className="mdm-template-label">Pilot</Label>
        <Input
          id="flight-pilot-filter"
          value={flightPilotFilter}
          onChange={(event) => setFlightPilotFilter(event.target.value)}
          className="mdm-template-input"
          placeholder="Filter by pilot name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="flight-registration-filter" className="mdm-template-label">Aircraft Registration</Label>
        <Input
          id="flight-registration-filter"
          value={flightRegistrationFilter}
          onChange={(event) => setFlightRegistrationFilter(event.target.value)}
          className="mdm-template-input"
          placeholder="Filter by tail number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="flight-number-filter" className="mdm-template-label">Flight Number</Label>
        <Input
          id="flight-number-filter"
          value={flightNumberFilter}
          onChange={(event) => setFlightNumberFilter(event.target.value)}
          className="mdm-template-input"
          placeholder="Filter by flight number"
        />
      </div>
    </>
  );
}
