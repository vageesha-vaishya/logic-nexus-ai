import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type FlightLogFormMode = 'add' | 'new';

export type FlightLogFormValues = {
  aircraftId: string;
  flightDate: string;
  flightNumber: string;
  pilotName: string;
  departureAirport: string;
  arrivalAirport: string;
  flightHours: string;
  blockHours: string;
  flightCycles: string;
  crewDetails: string;
  fuelBurnKg: string;
  oilUpliftLiters: string;
  pirepDiscrepancy: string;
  regulatoryAuthority: string;
};

export type FlightLogFormErrors = Partial<Record<keyof FlightLogFormValues, string>>;

export type FlightLogPayload = {
  aircraft_id: string;
  flight_date: string;
  flight_number: string | null;
  pilot_name: string | null;
  departure_airport: string;
  arrival_airport: string;
  flight_hours: number;
  block_hours: number;
  flight_cycles: number;
  crew_details: string | null;
  fuel_burn_kg: number;
  oil_uplift_liters: number;
  pirep_discrepancy: string | null;
  regulatory_authority: string | null;
  metadata: {
    source: string;
  };
};

export type FlightLogFormSubmitInput = {
  mode: FlightLogFormMode;
  values: FlightLogFormValues;
  payload: FlightLogPayload;
};

export type FlightLogFormConfig = {
  mode: FlightLogFormMode;
  title: string;
  description: string;
  submitLabel: string;
  metadataSource: string;
  aircraftReadOnly?: boolean;
};

type FlightLogFormProps = {
  config: FlightLogFormConfig;
  initialValues?: Partial<FlightLogFormValues>;
  onCancel: () => void;
  onSubmit: (input: FlightLogFormSubmitInput) => Promise<void>;
  submitting?: boolean;
};

export function getDefaultFlightLogFormValues(overrides: Partial<FlightLogFormValues> = {}): FlightLogFormValues {
  const today = new Date().toISOString().slice(0, 10);
  return {
    aircraftId: '',
    flightDate: today,
    flightNumber: '',
    pilotName: '',
    departureAirport: '',
    arrivalAirport: '',
    flightHours: '0',
    blockHours: '0',
    flightCycles: '1',
    crewDetails: '',
    fuelBurnKg: '0',
    oilUpliftLiters: '0',
    pirepDiscrepancy: '',
    regulatoryAuthority: 'DGCA',
    ...overrides,
  };
}

export function validateFlightLogFormValues(values: FlightLogFormValues): FlightLogFormErrors {
  const errors: FlightLogFormErrors = {};
  if (!values.aircraftId.trim()) {
    errors.aircraftId = 'Aircraft Id is required';
  }
  if (!values.flightDate.trim()) {
    errors.flightDate = 'Flight date is required';
  }
  if (!values.departureAirport.trim()) {
    errors.departureAirport = 'Departure airport is required';
  }
  if (!values.arrivalAirport.trim()) {
    errors.arrivalAirport = 'Arrival airport is required';
  }
  if (
    values.departureAirport.trim()
    && values.arrivalAirport.trim()
    && values.departureAirport.trim().toUpperCase() === values.arrivalAirport.trim().toUpperCase()
  ) {
    errors.arrivalAirport = 'Arrival airport must be different from departure airport';
  }

  const flightHours = Number(values.flightHours || '0');
  const blockHours = Number(values.blockHours || '0');
  const flightCycles = Number(values.flightCycles || '0');
  if (!Number.isFinite(flightHours) || flightHours < 0) {
    errors.flightHours = 'Flight hours must be a non-negative number';
  }
  if (!Number.isFinite(blockHours) || blockHours < 0) {
    errors.blockHours = 'Block hours must be a non-negative number';
  }
  if (!Number.isFinite(flightCycles) || flightCycles < 0 || !Number.isInteger(flightCycles)) {
    errors.flightCycles = 'Flight cycles must be a non-negative whole number';
  }
  if (
    flightHours <= 0
    && blockHours <= 0
    && flightCycles <= 0
    && !errors.flightHours
    && !errors.blockHours
    && !errors.flightCycles
  ) {
    errors.flightHours = 'Provide at least one positive usage metric';
  }

  const fuelBurnKg = Number(values.fuelBurnKg || '0');
  const oilUpliftLiters = Number(values.oilUpliftLiters || '0');
  if (!Number.isFinite(fuelBurnKg) || fuelBurnKg < 0) {
    errors.fuelBurnKg = 'Fuel burn must be a non-negative number';
  }
  if (!Number.isFinite(oilUpliftLiters) || oilUpliftLiters < 0) {
    errors.oilUpliftLiters = 'Oil uplift must be a non-negative number';
  }
  return errors;
}

