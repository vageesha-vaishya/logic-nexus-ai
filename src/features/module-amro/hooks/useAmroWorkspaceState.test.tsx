import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAmroWorkspaceState } from './useAmroWorkspaceState';

const mockUseAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();
  private listeners = new Map<string, Array<() => void>>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(eventName: string, listener: () => void) {
    const existing = this.listeners.get(eventName) || [];
    this.listeners.set(eventName, [...existing, listener]);
  }

  emit(eventName: string) {
    const listeners = this.listeners.get(eventName) || [];
    listeners.forEach((listener) => listener());
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useAmroWorkspaceState realtime schedule connectivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
    mockUseAuth.mockReturnValue({
      session: { access_token: 'token-abc' },
      hasPermission: () => true,
      hasRole: () => false,
      isPlatformAdmin: () => false,
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/v1/work-packages/') && url.includes('/materials')) {
        return jsonResponse({ data: [] });
      }
      if (url.includes('/api/v1/work-packages/') && url.includes('/tasks')) {
        return jsonResponse({
          data: [{ id: 'task-1', work_package_id: 'wp-1', title: 'Inspect', status: 'in_progress' }],
        });
      }
      if (url.includes('/api/v1/work-packages')) {
        return jsonResponse({
          data: [{ id: 'wp-1', aircraft_id: 'ac-1', work_order_number: 'WP-1', status: 'planning', title: 'WP' }],
        });
      }
      if (url.includes('/api/v2/amro/schedules')) {
        return jsonResponse({
          output: {
            schedules: [
              {
                schedule_id: 'sch-1',
                work_package_id: 'wp-1',
                station_code: 'station-a',
                slot_start: '2026-03-22T00:00:00.000Z',
                slot_end: '2026-03-22T02:00:00.000Z',
                assigned_team_size: 2,
                capacity: 4,
                status: 'scheduled',
              },
            ],
          },
        });
      }
      if (url.includes('/api/v1/assets')) {
        return jsonResponse({
          data: [
            {
              id: 'ac-1',
              tenant_id: 'tenant-1',
              franchise_id: 'fr-1',
              registration: 'A320',
              aircraft_type: 'A320',
              serial_number: 'SN-1',
              status: 'active',
            },
          ],
        });
      }
      if (url.includes('/api/v1/qualifications')) {
        return jsonResponse({
          data: [{ id: 'qual-1', qualification_name: 'Inspector', rating: 'qa', can_certify_release: true }],
        });
      }
      if (url.includes('/api/v1/compliance/summary')) {
        return jsonResponse({ data: { authorityCoverage: ['FAA'], activeRulePacks: 1 } });
      }
      if (url.includes('/api/v1/evidence')) {
        return jsonResponse({ data: [] });
      }
      if (url.includes('/api/v1/forecast/recommendations')) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ data: [] });
    });

    vi.stubGlobal('fetch', fetchMock);
  });

  it('connects to EventSource stream and marks realtime connection on connected event', async () => {
    const { result } = renderHook(() => useAmroWorkspaceState());

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1));

    const source = MockEventSource.instances[0];
    expect(source.url).toContain('/api/v1/work-packages/stream?access_token=token-abc');

    act(() => {
      source.emit('connected');
    });

    await waitFor(() => expect(result.current.realtimeConnected).toBe(true));
  });

  it('refreshes workspace datasets when work-package-change event is emitted', async () => {
    const fetchMock = vi.mocked(fetch);
    renderHook(() => useAmroWorkspaceState());

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1));

    const listCallsBefore = fetchMock.mock.calls.filter(
      (call) => String(call[0]).includes('/api/v1/work-packages') && !String(call[0]).includes('/tasks') && !String(call[0]).includes('/materials'),
    ).length;

    act(() => {
      MockEventSource.instances[0].emit('work-package-change');
    });

    await waitFor(() => {
      const listCallsAfter = fetchMock.mock.calls.filter(
        (call) => String(call[0]).includes('/api/v1/work-packages') && !String(call[0]).includes('/tasks') && !String(call[0]).includes('/materials'),
      ).length;
      expect(listCallsAfter).toBeGreaterThan(listCallsBefore);
    });
  });

  it('marks realtime disconnected and closes stream on EventSource error', async () => {
    const { result } = renderHook(() => useAmroWorkspaceState());

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1));

    const source = MockEventSource.instances[0];
    act(() => {
      source.emit('connected');
    });
    await waitFor(() => expect(result.current.realtimeConnected).toBe(true));

    act(() => {
      source.onerror?.(new Event('error'));
    });

    await waitFor(() => expect(result.current.realtimeConnected).toBe(false));
    expect(source.close).toHaveBeenCalled();
  });

  it('loads certification workflow states through certification interfaces', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/v2/amro/certification?interface=validate-certifying-authority')) {
        return jsonResponse({ output: { validation_result: 'valid' } });
      }
      if (url.includes('/api/v2/amro/certification?interface=submit-certification-decision')) {
        return jsonResponse({
          output: {
            action_status: 'approved',
            blockers: [],
            workflow: { next_action: 'release-authorized' },
          },
        });
      }
      if (url.includes('/api/v2/amro/certification?interface=automate-expiry-suspension')) {
        return jsonResponse({
          output: {
            summary: { warning_count: 1, suspension_count: 0, evaluated_count: 1 },
          },
        });
      }
      if (url.includes('/api/v2/amro/certification?interface=load-competency-analytics-dashboard')) {
        return jsonResponse({
          output: {
            kpi_cards: {
              total_qualified_staff: 1,
              active_certifiers: 1,
              warning_window_staff: 0,
              suspended_certifiers: 0,
            },
            authority_distribution: { supervisor: 1 },
          },
        });
      }
      if (url.includes('/api/v2/amro/certification?interface=load-authority-certification-template')) {
        return jsonResponse({
          output: {
            template: {
              template_id: 'tmpl-faa-cert-release-v1',
              required_signatures: ['certifying_engineer'],
              mandatory_checks: ['ad_sb_clearance'],
              defer_policy: { max_defer_days: 3 },
            },
          },
        });
      }

      if (url.includes('/api/v1/work-packages/') && url.includes('/materials')) {
        return jsonResponse({ data: [] });
      }
      if (url.includes('/api/v1/work-packages/') && url.includes('/tasks')) {
        return jsonResponse({
          data: [{ id: 'task-1', work_package_id: 'wp-1', title: 'Inspect', status: 'in_progress' }],
        });
      }
      if (url.includes('/api/v1/work-packages')) {
        return jsonResponse({
          data: [{ id: 'wp-1', aircraft_id: 'ac-1', work_order_number: 'WP-1', status: 'planning', title: 'WP' }],
        });
      }
      if (url.includes('/api/v2/amro/schedules')) {
        return jsonResponse({ output: { schedules: [] } });
      }
      if (url.includes('/api/v1/assets')) {
        return jsonResponse({
          data: [
            {
              id: 'ac-1',
              tenant_id: 'tenant-1',
              franchise_id: 'fr-1',
              registration: 'A320',
              aircraft_type: 'A320',
              serial_number: 'SN-1',
              status: 'active',
            },
          ],
        });
      }
      if (url.includes('/api/v1/qualifications')) {
        return jsonResponse({
          data: [
            {
              id: 'qual-1',
              qualification_name: 'Inspector',
              rating: 'supervisor',
              can_certify_release: true,
              expiration_date: '2026-05-01T00:00:00.000Z',
            },
          ],
        });
      }
      if (url.includes('/api/v1/compliance/summary')) {
        return jsonResponse({ data: { authorityCoverage: ['FAA'], activeRulePacks: 1 } });
      }
      if (url.includes('/api/v1/evidence')) {
        return jsonResponse({ data: [] });
      }
      if (url.includes('/api/v1/forecast/recommendations')) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroWorkspaceState());

    await waitFor(() => expect(result.current.selectedWorkPackageId).toBe('wp-1'));

    await act(async () => {
      await result.current.validateCertifyingPrivilege();
      await result.current.submitCertificationDecision('approve');
      await result.current.runExpiryWarningAndSuspension();
      await result.current.loadCompetencyAnalyticsDashboard();
      await result.current.loadAuthorityCertificationTemplate();
    });

    expect(result.current.certifyingPrivilegeValidated).toBe(true);
    expect(result.current.latestCertificationDecision?.actionStatus).toBe('approved');
    expect(result.current.expiryAutomationSummary?.warningCount).toBe(1);
    expect(result.current.competencyAnalytics?.totalQualifiedStaff).toBe(1);
    expect(result.current.authorityCertificationTemplate?.templateId).toBe('tmpl-faa-cert-release-v1');
  });
});
