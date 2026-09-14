import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Auth from './Auth';

// The shared test/setup.ts mock for '@/hooks/useAuth' returns a *new*
// object from every call. Auth.tsx's `useEffect(() => { if (user)
// navigate(...) }, [user, ...])` then sees a new `user` reference on every
// render and loops: navigate -> MemoryRouter re-renders -> useAuth() called
// again -> new `user` -> effect fires again. Override with a stable,
// signed-out value (the realistic case for someone viewing /auth) so the
// effect doesn't fire at all.
vi.mock('@/hooks/useAuth');

// F18 — the standard-branch return had no <main> landmark and its <H2> was
// the page's only heading (axe: "0 h1, no main"). The Sthira branch already
// had an <h1> but wasn't wrapped in <main> either. Both branches now render
// a single <main> landmark with exactly one <h1>.
describe('Auth page', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      signIn: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('exposes a main landmark and exactly one h1', () => {
    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('exposes a main landmark and exactly one h1 on the Sthira (retail) variant', () => {
    render(
      <MemoryRouter initialEntries={['/auth?intent=retail']}>
        <Auth />
      </MemoryRouter>,
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
