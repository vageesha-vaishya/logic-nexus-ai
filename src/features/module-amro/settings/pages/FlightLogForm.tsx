import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type FlightLogFormMode = 'add' | 'new';

type AirframePeriodRow = {
  model: string;
  serialNo: string;
  hours: string;
  finalHours: string;
  landings: string;
  finalLandings: string;
};

type EnginePeriodRow = {
  model: string;
  serialNo: string;
  hours: string;
  finalHours: string;
  cycles: string;
  finalCycles: string;
};

export type FlightLogFormValues = {
  aircraftId: string;
  flightDate: string;
  logSelectionNo: string;
  logPageNo: string;
  flightNumber: string;
  pilotName: string;
  picInCommand: string;
  coPilot: string;
  classificationName: string;
  classificationId: string;
  attachmentRefs: string[];
  departureAirport: string;
  departureDateUtc: string;
  departureTimeUtc: string;
  arrivalAirport: string;
  arrivalDateUtc: string;
  arrivalTimeUtc: string;
  timeOutUtc: string;
  timeOffUtc: string;
  timeOnUtc: string;
  timeInUtc: string;
  airborneTimeHours: string;
  groundRunTimeHours: string;
  groundRunPercent: string;
  totalTimeHours: string;
  flightHours: string;
  blockHours: string;
  flightCycles: string;
  landings: string;
  crewDetails: string;
  fuelBurnKg: string;
  oilUpliftLiters: string;
  pirepDiscrepancy: string;
  remarks: string;
  airframePeriods: AirframePeriodRow[];
  enginePeriods: EnginePeriodRow[];
  regulatoryAuthority: string;
};

export type FlightLogFormErrors = Partial<Record<keyof FlightLogFormValues, string>>;

