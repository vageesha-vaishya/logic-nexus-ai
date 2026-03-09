
import { describe, it, expect, vi } from 'vitest';
import { fetchMglOptions } from '../engine/mgl-loader';
import { Logger } from '../../_shared/logger';

describe('fetchMglOptions', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;

  const mockSupabaseClient = {};

  it('should return empty array if no mgl options found', async () => {
    const mockSafeSelect = vi.fn().mockResolvedValue({ data: [], error: null });
    const result = await fetchMglOptions(mockSupabaseClient, 'ver-123', mockSafeSelect, mockLogger);
    expect(result).toEqual([]);
    expect(mockSafeSelect).toHaveBeenCalledWith(
      "rate_options",
      expect.any(String),
      expect.any(String),
      expect.any(Function),
      expect.any(String)
    );
  });

  it('should map mgl options to standard options correctly', async () => {
    // Mock Data
    const mockMglOptions = [
      {
        id: 'opt-1',
        carrier_name: 'Maersk',
        transit_time_days: 20,
        frequency_per_week: 1,
        remarks: 'Test Remark',
        equipment_columns: ['20GP', '40HC']
      }
    ];

    const mockLegs = [
      { id: 'leg-1', sequence_no: 1, transport_mode: 'ocean', origin_code: 'SHA', destination_code: 'LAX', carrier_name: 'Maersk', transit_days: 20 }
    ];

    const mockRows = [
      { id: 'row-1', row_name: 'Freight', currency: 'USD', include_in_total: true, sort_order: 1 },
      { id: 'row-2', row_name: 'THC', currency: 'USD', include_in_total: true, sort_order: 2 }
    ];

    const mockCells = [
      { id: 'cell-1', charge_row_id: 'row-1', equipment_key: '20GP', amount: 1000 },
      { id: 'cell-2', charge_row_id: 'row-1', equipment_key: '40HC', amount: 2000 },
      { id: 'cell-3', charge_row_id: 'row-2', equipment_key: '20GP', amount: 100 },
      { id: 'cell-4', charge_row_id: 'row-2', equipment_key: '40HC', amount: 200 }
    ];

    // Mock safeSelect to return appropriate data based on table name
    const mockSafeSelect = vi.fn().mockImplementation((table) => {
      if (table === 'rate_options') return Promise.resolve({ data: mockMglOptions, error: null });
      if (table === 'rate_option_legs') return Promise.resolve({ data: mockLegs, error: null });
      if (table === 'rate_charge_rows') return Promise.resolve({ data: mockRows, error: null });
      if (table === 'rate_charge_cells') return Promise.resolve({ data: mockCells, error: null });
      return Promise.resolve({ data: [], error: null });
    });

    const result = await fetchMglOptions(mockSupabaseClient, 'ver-123', mockSafeSelect, mockLogger);

    expect(result).toHaveLength(2); // 20GP and 40HC

    // Verify 20GP Option
    const opt20 = result.find(o => o.container_type === '20GP');
    expect(opt20).toBeDefined();
    expect(opt20?.carrier).toBe('Maersk');
    expect(opt20?.transit_time).toBe('20 Days');
    expect(opt20?.frequency).toBe('1 / week');
    expect(opt20?.grand_total).toBe(1100); // 1000 + 100
    expect(opt20?.legs).toHaveLength(1);
    expect(opt20?.charges).toHaveLength(2);
    expect(opt20?.charges[0].amount).toBe(1000);
    expect(opt20?.charges[1].amount).toBe(100);

    // Verify 40HC Option
    const opt40 = result.find(o => o.container_type === '40HC');
    expect(opt40).toBeDefined();
    expect(opt40?.grand_total).toBe(2200); // 2000 + 200
  });
});
