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

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null || value === '') {
    return {};
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error('metadata must be an object');
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

    const aircraftId = parseRequiredString(body.aircraft_id, 'aircraft_id');
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
    const pirepDiscrepancy = parseOptionalString(body.pirep_discrepancy);
    const regulatoryAuthority = parseOptionalString(body.regulatory_authority);
    const metadata = parseMetadata(body.metadata);

    if (departureAirport === arrivalAirport) {
      throw new Error('departure_airport and arrival_airport must be different');
    }
    if (flightHours <= 0 && blockHours <= 0 && flightCycles <= 0) {
      throw new Error('At least one of flight_hours, block_hours, or flight_cycles must be greater than zero');
    }

    const supabase = getSupabaseAdminClient();
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
