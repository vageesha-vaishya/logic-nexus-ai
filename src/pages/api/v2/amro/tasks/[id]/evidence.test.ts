import { describe, expect, it, vi } from 'vitest';
import handler from './evidence';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import { sanitizeQueryId } from '../../../../_utils/http';
import tasksHandler from '../../tasks';

vi.mock('../../../../_utils/http', () => ({
  sanitizeQueryId: vi.fn(),
}));

vi.mock('../../tasks', () => ({
  default: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, any> } {
  const res: any = {
    headers: {},
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return {
        json: (body: unknown) => {
          res.jsonBody = body;
        },
        end: vi.fn(),
      };
    }),
  };
  return res;
}

describe('/api/v2/amro/tasks/[id]/evidence', () => {
  it('returns 400 when task id is empty', async () => {
    vi.mocked(sanitizeQueryId).mockReturnValue('');
    const req: ApiRequest = { method: 'POST', query: { id: '' }, body: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect((res.jsonBody as any)?.error).toBe('id is required');
    expect(tasksHandler).not.toHaveBeenCalled();
  });

  it('forwards request to tasks mutation endpoint with upload-evidence interface', async () => {
    vi.mocked(sanitizeQueryId).mockReturnValue('task-001');
    vi.mocked(tasksHandler).mockResolvedValue(undefined as never);
    const req: ApiRequest = {
      method: 'POST',
      query: { id: 'task-001' },
      body: {
        evidence_type: 'photo',
        media_ref: 's3://bucket/evidence/photo-001.jpg',
        checksum: 'abc123def456ghi789',
        metadata: {
          media_size_bytes: 1024 * 1024,
          mime_type: 'image/jpeg',
        },
      },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(tasksHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          id: 'task-001',
          interface: 'upload-evidence',
        }),
        body: expect.objectContaining({
          task_id: 'task-001',
          evidence_type: 'photo',
        }),
      }),
      res
    );
  });
});
