import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AttachmentDescriptor,
  AttachmentValidationPolicy,
  CreateUploadSessionInput,
  CreateUploadSessionOutput,
  FileAttachmentRecord,
  FinalizeUploadInput,
  UploadBinaryInput,
} from './types';

export const DEFAULT_ATTACHMENT_POLICY: AttachmentValidationPolicy = {
  allowedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
  maxBytes: 25 * 1024 * 1024,
};

export function validateAttachment(
  file: File,
  policy: AttachmentValidationPolicy = DEFAULT_ATTACHMENT_POLICY,
): { valid: boolean; reason?: string } {
  return validateAttachmentDescriptor(
    {
      name: file.name,
      mimeType: file.type || undefined,
      sizeBytes: file.size,
    },
    policy,
  );
}

export function validateAttachmentDescriptor(
  descriptor: AttachmentDescriptor,
  policy: AttachmentValidationPolicy = DEFAULT_ATTACHMENT_POLICY,
): { valid: boolean; reason?: string } {
  if (descriptor.sizeBytes > policy.maxBytes) {
    return { valid: false, reason: `File exceeds ${policy.maxBytes} bytes limit` };
  }
  if (
    policy.allowedMimeTypes.length > 0 &&
    descriptor.mimeType &&
    !policy.allowedMimeTypes.includes(descriptor.mimeType)
  ) {
    return { valid: false, reason: `Unsupported file type: ${descriptor.mimeType}` };
  }
  return { valid: true };
}

export async function createUploadSession(
  client: SupabaseClient,
  input: CreateUploadSessionInput,
): Promise<CreateUploadSessionOutput> {
  const { data, error } = await client.rpc('file_attachment_create_upload_session', {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_file_name: input.fileName,
    p_file_type: input.fileType ?? null,
    p_file_size: input.fileSize ?? null,
    p_field_name: input.fieldName ?? null,
    p_relationship_role: input.relationshipRole ?? null,
    p_franchise_id: input.franchiseId ?? null,
    p_is_public: input.isPublic ?? false,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as CreateUploadSessionOutput;
}

export async function uploadBinary(
  client: SupabaseClient,
  bucket: string,
  path: string,
  input: UploadBinaryInput,
  contentType?: string,
): Promise<void> {
  const { body, inferredContentType } = normalizeUploadInput(input, contentType);
  const { error } = await client.storage.from(bucket).upload(path, body, {
    contentType: inferredContentType,
    upsert: false,
  });
  if (error) throw error;
}

export async function finalizeUpload(
  client: SupabaseClient,
  input: FinalizeUploadInput,
): Promise<void> {
  const { error } = await client.rpc('file_attachment_finalize_upload', {
    p_attachment_id: input.attachmentId,
    p_success: input.success ?? true,
    p_error: input.error ?? null,
    p_checksum_sha256: input.checksumSha256 ?? null,
  });
  if (error) throw error;
}

export async function listAttachments(
  client: SupabaseClient,
  entityType: string,
  entityId: string,
  includeInactive = false,
): Promise<FileAttachmentRecord[]> {
  const { data, error } = await client.rpc('file_attachment_list_for_entity', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_include_inactive: includeInactive,
  });
  if (error) throw error;
  return (data ?? []) as FileAttachmentRecord[];
}

export async function deleteAttachment(client: SupabaseClient, attachmentId: string): Promise<void> {
  const { error } = await client.rpc('file_attachment_soft_delete', {
    p_attachment_id: attachmentId,
  });
  if (error) throw error;
}

export async function createDownloadUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
  attachmentId: string,
  isPublic = false,
  publicUrl: string | null = null,
  expiresInSeconds = 120,
): Promise<string> {
  if (isPublic) {
    if (publicUrl) return publicUrl;
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;

  const { error: trackingError } = await client.rpc('file_attachment_record_access', {
    p_attachment_id: attachmentId,
    p_event_type: 'downloaded',
  });
  if (trackingError) {
    // Non-blocking tracking error: do not fail download URL generation
  }

  return data.signedUrl;
}

function normalizeUploadInput(
  input: UploadBinaryInput,
  contentType?: string,
): { body: UploadBinaryInput; inferredContentType: string } {
  if (typeof File !== 'undefined' && input instanceof File) {
    return {
      body: input,
      inferredContentType: contentType || input.type || 'application/octet-stream',
    };
  }

  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return {
      body: input,
      inferredContentType: contentType || input.type || 'application/octet-stream',
    };
  }

  if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
    return {
      body: input,
      inferredContentType: contentType || 'application/octet-stream',
    };
  }

  return {
    body: input,
    inferredContentType: contentType || 'application/octet-stream',
  };
}
