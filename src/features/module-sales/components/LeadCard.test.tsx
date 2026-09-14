import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeadCard } from './LeadCard';
import type { Lead } from '@/pages/dashboard/leads-data';

const sampleLead: Lead = {
  id: 'lead-1',
  first_name: 'Jane',
  last_name: 'Doe',
  company: 'Acme Corp',
  email: 'jane@acme.com',
  phone: '555-1234',
  status: 'new',
  source: 'website',
  estimated_value: 5000,
  created_at: new Date().toISOString(),
  lead_score: 80,
  qualification_status: null,
  owner_id: null,
  title: null,
  expected_close_date: null,
  description: null,
  notes: null,
  updated_at: new Date().toISOString(),
  last_activity_date: null,
  converted_at: null,
  custom_fields: null,
  tenant_id: 'tenant-1',
  franchise_id: null,
};

describe('LeadCard', () => {
  it('is not itself interactive but exposes one named open control', () => {
    render(<LeadCard lead={sampleLead} onClick={vi.fn()} />);
    // the old card-as-button (role="button" wrapping the whole card) is gone
    expect(screen.queryByRole('button', { name: /Jane Doe, New Lead, score/i })).toBeNull();
    expect(screen.getByRole('button', { name: /open jane doe/i })).toBeInTheDocument();
  });

  it('opens the lead when the named control is clicked', async () => {
    const onClick = vi.fn();
    render(<LeadCard lead={sampleLead} onClick={onClick} />);
    screen.getByRole('button', { name: /open jane doe/i }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