export function buildFlightLogPayload(values: FlightLogFormValues, metadataSource: string): FlightLogPayload {
  return {
    aircraft_id: values.aircraftId.trim(),
    flight_date: values.flightDate.trim(),
    flight_number: values.flightNumber.trim() || null,
    pilot_name: values.pilotName.trim() || null,
    departure_airport: values.departureAirport.trim().toUpperCase(),
    arrival_airport: values.arrivalAirport.trim().toUpperCase(),
    flight_hours: Number(values.flightHours || '0'),
    block_hours: Number(values.blockHours || '0'),
    flight_cycles: Number(values.flightCycles || '0'),
    crew_details: values.crewDetails.trim() || null,
    fuel_burn_kg: Number(values.fuelBurnKg || '0'),
    oil_uplift_liters: Number(values.oilUpliftLiters || '0'),
    pirep_discrepancy: values.pirepDiscrepancy.trim() || null,
    regulatory_authority: values.regulatoryAuthority.trim().toUpperCase() || null,
    metadata: {
      source: metadataSource,
    },
  };
}

export function FlightLogForm({ config, initialValues, onCancel, onSubmit, submitting = false }: FlightLogFormProps) {
  const [values, setValues] = useState<FlightLogFormValues>(() => getDefaultFlightLogFormValues(initialValues));
  const [errors, setErrors] = useState<FlightLogFormErrors>({});
  const [submitError, setSubmitError] = useState('');

  const setFieldValue = useCallback((key: keyof FlightLogFormValues, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: '' }));
    setSubmitError('');
  }, []);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateFlightLogFormValues(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Please resolve flight log validation errors');
      return;
    }
    const payload = buildFlightLogPayload(values, config.metadataSource);
    try {
      await onSubmit({
        mode: config.mode,
        values,
        payload,
      });
    } catch (error) {
      setSubmitError(String((error as Error).message || 'Failed to save flight log'));
    }
  }, [config.metadataSource, config.mode, onSubmit, values]);

  const sectionFieldClass = 'mdm-template-form-field';
  const fullWidthSectionFieldClass = 'mdm-template-form-field-full';

  return (
    <>
      <DialogHeader className="border-b border-[hsl(var(--mdm-template-border))] px-6 py-4">
        <DialogTitle className="text-[15px] font-semibold text-[hsl(var(--mdm-template-heading))]">{config.title}</DialogTitle>
        <DialogDescription className="text-[12px] text-[hsl(var(--mdm-template-muted))]">{config.description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 px-6 pb-6 pt-4">
        {submitError ? <p className="mdm-template-danger">{submitError}</p> : null}
        <div className="mdm-template-form-grid">
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-aircraft`} className="mdm-template-label">Aircraft Id</Label>
            <Input
              id={`${config.mode}-flight-log-aircraft`}
              value={values.aircraftId}
              onChange={(event) => setFieldValue('aircraftId', event.target.value)}
              className={cn('mdm-template-input', errors.aircraftId && 'border-destructive')}
              aria-invalid={Boolean(errors.aircraftId)}
              readOnly={Boolean(config.aircraftReadOnly)}
              placeholder="ac-1"
            />
            {errors.aircraftId ? <p className="mdm-template-danger">{errors.aircraftId}</p> : null}
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-date`} className="mdm-template-label">Flight Date</Label>
            <Input
              id={`${config.mode}-flight-log-date`}
              type="date"
              value={values.flightDate}
              onChange={(event) => setFieldValue('flightDate', event.target.value)}
              className={cn('mdm-template-input', errors.flightDate && 'border-destructive')}
              aria-invalid={Boolean(errors.flightDate)}
            />
            {errors.flightDate ? <p className="mdm-template-danger">{errors.flightDate}</p> : null}
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-number`} className="mdm-template-label">Flight Number</Label>
            <Input
              id={`${config.mode}-flight-log-number`}
              value={values.flightNumber}
              onChange={(event) => setFieldValue('flightNumber', event.target.value)}
              className="mdm-template-input"
              placeholder="AI203"
            />
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-pilot`} className="mdm-template-label">Pilot Name</Label>
            <Input
              id={`${config.mode}-flight-log-pilot`}
              value={values.pilotName}
              onChange={(event) => setFieldValue('pilotName', event.target.value)}
              className="mdm-template-input"
              placeholder="Captain / PIC"
            />
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-departure`} className="mdm-template-label">Departure Airport</Label>
            <Input
              id={`${config.mode}-flight-log-departure`}
              value={values.departureAirport}
              onChange={(event) => setFieldValue('departureAirport', event.target.value.toUpperCase())}
              className={cn('mdm-template-input', errors.departureAirport && 'border-destructive')}
              aria-invalid={Boolean(errors.departureAirport)}
              placeholder="DEL"
            />
            {errors.departureAirport ? <p className="mdm-template-danger">{errors.departureAirport}</p> : null}
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-arrival`} className="mdm-template-label">Arrival Airport</Label>
            <Input
              id={`${config.mode}-flight-log-arrival`}
              value={values.arrivalAirport}
              onChange={(event) => setFieldValue('arrivalAirport', event.target.value.toUpperCase())}
              className={cn('mdm-template-input', errors.arrivalAirport && 'border-destructive')}
              aria-invalid={Boolean(errors.arrivalAirport)}
              placeholder="CCU"
            />
            {errors.arrivalAirport ? <p className="mdm-template-danger">{errors.arrivalAirport}</p> : null}
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-hours`} className="mdm-template-label">Flight Hours</Label>
            <Input
              id={`${config.mode}-flight-log-hours`}
              type="number"
              min="0"
              step="0.01"
              value={values.flightHours}
              onChange={(event) => setFieldValue('flightHours', event.target.value)}
              className={cn('mdm-template-input', errors.flightHours && 'border-destructive')}
              aria-invalid={Boolean(errors.flightHours)}
            />
            {errors.flightHours ? <p className="mdm-template-danger">{errors.flightHours}</p> : null}
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-block-hours`} className="mdm-template-label">Block Hours</Label>
            <Input
              id={`${config.mode}-flight-log-block-hours`}
              type="number"
              min="0"
              step="0.01"
              value={values.blockHours}
              onChange={(event) => setFieldValue('blockHours', event.target.value)}
              className={cn('mdm-template-input', errors.blockHours && 'border-destructive')}
              aria-invalid={Boolean(errors.blockHours)}
            />
            {errors.blockHours ? <p className="mdm-template-danger">{errors.blockHours}</p> : null}
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-cycles`} className="mdm-template-label">Flight Cycles</Label>
            <Input
              id={`${config.mode}-flight-log-cycles`}
              type="number"
              min="0"
              step="1"
              value={values.flightCycles}
              onChange={(event) => setFieldValue('flightCycles', event.target.value)}
              className={cn('mdm-template-input', errors.flightCycles && 'border-destructive')}
              aria-invalid={Boolean(errors.flightCycles)}
            />
            {errors.flightCycles ? <p className="mdm-template-danger">{errors.flightCycles}</p> : null}
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-fuel-burn`} className="mdm-template-label">Fuel Burn (Kg)</Label>
            <Input
              id={`${config.mode}-flight-log-fuel-burn`}
              type="number"
              min="0"
              step="0.01"
              value={values.fuelBurnKg}
              onChange={(event) => setFieldValue('fuelBurnKg', event.target.value)}
              className={cn('mdm-template-input', errors.fuelBurnKg && 'border-destructive')}
              aria-invalid={Boolean(errors.fuelBurnKg)}
            />
            {errors.fuelBurnKg ? <p className="mdm-template-danger">{errors.fuelBurnKg}</p> : null}
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-oil-uplift`} className="mdm-template-label">Oil Uplift (Liters)</Label>
            <Input
              id={`${config.mode}-flight-log-oil-uplift`}
              type="number"
              min="0"
              step="0.01"
              value={values.oilUpliftLiters}
              onChange={(event) => setFieldValue('oilUpliftLiters', event.target.value)}
              className={cn('mdm-template-input', errors.oilUpliftLiters && 'border-destructive')}
              aria-invalid={Boolean(errors.oilUpliftLiters)}
            />
            {errors.oilUpliftLiters ? <p className="mdm-template-danger">{errors.oilUpliftLiters}</p> : null}
          </div>
          <div className={sectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-authority`} className="mdm-template-label">Regulatory Authority</Label>
            <Input
              id={`${config.mode}-flight-log-authority`}
              value={values.regulatoryAuthority}
              onChange={(event) => setFieldValue('regulatoryAuthority', event.target.value.toUpperCase())}
              className="mdm-template-input"
              placeholder="DGCA / FAA / EASA"
            />
          </div>
          <div className={fullWidthSectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-crew`} className="mdm-template-label">Crew Details</Label>
            <Textarea
              id={`${config.mode}-flight-log-crew`}
              value={values.crewDetails}
              onChange={(event) => setFieldValue('crewDetails', event.target.value)}
              className="mdm-template-input min-h-[80px]"
              placeholder="Captain, First Officer, etc."
            />
          </div>
          <div className={fullWidthSectionFieldClass}>
            <Label htmlFor={`${config.mode}-flight-log-pirep`} className="mdm-template-label">PIREP / Discrepancy</Label>
            <Textarea
              id={`${config.mode}-flight-log-pirep`}
              value={values.pirepDiscrepancy}
              onChange={(event) => setFieldValue('pirepDiscrepancy', event.target.value)}
              className="mdm-template-input min-h-[110px]"
              placeholder="Pilot reported discrepancy or snag details"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[hsl(var(--mdm-template-border))] pt-4">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? 'Saving...' : config.submitLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
