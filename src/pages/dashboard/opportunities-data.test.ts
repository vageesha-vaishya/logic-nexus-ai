import { describe, it, expect } from 'vitest';
import { buildOpportunityFromLead } from './opportunities-data';
import type { Lead } from './leads-data';

describe('buildOpportunityFromLead', () => {
  const baseLead: Lead = {
    id: 'lead_1',
    first_name: 'Jane',
    last_name: 'Doe',
    company: 'Acme Co',
    email: 'jane@example.com',
    phone: '123-456-7890',
    status: 'qualified',
    source: 'web',
    estimated_value: 12500,
    created_at: new Date().toISOString(),
    lead_score: 80,
    qualification_status: 'qualified',
    title: 'Logistics Manager',
    expected_close_date: '2026-02-15',
    description: 'Potential multi-modal shipment',
    notes: null,
    updated_at: new Date().toISOString(),
    last_activity_date: null,
    converted_at: null,
    custom_fields: null,
    owner_id: null,
    tenant_id: 'tenant_1',
    franchise_id: 'franchise_1',
  };

  it('maps core fields correctly with default name', () => {
    const opp = buildOpportunityFromLead({
      lead: baseLead,
      name: null,
      tenant_id: 'tenant_1',
      franchise_id: 'franchise_1',
      account_id: 'acc_1',
      contact_id: 'con_1',
    });
    expect(opp.stage).toBe('prospecting');
    expect(opp.amount).toBe(12500);
    expect(opp.close_date).toBe('2026-02-15');
    expect(opp.name).toContain('Jane Doe');
    expect(opp.lead_source).toBe('web');
    expect(opp.lead_id).toBe('lead_1');
    expect(opp.account_id).toBe('acc_1');
    expect(opp.contact_id).toBe('con_1');
    expect(opp.tenant_id).toBe('tenant_1');
    expect(opp.franchise_id).toBe('franchise_1');
  });

  it('uses provided name when present and handles nulls', () => {
    const opp = buildOpportunityFromLead({
      lead: { ...baseLead, estimated_value: null, expected_close_date: null },
      name: 'Custom Opp',
      tenant_id: 't2',
      franchise_id: null,
      account_id: null,
      contact_id: null,
    });
    expect(opp.name).toBe('Custom Opp');
    expect(opp.amount).toBeNull();
    expect(opp.close_date).toBeNull();
    expect(opp.account_id).toBeNull();
    expect(opp.contact_id).toBeNull();
    expect(opp.franchise_id).toBeNull();
  });
});
