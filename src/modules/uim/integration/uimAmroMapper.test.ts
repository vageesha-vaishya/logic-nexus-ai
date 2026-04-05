import { describe, expect, it } from 'vitest';
import { mapAmroPayloadToUimMetadata, mapUimAvailabilityRowToAmro } from './uimAmroMapper';

describe('uimAmroMapper', () => {
  it('maps availability rows to AMRO-facing response shape', () => {
    const mapped = mapUimAvailabilityRowToAmro({
      inventory_item_id: 'inv-1',
      catalog_item_id: 'cat-1',
      sku: 'UIM-MRO-000001',
      part_number: 'MRO-PN-70000001',
      title: 'Example',
      quantity: 10,
      projected_reserved_quantity: 3,
      status: 'available',
      aog_priority: true,
    });
    expect(mapped.quantity_available).toBe(7);
    expect(mapped.aog_priority).toBe(true);
  });

  it('maps AMRO payload fields into UIM metadata contract', () => {
    const metadata = mapAmroPayloadToUimMetadata({
      maintenance_order_id: 'MO-1',
      work_package_id: 'WP-1',
      task_id: 'TASK-1',
      requested_by: 'planner',
      amro_reference: 'AMRO-REF',
    });
    expect(metadata.source).toBe('amro');
    expect(metadata.maintenance_order_id).toBe('MO-1');
  });
});
