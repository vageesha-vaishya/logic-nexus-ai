import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';

describe('SmartQuoteWorkspace hand-off payload', () => {
  it('produces a payload that satisfies QuoteTransferSchema', () => {
    const formValues = { mode: 'ocean', origin: 'CNSHA', destination: 'USLAX', commodity: 'General Cargo' };
    // originDetails/destinationDetails are omitted here (rather than passed as null) because
    // QuoteTransferSchema's LocationDetailsSchema is `.optional()` but not `.nullable()`. The real
    // handler normalizes deriveSharedPayload's `null` defaults to `undefined` before validating —
    // see the null-coalescing on originDetails/destinationDetails in handleConvertToQuote.
    const extendedData = { containerType: 'dry', containerSize: '20ft', containerQty: '1', htsCode: '', dangerousGoods: false, specialHandling: '', vehicleType: 'van', pickupDate: '', deliveryDeadline: '' };
    const selectedOption = { id: 'opt-1', carrier: 'Maersk', price: 1200, currency: 'USD' };

    const transferPayload = {
      ...formValues,
      ...extendedData,
      containerCombos: [{ type: 'dry', size: '20ft', qty: 1 }],
      selectedRates: [selectedOption],
    };

    expect(() => QuoteTransferSchema.parse(transferPayload)).not.toThrow();
  });
});