export type FlightLogPayload = {
  aircraft_id: string;
  flight_date: string;
  log_selection_no: string | null;
  log_page_no: string | null;
  flight_number: string | null;
  pilot_name: string | null;
  pic_in_command: string | null;
  co_pilot: string | null;
  classification_id: string | null;
  classification_name: string | null;
  flight_log_attachment_refs: string[];
  departure_airport: string;
  arrival_airport: string;
  time_out: string | null;
  time_off: string | null;
  time_on: string | null;
  time_in: string | null;
  taxi_out_time_hours: number | null;
  airborne_time_hours: number | null;
  ground_run_time_hours: number | null;
  ground_run_percent: number | null;
  total_time_hours: number | null;
  flight_hours: number;
  block_hours: number;
  flight_cycles: number;
  landings: number | null;
  crew_details: string | null;
  fuel_burn_kg: number;
  oil_uplift_liters: number;
  pirep_discrepancy: string | null;
  remarks: string | null;
  airframe_periods: Array<Record<string, unknown>>;
  engine_periods: Array<Record<string, unknown>>;
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

export type FlightLogPilotOption = {
  userId: string;
  displayName: string;
  email: string | null;
};

export type FlightLogAirportOption = {
  id: string;
  name: string;
  icaoCode: string;
};

type FlightLogFormProps = {
  config: FlightLogFormConfig;
  initialValues?: Partial<FlightLogFormValues>;
  pilotOptions?: FlightLogPilotOption[];
  pilotOptionsLoading?: boolean;
  pilotOptionsError?: string;
  coPilotOptions?: FlightLogPilotOption[];
  coPilotOptionsLoading?: boolean;
  coPilotOptionsError?: string;
  departureAirportOptions?: FlightLogAirportOption[];
  departureAirportOptionsLoading?: boolean;
  departureAirportOptionsError?: string;
  onCancel: () => void;
  onSubmit: (input: FlightLogFormSubmitInput) => Promise<void>;
  submitting?: boolean;
};

export function getDefaultFlightLogFormValues(overrides: Partial<FlightLogFormValues> = {}): FlightLogFormValues {
  const today = new Date().toISOString().slice(0, 10);
  const emptyAirframeRow: AirframePeriodRow = {
    model: '',
    serialNo: '',
    hours: '',
    finalHours: '',
    landings: '',
    finalLandings: '',
  };
  const emptyEngineRow: EnginePeriodRow = {
    model: '',
    serialNo: '',
    hours: '',
    finalHours: '',
    cycles: '',
    finalCycles: '',
  };
  return {
    aircraftId: '',
    flightDate: today,
    logSelectionNo: '',
    logPageNo: '',
    flightNumber: '',
    pilotName: '',
    picInCommand: '',
    coPilot: '',
    classificationName: '',
    classificationId: '',
    attachmentRefs: [],
    departureAirport: '',
    departureDateUtc: today,
    departureTimeUtc: '',
    arrivalAirport: '',
    arrivalDateUtc: today,
    arrivalTimeUtc: '',
    timeOutUtc: '',
    timeOffUtc: '',
    timeOnUtc: '',
    timeInUtc: '',
    airborneTimeHours: '0',
    groundRunTimeHours: '0',
    groundRunPercent: '0',
    totalTimeHours: '0',
    flightHours: '0',
    blockHours: '0',
    flightCycles: '1',
    landings: '1',
    crewDetails: '',
    fuelBurnKg: '0',
    oilUpliftLiters: '0',
    pirepDiscrepancy: '',
    remarks: '',
    airframePeriods: [emptyAirframeRow],
    enginePeriods: [emptyEngineRow],
    regulatoryAuthority: 'DGCA',
    ...overrides,
  };
}

function parseNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function combineUtcDateAndTime(dateValue: string, timeValue: string): string | null {
  const date = dateValue.trim();
  const time = timeValue.trim();
  if (!date || !time) return null;
  const candidate = `${date}T${time}:00Z`;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
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
  const airborneTimeHours = Number(values.airborneTimeHours || '0');
  const groundRunTimeHours = Number(values.groundRunTimeHours || '0');
  const groundRunPercent = Number(values.groundRunPercent || '0');
  const totalTimeHours = Number(values.totalTimeHours || '0');
  const landings = Number(values.landings || '0');
  if (!Number.isFinite(fuelBurnKg) || fuelBurnKg < 0) {
    errors.fuelBurnKg = 'Fuel burn must be a non-negative number';
  }
  if (!Number.isFinite(oilUpliftLiters) || oilUpliftLiters < 0) {
    errors.oilUpliftLiters = 'Oil uplift must be a non-negative number';
  }
  if (!Number.isFinite(airborneTimeHours) || airborneTimeHours < 0) {
    errors.airborneTimeHours = 'Airborne time must be a non-negative number';
  }
  if (!Number.isFinite(groundRunTimeHours) || groundRunTimeHours < 0) {
    errors.groundRunTimeHours = 'Ground run time must be a non-negative number';
  }
  if (!Number.isFinite(totalTimeHours) || totalTimeHours < 0) {
    errors.totalTimeHours = 'Total time must be a non-negative number';
  }
  if (!Number.isFinite(groundRunPercent) || groundRunPercent < 0 || groundRunPercent > 100) {
    errors.groundRunPercent = 'Ground run percent must be between 0 and 100';
  }
  if (!Number.isFinite(landings) || landings < 0 || !Number.isInteger(landings)) {
    errors.landings = 'Landings must be a non-negative whole number';
  }
  if (values.departureDateUtc.trim() && values.departureTimeUtc.trim() && !combineUtcDateAndTime(values.departureDateUtc, values.departureTimeUtc)) {
    errors.departureDateUtc = 'Invalid departure UTC date/time';
  }
  if (values.arrivalDateUtc.trim() && values.arrivalTimeUtc.trim() && !combineUtcDateAndTime(values.arrivalDateUtc, values.arrivalTimeUtc)) {
    errors.arrivalDateUtc = 'Invalid arrival UTC date/time';
  }
  return errors;
}

export function buildFlightLogPayload(values: FlightLogFormValues, metadataSource: string): FlightLogPayload {
  const picInCommand = values.picInCommand.trim() || values.pilotName.trim();
  const sanitizedAirframeRows = values.airframePeriods
    .filter((row) => Object.values(row).some((value) => value.trim() !== ''))
    .map((row) => ({
      model: row.model.trim() || null,
      serial_no: row.serialNo.trim() || null,
      hours: parseNumberOrNull(row.hours),
      final_hours: parseNumberOrNull(row.finalHours),
      landings: parseNumberOrNull(row.landings),
      final_landings: parseNumberOrNull(row.finalLandings),
    }));
  const sanitizedEngineRows = values.enginePeriods
    .filter((row) => Object.values(row).some((value) => value.trim() !== ''))
    .map((row) => ({
      model: row.model.trim() || null,
      serial_no: row.serialNo.trim() || null,
      hours: parseNumberOrNull(row.hours),
      final_hours: parseNumberOrNull(row.finalHours),
      cycles: parseNumberOrNull(row.cycles),
      final_cycles: parseNumberOrNull(row.finalCycles),
    }));

  return {
    aircraft_id: values.aircraftId.trim(),
    flight_date: values.flightDate.trim(),
    log_selection_no: values.logSelectionNo.trim() || null,
    log_page_no: values.logPageNo.trim() || null,
    flight_number: values.flightNumber.trim() || null,
    pilot_name: picInCommand || null,
    pic_in_command: picInCommand || null,
    co_pilot: values.coPilot.trim() || null,
    classification_id: values.classificationId.trim() || null,
    classification_name: values.classificationName.trim() || null,
    flight_log_attachment_refs: values.attachmentRefs,
    departure_airport: values.departureAirport.trim().toUpperCase(),
    arrival_airport: values.arrivalAirport.trim().toUpperCase(),
    time_out: combineUtcDateAndTime(values.departureDateUtc, values.departureTimeUtc),
    time_off: values.timeOffUtc.trim() ? `1970-01-01T${values.timeOffUtc.trim()}:00Z` : null,
    time_on: values.timeOnUtc.trim() ? `1970-01-01T${values.timeOnUtc.trim()}:00Z` : null,
    time_in: combineUtcDateAndTime(values.arrivalDateUtc, values.arrivalTimeUtc),
    taxi_out_time_hours: parseNumberOrNull(values.blockHours),
    airborne_time_hours: parseNumberOrNull(values.airborneTimeHours),
    ground_run_time_hours: parseNumberOrNull(values.groundRunTimeHours),
    ground_run_percent: parseNumberOrNull(values.groundRunPercent),
    total_time_hours: parseNumberOrNull(values.totalTimeHours),
    flight_hours: Number(values.flightHours || '0'),
    block_hours: Number(values.blockHours || '0'),
    flight_cycles: Number(values.flightCycles || '0'),
    landings: parseNumberOrNull(values.landings),
    crew_details: values.crewDetails.trim() || null,
    fuel_burn_kg: Number(values.fuelBurnKg || '0'),
    oil_uplift_liters: Number(values.oilUpliftLiters || '0'),
    pirep_discrepancy: values.pirepDiscrepancy.trim() || null,
    remarks: values.remarks.trim() || null,
    airframe_periods: sanitizedAirframeRows,
    engine_periods: sanitizedEngineRows,
    regulatory_authority: values.regulatoryAuthority.trim().toUpperCase() || null,
    metadata: {
      source: metadataSource,
    },
  };
}

export function FlightLogForm({
  config,
  initialValues,
  pilotOptions = [],
  pilotOptionsLoading = false,
  pilotOptionsError = '',
  coPilotOptions = [],
  coPilotOptionsLoading = false,
  coPilotOptionsError = '',
  departureAirportOptions = [],
  departureAirportOptionsLoading = false,
  departureAirportOptionsError = '',
  onCancel,
  onSubmit,
  submitting = false,
}: FlightLogFormProps) {
  const [values, setValues] = useState<FlightLogFormValues>(() => getDefaultFlightLogFormValues(initialValues));
  const [errors, setErrors] = useState<FlightLogFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const classificationOptions = useMemo(
    () => [
      '2 & 4 Weekly flight ready storage',
      '2 weekly flight ready storage',
      'apu',
      'Cancelled',
      'CHECK',
      'Commercial',
      'Compass Swinging',
      'Compressor Wash',
      'Defect rectification',
      'DRY RUN',
      'DRY RUN & HOVER CHECK',
      'Dummy TLS',
      'Engine and APU Ground Run',
      'Engine and APU Run for Troubleshooting',
      'Engine Ground Run',
      'Engine Ground Run & Taxi Check',
      'Engine Ground Run for ARA',
      'Flight Cancelled',
      'FLIGHT CHECK',
      'G/R for issue of C of A',
      'G/R Idel TT check',
      'Ground Run',
      'Ground Run & Hover Check',
      'Ground Run & NG TOPPIN',
      'Ground run after engine change',
      'Ground Run For C of A Renewal',
      'Ground run for tail rotor RADS',
      'Ground Run post Compressor Wash',
      'Hover Check',
      'Light on Skid',
      'Night flying',
      'Normal flight',
      'Owner Flying',
      'PA CHECK',
      'PAC & Beep range',
      'Periodic Engine Ground Run',
      'positioning',
      'Private',
      'Proficiency Check',
      'Schedule',
      'Tail Rotor Vibration Check',
      'TAXI CHECK',
      'Taxi Check & Compass Swing',
      'Test Flight',
      'Test Flight for ARA',
      'Test Flight For C of A',
      'Test Flight for VIBREX',
      'track & balance',
      'Training',
      'VIBREX',
      'Weekly Ground Run',
    ],
    [],
  );
  const picOptions = useMemo(() => {
    const fromPilots = pilotOptions
      .map((option) => String(option.displayName || '').trim())
      .filter((name) => Boolean(name));
    if (values.picInCommand.trim() && !fromPilots.includes(values.picInCommand.trim())) {
      return [values.picInCommand.trim(), ...fromPilots];
    }
    return fromPilots;
  }, [pilotOptions, values.picInCommand]);
  const coPilotSelectOptions = useMemo(() => {
    const fromCoPilots = coPilotOptions
      .map((option) => String(option.displayName || '').trim())
      .filter((name) => Boolean(name));
    if (values.coPilot.trim() && !fromCoPilots.includes(values.coPilot.trim())) {
      return [values.coPilot.trim(), ...fromCoPilots];
    }
    return fromCoPilots;
  }, [coPilotOptions, values.coPilot]);
  const departureSelectOptions = useMemo(() => {
    const options = departureAirportOptions.map((option) => {
      const icao = String(option.icaoCode || '').trim().toUpperCase();
      const name = String(option.name || '').trim();
      return {
        value: icao,
        label: name ? `${name} (${icao})` : icao,
      };
    }).filter((option) => Boolean(option.value));
    const normalizedDeparture = values.departureAirport.trim().toUpperCase();
    if (normalizedDeparture && !options.some((option) => option.value === normalizedDeparture)) {
      return [{ value: normalizedDeparture, label: normalizedDeparture }, ...options];
    }
    return options;
  }, [departureAirportOptions, values.departureAirport]);

  const setFieldValue = useCallback((key: keyof FlightLogFormValues, value: string) => {
    setValues((previous) => {
      if (key === 'picInCommand') {
        return { ...previous, picInCommand: value, pilotName: value };
      }
      return { ...previous, [key]: value };
    });
    setErrors((previous) => ({ ...previous, [key]: '' }));
    setSubmitError('');
  }, []);

  const setAttachmentNames = useCallback((files: FileList | null) => {
    const nextNames = files ? Array.from(files).map((file) => file.name) : [];
    setValues((previous) => ({ ...previous, attachmentRefs: nextNames }));
    setSubmitError('');
  }, []);

  const setAirframeRowValue = useCallback((rowIndex: number, key: keyof AirframePeriodRow, value: string) => {
    setValues((previous) => {
      const nextRows = [...previous.airframePeriods];
      nextRows[rowIndex] = { ...nextRows[rowIndex], [key]: value };
      return { ...previous, airframePeriods: nextRows };
    });
    setSubmitError('');
  }, []);

  const setEngineRowValue = useCallback((rowIndex: number, key: keyof EnginePeriodRow, value: string) => {
    setValues((previous) => {
      const nextRows = [...previous.enginePeriods];
      nextRows[rowIndex] = { ...nextRows[rowIndex], [key]: value };
      return { ...previous, enginePeriods: nextRows };
    });
    setSubmitError('');
  }, []);

  const addAirframeRow = useCallback(() => {
    setValues((previous) => ({
      ...previous,
      airframePeriods: [
        ...previous.airframePeriods,
        { model: '', serialNo: '', hours: '', finalHours: '', landings: '', finalLandings: '' },
      ],
    }));
  }, []);

  const addEngineRow = useCallback(() => {
    setValues((previous) => ({
      ...previous,
      enginePeriods: [
        ...previous.enginePeriods,
        { model: '', serialNo: '', hours: '', finalHours: '', cycles: '', finalCycles: '' },
      ],
    }));
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
  const sectionClass = 'rounded-md border border-blue-400 bg-white p-4';
  const sectionHeadingClass = 'mb-3 text-sm font-semibold text-blue-700';

  return (
    <>
      <DialogHeader className="border-b border-[hsl(var(--mdm-template-border))] px-6 py-4">
        <DialogTitle className="text-[15px] font-semibold text-[hsl(var(--mdm-template-heading))]">{config.title}</DialogTitle>
        <DialogDescription className="text-[12px] text-[hsl(var(--mdm-template-muted))]">{config.description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 px-6 pb-6 pt-4">
        {submitError ? <p className="mdm-template-danger">{submitError}</p> : null}
        <section className={sectionClass}>
          <h3 className={sectionHeadingClass}>Log Details</h3>
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
              <Label htmlFor={`${config.mode}-flight-log-date`} className="mdm-template-label">Date (UTC)</Label>
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
              <Label htmlFor={`${config.mode}-flight-log-selection-no`} className="mdm-template-label">Log No</Label>
              <Input
                id={`${config.mode}-flight-log-selection-no`}
                value={values.logSelectionNo}
                onChange={(event) => setFieldValue('logSelectionNo', event.target.value)}
                className="mdm-template-input"
                placeholder="LOG-001"
              />
            </div>
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-page-no`} className="mdm-template-label">Page No</Label>
              <Input
                id={`${config.mode}-flight-log-page-no`}
                value={values.logPageNo}
                onChange={(event) => setFieldValue('logPageNo', event.target.value)}
                className="mdm-template-input"
                placeholder="1"
              />
            </div>
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-number`} className="mdm-template-label">Flight No</Label>
              <Input
                id={`${config.mode}-flight-log-number`}
                value={values.flightNumber}
                onChange={(event) => setFieldValue('flightNumber', event.target.value)}
                className="mdm-template-input"
                placeholder="AI203"
              />
            </div>
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-pic`} className="mdm-template-label">PIC In Command</Label>
              <Select value={values.picInCommand} onValueChange={(value) => setFieldValue('picInCommand', value)}>
                <SelectTrigger
                  id={`${config.mode}-flight-log-pic`}
                  className="mdm-template-input"
                  aria-label="PIC In Command"
                  disabled={pilotOptionsLoading}
                >
                  <SelectValue placeholder={pilotOptionsLoading ? 'Loading pilots...' : 'Select PIC in Command'} />
                </SelectTrigger>
                <SelectContent>
                  {picOptions.length === 0 ? (
                    <SelectItem value="__no-pilot__" disabled>No pilot users available</SelectItem>
                  ) : (
                    picOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {pilotOptionsError ? <p className="mdm-template-danger">{pilotOptionsError}</p> : null}
            </div>
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-co-pilot`} className="mdm-template-label">Co-Pilot</Label>
              <Select value={values.coPilot} onValueChange={(value) => setFieldValue('coPilot', value)}>
                <SelectTrigger
                  id={`${config.mode}-flight-log-co-pilot`}
                  className="mdm-template-input"
                  aria-label="Co-Pilot"
                  disabled={coPilotOptionsLoading}
                >
                  <SelectValue placeholder={coPilotOptionsLoading ? 'Loading co-pilots...' : 'Select Co-Pilot'} />
                </SelectTrigger>
                <SelectContent>
                  {coPilotSelectOptions.length === 0 ? (
                    <SelectItem value="__no-co-pilot__" disabled>No co-pilot users available</SelectItem>
                  ) : (
                    coPilotSelectOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {coPilotOptionsError ? <p className="mdm-template-danger">{coPilotOptionsError}</p> : null}
            </div>
            <div className={sectionFieldClass}>
              <Label className="mdm-template-label">Classification</Label>
              <Select
                value={values.classificationName}
                onValueChange={(value) => setFieldValue('classificationName', value)}
              >
                <SelectTrigger className="mdm-template-input">
                  <SelectValue placeholder="Select Classification" />
                </SelectTrigger>
                <SelectContent>
                  {classificationOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-attachments`} className="mdm-template-label">Attach File</Label>
              <Input
                id={`${config.mode}-flight-log-attachments`}
                type="file"
                multiple
                className="mdm-template-input cursor-pointer"
                onChange={(event) => setAttachmentNames(event.target.files)}
              />
              {values.attachmentRefs.length > 0 ? (
                <p className="text-xs text-[hsl(var(--mdm-template-muted))]">
                  {values.attachmentRefs.length} file(s) selected
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h3 className={sectionHeadingClass}>Departure / Arrival</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-blue-300 p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--mdm-template-muted))]">Departure</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className={fullWidthSectionFieldClass}>
                  <Label htmlFor={`${config.mode}-flight-log-departure`} className="mdm-template-label">Place</Label>
                  <Select
                    value={values.departureAirport.trim().toUpperCase()}
                    onValueChange={(value) => setFieldValue('departureAirport', value.toUpperCase())}
                  >
                    <SelectTrigger
                      id={`${config.mode}-flight-log-departure`}
                      className={cn('mdm-template-input', errors.departureAirport && 'border-destructive')}
                      aria-invalid={Boolean(errors.departureAirport)}
                      aria-label="Departure Place"
                      disabled={departureAirportOptionsLoading}
                    >
                      <SelectValue placeholder={departureAirportOptionsLoading ? 'Loading airports...' : 'Select departure airport'} />
                    </SelectTrigger>
                    <SelectContent>
                      {departureSelectOptions.length === 0 ? (
                        <SelectItem value="__no-departure-airports__" disabled>No airports available</SelectItem>
                      ) : (
                        departureSelectOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.departureAirport ? <p className="mdm-template-danger">{errors.departureAirport}</p> : null}
                  {departureAirportOptionsError ? <p className="mdm-template-danger">{departureAirportOptionsError}</p> : null}
                </div>
                <div className={sectionFieldClass}>
                  <Label htmlFor={`${config.mode}-flight-log-departure-date`} className="mdm-template-label">UTC Date</Label>
                  <Input
                    id={`${config.mode}-flight-log-departure-date`}
                    type="date"
                    value={values.departureDateUtc}
                    onChange={(event) => setFieldValue('departureDateUtc', event.target.value)}
                    className={cn('mdm-template-input', errors.departureDateUtc && 'border-destructive')}
                  />
                </div>
                <div className={sectionFieldClass}>
                  <Label htmlFor={`${config.mode}-flight-log-departure-time`} className="mdm-template-label">UTC Time</Label>
                  <Input
                    id={`${config.mode}-flight-log-departure-time`}
                    type="time"
                    value={values.departureTimeUtc}
                    onChange={(event) => setFieldValue('departureTimeUtc', event.target.value)}
                    className="mdm-template-input"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-md border border-blue-300 p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--mdm-template-muted))]">Arrival</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className={fullWidthSectionFieldClass}>
                  <Label htmlFor={`${config.mode}-flight-log-arrival`} className="mdm-template-label">Place</Label>
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
                  <Label htmlFor={`${config.mode}-flight-log-arrival-date`} className="mdm-template-label">UTC Date</Label>
                  <Input
                    id={`${config.mode}-flight-log-arrival-date`}
                    type="date"
                    value={values.arrivalDateUtc}
                    onChange={(event) => setFieldValue('arrivalDateUtc', event.target.value)}
                    className={cn('mdm-template-input', errors.arrivalDateUtc && 'border-destructive')}
                  />
                </div>
                <div className={sectionFieldClass}>
                  <Label htmlFor={`${config.mode}-flight-log-arrival-time`} className="mdm-template-label">UTC Time</Label>
                  <Input
                    id={`${config.mode}-flight-log-arrival-time`}
                    type="time"
                    value={values.arrivalTimeUtc}
                    onChange={(event) => setFieldValue('arrivalTimeUtc', event.target.value)}
                    className="mdm-template-input"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h3 className={sectionHeadingClass}>Aircraft Flying Hours (Log/HOBBS)</h3>
          <div className="mdm-template-form-grid">
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-block-hours`} className="mdm-template-label">Block Time</Label>
              <Input
                id={`${config.mode}-flight-log-block-hours`}
                type="number"
                min="0"
                step="0.01"
                value={values.blockHours}
                onChange={(event) => setFieldValue('blockHours', event.target.value)}
                className={cn('mdm-template-input', errors.blockHours && 'border-destructive')}
              />
              {errors.blockHours ? <p className="mdm-template-danger">{errors.blockHours}</p> : null}
            </div>
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-airborne`} className="mdm-template-label">Airborne Time</Label>
              <Input
                id={`${config.mode}-flight-log-airborne`}
                type="number"
                min="0"
                step="0.01"
                value={values.airborneTimeHours}
                onChange={(event) => setFieldValue('airborneTimeHours', event.target.value)}
                className={cn('mdm-template-input', errors.airborneTimeHours && 'border-destructive')}
              />
              {errors.airborneTimeHours ? <p className="mdm-template-danger">{errors.airborneTimeHours}</p> : null}
            </div>
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-ground-run`} className="mdm-template-label">Ground Run Time</Label>
              <Input
                id={`${config.mode}-flight-log-ground-run`}
                type="number"
                min="0"
                step="0.01"
                value={values.groundRunTimeHours}
                onChange={(event) => setFieldValue('groundRunTimeHours', event.target.value)}
                className={cn('mdm-template-input', errors.groundRunTimeHours && 'border-destructive')}
              />
              {errors.groundRunTimeHours ? <p className="mdm-template-danger">{errors.groundRunTimeHours}</p> : null}
            </div>
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-ground-run-percent`} className="mdm-template-label">% Ground Run Time</Label>
              <Input
                id={`${config.mode}-flight-log-ground-run-percent`}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={values.groundRunPercent}
                onChange={(event) => setFieldValue('groundRunPercent', event.target.value)}
                className={cn('mdm-template-input', errors.groundRunPercent && 'border-destructive')}
              />
              {errors.groundRunPercent ? <p className="mdm-template-danger">{errors.groundRunPercent}</p> : null}
            </div>
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-total-time`} className="mdm-template-label">Total Time</Label>
              <Input
                id={`${config.mode}-flight-log-total-time`}
                type="number"
                min="0"
                step="0.01"
                value={values.totalTimeHours}
                onChange={(event) => setFieldValue('totalTimeHours', event.target.value)}
                className={cn('mdm-template-input', errors.totalTimeHours && 'border-destructive')}
              />
              {errors.totalTimeHours ? <p className="mdm-template-danger">{errors.totalTimeHours}</p> : null}
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
              />
              {errors.flightHours ? <p className="mdm-template-danger">{errors.flightHours}</p> : null}
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
              />
              {errors.flightCycles ? <p className="mdm-template-danger">{errors.flightCycles}</p> : null}
            </div>
            <div className={sectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-landings`} className="mdm-template-label">Landings</Label>
              <Input
                id={`${config.mode}-flight-log-landings`}
                type="number"
                min="0"
                step="1"
                value={values.landings}
                onChange={(event) => setFieldValue('landings', event.target.value)}
                className={cn('mdm-template-input', errors.landings && 'border-destructive')}
              />
              {errors.landings ? <p className="mdm-template-danger">{errors.landings}</p> : null}
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
              />
              {errors.oilUpliftLiters ? <p className="mdm-template-danger">{errors.oilUpliftLiters}</p> : null}
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h3 className={sectionHeadingClass}>Airframe Periods</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--mdm-template-border))] text-left">
                  <th className="px-2 py-2">Model</th>
                  <th className="px-2 py-2">Serial No.</th>
                  <th className="px-2 py-2">Hours</th>
                  <th className="px-2 py-2">Final Hours</th>
                  <th className="px-2 py-2">Landings</th>
                  <th className="px-2 py-2">Final Landings</th>
                </tr>
              </thead>
              <tbody>
                {values.airframePeriods.map((row, index) => (
                  <tr key={`airframe-${index}`} className="border-b border-[hsl(var(--mdm-template-border))]">
                    <td className="px-2 py-2"><Input value={row.model} className="mdm-template-input" onChange={(event) => setAirframeRowValue(index, 'model', event.target.value)} /></td>
                    <td className="px-2 py-2"><Input value={row.serialNo} className="mdm-template-input" onChange={(event) => setAirframeRowValue(index, 'serialNo', event.target.value)} /></td>
                    <td className="px-2 py-2"><Input value={row.hours} type="number" min="0" step="0.01" className="mdm-template-input" onChange={(event) => setAirframeRowValue(index, 'hours', event.target.value)} /></td>
                    <td className="px-2 py-2"><Input value={row.finalHours} type="number" min="0" step="0.01" className="mdm-template-input" onChange={(event) => setAirframeRowValue(index, 'finalHours', event.target.value)} /></td>
                    <td className="px-2 py-2"><Input value={row.landings} type="number" min="0" step="1" className="mdm-template-input" onChange={(event) => setAirframeRowValue(index, 'landings', event.target.value)} /></td>
                    <td className="px-2 py-2"><Input value={row.finalLandings} type="number" min="0" step="1" className="mdm-template-input" onChange={(event) => setAirframeRowValue(index, 'finalLandings', event.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Button type="button" variant="outline" onClick={addAirframeRow}>Add Airframe Row</Button>
          </div>
        </section>

        <section className={sectionClass}>
          <h3 className={sectionHeadingClass}>Engine Periods</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--mdm-template-border))] text-left">
                  <th className="px-2 py-2">Model</th>
                  <th className="px-2 py-2">Serial No.</th>
                  <th className="px-2 py-2">Hours</th>
                  <th className="px-2 py-2">Final Hours</th>
                  <th className="px-2 py-2">Cycles</th>
                  <th className="px-2 py-2">Final Cycles</th>
                </tr>
              </thead>
              <tbody>
                {values.enginePeriods.map((row, index) => (
                  <tr key={`engine-${index}`} className="border-b border-[hsl(var(--mdm-template-border))]">
                    <td className="px-2 py-2"><Input value={row.model} className="mdm-template-input" onChange={(event) => setEngineRowValue(index, 'model', event.target.value)} /></td>
                    <td className="px-2 py-2"><Input value={row.serialNo} className="mdm-template-input" onChange={(event) => setEngineRowValue(index, 'serialNo', event.target.value)} /></td>
                    <td className="px-2 py-2"><Input value={row.hours} type="number" min="0" step="0.01" className="mdm-template-input" onChange={(event) => setEngineRowValue(index, 'hours', event.target.value)} /></td>
                    <td className="px-2 py-2"><Input value={row.finalHours} type="number" min="0" step="0.01" className="mdm-template-input" onChange={(event) => setEngineRowValue(index, 'finalHours', event.target.value)} /></td>
                    <td className="px-2 py-2"><Input value={row.cycles} type="number" min="0" step="1" className="mdm-template-input" onChange={(event) => setEngineRowValue(index, 'cycles', event.target.value)} /></td>
                    <td className="px-2 py-2"><Input value={row.finalCycles} type="number" min="0" step="1" className="mdm-template-input" onChange={(event) => setEngineRowValue(index, 'finalCycles', event.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Button type="button" variant="outline" onClick={addEngineRow}>Add Engine Row</Button>
          </div>
        </section>

        <section className={sectionClass}>
          <h3 className={sectionHeadingClass}>Crew and Remarks</h3>
          <div className="mdm-template-form-grid">
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
                className="mdm-template-input min-h-[100px]"
                placeholder="Pilot reported discrepancy or snag details"
              />
            </div>
            <div className={fullWidthSectionFieldClass}>
              <Label htmlFor={`${config.mode}-flight-log-remarks`} className="mdm-template-label">Remark</Label>
              <Textarea
                id={`${config.mode}-flight-log-remarks`}
                value={values.remarks}
                onChange={(event) => setFieldValue('remarks', event.target.value)}
                className="mdm-template-input min-h-[80px]"
                placeholder="Additional remarks"
              />
            </div>
          </div>
        </section>
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
