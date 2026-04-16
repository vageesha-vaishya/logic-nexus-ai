import { describe, expect, it } from 'vitest';
import { filterTemplatesByAircraft } from './templateFiltering';

const templates = [
  {
    id: 'wpt-1',
    value: 'wpt-1',
    label: 'WPT-A320',
    tenant_id: 'tenant-1',
    model_id: 'model-a320',
    aircraft_model: 'A320-200-157',
    name: 'WPT-A320',
    description: null,
    version: 1,
    status: 'active',
  },
  {
    id: 'wpt-2',
    value: 'wpt-2',
    label: 'WPT-B737',
    tenant_id: 'tenant-1',
    model_id: 'model-b737',
    aircraft_model: 'B737-800',
    name: 'WPT-B737',
    description: null,
    version: 1,
    status: 'active',
  },
  {
    id: 'wpt-3',
    value: 'wpt-3',
    label: 'WPT-A320-OTHER-TENANT',
    tenant_id: 'tenant-2',
    model_id: 'model-a320',
    aircraft_model: 'A320-200-157',
    name: 'WPT-A320-OTHER-TENANT',
    description: null,
    version: 1,
    status: 'active',
  },
];

describe('filterTemplatesByAircraft', () => {
  it('matches by exact tenant + model_id', () => {
    const result = filterTemplatesByAircraft({
      aircraftTenantId: 'tenant-1',
      aircraftModelId: 'model-a320',
      aircraftModelName: 'A320-200-157',
      templates,
    });
    expect(result.map((row) => row.id)).toEqual(['wpt-1']);
  });

  it('falls back to exact model designation when model_id is unavailable', () => {
    const result = filterTemplatesByAircraft({
      aircraftTenantId: 'tenant-1',
      aircraftModelId: null,
      aircraftModelName: 'A320-200-157',
      templates,
    });
    expect(result.map((row) => row.id)).toEqual(['wpt-1']);
  });

  it('returns empty when no matching template exists', () => {
    const result = filterTemplatesByAircraft({
      aircraftTenantId: 'tenant-1',
      aircraftModelId: 'model-a330',
      aircraftModelName: 'A330-900',
      templates,
    });
    expect(result).toEqual([]);
  });

  it('returns empty when model metadata is null/undefined', () => {
    const result = filterTemplatesByAircraft({
      aircraftTenantId: 'tenant-1',
      aircraftModelId: null,
      aircraftModelName: null,
      templates,
    });
    expect(result).toEqual([]);
  });
});

