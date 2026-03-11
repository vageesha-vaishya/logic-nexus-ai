import { describe, expect, it } from 'vitest';
import { parseJsonField, prepareQuoteImportBatch, quoteSchema, transformQuoteRecord } from '../QuotesImportExport';

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
});
