import { describe, expect, it } from 'vitest';
import { buildPayloadFromForm } from './utils';

describe('buildPayloadFromForm aircraft ownership UUID fields', () => {
  it('persists valid operator, owner, and base location UUID values', () => {
    const result = buildPayloadFromForm('aircraft', {
      tail_number: 'N100AA',
      serial_number: 'SN-100',
      aircraft_type: 'NarrowBody',
      status: 'active',
      aircraft_operators_id: '157b8d12-c115-446e-a4dc-d12077751fe2',
      aircraft_owners_id: '257b8d12-c115-446e-a4dc-d12077751fe2',
      aircraft_base_location_id: '357b8d12-c115-446e-a4dc-d12077751fe2',
    });

    expect(result.errors.aircraft_operators_id).toBeUndefined();
    expect(result.errors.aircraft_owners_id).toBeUndefined();
    expect(result.errors.aircraft_base_location_id).toBeUndefined();
    expect(result.payload.aircraft_operators_id).toBe('157b8d12-c115-446e-a4dc-d12077751fe2');
    expect(result.payload.aircraft_owners_id).toBe('257b8d12-c115-446e-a4dc-d12077751fe2');
    expect(result.payload.aircraft_base_location_id).toBe('357b8d12-c115-446e-a4dc-d12077751fe2');
  });

  it('allows both ownership UUID fields to remain empty', () => {
    const result = buildPayloadFromForm('aircraft', {
      tail_number: 'N101AA',
      serial_number: 'SN-101',
      aircraft_type: 'NarrowBody',
      status: 'active',
      aircraft_operators_id: '',
      aircraft_owners_id: '',
      aircraft_base_location_id: '',
    });

    expect(result.errors.aircraft_operators_id).toBeUndefined();
    expect(result.errors.aircraft_owners_id).toBeUndefined();
    expect(result.errors.aircraft_base_location_id).toBeUndefined();
    expect(result.payload.aircraft_operators_id).toBeUndefined();
    expect(result.payload.aircraft_owners_id).toBeUndefined();
    expect(result.payload.aircraft_base_location_id).toBeUndefined();
  });

  it('returns validation errors for malformed UUID values', () => {
    const result = buildPayloadFromForm('aircraft', {
      tail_number: 'N102AA',
      serial_number: 'SN-102',
      aircraft_type: 'NarrowBody',
      status: 'active',
      aircraft_operators_id: 'bad-uuid',
      aircraft_owners_id: 'also-bad',
      aircraft_base_location_id: 'wrong-base',
    });

    expect(result.errors.aircraft_operators_id).toBe('Operator Owner must be a valid UUID');
    expect(result.errors.aircraft_owners_id).toBe('Aircraft Owner must be a valid UUID');
    expect(result.errors.aircraft_base_location_id).toBe('Base Location must be a valid UUID');
  });
});
