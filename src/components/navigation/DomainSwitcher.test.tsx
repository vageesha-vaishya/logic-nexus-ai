import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DomainSwitcher } from './DomainSwitcher';

vi.mock('@/contexts/DomainContext', () => ({
  useDomain: vi.fn(),
}));

import { useDomain } from '@/contexts/DomainContext';

describe('DomainSwitcher', () => {
  it('renders nothing when selector is disabled', () => {
    vi.mocked(useDomain).mockReturnValue({
      currentDomain: null,
      setDomain: vi.fn(),
      availableDomains: [],
      showDomainSelector: false,
      tenantDomainCount: 1,
      isPlatformAdmin: false,
      isLoading: false,
    } as any);

    const { container } = render(<DomainSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders active domain label when tenant has a single domain', () => {
    vi.mocked(useDomain).mockReturnValue({
      currentDomain: { id: '1', code: 'LOGISTICS', name: 'Logistics', description: null, is_active: true },
      setDomain: vi.fn(),
      availableDomains: [{ id: '1', code: 'LOGISTICS', name: 'Logistics', description: null, is_active: true }],
      showDomainSelector: true,
      tenantDomainCount: 1,
      isPlatformAdmin: false,
      isLoading: false,
    } as any);

    render(<DomainSwitcher />);
    expect(screen.getByText('Logistics')).toBeInTheDocument();
  });

  it('renders selector when multiple domains are available', () => {
    vi.mocked(useDomain).mockReturnValue({
      currentDomain: { id: '1', code: 'LOGISTICS', name: 'Logistics', description: null, is_active: true },
      setDomain: vi.fn(),
      availableDomains: [
        { id: '1', code: 'LOGISTICS', name: 'Logistics', description: null, is_active: true },
        { id: '2', code: 'ECOMMERCE', name: 'E-Commerce', description: null, is_active: true },
      ],
      showDomainSelector: true,
      tenantDomainCount: 2,
      isPlatformAdmin: false,
      isLoading: false,
    } as any);

    render(<DomainSwitcher />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getAllByText('Logistics').length).toBeGreaterThan(0);
    expect(screen.getByText('E-Commerce')).toBeInTheDocument();
  });

  it('names the domain select for screen readers even before a value is chosen', () => {
    // Two domains (with showDomainSelector) so the component takes the
    // <Select> branch rather than the single-domain summary div — with
    // only one domain the component always renders the summary div
    // regardless of showDomainSelector, and there is no combobox to name.
    vi.mocked(useDomain).mockReturnValue({
      currentDomain: undefined,
      availableDomains: [
        { id: '1', code: 'crm', name: 'CRM', description: 'Sales' },
        { id: '2', code: 'amro', name: 'AMRO', description: 'Maintenance' },
      ],
      showDomainSelector: true,
      setDomain: vi.fn(),
    } as any);

    render(<DomainSwitcher />);

    expect(screen.getByRole('combobox', { name: /domain/i })).toBeInTheDocument();
  });
});
