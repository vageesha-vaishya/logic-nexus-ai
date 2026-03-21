import { afterEach, describe, expect, it } from 'vitest';

import {
  collectApiRoutes,
  collectAppRoutes,
  collectMenuRoutes,
  generateRouteInventory,
} from './generate-route-inventory.mjs';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
});

describe('generate-route-inventory', () => {
  it('collects API routes from src/pages/api', () => {
    const apiRoutes = collectApiRoutes();

    expect(apiRoutes).toContain('/api/v1/platform-domains');
    expect(apiRoutes).toContain('/api/v2/amro/compliance-gates');
    expect(apiRoutes).toContain('/api/v2/amro/work-packages');
    expect(apiRoutes).toContain('/api/v2/amro/tasks');
    expect(apiRoutes).toContain('/api/v2/quotations/import');
    expect(apiRoutes.some((route) => route.includes('_utils'))).toBe(false);
  });

  it('collects app and menu routes for dashboard surfaces', () => {
    const appRoutes = collectAppRoutes();
    const menuRoutes = collectMenuRoutes();

    expect(appRoutes).toContain('/dashboard/dashboards');
    expect(menuRoutes).toContain('/dashboard/dashboards');
    expect(menuRoutes).toContain('/dashboard/migration-baseline');
  });

  it('generates populated inventory when feature flag is enabled', () => {
    process.env.ROUTE_INVENTORY_DASHBOARD_V1 = 'true';
    const payload = generateRouteInventory();

    expect(payload.featureFlag.enabled).toBe(true);
    expect(payload.web.appRoutes).toContain('/dashboard/migration-baseline');
    expect(payload.web.appRoutes.length).toBe(payload.counts.appRoutes);
    expect(payload.web.menuRoutes.length).toBe(payload.counts.menuRoutes);
    expect(payload.api.routes.length).toBe(payload.counts.apiRoutes);
  });

  it('returns empty inventory when feature flag is disabled', () => {
    process.env.ROUTE_INVENTORY_DASHBOARD_V1 = 'false';
    const payload = generateRouteInventory();

    expect(payload.featureFlag.enabled).toBe(false);
    expect(payload.counts).toEqual({
      appRoutes: 0,
      menuRoutes: 0,
      apiRoutes: 0,
    });
    expect(payload.web.appRoutes).toEqual([]);
    expect(payload.web.menuRoutes).toEqual([]);
    expect(payload.api.routes).toEqual([]);
  });
});
