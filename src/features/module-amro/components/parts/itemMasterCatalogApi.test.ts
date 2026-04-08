import { describe, expect, it, vi } from 'vitest';
import {
  createItemMasterRecord,
  getItemMasterRecord,
  listItemMasterRecords,
  updateItemMasterRecord,
} from './itemMasterCatalogApi';

describe('itemMasterCatalogApi', () => {
  it('lists records', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: {
          total: 1,
          records: [{
            id: 'item-1',
            partNumber: 'AMRO-ITEM-001',
            description: 'Pump',
            itemType: 'part',
            status: 'active',
            lifecycleStatus: 'serviceable',
            category: 'hydraulics',
            subcategory: 'pump',
            specification: {},
            manufacturerName: null,
            manufacturerPartNumber: null,
            oemPartNumber: null,
            unitOfMeasure: 'EA',
            baseUnitOfMeasure: 'EA',
            uomConversionFactor: 1,
            currency: 'USD',
            isActive: true,
            metadata: {},
            crossReferences: [],
            uomConversions: [],
          }],
        },
      }),
    });
    const result = await listItemMasterRecords({ page: 1, pageSize: 20 }, fetchMock as never);
    expect(result.total).toBe(1);
    expect(result.records[0]?.partNumber).toBe('AMRO-ITEM-001');
  });

  it('loads detail record', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: {
          record: {
            id: 'item-1',
            partNumber: 'AMRO-ITEM-001',
            description: 'Pump',
            itemType: 'part',
            status: 'active',
            lifecycleStatus: 'inspection_due',
            category: null,
            subcategory: null,
            specification: {},
            manufacturerName: null,
            manufacturerPartNumber: null,
            oemPartNumber: null,
            unitOfMeasure: 'EA',
            baseUnitOfMeasure: 'EA',
            uomConversionFactor: 1,
            currency: 'USD',
            isActive: true,
            metadata: {},
            crossReferences: [],
            uomConversions: [],
          },
        },
      }),
    });
    const result = await getItemMasterRecord('item-1', fetchMock as never);
    expect(result.lifecycleStatus).toBe('inspection_due');
  });

  it('surfaces field-level validation errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        issues: [{ field: 'part_number', message: 'invalid format' }],
      }),
    });
    await expect(createItemMasterRecord({
      partNumber: 'bad',
      description: '',
      itemType: 'part',
      category: '',
      subcategory: '',
      status: 'active',
      lifecycleStatus: 'serviceable',
      specification: {},
      manufacturerName: '',
      manufacturerPartNumber: '',
      oemPartNumber: '',
      unitOfMeasure: 'EA',
      baseUnitOfMeasure: 'EA',
      uomConversionFactor: 1,
      currency: 'USD',
      isActive: true,
      metadata: {},
      crossReferences: [],
      uomConversions: [],
    }, fetchMock as never)).rejects.toThrow(/part_number/);
  });

  it('updates records', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: {
          record: {
            id: 'item-2',
            partNumber: 'AMRO-ITEM-002',
            description: 'Valve',
            itemType: 'part',
            status: 'inactive',
            lifecycleStatus: 'retired',
            category: null,
            subcategory: null,
            specification: {},
            manufacturerName: null,
            manufacturerPartNumber: null,
            oemPartNumber: null,
            unitOfMeasure: 'EA',
            baseUnitOfMeasure: 'EA',
            uomConversionFactor: 1,
            currency: 'USD',
            isActive: false,
            metadata: {},
            crossReferences: [],
            uomConversions: [],
          },
        },
      }),
    });
    const result = await updateItemMasterRecord('item-2', {
      partNumber: 'AMRO-ITEM-002',
      description: 'Valve',
      itemType: 'part',
      category: '',
      subcategory: '',
      status: 'inactive',
      lifecycleStatus: 'retired',
      specification: {},
      manufacturerName: '',
      manufacturerPartNumber: '',
      oemPartNumber: '',
      unitOfMeasure: 'EA',
      baseUnitOfMeasure: 'EA',
      uomConversionFactor: 1,
      currency: 'USD',
      isActive: false,
      metadata: {},
      crossReferences: [],
      uomConversions: [],
    }, fetchMock as never);
    expect(result.status).toBe('inactive');
  });
});
