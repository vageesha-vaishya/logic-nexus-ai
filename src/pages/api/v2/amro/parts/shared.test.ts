import { describe, expect, it } from 'vitest';
import {
  mapTemplateToPartsInventoryRow,
  mapPartsInventoryRowToTemplate,
  mapStatusToLifecycle,
  parsePagination,
  resolveWorkflowTriggers,
  validatePartsRecordInput,
} from './shared';

describe('amro parts shared mapping and validation', () => {
  it('maps template record to database row', () => {
    const mapped = mapTemplateToPartsInventoryRow({
      partNumber: 'amro-pn-0001',
      serialNumber: 'sn-1',
      description: 'Main actuator',
      status: 'available',
      quantityOnHand: 12,
      quantityReserved: 3,
      warehouseLocation: 'WH-A-001',
      supplierName: 'AeroLink',
      criticality: 'high',
      ataChapter: '27',
    });
    expect(mapped.part_number).toBe('AMRO-PN-0001');
    expect(mapped.quantity_on_hand).toBe(12);
    expect(mapped.quantity_reserved).toBe(3);
    expect(mapped.lifecycle_status).toBe('serviceable');
  });

  it('maps database row to template shape', () => {
    const template = mapPartsInventoryRowToTemplate({
      id: 'inv-1',
      part_number: 'AMRO-PN-0001',
      serial_number: 'SN-1',
      description: 'Main actuator',
      status: 'low_stock',
      lifecycle_status: 'inspection_due',
      quantity_on_hand: 5,
      quantity_reserved: 1,
      warehouse_location: 'WH-A-001',
      supplier_name: 'AeroLink',
      criticality: 'critical',
      ata_chapter: '27',
    });
    expect(template.partNumber).toBe('AMRO-PN-0001');
    expect(template.lifecycleStatus).toBe('inspection_due');
    expect(template.quantityOnHand).toBe(5);
  });

  it('validates part number and quantity integrity rules', () => {
    const issues = validatePartsRecordInput({
      part_number: 'bad part number',
      serial_number: '#',
      status: 'invalid-status',
      lifecycle_status: 'foo',
      quantity_on_hand: 1,
      quantity_reserved: 3,
      warehouse_location: '',
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.field === 'part_number')).toBe(true);
    expect(issues.some((issue) => issue.field === 'quantity_reserved')).toBe(true);
  });

  it('resolves MRO workflow triggers from lifecycle and stock state', () => {
    const events = resolveWorkflowTriggers({
      previous: { lifecycle_status: 'serviceable', status: 'available' },
      next: {
        lifecycle_status: 'needs_repair',
        status: 'unserviceable',
        criticality: 'critical',
        quantity_on_hand: 2,
        reorder_level: 5,
      },
    });
    expect(events).toContain('repair_scheduling');
    expect(events).toContain('replacement_authorization');
  });

  it('maps status aliases to lifecycle defaults and parses pagination', () => {
    expect(mapStatusToLifecycle('unserviceable')).toBe('needs_repair');
    expect(mapStatusToLifecycle('quarantined')).toBe('quarantined');
    const paging = parsePagination({
      method: 'GET',
      query: { page: '2', page_size: '25' },
      headers: {},
    } as any);
    expect(paging.page).toBe(2);
    expect(paging.pageSize).toBe(25);
  });

  it('triggers inspection workflow when lifecycle enters inspection_due', () => {
    const events = resolveWorkflowTriggers({
      previous: { lifecycle_status: 'serviceable', status: 'available' },
      next: {
        lifecycle_status: 'inspection_due',
        status: 'quarantined',
        criticality: 'normal',
        quantity_on_hand: 10,
        reorder_level: 3,
      },
    });
    expect(events).toContain('part_inspection');
  });
});
