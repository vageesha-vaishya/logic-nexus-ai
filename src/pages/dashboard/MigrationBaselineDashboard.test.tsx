import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import MigrationBaselineDashboard from './MigrationBaselineDashboard';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

describe('MigrationBaselineDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders gateway route inventory metrics from API', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          correlationId: 'corr-route-inventory',
          data: {
            generatedAt: '2026-03-21T00:00:00.000Z',
            featureFlag: { key: 'ROUTE_INVENTORY_DASHBOARD_V1', enabled: true },
            featureFlagPlatform: {
              version: 4,
              checksum: 'checksum-4abcdef',
              updatedAt: '2026-03-21T00:00:00.000Z',
              globalKillSwitch: false,
              modules: [],
            },
            gateway: {
              globalRevertToLegacy: false,
              facadeEnabled: true,
              v2PrimaryEnabled: false,
              v2ShadowEnabled: true,
            },
            web: {
              appRoutes: ['/dashboard/migration-baseline', '/dashboard/dashboards'],
              menuRoutes: ['/dashboard/migration-baseline'],
            },
            api: {
              routes: ['/api/v1/gateway/route-inventory', '/api/v1/platform-domains'],
            },
            counts: {
              appRoutes: 2,
              menuRoutes: 1,
              apiRoutes: 2,
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          correlationId: 'corr-monitoring',
          data: {
            generatedAt: '2026-03-21T00:00:00.000Z',
            featureFlag: {
              key: 'MIGRATION_BASELINE_SLO_V1',
              enabled: true,
              configVersion: 4,
              configChecksum: 'checksum-4abcdef',
            },
            goldenSignals: {
              latency: { p95Ms: 450, p99Ms: 900, objectiveMs: 450 },
              errorRate: { value: 0.008, objective: 0.01, errorBudgetRemainingPercent: 20 },
              throughputRpm: 1600,
              availabilityPercent: 99.95,
            },
            businessKpis: [{ key: 'gateway-routed-traffic', label: 'Gateway Routed Traffic', value: 23, unit: 'count' }],
            alerts: {
              legacyChannelsParallel: true,
              noisyAlertMitigation: { burnRateWindows: ['5m', '30m'], activeWindow: '30m' },
              policies: [],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          correlationId: 'corr-vertical',
          data: {
            moduleConfig: {
              moduleKey: 'module-crm',
              extractionEnabled: true,
              aclLegacyPathEnabled: true,
              routePath: 'extracted',
              reason: 'extracted_enabled',
            },
            writePlan: {
              allowed: true,
              directWrite: false,
              writePath: 'acl-legacy-proxy',
              tableName: 'quotations',
            },
            translationResult: null,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          correlationId: 'corr-recon',
          data: {
            mode: {
              moduleKey: 'module-crm',
              shadowReadsEnabled: true,
              shadowWritesEnabled: true,
              updatedAt: '2026-03-21T00:00:00.000Z',
            },
            artifacts: [
              {
                runId: 'run-1',
                moduleKey: 'module-crm',
                entityKey: 'crm.lead',
                thresholdPercent: 0.5,
                comparedRecords: 100,
                mismatchRecords: 0,
                diffRatePercent: 0,
                withinThreshold: true,
                generatedAt: '2026-03-21T00:00:00.000Z',
              },
            ],
          },
        }),
      }));

    render(<MigrationBaselineDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Correlation corr-route-inventory/i)).toBeInTheDocument();
    });
    expect(screen.getByText('App Routes')).toBeInTheDocument();
    expect(screen.getByText('API Routes')).toBeInTheDocument();
    expect(screen.getByText('P95 Latency')).toBeInTheDocument();
    expect(screen.getByText('Route Inventory Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Monitoring and Alert Baseline')).toBeInTheDocument();
    expect(screen.getByText('Vertical Extraction Operations')).toBeInTheDocument();
    expect(screen.getByText(/Cutover ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Top API routes:/i)).toBeInTheDocument();
  });

  it('renders error message when route inventory API fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'route inventory unavailable' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      }));

    render(<MigrationBaselineDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Unable to load route inventory:/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/route inventory unavailable/i)).toBeInTheDocument();
  });

  it('sends rollback patch through operational controls', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          correlationId: 'corr-route-inventory',
          data: {
            generatedAt: '2026-03-21T00:00:00.000Z',
            featureFlag: { key: 'ROUTE_INVENTORY_DASHBOARD_V1', enabled: true },
            featureFlagPlatform: {
              version: 4,
              checksum: 'checksum-4abcdef',
              updatedAt: '2026-03-21T00:00:00.000Z',
              globalKillSwitch: false,
              modules: [],
            },
            gateway: {
              globalRevertToLegacy: false,
              facadeEnabled: true,
              v2PrimaryEnabled: false,
              v2ShadowEnabled: true,
            },
            web: { appRoutes: ['/dashboard/migration-baseline'], menuRoutes: ['/dashboard/migration-baseline'] },
            api: { routes: ['/api/v1/gateway/route-inventory'] },
            counts: { appRoutes: 1, menuRoutes: 1, apiRoutes: 1 },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          correlationId: 'corr-monitoring',
          data: {
            generatedAt: '2026-03-21T00:00:00.000Z',
            featureFlag: { key: 'MIGRATION_BASELINE_SLO_V1', enabled: true, configVersion: 4, configChecksum: 'checksum' },
            goldenSignals: {
              latency: { p95Ms: 450, p99Ms: 900, objectiveMs: 450 },
              errorRate: { value: 0.008, objective: 0.01, errorBudgetRemainingPercent: 20 },
              throughputRpm: 1600,
              availabilityPercent: 99.95,
            },
            businessKpis: [{ key: 'gateway-routed-traffic', label: 'Gateway Routed Traffic', value: 23, unit: 'count' }],
            alerts: { legacyChannelsParallel: true, noisyAlertMitigation: { burnRateWindows: ['5m'], activeWindow: '5m' }, policies: [] },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          correlationId: 'corr-vertical',
          data: {
            moduleConfig: {
              moduleKey: 'module-crm',
              extractionEnabled: true,
              aclLegacyPathEnabled: true,
              routePath: 'extracted',
              reason: 'extracted_enabled',
            },
            writePlan: {
              allowed: true,
              directWrite: false,
              writePath: 'acl-legacy-proxy',
              tableName: 'quotations',
            },
            translationResult: null,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          correlationId: 'corr-recon',
          data: {
            mode: {
              moduleKey: 'module-crm',
              shadowReadsEnabled: true,
              shadowWritesEnabled: true,
              updatedAt: '2026-03-21T00:00:00.000Z',
            },
            artifacts: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          correlationId: 'corr-vertical-patch',
          data: {
            moduleConfig: {
              moduleKey: 'module-crm',
              extractionEnabled: true,
              aclLegacyPathEnabled: true,
              routePath: 'acl-legacy',
              reason: 'rollback_toggle',
            },
            writePlan: {
              allowed: true,
              directWrite: false,
              writePath: 'acl-legacy-proxy',
              tableName: 'leads',
            },
            translationResult: null,
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<MigrationBaselineDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Vertical Extraction Operations')).toBeInTheDocument();
    });

    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/gateway/vertical-extraction?moduleKey=module-crm'),
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });
});
