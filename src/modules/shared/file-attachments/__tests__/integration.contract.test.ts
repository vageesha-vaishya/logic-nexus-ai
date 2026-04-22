import { describe, expect, it, vi } from 'vitest';
import { createUploadSession, finalizeUpload, listAttachments } from '../api';

function makeMockClient() {
  return {
    rpc: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  } as any;
}

describe('file attachment RPC contract', () => {
  it('calls upload session RPC with standardized parameters', async () => {
    const client = makeMockClient();
    client.rpc.mockResolvedValue({
      data: [{ attachment_id: 'a1', bucket: 'app-attachments', path: 't/e/1' }],
      error: null,
    });

    const data = await createUploadSession(client, {
      entityType: 'shipment',
      entityId: '00000000-0000-0000-0000-000000000001',
      fileName: 'proof.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      fieldName: 'attachments',
      relationshipRole: 'supporting',
      isPublic: true,
    });

    expect(data.attachment_id).toBe('a1');
    expect(client.rpc).toHaveBeenCalledWith(
      'file_attachment_create_upload_session',
      expect.objectContaining({ p_is_public: true }),
    );
  });

  it('calls finalize RPC', async () => {
    const client = makeMockClient();
    client.rpc.mockResolvedValue({ data: {}, error: null });
    await finalizeUpload(client, { attachmentId: 'a1', success: true });
    expect(client.rpc).toHaveBeenCalledWith('file_attachment_finalize_upload', {
      p_attachment_id: 'a1',
      p_success: true,
      p_error: null,
      p_checksum_sha256: null,
    });
  });

  it('calls list RPC', async () => {
    const client = makeMockClient();
    client.rpc.mockResolvedValue({ data: [], error: null });
    await listAttachments(client, 'shipment', '00000000-0000-0000-0000-000000000001');
    expect(client.rpc).toHaveBeenCalledWith('file_attachment_list_for_entity', {
      p_entity_type: 'shipment',
      p_entity_id: '00000000-0000-0000-0000-000000000001',
      p_include_inactive: false,
    });
  });
});
