import { describe, it, expect } from 'vitest';
import { mapQuoteToBooking, validateMapping } from '../../src/lib/mapping-engine';

describe('Quote to Booking Mapping Engine', () => {
  const mockQuote = {
    id: '123',
    quote_number: 'QUO-001',
    account_id: 'acc-123',
    total_amount: 5000,
    currency: 'USD',
    incoterms: 'FOB',
    origin_location: { name: 'Shanghai' },
    destination_location: { name: 'Los Angeles' }
  };

  it('should map basic fields correctly', () => {
    const result = mapQuoteToBooking(mockQuote);
    
    expect(result.account_id).toBe(mockQuote.account_id);
    expect(result.total_amount).toBe(mockQuote.total_amount);
    expect(result.currency).toBe(mockQuote.currency);
    expect(result.incoterms).toBe(mockQuote.incoterms);
    expect(result.origin).toBe('Shanghai');
    expect(result.destination).toBe('Los Angeles');
    expect(result.notes).toContain(mockQuote.quote_number);
    expect(result.booking_number).toContain('BK-');
  });

  it('should handle missing optional fields with defaults', () => {
    const minimalQuote = {
        quote_number: 'QUO-002',
        total_amount: 1000,
        currency: 'USD'
    };
    const result = mapQuoteToBooking(minimalQuote);
    
    expect(result.origin).toBe('');
    expect(result.destination).toBe('');
    expect(result.incoterms).toBe('FOB'); // Default
    expect(result.currency).toBe('USD');
  });
});

describe('Mapping Validation', () => {
  const mockQuote = {
    total_amount: 5000,
    currency: 'USD',
    origin_location: { name: 'Shanghai' },
    destination_location: { name: 'Los Angeles' }
  };

  it('should validate correct mapping', () => {
    const booking = {
        booking_number: '123',
        account_id: 'acc-1',
        total_amount: 5000,
        currency: 'USD',
        origin: 'Shanghai',
        destination: 'Los Angeles'
    };
    
    const result = validateMapping(booking, mockQuote);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail if required fields are missing', () => {
    const booking = {
        booking_number: '123',
        account_id: 'acc-1',
        total_amount: 5000,
        currency: 'USD',
        origin: '', // Empty - should fail
        destination: 'Los Angeles'
    };
    
    const result = validateMapping(booking, mockQuote);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Origin location is required.');
  });
});
