import { format, addDays, isAfter, parseISO } from 'date-fns';

// --- Interfaces ---

export interface Quote {
  id: string;
  quote_number: string;
  tenant_id: string;
  account_id?: string;
  valid_until?: string;
  status: string;
  total_amount: number;
  currency: string;
  origin_port?: { name: string; code?: string };
  destination_port?: { name: string; code?: string };
  origin_location?: { name: string };
  destination_location?: { name: string };
  incoterms?: string;
  vessel_name?: string;
  voyage_number?: string;
  cargo_ready_date?: string;
  line_items?: any[];
  service_level?: string;
  container_qty?: number;
  container_type_id?: string;
  notes?: string;
}

export interface BookingDraft {
  id?: string;
  quote_id?: string;
  booking_number: string;
  account_id?: string;
  tenant_id: string;
  status: 'draft' | 'submitted' | 'confirmed';
  source: 'manual' | 'quote' | 'ai_agent';
  origin: string;
  destination: string;
  incoterms: string;
  total_amount: number;
  currency: string;
  vessel_name?: string;
  voyage_number?: string;
  notes?: string;
  cargo_ready_date?: string;
  container_qty?: number;
  container_type_id?: string;
  commodity_list?: any[];
  mapping_metadata?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MappingStrategy {
  name: string;
  map(quote: Quote, existingBooking?: BookingDraft): BookingDraft;
  validate(quote: Quote, booking: BookingDraft): ValidationResult;
}

// --- Strategies ---

export class StandardMappingStrategy implements MappingStrategy {
  name = 'Standard';

  map(quote: Quote, existingBooking?: BookingDraft): BookingDraft {
    const draftNumber = existingBooking?.booking_number || 
      `BK-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    const baseBooking: BookingDraft = {
      booking_number: draftNumber,
      quote_id: quote.id,
      tenant_id: quote.tenant_id,
      account_id: quote.account_id,
      status: existingBooking?.status || 'draft',
      source: 'quote',
      origin: quote.origin_port?.name || quote.origin_location?.name || '',
      destination: quote.destination_port?.name || quote.destination_location?.name || '',
      incoterms: quote.incoterms || 'FOB',
      total_amount: Number(quote.total_amount) || 0,
      currency: quote.currency || 'USD',
      vessel_name: quote.vessel_name || '',
      voyage_number: quote.voyage_number || '',
      cargo_ready_date: quote.cargo_ready_date || format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      container_qty: quote.container_qty || 1,
      container_type_id: quote.container_type_id,
      commodity_list: quote.line_items || [],
      notes: existingBooking?.notes || `Mapped from Quote ${quote.quote_number}`,
      mapping_metadata: {
        strategy: this.name,
        mapped_at: new Date().toISOString(),
        original_quote_amount: quote.total_amount,
        quote_version: 'latest' // In a real scenario, this would come from the quote object
      }
    };

    return baseBooking;
  }

  validate(quote: Quote, booking: BookingDraft): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Availability Check (Expiration)
    if (quote.valid_until && isAfter(new Date(), parseISO(quote.valid_until))) {
      errors.push(`Quote ${quote.quote_number} has expired on ${quote.valid_until}`);
    }

    // 2. Pricing Consistency
    if (Math.abs(booking.total_amount - quote.total_amount) > 0.01) {
      warnings.push(`Booking amount (${booking.total_amount}) differs from Quote amount (${quote.total_amount})`);
    }

    // 3. Requirement Fulfillment (Container Qty)
    if (quote.container_qty && booking.container_qty && booking.container_qty < quote.container_qty) {
      warnings.push(`Booking quantity (${booking.container_qty}) is less than Quote quantity (${quote.container_qty})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export class LegacyMappingStrategy implements MappingStrategy {
  name = 'Legacy';

  map(quote: Quote, existingBooking?: BookingDraft): BookingDraft {
    // Similar to standard but with more aggressive defaults for missing data
    const draftNumber = existingBooking?.booking_number || `BK-LEG-${Date.now()}`;
    
    return {
      booking_number: draftNumber,
      quote_id: quote.id,
      tenant_id: quote.tenant_id,
      status: 'draft',
      source: 'manual', // Legacy often treated as manual
      origin: quote.origin_port?.name || 'Unknown Origin',
      destination: quote.destination_port?.name || 'Unknown Destination',
      incoterms: quote.incoterms || 'EXW',
      total_amount: Number(quote.total_amount) || 0,
      currency: quote.currency || 'USD',
      mapping_metadata: {
        strategy: this.name,
        note: 'Legacy data mapping applied'
      }
    };
  }

  validate(quote: Quote, booking: BookingDraft): ValidationResult {
    // Legacy validation is lenient
    return { valid: true, errors: [], warnings: ['Legacy validation skipped strict checks'] };
  }
}

// --- Engine ---

export class BookingMappingEngine {
  private strategies: Record<string, MappingStrategy> = {
    'standard': new StandardMappingStrategy(),
    'legacy': new LegacyMappingStrategy()
  };

  /**
   * Main entry point to map a quote to a booking.
   */
  public map(quote: Quote, strategyName: string = 'standard', existingBooking?: BookingDraft): { booking: BookingDraft, validation: ValidationResult } {
    const strategy = this.strategies[strategyName] || this.strategies['standard'];
    
    const booking = strategy.map(quote, existingBooking);
    const validation = strategy.validate(quote, booking);

    return { booking, validation };
  }

  /**
   * Validates a booking draft against a quote using the specified strategy.
   */
  public validate(quote: Quote, booking: BookingDraft, strategyName: string = 'standard'): ValidationResult {
    const strategy = this.strategies[strategyName] || this.strategies['standard'];
    return strategy.validate(quote, booking);
  }

  /**
   * Registers a new strategy dynamically (Dependency Injection support).
   */
  public registerStrategy(name: string, strategy: MappingStrategy) {
    this.strategies[name] = strategy;
  }
}

// Singleton instance for easy usage
export const bookingMappingEngine = new BookingMappingEngine();
