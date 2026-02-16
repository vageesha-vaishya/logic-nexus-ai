import { describe, it, expect } from 'vitest';
import { QuoteTransformService } from '../quote-transform.service';

describe('QuoteTransformService.resolveServiceTypeId', () => {
  const baseServiceTypes: any[] = [
    {
      id: 'st-ocean-tm',
      name: 'Ocean Freight',
      code: 'OCEAN_FREIGHT',
      is_active: true,
      transport_modes: { code: 'ocean' }
    },
    {
      id: 'st-air-tm',
      name: 'Air Freight',
      code: 'AIR_FREIGHT',
      is_active: true,
      transport_modes: { code: 'air_cargo' }
    },
    {
      id: 'st-legacy-ocean',
      name: 'Sea FCL',
      code: 'SEA_FCL',
      is_active: true
    }
  ];

  it('returns explicitId when provided', () => {
    const result = QuoteTransformService.resolveServiceTypeId('ocean', 'explicit-id', baseServiceTypes as any);
    expect(result).toBe('explicit-id');
  });

  it('uses transport_modes.code to resolve ocean mode', () => {
    const result = QuoteTransformService.resolveServiceTypeId('ocean', undefined, baseServiceTypes as any);
    expect(result).toBe('st-ocean-tm');
  });

  it('uses transport_modes.code with alias air_cargo for air mode', () => {
    const result = QuoteTransformService.resolveServiceTypeId('air', undefined, baseServiceTypes as any);
    expect(result).toBe('st-air-tm');
  });

  it('falls back to legacy name/code matching when no transport_modes present', () => {
    const onlyLegacy = [
      {
        id: 'legacy-only',
        name: 'Sea Service',
        code: 'SEA_SERVICE'
      }
    ];

    const result = QuoteTransformService.resolveServiceTypeId('ocean', undefined, onlyLegacy as any);
    expect(result).toBe('legacy-only');
  });

  it('returns undefined when no match is found', () => {
    const result = QuoteTransformService.resolveServiceTypeId('rail', undefined, baseServiceTypes as any);
    expect(result).toBeUndefined();
  });
});

