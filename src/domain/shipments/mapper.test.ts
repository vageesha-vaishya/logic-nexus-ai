import { describe, it, expect } from 'vitest';
import { dbRowToAppShipment, appShipmentToDbInsert } from './mapper';
import type { DbShipmentRow, AppShipment } from './types';

describe('Shipment Mapper', () => {
  const mockDate = new Date().toISOString();
  
  // Create a minimal mock that satisfies the type requirements
  const mockDbRow = {
    id: '123',
    shipment_number: 'SH-001',
    shipment_type: 'ocean_freight' as const,
    reference_number: 'Q-001',
    special_instructions: 'Handle with care',
    status: 'in_transit' as const,
    origin_address: { city: 'Shanghai', country: 'China' },
    destination_address: { city: 'Los Angeles', country: 'USA' },
    pickup_date: '2023-01-01',
    estimated_delivery_date: '2023-02-01',
    actual_delivery_date: null,
    total_weight_kg: 1000,
    total_packages: 10,
    total_charges: 5000,
    currency: 'USD',
    priority_level: 'normal',
    created_at: mockDate,
    updated_at: mockDate,
    account_id: 'acc_123',
    tenant_id: 'tenant_1',
    carrier_id: 'carr_1',
    franchise_id: 'fran_1',
    assigned_to: 'user_1',
    contact_id: null,
    container_number: null,
    container_type: '20ft_standard' as const,
    vehicle_id: null
  } as unknown as DbShipmentRow;

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
    total_packages: 10,
    total_charges: 5000,
    currency: 'USD',
    current_location: null,
    priority_level: 'normal',
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
      const minimalRow = {
        ...mockDbRow,
        reference_number: null,
        special_instructions: null,
        origin_address: null,
        destination_address: null,
        total_weight_kg: null,
        total_charges: null,
        account_id: null
      } as unknown as DbShipmentRow;
      
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
      const rowWithWeirdType = { ...mockDbRow, shipment_type: 'ocean_freight' as const };
      const result = dbRowToAppShipment(rowWithWeirdType);
      expect(result.shipment_type).toBe('ocean');
    });

    it('should normalize status', () => {
      const rowWithWeirdStatus = { ...mockDbRow, status: 'in_transit' as const };
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
      expect(result.reference_number).toBe('REF-002');
      expect(result.special_instructions).toBe('Fragile');
      expect(result.status).toBe('draft');
      expect(result.origin_address).toEqual({ city: 'London', country: 'UK' });
      expect(result.total_weight_kg).toBe(500);
      expect(result.total_charges).toBe(2000);
      expect(result.account_id).toBe('acc_456');
    });

    it('should ignore undefined values', () => {
      const result = appShipmentToDbInsert({ shipment_number: 'SH-003' });
      expect(result).toEqual({ shipment_number: 'SH-003' });
      expect(Object.keys(result)).toHaveLength(1);
    });
  });
});
