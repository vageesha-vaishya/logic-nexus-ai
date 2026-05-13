export interface AttachmentValidationPolicy {
  allowedMimeTypes: string[];
  maxBytes: number;
}

export interface AttachmentDescriptor {
  name: string;
  mimeType?: string;
  sizeBytes: number;
}

export type UploadBinaryInput = File | Blob | ArrayBuffer | Uint8Array;

export interface FileAttachmentRecord {
  attachment_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  file_path: string;
  storage_bucket: string;
  is_public: boolean;
  public_url: string | null;
  uploaded_by: string | null;
  uploaded_date: string;
  is_active: boolean;
  scan_status: 'pending' | 'clean' | 'infected' | 'failed';
  field_name: string | null;
  relationship_role: string | null;
}

export interface CreateUploadSessionInput {
  entityType: string;
  entityId: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  fieldName?: string;
  relationshipRole?: string;
  franchiseId?: string;
  isPublic?: boolean;
}

export interface CreateUploadSessionOutput {
  attachment_id: string;
  bucket: string;
  path: string;
}

export interface FinalizeUploadInput {
  attachmentId: string;
  success?: boolean;
  error?: string;
  checksumSha256?: string;
}
