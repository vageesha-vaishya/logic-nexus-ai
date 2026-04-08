import { describe, expect, it } from 'vitest';
import {
  mapItemMasterRowToTemplate,
  mapTemplateToItemMasterRow,
  parsePagination,
  validateItemMasterInput,
} from './shared';

describe('amro item master shared mapping and validation', () => {
  it('maps template record to item master row', () => {
    const mapped = mapTemplateToItemMasterRow({
      partNumber: 'amro-item-001',
      description: 'Hydraulic Pump Core',
      itemType: 'part',
      category: 'hydraulics',
      subcategory: 'pump',
      status: 'active',
      lifecycleStatus: 'serviceable',
      manufacturerPartNumber: 'MFG-HP-01',
      oemPartNumber: 'OEM-HP-01',
      unitOfMeasure: 'ea',
      baseUnitOfMeasure: 'ea',
      uomConversionFactor: 1,
      currency: 'usd',
    });
    expect(mapped.part_number).toBe('AMRO-ITEM-001');
    expect(mapped.item_type).toBe('part');
    expect(mapped.currency).toBe('USD');
  });

  it('maps row shape to template output', () => {
    const mapped = mapItemMasterRowToTemplate({
      id: 'item-1',
      part_number: 'AMRO-ITEM-002',
      status: 'active',
      lifecycle_status: 'inspection_due',
      unit_of_measure: 'EA',
      base_unit_of_measure: 'EA',
      uom_conversion_factor: 1,
      currency: 'USD',
      is_active: true,
    });
    expect(mapped.partNumber).toBe('AMRO-ITEM-002');
    expect(mapped.lifecycleStatus).toBe('inspection_due');
    expect(mapped.isActive).toBe(true);
  });

  it('validates invalid item master payloads', () => {
    const issues = validateItemMasterInput({
      part_number: 'bad part',
      item_type: 'invalid',
      status: 'unknown',
      lifecycle_status: 'foo',
      unit_of_measure: '',
      base_unit_of_measure: '',
      uom_conversion_factor: 0,
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.field === 'part_number')).toBe(true);
    expect(issues.some((issue) => issue.field === 'item_type')).toBe(true);
  });

  it('parses pagination defaults and bounds', () => {
    const paging = parsePagination({
      method: 'GET',
      query: { page: '2', page_size: '25' },
      headers: {},
    } as any);
    expect(paging.page).toBe(2);
    expect(paging.pageSize).toBe(25);
  });
});
