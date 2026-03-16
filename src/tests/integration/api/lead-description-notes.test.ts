import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSupabaseAdminClient } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/pages/api/_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient,
}));

import getDescriptionNotesHandler from '@/pages/api/leads/[id]/description-notes';
import putDescriptionHandler from '@/pages/api/leads/[id]/description';
import putNotesHandler from '@/pages/api/leads/[id]/notes';

function mockReqRes(input: { method?: string; query?: Record<string, unknown>; headers?: Record<string, string>; body?: any }) {
  const req = {
    method: input.method,
    query: input.query || {},
    headers: input.headers || {},
    body: input.body,
  } as any;

  let statusCode = 200;
  let payload: any;
  let endedText = '';

  const res = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      statusCode = code;
      return {
        json: (data: unknown) => {
          payload = data;
        },
        end: (text?: string) => {
          endedText = text || '';
        },
      };
    }),
    _getStatusCode: () => statusCode,
    _getData: () => payload,
    _getEndText: () => endedText,
  } as any;

  return { req, res };
}

function setupSelectMock(data: any, error: any = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eqSecond = vi.fn(() => ({ maybeSingle }));
  const eqFirst = vi.fn(() => ({ eq: eqSecond }));
  const select = vi.fn(() => ({ eq: eqFirst }));
  const from = vi.fn(() => ({ select }));
  getSupabaseAdminClient.mockReturnValue({ from });
}

function setupUpdateMock(data: any, error: any = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn(() => ({ maybeSingle }));
  const eqSecond = vi.fn(() => ({ select }));
  const eqFirst = vi.fn(() => ({ eq: eqSecond }));
  const update = vi.fn(() => ({ eq: eqFirst }));
  const from = vi.fn(() => ({ update }));
  getSupabaseAdminClient.mockReturnValue({ from });
}

describe('Lead description and notes API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/leads/:id/description-notes returns sanitized payload', async () => {
    setupSelectMock({
      id: 'lead-1',
      description: '<p>Hello</p><script>alert(1)</script>',
      notes: '<p>World</p><img src=x onerror=alert(1)>',
      updated_at: '2026-03-16T10:00:00.000Z',
    });

    const { req, res } = mockReqRes({
      method: 'GET',
      query: { id: 'lead-1' },
      headers: { 'x-tenant-id': 'tenant-1', 'x-user-id': 'user-1' },
    });

    await getDescriptionNotesHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getData().data).toEqual(
      expect.objectContaining({
        leadId: 'lead-1',
        description: '<p>Hello</p>',
        notes: '<p>World</p>',
      }),
    );
  });

  it('PUT /api/leads/:id/description validates max length', async () => {
    setupUpdateMock(null, null);
    const tooLong = `<p>${'a'.repeat(5001)}</p>`;
    const { req, res } = mockReqRes({
      method: 'PUT',
      query: { id: 'lead-1' },
      body: { description: tooLong },
      headers: { 'x-tenant-id': 'tenant-1', 'x-user-id': 'user-1' },
    });

    await putDescriptionHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData().error).toContain('Invalid description format');
  });

  it('PUT /api/leads/:id/notes updates and sanitizes notes', async () => {
    setupUpdateMock({
      id: 'lead-1',
      notes: '<p>Safe</p>',
      updated_at: '2026-03-16T11:00:00.000Z',
    });

    const { req, res } = mockReqRes({
      method: 'PUT',
      query: { id: 'lead-1' },
      body: { notes: '<p>Safe</p><script>bad()</script>' },
      headers: { 'x-tenant-id': 'tenant-1', 'x-user-id': 'user-1' },
    });

    await putNotesHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getData().data).toEqual(
      expect.objectContaining({
        leadId: 'lead-1',
        notes: '<p>Safe</p>',
      }),
    );
  });
});
