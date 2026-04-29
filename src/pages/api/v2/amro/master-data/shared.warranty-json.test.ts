import { describe, expect, it } from 'vitest';
import { HttpError, normalizePayload, sanitizeWritePayload } from './shared';

describe('AMRO aircraft warranty_json handling', () => {
  it('stores warranty state in warranty_json and does not emit scalar warranty columns', () => {
    const payload = sanitizeWritePayload('aircraft', {
      tail_number: 'N100AA',
      serial_number: 'MSN-001',
      is_under_warranty: true,
      warranty_start_date: '2026-01-01',
      warranty_end_date: '2027-01-01',
    });

    expect(payload.warranty_json).toEqual({
      is_under_warranty: true,
      warranty_start_date: '2026-01-01',
      warranty_end_date: '2027-01-01',
    });
    expect(Object.prototype.hasOwnProperty.call(payload, 'is_under_warranty')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'warranty_start_date')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'warranty_end_date')).toBe(false);
  });

  it('uses warranty_json as canonical source when both scalar and json values are present', () => {
    const payload = sanitizeWritePayload('aircraft', {
      tail_number: 'N200BB',
      serial_number: 'MSN-002',
      is_under_warranty: true,
      warranty_json: {
        is_under_warranty: false,
        warranty_start_date: '2025-02-01',
        warranty_end_date: '2026-02-01',
      },
    });

    expect(payload.warranty_json).toEqual({
      is_under_warranty: false,
      warranty_start_date: '2025-02-01',
      warranty_end_date: '2026-02-01',
    });
  });

  it('defaults missing warranty_json fields safely', () => {
    const normalized = normalizePayload('aircraft', {
      tail_number: 'N300CC',
      serial_number: 'MSN-003',
    }) as Record<string, unknown>;

    expect(normalized.warranty_json).toEqual({
      is_under_warranty: false,
      warranty_start_date: null,
      warranty_end_date: null,
    });
  });

  it('throws a clear error when warranty_json is malformed', () => {
    expect(() =>
      sanitizeWritePayload('aircraft', {
        tail_number: 'N400DD',
        serial_number: 'MSN-004',
        warranty_json: 'bad-json-shape',
      }),
    ).toThrowError(HttpError);

    expect(() =>
      sanitizeWritePayload('aircraft', {
        tail_number: 'N400DD',
        serial_number: 'MSN-004',
        warranty_json: 'bad-json-shape',
      }),
    ).toThrow('warranty_json must be an object');
  });
});
