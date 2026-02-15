import { describe, it, expect } from 'vitest';
import { QuoteTransformService } from '../quote-transform.service';

const masterData = {
  serviceTypes: [{ id: 'st1', name: 'Ocean', code: 'ocean' }],
  carriers: [{ id: 'c1', carrier_name: 'Evergreen Line', scac: 'EGLV' }],
  ports: [
    { id: 'p1', location_name: 'Los Angeles', location_code: 'USLAX', country: 'US' },
    { id: 'p2', location_name: 'Nhava Sheva Port', location_code: 'INNSA', country: 'IN' },
    { id: 'p3', location_name: 'San Juan Port', location_code: 'PRSJU', country: 'PR' },
    { id: 'p4', location_name: 'ICD Tughlakabad', location_code: 'INITK', country: 'IN' },
  ],
  containerTypes: [],
  containerSizes: [],
  shippingTerms: [{ id: 'inc1', code: 'CIF', name: 'Cost Insurance Freight' }]
};

describe('QuoteTransformService.resolvePortId', () => {
  it('prioritizes id and code over name', () => {
    const idMatch = QuoteTransformService.resolvePortId('AGUADILLA', masterData.ports as any, 'USLAX', 'p1');
    expect(idMatch).toBe('p1');
    const codeMatch = QuoteTransformService.resolvePortId('Unknown', masterData.ports as any, 'PRSJU');
    expect(codeMatch).toBe('p3');
    const nameMatch = QuoteTransformService.resolvePortId('ICD Tughlakabad', masterData.ports as any);
    expect(nameMatch).toBe('p4');
  });
});

describe('QuoteTransformService.transformToQuoteForm', () => {
  it('maps origin/destination using id/code safely', () => {
    const payload: any = {
      origin: 'Aguadilla',
      destination: 'ICD Tughlakabad',
      mode: 'ocean',
      selectedRates: [{
        id: 'opt1',
        carrier_name: 'Evergreen Line',
        price: 1000,
        currency: 'USD',
        transitTime: '32 days port-to-port',
        legs: [
          { id: 'l1', mode: 'road', origin: 'Aguadilla', destination: 'San Juan Port' },
          { id: 'l2', mode: 'ocean', origin: 'San Juan Port', destination: 'Nhava Sheva Port' },
          { id: 'l3', mode: 'rail', origin: 'Nhava Sheva Port', destination: 'ICD Tughlakabad' },
        ]
      }],
      originDetails: { id: 'p3', name: 'San Juan Port', code: 'PRSJU' },
      destinationDetails: { id: 'p4', name: 'ICD Tughlakabad', code: 'INITK' }
    };

    const form = QuoteTransformService.transformToQuoteForm(payload, masterData as any);
    expect(form.origin_port_id).toBe('p3');
    expect(form.destination_port_id).toBe('p4');
    const legs = form.options?.[0]?.legs || [];
    expect(legs[0].origin_location_id).toBe('p3');
    expect(legs[2].destination_location_id).toBe('p4');
  });
});
