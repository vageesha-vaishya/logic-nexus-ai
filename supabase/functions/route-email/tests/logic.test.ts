import { describe, it, expect } from 'vitest';
import { determineRoute } from '../../_shared/routing-logic';

describe('Email Routing Logic', () => {
  it('routes negative feedback to cfm_negative with 30m SLA', () => {
    const result = determineRoute({
      category: 'feedback',
      sentiment: 'negative'
    });
    expect(result.queue).toBe('cfm_negative');
    expect(result.sla_minutes).toBe(30);
  });

  it('routes very negative CRM to support_priority with 15m SLA', () => {
    const result = determineRoute({
      category: 'crm',
      sentiment: 'very_negative'
    });
    expect(result.queue).toBe('support_priority');
    expect(result.sla_minutes).toBe(15);
  });

  it('routes sales intent to sales_inbound with 120m SLA', () => {
    const result = determineRoute({
      intent: 'sales',
      category: 'general',
      sentiment: 'neutral'
    });
    expect(result.queue).toBe('sales_inbound');
    expect(result.sla_minutes).toBe(120);
  });

  it('routes default to support_general with 60m SLA', () => {
    const result = determineRoute({
      category: 'general',
      sentiment: 'neutral'
    });
    expect(result.queue).toBe('support_general');
    expect(result.sla_minutes).toBe(60);
  });
});
