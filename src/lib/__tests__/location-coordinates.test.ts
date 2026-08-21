import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

function chain(result: { data: any }) {
  return {
    select: () => ({
      ilike: () => ({
        limit: () => ({
          maybeSingle: () => Promise.resolve(result),
        }),
      }),
    }),
  };
}

import { resolveCoordinates, __clearCoordinatesCacheForTests } from '../location-coordinates';

describe('resolveCoordinates', () => {
  beforeEach(() => {
    __clearCoordinatesCacheForTests();
    mockFrom.mockReset();
  });

  it('returns null for an empty/blank name without querying', async () => {
    const result = await resolveCoordinates('   ');
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns null for null/undefined input', async () => {
    expect(await resolveCoordinates(null)).toBeNull();
    expect(await resolveCoordinates(undefined)).toBeNull();
  });

  it('resolves from ports_locations, parsing the {latitude,longitude} JSON shape', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ports_locations') return chain({ data: { coordinates: { latitude: 31.2, longitude: 121.5 } } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('CNSHA');
    expect(result).toEqual({ lat: 31.2, lng: 121.5 });
  });

  it('falls through to airports when ports_locations has no match', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ports_locations') return chain({ data: null });
      if (table === 'airports') return chain({ data: { latitude: 33.9, longitude: -118.4 } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('LAX');
    expect(result).toEqual({ lat: 33.9, lng: -118.4 });
  });

  it('falls through to cities when ports_locations and airports have no match', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cities') return chain({ data: { latitude: 40.7, longitude: -74.0 } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('New York');
    expect(result).toEqual({ lat: 40.7, lng: -74.0 });
  });

  it('falls through to transfer_points when nothing else matches', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'transfer_points') return chain({ data: { latitude: 51.5, longitude: -0.1 } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('LondonHub');
    expect(result).toEqual({ lat: 51.5, lng: -0.1 });
  });

  it('returns null when nothing matches in any table', async () => {
    mockFrom.mockImplementation(() => chain({ data: null }));
    const result = await resolveCoordinates('Nowhereville');
    expect(result).toBeNull();
  });

  it('discards malformed coordinate data (non-numeric lat/lng)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ports_locations') return chain({ data: { coordinates: { latitude: 'not-a-number', longitude: null } } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('BadData');
    expect(result).toBeNull();
  });

  it('discards a row with NULL latitude/longitude instead of resolving to {lat:0,lng:0}', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cities') return chain({ data: { latitude: null, longitude: null } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('NullIslandCity');
    expect(result).toBeNull();
  });

  it('discards out-of-range coordinate values', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cities') return chain({ data: { latitude: 999, longitude: 5000 } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('OutOfRangeCity');
    expect(result).toBeNull();
  });

  it('caches results — a second call for the same (normalized) name does not re-query', async () => {
    let portCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ports_locations') {
        portCallCount += 1;
        return chain({ data: { coordinates: { latitude: 1, longitude: 2 } } });
      }
      return chain({ data: null });
    });
    await resolveCoordinates('CNSHA');
    await resolveCoordinates('  cnsha  ');
    expect(portCallCount).toBe(1);
  });

  it('returns null (not throw) when a query rejects', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        ilike: () => ({
          limit: () => ({
            maybeSingle: () => Promise.reject(new Error('network error')),
          }),
        }),
      }),
    }));
    const result = await resolveCoordinates('AnythingAtAll');
    expect(result).toBeNull();
  });
});
