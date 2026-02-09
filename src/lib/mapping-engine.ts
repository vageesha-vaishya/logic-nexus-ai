import { format, addDays, isBefore } from 'date-fns';

export interface BookingDraft {
  booking_number: string;
  account_id?: string;
  origin?: string;
  destination?: string;
  incoterms?: string;
  total_amount?: number;
  currency?: string;
  vessel_name?: string;
  voyage_number?: string;
  notes?: string;
  cargo_ready_date?: string;
  commodity_list?: any[];
  shipping_service?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Intelligent Data Population Engine
 * Maps Quote data to Booking schema with type validation and transformation.
 */
export function mapQuoteToBooking(quote: any): BookingDraft {
  // Generate a draft booking number
  const draftNumber = `BK-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  return {
    booking_number: draftNumber,
    account_id: quote.account_id,
    origin: quote.origin_location?.name || quote.origin_port?.name || '',
    destination: quote.destination_location?.name || quote.destination_port?.name || '',
    incoterms: quote.incoterms || 'FOB', // Default if missing
    total_amount: Number(quote.total_amount) || 0,
    currency: quote.currency || 'USD',
    vessel_name: quote.vessel_name || '',
    voyage_number: quote.voyage_number || '',
    notes: `Mapped from Quote ${quote.quote_number} on ${format(new Date(), 'yyyy-MM-dd')}`,
    cargo_ready_date: quote.cargo_ready_date || format(addDays(new Date(), 7), 'yyyy-MM-dd'), // Default to 1 week out if missing
    commodity_list: quote.line_items || [],
    shipping_service: quote.service_level || 'Standard'
  };
}

/**
 * Validates the mapping against business rules.
 */
export function validateMapping(booking: BookingDraft, quote: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Data Integrity Checks
  if (!booking.account_id) {
    errors.push("Account ID is missing. Booking must be linked to a customer.");
  }

  if (!booking.origin) {
    errors.push("Origin location is required.");
  }

  if (!booking.destination) {
    errors.push("Destination location is required.");
  }

  // 2. Business Rule Validation
  if (booking.total_amount && booking.total_amount > 1000000) {
      warnings.push("High value booking (>1M). Requires supervisor approval.");
  }

  // Currency Check
  if (booking.currency !== quote.currency) {
      warnings.push(`Currency mismatch: Quote is ${quote.currency}, Booking is ${booking.currency}. Exchange rate rules may apply.`);
  }

  // Date Validation
  if (booking.cargo_ready_date && isBefore(new Date(booking.cargo_ready_date), new Date())) {
      errors.push("Cargo Ready Date cannot be in the past.");
  }

  // 3. Conflict Resolution (Mock)
  // In a real scenario, this would check against available vessel capacity via API
  
  return {
      valid: errors.length === 0,
      errors,
      warnings
  };
}
