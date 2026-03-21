export type LogisticsTransportMode = 'ocean' | 'air' | 'trucking' | 'rail';

export type LogisticsLegDraft = {
  id: string;
  mode: LogisticsTransportMode;
  origin: string;
  destination: string;
  carrier: string;
  departureAt: string;
  arrivalAt: string;
  vesselName: string;
  voyageNumber: string;
  flightNumber: string;
  truckReference: string;
  railServiceCode: string;
};

export type LogisticsLegValidationResult = {
  isValid: boolean;
  missingFields: string[];
};

export type CarrierConnectorStatus = 'healthy' | 'degraded' | 'down';

export type CarrierConnectorDiagnostic = {
  id: string;
  connector: string;
  status: CarrierConnectorStatus;
  lastHeartbeat: string;
  retryAttempts: number;
  pendingJobs: number;
};

export const LOGISTICS_MODE_FIELD_SCHEMA: Record<LogisticsTransportMode, (keyof LogisticsLegDraft)[]> = {
  ocean: ['origin', 'destination', 'carrier', 'departureAt', 'arrivalAt', 'vesselName', 'voyageNumber'],
  air: ['origin', 'destination', 'carrier', 'departureAt', 'arrivalAt', 'flightNumber'],
  trucking: ['origin', 'destination', 'carrier', 'departureAt', 'arrivalAt', 'truckReference'],
  rail: ['origin', 'destination', 'carrier', 'departureAt', 'arrivalAt', 'railServiceCode'],
};

export function validateLegDraft(leg: LogisticsLegDraft): LogisticsLegValidationResult {
  const requiredFields = LOGISTICS_MODE_FIELD_SCHEMA[leg.mode];
  const missingFields = requiredFields.filter((field) => {
    const rawValue = leg[field];
    if (typeof rawValue !== 'string') return true;
    return rawValue.trim().length === 0;
  });
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

export function shouldRollbackConnectorRetry(connector: CarrierConnectorDiagnostic): boolean {
  return connector.status === 'down' && connector.retryAttempts >= 2;
}

export function applyOptimisticConnectorRetry(connector: CarrierConnectorDiagnostic): CarrierConnectorDiagnostic {
  return {
    ...connector,
    status: 'degraded',
    retryAttempts: connector.retryAttempts + 1,
    lastHeartbeat: new Date().toISOString(),
  };
}
