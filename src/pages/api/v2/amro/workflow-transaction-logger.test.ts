import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import {
  fetchWorkflowTransactionLogByTransitionId,
  logWorkflowTransaction,
  sanitizeWorkflowPayload,
} from './workflow-transaction-logger';

vi.mock('../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

describe('workflow-transaction-logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes sensitive payload keys recursively', () => {
    const payload = sanitizeWorkflowPayload({
      actor_signature: 'sig-123',
      authorization_token: 'token-123',
      nested: {
        password_hash: 'hash-123',
      },
    });

    expect(payload.actor_signature).toBe('***');
    expect(payload.authorization_token).toBe('***');
    expect((payload.nested as Record<string, unknown>).password_hash).toBe('***');
  });

  it('persists sanitized payload as serialized text columns', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      schema: vi.fn(() => ({
        from: vi.fn(() => ({ insert })),
      })),
    } as any);

    const record = await logWorkflowTransaction({
      transitionId: 'tr-001',
      gateName: 'work-package-transition',
      inputPayload: { actor_signature: 'sig-123' },
      outputPayload: { status: 'ok' },
      userContext: { user_id: 'user-1' },
      status: 'SUCCESS',
    });

    expect(record.tx_status).toBe('SUCCESS');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      input_payload: expect.any(String),
      output_payload: expect.any(String),
      tx_status: 'SUCCESS',
    }));
    const args = insert.mock.calls[0][0];
    expect(JSON.parse(args.input_payload).actor_signature).toBe('***');
  });

  it('parses stored text payloads when fetching by transition id', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        tx_id: 'wf-tx-001',
        transition_id: 'tr-001',
        gate_name: 'work-package-transition',
        input_payload: '{"actor_signature":"***","expected_version":1}',
        output_payload: '{"updated_status":"completed"}',
        tx_timestamp: '2026-03-24T00:00:00.000Z',
        user_ctx: { user_id: 'user-1' },
        tx_status: 'SUCCESS',
      },
      error: null,
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      schema: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
          })),
        })),
      })),
    } as any);

    const result = await fetchWorkflowTransactionLogByTransitionId('tr-001');

    expect(result?.tx_id).toBe('wf-tx-001');
    expect(result?.input_payload.actor_signature).toBe('***');
    expect(result?.output_payload.updated_status).toBe('completed');
  });
});
