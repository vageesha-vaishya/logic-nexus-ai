import { describe, it, expect } from 'vitest';
import { quoteComposerSchema } from '../schema';

describe('quoteComposerSchema modes', () => {
  it('requires guest fields in standalone mode', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: true,
      mode: 'ocean',
      origin: 'Shanghai',
      originId: 'origin-1',
      destination: 'Los Angeles',
      destinationId: 'dest-1',
    });
    expect(result.success).toBe(false);
  });

  it('accepts standalone with minimal valid guest data', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: true,
      mode: 'ocean',
      origin: 'Shanghai',
      originId: 'origin-1',
      destination: 'Los Angeles',
      destinationId: 'dest-1',
      commodity: 'Electronics',
      // Container details for ocean
      containerType: 'Dry',
      containerSize: '40ft',
      containerQty: '1',
      guestCompany: 'Test Co',
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
      billingAddress: {
        street: '123 Main St',
        city: 'NY',
        country: 'USA'
      }
    });
    expect(result.success).toBe(true);
  });

  it('validates standalone address requirements', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: true,
      mode: 'ocean',
      origin: 'Shanghai',
      originId: 'origin-1',
      destination: 'Los Angeles',
      destinationId: 'dest-1',
      commodity: 'Electronics',
      containerType: 'Dry',
      containerSize: '40ft',
      containerQty: '1',
      guestCompany: 'Test Co',
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
      billingAddress: {
        street: '', // Missing
        city: 'NY',
        country: 'USA'
      }
    });
    expect(result.success).toBe(false);
  });

  it('requires opportunity or account in CRM mode', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: false,
      mode: 'ocean',
      origin: 'Shanghai',
      originId: 'origin-1',
      destination: 'Los Angeles',
      destinationId: 'dest-1',
      commodity: 'Electronics',
      containerType: 'Dry',
      containerSize: '40ft',
      containerQty: '1',
    });
    expect(result.success).toBe(false);
  });

  it('accepts CRM mode with opportunity', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: false,
      mode: 'ocean',
      origin: 'Shanghai',
      originId: 'origin-1',
      destination: 'Los Angeles',
      destinationId: 'dest-1',
      commodity: 'Electronics',
      containerType: 'Dry',
      containerSize: '40ft',
      containerQty: '1',
      opportunityId: 'opp-1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts CRM mode with account', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: false,
      mode: 'ocean',
      origin: 'Shanghai',
      originId: 'origin-1',
      destination: 'Los Angeles',
      destinationId: 'dest-1',
      commodity: 'Electronics',
      containerType: 'Dry',
      containerSize: '40ft',
      containerQty: '1',
      accountId: 'acc-1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts CRM mode when guestEmail is blank', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: false,
      mode: 'ocean',
      origin: 'Shanghai',
      originId: 'origin-1',
      destination: 'Los Angeles',
      destinationId: 'dest-1',
      commodity: 'Electronics',
      containerType: 'Dry',
      containerSize: '40ft',
      containerQty: '1',
      accountId: 'acc-1',
      guestEmail: '',
    });

    expect(result.success).toBe(true);
  });

  it('rejects CRM mode when guestEmail has invalid format', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: false,
      mode: 'ocean',
      origin: 'Shanghai',
      originId: 'origin-1',
      destination: 'Los Angeles',
      destinationId: 'dest-1',
      commodity: 'Electronics',
      containerType: 'Dry',
      containerSize: '40ft',
      containerQty: '1',
      accountId: 'acc-1',
      guestEmail: 'invalid-email',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('Invalid email format');
    }
  });

  it('accepts air mode with comma-formatted weight', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: false,
      mode: 'air',
      origin: 'Shanghai',
      originId: 'origin-1',
      destination: 'Los Angeles',
      destinationId: 'dest-1',
      commodity: 'Electronics',
      weight: '1,250.5',
      accountId: 'acc-1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects air mode when weight is zero', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: false,
      mode: 'air',
      origin: 'Shanghai',
      originId: 'origin-1',
      destination: 'Los Angeles',
      destinationId: 'dest-1',
      commodity: 'Electronics',
      weight: '0',
      accountId: 'acc-1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => issue.message);
      expect(issues).toContain('Air freight requires a valid weight greater than 0');
    }
  });
});
