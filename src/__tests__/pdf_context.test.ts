import { describe, it, expect } from 'vitest';
import { buildSafeContextWithValidation } from '../../supabase/functions/generate-quote-pdf/engine/context.ts';

describe('PDF SafeContext Branding Mapping', () => {
  it('applies defaults when branding fields are missing', () => {
    const raw = {
      branding: {
        // intentionally empty to trigger defaults
      },
      quote: {
        quote_number: 'QUO-TEST-001',
        created_at: new Date().toISOString(),
        currency: 'USD',
      },
    };

    const { context } = buildSafeContextWithValidation(raw as any);
    expect(context.branding.company_name).toBe('Miami Global Lines');
    expect(context.branding.company_address).toContain('Logistics Way');
    expect(context.branding.primary_color).toBe('#0087b5');
    expect(context.branding.secondary_color).toBe('#dceef2');
    expect(context.branding.accent_color).toBe('#000000');
    expect(context.branding.header_text).toBe('');
    expect(context.branding.sub_header_text).toBe('');
    expect(context.branding.footer_text).toBe('');
    expect(context.branding.disclaimer_text).toContain('Standard terms');
  });

  it('maps provided branding fields correctly', () => {
    const raw = {
      branding: {
        company_name: 'Acme Freight Co.',
        company_address: '123 Ocean Blvd, Port City, PC 99999',
        primary_color: '#112233',
        secondary_color: '#abcdef',
        accent_color: '#445566',
        header_text: 'Fast. Reliable. Global.',
        sub_header_text: 'FMC Lic. # 012345',
        footer_text: 'Registered in Delaware | EIN 12-3456789',
        disclaimer_text: 'All services subject to Acme terms.',
      },
      quote: {
        quote_number: 'QUO-ACME-42',
        created_at: '2026-03-06T00:00:00.000Z',
        expiration_date: '2026-03-20T00:00:00.000Z',
        currency: 'EUR',
        total_amount: 1000,
      },
    };

    const { context } = buildSafeContextWithValidation(raw as any);
    expect(context.branding.company_name).toBe('Acme Freight Co.');
    expect(context.branding.company_address).toBe('123 Ocean Blvd, Port City, PC 99999');
    expect(context.branding.primary_color).toBe('#112233');
    expect(context.branding.secondary_color).toBe('#abcdef');
    expect(context.branding.accent_color).toBe('#445566');
    expect(context.branding.header_text).toBe('Fast. Reliable. Global.');
    expect(context.branding.sub_header_text).toBe('FMC Lic. # 012345');
    expect(context.branding.footer_text).toBe('Registered in Delaware | EIN 12-3456789');
    expect(context.branding.disclaimer_text).toBe('All services subject to Acme terms.');
    expect(context.quote.number).toBe('QUO-ACME-42');
    expect(context.quote.currency).toBe('EUR');
    expect(context.quote.grand_total).toBe(1000);
  });
});
