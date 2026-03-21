import { describe, expect, it } from 'vitest';
import {
  applyOptimisticConnectorRetry,
  shouldRollbackConnectorRetry,
  validateLegDraft,
} from './logisticsWorkspaceModel';

describe('logisticsWorkspaceModel', () => {
  it('validates required leg fields based on transport mode', () => {
    const invalidAirLeg = {
      id: 'leg-air',
      mode: 'air' as const,
      origin: 'DXB',
      destination: '',
      carrier: 'Emirates',
      departureAt: '',
      arrivalAt: '2026-03-21T14:00:00.000Z',
      vesselName: '',
      voyageNumber: '',
      flightNumber: '',
      truckReference: '',
      railServiceCode: '',
    };
    const result = validateLegDraft(invalidAirLeg);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toEqual(['destination', 'departureAt', 'flightNumber']);
  });

  it('applies optimistic retry and enforces deterministic rollback policy', () => {
    const connector = {
      id: 'carrier-freightos',
      connector: 'Freightos',
      status: 'down' as const,
      lastHeartbeat: '2026-03-20T00:00:00.000Z',
      retryAttempts: 2,
      pendingJobs: 8,
    };
    const optimistic = applyOptimisticConnectorRetry(connector);
    expect(optimistic.retryAttempts).toBe(3);
    expect(optimistic.status).toBe('degraded');
    expect(shouldRollbackConnectorRetry(connector)).toBe(true);
  });
});
