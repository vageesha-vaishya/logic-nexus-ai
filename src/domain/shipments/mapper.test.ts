import { describe, it, expect } from 'vitest';
import { dbRowToAppShipment, appShipmentToDbInsert } from './mapper';
import type { DbShipmentRow, AppShipment } from './types';

describe('Shipment Mapper', () => {
  const mockDate = new Date().toISOString();
  
  const mockDbRow: DbShipmentRow = {
    id: '123',
    shipment_number: 'SH-001',
    shipment_type: 'ocean',
    quote_id: 'Q-001',
    notes: 'Handle with care',
    status: 'in_transit',
    origin_location: { city: 'Shanghai', country: 'China' },
    destination_location: { city: 'Los Angeles', country: 'USA' },
    pickup_date: '2023-01-01',
    estimated_delivery: '2023-02-01',
    actual_delivery: null,
    total_weight_kg: 1000,
    total_cost: 5000,
    currency: 'USD',
    created_at: mockDate,
    updated_at: mockDate,
    owner_id: 'acc_123',
    tenant_id: 'tenant_1',
    carrier_id: 'carr_1',
    franchise_id: 'fran_1',
    created_by: 'user_1',
    destination_warehouse_id: null,
    origin_warehouse_id: null,
    total_volume_cbm: 10,
    delivery_date: null,
    vehicle_id: null
  };

  const mockAppShipment: AppShipment = {
    id: '123',
    shipment_number: 'SH-001',
    shipment_type: 'ocean',
    reference_number: 'Q-001',
    special_instructions: 'Handle with care',
    status: 'in_transit',
    origin_address: { city: 'Shanghai', country: 'China', state_province: null, postal_code: null, latitude: null, longitude: null },
    destination_address: { city: 'Los Angeles', country: 'USA', state_province: null, postal_code: null, latitude: null, longitude: null },
    pickup_date: '2023-01-01',
    estimated_delivery_date: '2023-02-01',
    actual_delivery_date: null,
    total_weight_kg: 1000,
    total_packages: null,
    total_charges: 5000,
    currency: 'USD',
    current_location: null,
    priority_level: null,
    created_at: mockDate,
    pod_received: false,
    pod_received_at: null,
    account_id: 'acc_123',
    accounts: null
  };

  describe('dbRowToAppShipment', () => {
    it('should correctly map a full DB row to App shipment', () => {
      const result = dbRowToAppShipment(mockDbRow);
      expect(result).toEqual(mockAppShipment);
    });

    it('should handle null values gracefully', () => {
      const minimalRow: DbShipmentRow = {
        ...mockDbRow,
        quote_id: null,
        notes: null,
        origin_location: null,
        destination_location: null,
        total_weight_kg: null,
        total_cost: null,
        owner_id: null
      };
      
      const result = dbRowToAppShipment(minimalRow);
      
      expect(result.reference_number).toBeNull();
      expect(result.special_instructions).toBeNull();
      expect(result.origin_address).toBeNull();
      expect(result.destination_address).toBeNull();
      expect(result.total_weight_kg).toBeNull();
      expect(result.total_charges).toBeNull();
      expect(result.account_id).toBeNull();
    });

    it('should normalize shipment types', () => {
      const rowWithWeirdType = { ...mockDbRow, shipment_type: 'sea_freight' as any };
      const result = dbRowToAppShipment(rowWithWeirdType);
      expect(result.shipment_type).toBe('ocean');
    });

    it('should normalize status', () => {
      const rowWithWeirdStatus = { ...mockDbRow, status: 'IN_TRANSIT' };
      const result = dbRowToAppShipment(rowWithWeirdStatus);
      expect(result.status).toBe('in_transit');
    });
  });

  describe('appShipmentToDbInsert', () => {
    it('should correctly map App shipment to partial DB row', () => {
      const partialApp: Partial<AppShipment> = {
        shipment_number: 'SH-002',
        shipment_type: 'air',
        reference_number: 'REF-002',
        special_instructions: 'Fragile',
        status: 'draft',
        origin_address: { city: 'London', country: 'UK' },
        total_weight_kg: 500,
        total_charges: 2000,
        account_id: 'acc_456'
      };

      const result = appShipmentToDbInsert(partialApp);

      expect(result.shipment_number).toBe('SH-002');
      expect(result.shipment_type).toBe('air');
      expect(result.quote_id).toBe('REF-002');
      expect(result.notes).toBe('Fragile');
      expect(result.status).toBe('draft');
      expect(result.origin_location).toEqual({ city: 'London', country: 'UK' });
      expect(result.total_weight_kg).toBe(500);
      expect(result.total_cost).toBe(2000);
      expect(result.owner_id).toBe('acc_456');
    });

    it('should ignore undefined values', () => {
      const result = appShipmentToDbInsert({ shipment_number: 'SH-003' });
      expect(result).toEqual({ shipment_number: 'SH-003' });
      expect(Object.keys(result)).toHaveLength(1);
    });
  });
});
