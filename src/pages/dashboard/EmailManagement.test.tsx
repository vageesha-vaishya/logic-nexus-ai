import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmailManagement from './EmailManagement';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/features/module-communications/components/email/EmailInbox', () => ({
  EmailInbox: () => <div data-testid="email-inbox" />,
}));
vi.mock('@/features/module-communications/components/email/EmailAccounts', () => ({
  EmailAccounts: () => <div data-testid="email-accounts" />,
}));
vi.mock('@/features/module-communications/components/email/EmailFilters', () => ({
  EmailFilters: () => <div data-testid="email-filters" />,
}));
vi.mock('@/features/module-communications/components/email/EmailTemplates', () => ({
  EmailTemplates: () => <div data-testid="email-templates" />,
}));
vi.mock('@/features/module-communications/components/email/OAuthSettings', () => ({
  OAuthSettings: () => <div data-testid="oauth-settings" />,
}));
vi.mock('@/features/module-communications/components/email/ComplianceSettings', () => ({
  ComplianceSettings: () => <div data-testid="compliance-settings" />,
}));
vi.mock('@/features/module-communications/components/email/QueueRulesManager', () => ({
  QueueRulesManager: () => <div data-testid="queue-rules-manager" />,
}));
vi.mock('@/features/module-communications/components/email/SequencesList', () => ({
  SequencesList: () => <div data-testid="sequences-list" />,
}));
vi.mock('@/features/module-communications/components/email/EmailClientSettings', () => ({
  EmailClientSettings: () => <div data-testid="email-client-settings" />,
}));
vi.mock('@/features/module-communications/components/email/DomainHealth', () => ({
  DomainHealth: () => <div data-testid="domain-health" />,
}));

describe('EmailManagement tabs', () => {
  it('renders exactly one tab labeled "Templates"', () => {
    render(<EmailManagement />);
    expect(screen.getAllByRole('tab', { name: 'Templates' })).toHaveLength(1);
  });

  it('renders an "Email Client" tab that opens EmailClientSettings', async () => {
    const user = userEvent.setup();
    render(<EmailManagement />);
    await user.click(screen.getByRole('tab', { name: 'Email Client' }));
    expect(screen.getByTestId('email-client-settings')).toBeInTheDocument();
  });

  it('labels the routing tab "Queue Rules", not "Routing Rules"', () => {
    render(<EmailManagement />);
    expect(screen.getByRole('tab', { name: 'Queue Rules' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Routing Rules' })).not.toBeInTheDocument();
  });
});
