import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { QuoteCard } from '@/components/sales/QuoteCard';
import { LeadCard } from '@/components/crm/LeadCard';

describe('Lead and Quote card highlight states', () => {
  it('applies highlighted and active match styling to QuoteCard', () => {
    const quote = {
      id: 'quote-1',
      quote_number: 'Q-1001',
      title: 'Quote A',
      status: 'draft' as const,
      sell_price: 12000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      accounts: { id: 'acc-1', name: 'Acme Corp' },
      contacts: { id: 'con-1', first_name: 'Jamie', last_name: 'Lee' },
      opportunities: { id: 'opp-1', name: 'Expansion' },
      carriers: { id: 'car-1', carrier_name: 'Fast Freight' },
    };

    const highlightedRender = render(<QuoteCard quote={quote as any} highlighted />);
    const highlightedCard = highlightedRender.container.querySelector('[data-quote-id="quote-1"]');
    expect(highlightedCard?.className).toContain('border-primary/40');
    highlightedRender.unmount();

    const activeRender = render(<QuoteCard quote={quote as any} activeMatch />);
    const activeCard = activeRender.container.querySelector('[data-quote-id="quote-1"]');
    expect(activeCard?.className).toContain('ring-amber-500/80');
  });

  it('applies highlighted and active match styling to LeadCard', () => {
    const lead = {
      id: 'lead-1',
      firstName: 'Ava',
      lastName: 'Stone',
      company: 'Acme Corp',
      status: 'new' as const,
      source: 'website',
      score: 85,
      lastActivity: new Date().toISOString(),
      dateAdded: new Date().toISOString(),
      email: 'ava@acme.com',
      phone: '555-123-4567',
      position: 'Manager',
      value: 45000,
      tags: ['priority'],
    };

    const highlightedRender = render(<LeadCard lead={lead as any} highlighted />);
    const highlightedCard = highlightedRender.container.querySelector('[data-lead-id="lead-1"]');
    expect(highlightedCard?.className).toContain('border-primary/40');
    highlightedRender.unmount();

    const activeRender = render(<LeadCard lead={lead as any} activeMatch />);
    const activeCard = activeRender.container.querySelector('[data-lead-id="lead-1"]');
    expect(activeCard?.className).toContain('ring-amber-500/80');
  });
});
