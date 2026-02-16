import { describe, it, expect, vi } from 'vitest';

let capturedHandler: any;

vi.mock('../../supabase/functions/_shared/logger.ts', () => ({
  serveWithLogger: (handler: any) => {
    capturedHandler = handler;
  },
}));

describe('generate-quote-pdf sell-side charge filter', () => {
  it('logs a warning when sell-side filter returns zero charges for an option', async () => {
    (globalThis as any).Deno = {
      env: {
        get: vi.fn().mockReturnValue(''),
      },
    };

    await import('../../supabase/functions/generate-quote-pdf/index.ts');

    const req = new Request('https://example.com', {
      method: 'POST',
      body: JSON.stringify({
        quoteId: 'quote-1',
        versionId: 'version-1',
        engine_v2: true,
      }),
    });

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const supabaseClient = {
      from: (table: string) => {
        if (table === 'charge_sides') {
          return {
            select: () =>
              Promise.resolve({
                data: [{ id: 'sell-id', code: 'sell', name: 'Sell' }],
                error: null,
              }),
          };
        }

        if (table === 'quotes') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'quote-1',
                      quote_number: 'QUO-1',
                      created_at: '2026-01-01T00:00:00.000Z',
                      expiration_date: '2026-01-10T00:00:00.000Z',
                      status: 'draft',
                      total_amount: 0,
                      currency: 'USD',
                      service_level: 'Standard',
                      notes: null,
                      terms_conditions: null,
                      accounts: { name: 'Test Account' },
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }

        if (table === 'quote_items') {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [],
                  error: null,
                }),
            }),
          };
        }

        if (table === 'quotation_versions') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'version-1',
                      quote_id: 'quote-1',
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }

        if (table === 'quotation_version_options') {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 'opt-1',
                      carriers: { carrier_name: 'Carrier 1' },
                      legs: [],
                    },
                  ],
                  error: null,
                }),
            }),
          };
        }

        if (table === 'quotation_version_option_legs') {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [],
                  error: null,
                }),
            }),
          };
        }

        if (table === 'quote_charges') {
          const chargesBuilder: any = {
            eq: (column: string) => {
              if (column === 'charge_side_id') {
                return Promise.resolve({
                  data: [],
                  error: null,
                });
              }
              return chargesBuilder;
            },
          };

          return {
            select: () => chargesBuilder,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    await capturedHandler(req, logger as any, supabaseClient as any);

    const warningMessages = logger.warn.mock.calls.map((c) => String(c[0]));

    expect(
      warningMessages.some((msg) =>
        msg.includes('Sell-side charge filter returned zero charges for option opt-1')
      )
    ).toBe(true);
  });
});
