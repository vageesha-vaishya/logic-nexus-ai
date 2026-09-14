import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ThemeManagement from './ThemeManagement';
import { ThemeProvider } from '@/hooks/useTheme';

// Mock heavy/unrelated child components so this stays a focused smoke test.
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

// ThemeProvider (rendered for real below) itself calls useCRM(), so it must
// be mocked here too -- a stable, module-level object identity, matching
// the pattern used by other dashboard page tests.
const stableContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  franchiseId: null,
  isPlatformAdmin: true,
  isTenantAdmin: true,
  isFranchiseAdmin: true,
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: null,
    context: stableContext,
  }),
}));

describe('ThemeManagement', () => {
  it('names the radius selects and the switches', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <ThemeManagement />
        </ThemeProvider>
      </BrowserRouter>,
    );

    expect(screen.getByRole('combobox', { name: /^card radius$/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^kanban card radius$/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /header banner/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /dark mode/i })).toBeInTheDocument();
  });
});
