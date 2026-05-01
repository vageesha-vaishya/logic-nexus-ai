import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

function parseRequiredString(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function parseOptionalString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function parseRequiredDate(value: unknown, fieldName: string): string {
  const normalized = parseRequiredString(value, fieldName);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function parseNumericValue(value: unknown, fieldName: string, fallback = 0): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number`);
  }
  return parsed;
}

function parseCycleValue(value: unknown, fieldName: string): number {
  const parsed = parseNumericValue(value, fieldName, 0);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be a whole number`);
  }
  return parsed;
}

function parseOptionalNumericValue(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return parseNumericValue(value, fieldName);
}

function parseOptionalCycleValue(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return parseCycleValue(value, fieldName);
}

function parseOptionalTimestamp(value: unknown, fieldName: string): string | null {
  const normalized = parseOptionalString(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid timestamp`);
  }
  return new Date(parsed).toISOString();
}

function parseOptionalArrayOfUnknown(value: unknown, fieldName: string): unknown[] {
  if (value === undefined || value === null || value === '') return [];
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value;
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null || value === '') {
    return {};
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error('metadata must be an object');
}

type AircraftLookupRow = {
  id: string;
  franchise_id: string | null;
  tail_number: string | null;
  registration: string | null;
};

async function findAircraftByField(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  field: 'id' | 'tail_number' | 'registration',
  value: string,
): Promise<AircraftLookupRow | null> {
  const { data, error } = await supabase
    .from('aircraft')
    .select('id,franchise_id,tail_number,registration')
    .eq('tenant_id', tenantId)
    .eq(field, value)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message || 'Failed to resolve aircraft');
  }
  if (!data) {
    return null;
  }
  return data as unknown as AircraftLookupRow;
}

async function resolveAircraft(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  identifier: string,
): Promise<AircraftLookupRow | null> {
  const idMatch = await findAircraftByField(supabase, tenantId, 'id', identifier);
  if (idMatch) return idMatch;
  const tailMatch = await findAircraftByField(supabase, tenantId, 'tail_number', identifier);
  if (tailMatch) return tailMatch;
  return findAircraftByField(supabase, tenantId, 'registration', identifier);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;

    const access = await resolveAndApplyAccessContext(req, ctx);
    const compatibilityDecision = resolveGatewayCompatibility(req, {
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    applyCompatibilityResponseHeaders(res, compatibilityDecision, ctx.correlationId);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records', 'create_maintenance_request']);

    const tenantId = String(access.tenantId || '').trim();
    const franchiseId = access.franchiseId ? String(access.franchiseId).trim() : null;
    const userId = String(auth.userId || '').trim();
    const body = parseBody(req.body);

    const aircraftIdentifier = parseRequiredString(body.aircraft_id, 'aircraft_id');
    const flightDate = parseRequiredDate(body.flight_date, 'flight_date');
    const flightNumber = parseOptionalString(body.flight_number);
    const departureAirport = parseRequiredString(body.departure_airport, 'departure_airport');
    const arrivalAirport = parseRequiredString(body.arrival_airport, 'arrival_airport');
    const flightHours = parseNumericValue(body.flight_hours, 'flight_hours');
    const blockHours = parseNumericValue(body.block_hours, 'block_hours');
    const flightCycles = parseCycleValue(body.flight_cycles, 'flight_cycles');
    const crewDetails = parseOptionalString(body.crew_details);
    const fuelBurnKg = parseNumericValue(body.fuel_burn_kg, 'fuel_burn_kg', 0);
    const oilUpliftLiters = parseNumericValue(body.oil_uplift_liters, 'oil_uplift_liters', 0);
    const pilotName = parseOptionalString(body.pilot_name);
    const picInCommand = parseOptionalString(body.pic_in_command) || pilotName;
    const coPilot = parseOptionalString(body.co_pilot);
    const classificationId = parseOptionalString(body.classification_id);
    const classificationName = parseOptionalString(body.classification_name);
    const logSelectionNo = parseOptionalString(body.log_selection_no);
    const logPageNo = parseOptionalString(body.log_page_no);
    const pirepDiscrepancy = parseOptionalString(body.pirep_discrepancy);
    const remarks = parseOptionalString(body.remarks);
    const regulatoryAuthority = parseOptionalString(body.regulatory_authority);
    const attachmentRefs = parseOptionalArrayOfUnknown(body.flight_log_attachment_refs, 'flight_log_attachment_refs');
    const airframePeriods = parseOptionalArrayOfUnknown(body.airframe_periods, 'airframe_periods');
    const enginePeriods = parseOptionalArrayOfUnknown(body.engine_periods, 'engine_periods');
    const taxiOutTimeHours = parseOptionalNumericValue(body.taxi_out_time_hours, 'taxi_out_time_hours');
    const airborneTimeHours = parseOptionalNumericValue(body.airborne_time_hours, 'airborne_time_hours');
    const groundRunTimeHours = parseOptionalNumericValue(body.ground_run_time_hours, 'ground_run_time_hours');
    const groundRunPercent = parseOptionalNumericValue(body.ground_run_percent, 'ground_run_percent');
    const totalTimeHours = parseOptionalNumericValue(body.total_time_hours, 'total_time_hours');
    const landings = parseOptionalCycleValue(body.landings, 'landings');
    const timeOut = parseOptionalTimestamp(body.time_out, 'time_out');
    const timeOff = parseOptionalTimestamp(body.time_off, 'time_off');
    const timeOn = parseOptionalTimestamp(body.time_on, 'time_on');
    const timeIn = parseOptionalTimestamp(body.time_in, 'time_in');
    const metadata = {
      ...parseMetadata(body.metadata),
      ...(picInCommand ? { pilot_name: picInCommand } : {}),
    };

    if (departureAirport === arrivalAirport) {
      throw new Error('departure_airport and arrival_airport must be different');
    }
    if (flightHours <= 0 && blockHours <= 0 && flightCycles <= 0) {
      throw new Error('At least one of flight_hours, block_hours, or flight_cycles must be greater than zero');
    }

    const supabase = getSupabaseAdminClient();
    const aircraft = await resolveAircraft(supabase, tenantId, aircraftIdentifier);
    if (!aircraft) {
      return res.status(404).json({
        error: `Aircraft ${aircraftIdentifier} not found`,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const aircraftFranchiseId = aircraft.franchise_id ? String(aircraft.franchise_id).trim() : '';
    if (franchiseId && aircraftFranchiseId && aircraftFranchiseId !== franchiseId) {
      return res.status(403).json({
        error: `Forbidden for aircraft ${aircraftIdentifier}`,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const aircraftId = String(aircraft.id || '').trim();
    const { data, error } = await supabase.rpc('amro_record_flight_log', {
      p_tenant_id: tenantId,
      p_franchise_id: franchiseId,
      p_user_id: userId,
      p_aircraft_id: aircraftId,
      p_flight_date: flightDate,
      p_flight_number: flightNumber,
      p_departure_airport: departureAirport,
      p_arrival_airport: arrivalAirport,
      p_flight_hours: flightHours,
      p_block_hours: blockHours,
      p_flight_cycles: flightCycles,
      p_crew_details: crewDetails,
      p_fuel_burn_kg: fuelBurnKg,
      p_oil_uplift_liters: oilUpliftLiters,
      p_pirep_discrepancy: pirepDiscrepancy,
      p_regulatory_authority: regulatoryAuthority,
      p_metadata: metadata,
    });

    if (error) {
      throw new Error(error.message || 'Failed to record flight log');
    }

    const flightLogId = data && typeof data === 'object' ? String((data as Record<string, unknown>).flight_log_id || '').trim() : '';
    const hasSupplementalFlightLogFields = Boolean(
      picInCommand
      || coPilot
      || classificationId
      || classificationName
      || logSelectionNo
      || logPageNo
      || remarks
      || timeOut
      || timeOff
      || timeOn
      || timeIn
      || attachmentRefs.length
      || airframePeriods.length
      || enginePeriods.length
      || taxiOutTimeHours !== null
      || airborneTimeHours !== null
      || groundRunTimeHours !== null
      || groundRunPercent !== null
      || totalTimeHours !== null
      || landings !== null,
    );
    if (flightLogId && (pilotName || hasSupplementalFlightLogFields)) {
      const updatePayload: Record<string, unknown> = {
        updated_by: userId,
      };
      if (picInCommand) {
        updatePayload.pilot_name = picInCommand;
        updatePayload.pic_in_command = picInCommand;
      }
      if (coPilot !== null) updatePayload.co_pilot = coPilot;
      if (classificationId !== null) updatePayload.classification_id = classificationId;
      if (classificationName !== null) updatePayload.classification_name = classificationName;
      if (logSelectionNo !== null) updatePayload.log_selection_no = logSelectionNo;
      if (logPageNo !== null) updatePayload.log_page_no = logPageNo;
      if (remarks !== null) updatePayload.remarks = remarks;
      if (timeOut !== null) updatePayload.time_out = timeOut;
      if (timeOff !== null) updatePayload.time_off = timeOff;
      if (timeOn !== null) updatePayload.time_on = timeOn;
      if (timeIn !== null) updatePayload.time_in = timeIn;
      if (taxiOutTimeHours !== null) updatePayload.taxi_out_time_hours = taxiOutTimeHours;
      if (airborneTimeHours !== null) updatePayload.airborne_time_hours = airborneTimeHours;
      if (groundRunTimeHours !== null) updatePayload.ground_run_time_hours = groundRunTimeHours;
      if (groundRunPercent !== null) updatePayload.ground_run_percent = groundRunPercent;
      if (totalTimeHours !== null) updatePayload.total_time_hours = totalTimeHours;
      if (landings !== null) updatePayload.landings = landings;
      if (attachmentRefs.length) updatePayload.flight_log_attachment_refs = attachmentRefs;
      if (airframePeriods.length) updatePayload.airframe_periods = airframePeriods;
      if (enginePeriods.length) updatePayload.engine_periods = enginePeriods;

      const { error: pilotUpdateError } = await supabase
        .from('flight_logs')
        .update(updatePayload)
        .eq('id', flightLogId)
        .eq('tenant_id', tenantId);
      if (pilotUpdateError) {
        throw new Error(pilotUpdateError.message || 'Failed to save supplemental flight log fields');
      }
    }

    await supabase.from('maintenance_events').insert({
      tenant_id: tenantId,
      franchise_id: franchiseId,
      aircraft_id: aircraftId,
      event_type: 'amro.flight_log.recorded',
      title: 'Flight log recorded',
      description: `Flight log recorded for aircraft ${aircraftId}`,
      performed_by: userId,
      compliance_authority: regulatoryAuthority,
      data: {
        flight_date: flightDate,
        flight_number: flightNumber,
        departure_airport: departureAirport,
        arrival_airport: arrivalAirport,
        pilot_name: picInCommand,
        co_pilot: coPilot,
        classification_name: classificationName,
        flight_hours: flightHours,
        block_hours: blockHours,
        flight_cycles: flightCycles,
      },
      metadata: {
        source: 'api.v2.amro.flight-logs',
        correlation_id: ctx.correlationId,
      },
    });

    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      output: {
        flight_log: data || null,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
