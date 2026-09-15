import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/feedback/UxFeedbackWidget', () => ({
  UxFeedbackWidget: () => <div data-testid="ux-feedback-widget-stub" />,
}));

// Mock everything DashboardLayout needs to render without a real provider
// tree -- minimal set per the task brief, extended incrementally with
// whatever hook/component throws when unmocked. DashboardLayout mounts a
// large number of sibling overlay/header components; those are stubbed out
// here since this test only cares whether UxFeedbackWidget is mounted.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'u1@example.com' },
    profile: { first_name: 'Test', last_name: 'User', email: 'u1@example.com' },
    roles: [],
    session: {},
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));
vi.mock('@/hooks/useCRM', () => ({ useCRM: () => ({ user: { id: 'u1' }, context: { tenantId: 't1' }, supabase: {} }) }));
vi.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock('@/hooks/useDomainAccent', () => ({ useDomainAccent: vi.fn() }));
vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ toggleSidebar: vi.fn(), isMobile: false }),
}));
vi.mock('@/features/notifications', () => ({
  useNotificationsRealtime: vi.fn(),
  InAppNotificationBell: () => <div data-testid="notif-bell-stub" />,
}));
vi.mock('@/lib/feature-flags', () => ({
  FEATURE_FLAGS: new Proxy({}, { get: (_target, prop) => prop }),
  useAppFeatureFlag: () => ({ enabled: false }),
}));
vi.mock('./AppSidebar', () => ({ AppSidebar: () => <div data-testid="app-sidebar-stub" /> }));
vi.mock('@/components/branding', () => ({ DomainAccentStrip: () => <div data-testid="domain-accent-strip-stub" /> }));
vi.mock('@/components/navigation/DomainSwitcher', () => ({ DomainSwitcher: () => <div data-testid="domain-switcher-stub" /> }));
vi.mock('./AdminScopeSwitcher', () => ({ AdminScopeSwitcher: () => <div data-testid="admin-scope-switcher-stub" /> }));
vi.mock('@/components/ui/global-search', () => ({ GlobalSearch: () => <div data-testid="global-search-stub" /> }));
vi.mock('@/components/system/HelpDialog', () => ({ HelpDialog: () => <div data-testid="help-dialog-stub" /> }));
vi.mock('@/components/system/DarkModeToggle', () => ({ DarkModeToggle: () => <div data-testid="dark-mode-toggle-stub" /> }));
vi.mock('@/components/system/ConsentBanner', () => ({ ConsentBanner: () => <div data-testid="consent-banner-stub" /> }));
vi.mock('@/components/system/OnboardingTour', () => ({ OnboardingTour: () => <div data-testid="onboarding-tour-stub" /> }));
vi.mock('@/features/markets/components/AIAssistantPanel', () => ({ AIAssistantPanel: () => <div data-testid="ai-assistant-panel-stub" /> }));
vi.mock('@/components/onboarding/OAuthWelcomeBanner', () => ({ OAuthWelcomeBanner: () => <div data-testid="oauth-welcome-banner-stub" /> }));
vi.mock('@/components/layout/StickyActionsContext', () => ({
  useStickyActions: () => ({ actions: { left: [], right: [] } }),
}));
vi.mock('@/integrations/supabase/client', () => {
  const channel = {
    on: vi.fn(function (this: unknown) { return this; }),
    subscribe: vi.fn(function (this: unknown) { return this; }),
  };
  return {
    supabase: {
      auth: {
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(() => Promise.resolve()),
    },
  };
});

import { DashboardLayout } from './DashboardLayout';

describe('DashboardLayout — ux feedback widget', () => {
  it('mounts UxFeedbackWidget once', () => {
    render(<MemoryRouter><DashboardLayout><div>content</div></DashboardLayout></MemoryRouter>);
    expect(screen.getAllByTestId('ux-feedback-widget-stub')).toHaveLength(1);
  });
});
