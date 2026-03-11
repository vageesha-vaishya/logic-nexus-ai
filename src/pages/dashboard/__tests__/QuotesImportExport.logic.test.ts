import { describe, expect, it } from 'vitest';
import { buildFullQuoteExportSheets, parseJsonField, prepareQuoteImportBatch, quoteSchema, splitQuoteReferences, transformQuoteRecord } from '../QuotesImportExport';

describe('QuotesImportExport validation and mapping', () => {
  it('normalizes valid quote schema payload', () => {
    const result = quoteSchema.safeParse({
      quote_number: ' QUO-123 ',
      title: ' Freight Quote ',
      status: 'SENT',
      sell_price: '1200',
      buy_price: '1000',
      currency: 'usd',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.quote_number).toBe('QUO-123');
    expect(result.data.title).toBe('Freight Quote');
    expect(result.data.status).toBe('sent');
    expect(result.data.currency).toBe('USD');
  });

  it('rejects invalid pricing combinations', () => {
    const result = quoteSchema.safeParse({
      quote_number: 'QUO-124',
      title: 'Invalid Quote',
      status: 'draft',
      sell_price: 500,
      buy_price: 700,
      currency: 'USD',
    });
    expect(result.success).toBe(false);
  });

  it('parses JSON strings and object values', () => {
    expect(parseJsonField('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonField({ a: 1 })).toEqual({ a: 1 });
    expect(parseJsonField('')).toBeUndefined();
    expect(parseJsonField('invalid-json')).toBeUndefined();
  });

  it('builds transformed quote record with import payload fields', () => {
    const transformed = transformQuoteRecord({
      quote_number: ' QUO-125 ',
      title: ' Sample ',
      status: 'SENT',
      buy_price: '100',
      sell_price: '180',
      line_items_json: '[{"sku":"A"}]',
      pricing_tiers_json: '[{"tier":"T1"}]',
      customer_snapshot_json: '{"name":"Acme"}',
      attachments_json: '[{"file":"a.pdf"}]',
      custom_fields_json: { source: 'migration' },
    });
    expect(transformed.quote_number).toBe('QUO-125');
    expect(transformed.title).toBe('Sample');
    expect(transformed.status).toBe('sent');
    expect(transformed.buy_price).toBe(100);
    expect(transformed.sell_price).toBe(180);
    expect((transformed.custom_fields as any).source).toBe('migration');
    expect((transformed.custom_fields as any).import_line_items).toEqual([{ sku: 'A' }]);
  });

  it('blocks batch when business rules fail', async () => {
    await expect(
      prepareQuoteImportBatch([
        { custom_fields: { credit_status: 'blocked' } },
      ])
    ).rejects.toThrow(/blocked credit status/i);
  });

  it('splits mixed quote references into ids and quote numbers', () => {
    const refs = [
      '00000000-0000-0000-0000-000000000111',
      'QUO-260309-00001',
      '  QUO-260309-00001  ',
      '00000000-0000-0000-0000-000000000111',
      'QUO-260309-00002',
    ];
    expect(splitQuoteReferences(refs)).toEqual({
      ids: ['00000000-0000-0000-0000-000000000111'],
      quoteNumbers: ['QUO-260309-00001', 'QUO-260309-00002'],
    });
  });

  it('builds full export sheets with legs and charges', () => {
    const sheets = buildFullQuoteExportSheets(
      [{ id: 'q-1', quote_number: 'QUO-260309-00001', title: 'Quote A' }],
      [{ quote_id: 'q-1', line_number: 1, product_name: 'Freight' }],
      [{ quote_id: 'q-1', cargo_type: 'General', quantity: 2 }],
      [{
        id: 'v-1',
        quote_id: 'q-1',
        version_number: 3,
        quotation_version_options: [{
          id: 'o-1',
          is_selected: true,
          total_amount: 1200,
          quote_currency: { code: 'USD' },
          total_transit_days: 12,
          quotation_version_option_legs: [{
            id: 'l-1',
            sort_order: 1,
            mode: 'ocean',
            origin_location: 'Miami',
            destination_location: 'Santos',
            quotation_version_option_leg_charges: [{
              id: 'c-1',
              amount: 1200,
              rate: 1200,
              quantity: 1,
              currency: { code: 'USD' },
              description: { name: 'Ocean Freight' },
              charge_sides: { code: 'SELL' },
              basis: { code: 'PER_CONTAINER' },
            }],
          }],
        }],
      }]
    );

    expect(sheets.Summary.length).toBe(1);
    expect(sheets.Transport_Legs.length).toBe(1);
    expect(sheets.Charges.length).toBe(1);
    expect(sheets.Charges[0].quote_number).toBe('QUO-260309-00001');
    expect(sheets.Options[0].version_number).toBe(3);
  });
});
