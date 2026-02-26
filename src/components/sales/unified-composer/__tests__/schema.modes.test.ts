import { describe, it, expect } from 'vitest';
import { quoteComposerSchema } from '../schema';

describe('quoteComposerSchema modes', () => {
  it('requires guest fields in standalone mode', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: true,
      mode: 'ocean',
      origin: 'Shanghai',
      destination: 'Los Angeles',
    });
    expect(result.success).toBe(false);
  });

  it('accepts standalone with minimal valid guest data', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: true,
      mode: 'ocean',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      guestCompany: 'Test Co',
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('requires opportunity or account in CRM mode', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: false,
      mode: 'ocean',
      origin: 'Shanghai',
      destination: 'Los Angeles',
    });
    expect(result.success).toBe(false);
  });

  it('accepts CRM mode with opportunity', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: false,
      mode: 'ocean',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      opportunityId: 'opp-1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts CRM mode with account', () => {
    const result = quoteComposerSchema.safeParse({
      standalone: false,
      mode: 'ocean',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      accountId: 'acc-1',
    });
    expect(result.success).toBe(true);
  });
});
