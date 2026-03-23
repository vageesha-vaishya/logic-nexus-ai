import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const addLog = vi.fn();
const getCorrelationId = vi.fn(() => 'corr-123');

vi.mock('@/lib/logger', () => ({
  logger: {
    getCorrelationId,
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/debug-store', () => ({
  debugStore: {
    getConfig: () => ({
      enabled: false,
      network: {
        ignoredUrls: [],
        captureRequestBody: false,
        captureResponseBody: false,
        captureRequestHeaders: false,
        captureResponseHeaders: false,
        urlPatterns: ['.*'],
        maxPayloadSize: 5000,
      },
    }),
    addLog,
  },
}));

describe('network-logger', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    originalFetch = window.fetch;
  });

  afterEach(() => {
    window.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('adds correlation header for non-supabase requests', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    window.fetch = baseFetch as unknown as typeof window.fetch;

    const { initNetworkLogger } = await import('@/lib/network-logger');
    initNetworkLogger();

    await window.fetch('https://api.example.com/health', { method: 'GET' });

    const [, init] = baseFetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('X-Correlation-ID')).toBe('corr-123');
  });

  it('ensures apikey and authorization for supabase rest requests', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    window.fetch = baseFetch as unknown as typeof window.fetch;

    const { initNetworkLogger } = await import('@/lib/network-logger');
    initNetworkLogger();

    await window.fetch('https://project.supabase.co/rest/v1/shipments?select=*', { method: 'GET' });

    const [, init] = baseFetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = new Headers(init.headers);
    const apikey = headers.get('apikey');
    expect(apikey).toBeTruthy();
    expect(headers.get('Authorization')).toBe(`Bearer ${apikey}`);
    expect(headers.get('X-Correlation-ID')).toBeNull();
  });

  it('detects supabase rest requests when fetch is called with Request objects', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    window.fetch = baseFetch as unknown as typeof window.fetch;

    const { initNetworkLogger } = await import('@/lib/network-logger');
    initNetworkLogger();

    const request = new Request('https://project.supabase.co/rest/v1/shipments?select=*', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer user_jwt_token',
      },
    });
    await window.fetch(request);

    const [patchedRequest] = baseFetch.mock.calls[0] as [Request];
    expect(patchedRequest.headers.get('apikey')).toBeTruthy();
    expect(patchedRequest.headers.get('Authorization')).toBe('Bearer user_jwt_token');
    expect(patchedRequest.headers.get('X-Correlation-ID')).toBeNull();
  });

  it('preserves Request headers when fetch receives Request plus init', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    window.fetch = baseFetch as unknown as typeof window.fetch;

    const { initNetworkLogger } = await import('@/lib/network-logger');
    initNetworkLogger();

    const request = new Request('https://project.supabase.co/rest/v1/user_roles?select=role', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer user_jwt_token',
      },
    });
    await window.fetch(request, { method: 'GET' });

    const [patchedRequest, patchedInit] = baseFetch.mock.calls[0] as [Request, RequestInit];
    const headers = new Headers(patchedInit.headers || patchedRequest.headers);
    expect(headers.get('Authorization')).toBe('Bearer user_jwt_token');
    expect(headers.get('apikey')).toBeTruthy();
  });
});
