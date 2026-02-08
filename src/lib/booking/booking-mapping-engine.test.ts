import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingMappingEngine, StandardMappingStrategy, Quote, BookingDraft } from './booking-mapping-engine';
import { addDays, format, subDays } from 'date-fns';

describe('StandardMappingStrategy', () => {
  let strategy: StandardMappingStrategy;
  let mockQuote: Quote;

  beforeEach(() => {
    strategy = new StandardMappingStrategy();
    mockQuote = {
      id: 'quote-123',
      quote_number: 'Q-2026-001',
      tenant_id: 'tenant-1',
      account_id: 'acc-1',
      status: 'approved',
      total_amount: 1000,
      currency: 'USD',
      origin_port: { name: 'Shanghai', code: 'CNSHA' },
      destination_port: { name: 'Los Angeles', code: 'USLAX' },
      valid_until: format(addDays(new Date(), 10), 'yyyy-MM-dd'),
      container_qty: 2,
      container_type_id: '40HC',
      line_items: [{ description: 'Electronics', weight: 500 }]
    };
  });

  it('should map a valid quote to a booking draft', () => {
    const result = strategy.map(mockQuote);

    expect(result).toMatchObject({
      quote_id: mockQuote.id,
      tenant_id: mockQuote.tenant_id,
      account_id: mockQuote.account_id,
      source: 'quote',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      total_amount: 1000,
      container_qty: 2,
      container_type_id: '40HC',
      commodity_list: mockQuote.line_items
    });
    expect(result.booking_number).toMatch(/^BK-2026-\d{4}$/);
    expect(result.mapping_metadata?.strategy).toBe('Standard');
  });

  it('should preserve existing booking details when provided', () => {
    const existingBooking: BookingDraft = {
      booking_number: 'BK-EXISTING-001',
      tenant_id: 'tenant-1',
      status: 'submitted',
      source: 'manual',
      origin: 'Old Origin',
      destination: 'Old Dest',
      incoterms: 'CIF',
      total_amount: 500,
      currency: 'USD',
      notes: 'Existing notes'
    };

    const result = strategy.map(mockQuote, existingBooking);

    expect(result.booking_number).toBe('BK-EXISTING-001');
    expect(result.status).toBe('submitted');
    expect(result.notes).toBe('Existing notes');
    // Should overwrite these with quote data as per standard strategy
    expect(result.total_amount).toBe(1000); 
    expect(result.origin).toBe('Shanghai');
  });

  it('should validate an expired quote', () => {
    mockQuote.valid_until = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const draft = strategy.map(mockQuote);
    const validation = strategy.validate(mockQuote, draft);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0]).toContain('expired');
  });

  it('should warn if booking amount differs from quote amount', () => {
    const draft = strategy.map(mockQuote);
    draft.total_amount = 1200; // Changed manually
    
    const validation = strategy.validate(mockQuote, draft);

    expect(validation.warnings).toHaveLength(1);
    expect(validation.warnings[0]).toContain('amount');
  });

  it('should warn if booking quantity is less than quote quantity', () => {
    const draft = strategy.map(mockQuote);
    draft.container_qty = 1; // Less than quote's 2
    
    const validation = strategy.validate(mockQuote, draft);

    expect(validation.warnings).toHaveLength(1);
    expect(validation.warnings[0]).toContain('quantity');
  });
});

describe('BookingMappingEngine', () => {
  let engine: BookingMappingEngine;
  let mockQuote: Quote;

  beforeEach(() => {
    engine = new BookingMappingEngine();
    mockQuote = {
      id: 'quote-123',
      quote_number: 'Q-2026-001',
      tenant_id: 'tenant-1',
      total_amount: 1000,
      currency: 'USD',
      status: 'approved'
    };
  });

  it('should use standard strategy by default', () => {
    const { booking, validation } = engine.map(mockQuote);
    expect(booking.mapping_metadata?.strategy).toBe('Standard');
    expect(validation.valid).toBe(true);
  });

  it('should allow registering and using a custom strategy', () => {
    const customStrategy = {
      name: 'Custom',
      map: (q: Quote) => ({
        booking_number: 'CUSTOM-001',
        tenant_id: q.tenant_id,
        status: 'draft',
        source: 'quote',
        origin: 'Custom Origin',
        destination: 'Custom Dest',
        incoterms: 'EXW',
        total_amount: q.total_amount,
        currency: q.currency
      } as BookingDraft),
      validate: () => ({ valid: true, errors: [], warnings: [] })
    };

    engine.registerStrategy('custom', customStrategy);
    const { booking } = engine.map(mockQuote, 'custom');

    expect(booking.booking_number).toBe('CUSTOM-001');
    expect(booking.origin).toBe('Custom Origin');
  });

  it('should fallback to standard strategy if requested strategy not found', () => {
    const { booking } = engine.map(mockQuote, 'non-existent');
    expect(booking.mapping_metadata?.strategy).toBe('Standard');
  });
});
