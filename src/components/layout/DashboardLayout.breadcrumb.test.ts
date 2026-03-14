import { describe, expect, it } from 'vitest';
import { APP_MENU } from '@/config/navigation';
import { resolveActiveSurface, resolveBreadcrumbTrail } from './DashboardLayout';

describe('DashboardLayout breadcrumb resolution', () => {
  it('shows Dashboard -> Leads for leads pipeline route', () => {
    const activeSurface = resolveActiveSurface('/dashboard/leads/pipeline');
    const breadcrumbTrail = resolveBreadcrumbTrail(activeSurface);

    expect(breadcrumbTrail).toEqual(['Leads']);
    expect(breadcrumbTrail).not.toContain('Sales');
  });

  it('shows only Dashboard for home route', () => {
    const activeSurface = resolveActiveSurface('/dashboard');
    const breadcrumbTrail = resolveBreadcrumbTrail(activeSurface);

    expect(breadcrumbTrail).toEqual([]);
  });

  it('maps every sidebar item to item-based breadcrumb labels', () => {
    const mismatches: Array<{ route: string; expected: string; actual: string[] }> = [];

    APP_MENU.forEach(({ items }) => {
      items.forEach((item) => {
        const activeSurface = resolveActiveSurface(item.path);
        const breadcrumbTrail = resolveBreadcrumbTrail(activeSurface);
        if (item.name === 'Home') {
          if (breadcrumbTrail.length !== 0) {
            mismatches.push({ route: item.path, expected: '[]', actual: breadcrumbTrail });
          }
          return;
        }
        if (breadcrumbTrail.join(' > ') !== item.name) {
          mismatches.push({ route: item.path, expected: item.name, actual: breadcrumbTrail });
        }
      });
    });

    expect(mismatches).toEqual([]);
  });

  it('maps detail screens to parent and screen breadcrumb labels', () => {
    const mismatches: Array<{ route: string; expected: string[]; actual: string[] }> = [];

    APP_MENU.forEach(({ items }) => {
      items.forEach((item) => {
        (item.screens ?? []).forEach((screen) => {
          const [screenPath, screenHash = ''] = screen.path.split('#');
          const activeSurface = resolveActiveSurface(screenPath, screenHash ? `#${screenHash}` : '');
          const breadcrumbTrail = resolveBreadcrumbTrail(activeSurface);
          const expected = [item.name, screen.name];

          if (breadcrumbTrail.join(' > ') !== expected.join(' > ')) {
            mismatches.push({ route: screen.path, expected, actual: breadcrumbTrail });
          }
        });
      });
    });

    expect(mismatches).toEqual([]);
  });
});
