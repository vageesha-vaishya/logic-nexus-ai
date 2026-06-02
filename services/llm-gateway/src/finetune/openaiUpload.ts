// Bucket URL → OpenAI file id translator. Per design §9.1.
//
// The submitter wants `training_file: 'file-...'` but tenants store
// datasets in their own buckets (Supabase Storage, S3, GCS). Rather
// than make every caller pre-upload via openai.files.create, the
// gateway resolves the URL itself:
//   1. file-XXXXXXXX  → pass through, no upload
//   2. https://…      → fetch bytes, upload via openai.files.create,
//                       cache the resulting file id by URL
//   3. gs:// / s3://  → reject with a clear message asking the caller
//                       to mint a signed https URL instead
//
// The cache is intentionally process-scoped: re-uploading 100MB of
// jsonl on every submit attempt is unfriendly, but a persistent
// per-provider ref column on fine_tune_jobs is a bigger schema slice
// that can come later. Within one running gateway process this is
// enough to make retries cheap.

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

export class FineTuneUploadError extends Error {
  constructor(
    public readonly code:
      | 'PROVIDER_NOT_CONFIGURED'
      | 'UNSUPPORTED_SCHEME'
      | 'FETCH_FAILED'
      | 'UPLOAD_FAILED',
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FineTuneUploadError';
  }
}

export const OPENAI_FILE_ID_RE = /^file-[A-Za-z0-9]{8,}$/;

/** Process-scoped cache keyed by source URL. */
const cache = new Map<string, string>();

export function clearTranslatorCacheForTesting(): void {
  cache.clear();
}

export interface TranslateDeps {
  /** Override hook for tests — defaults to global fetch. */
  fetcher?: (url: string) => Promise<{ ok: boolean; status: number; statusText: string; arrayBuffer(): Promise<ArrayBuffer> }>;
  /** Override hook for tests — defaults to the real OpenAI SDK call. */
  uploader?: (apiKey: string, fileName: string, bytes: Uint8Array) => Promise<{ id: string }>;
}

const DEFAULT_FILE_NAME_BY_FORMAT: Record<string, string> = {
  jsonl: 'dataset.jsonl',
  csv: 'dataset.csv',
  parquet: 'dataset.parquet',
};

function fileNameFor(url: string, format: string | undefined): string {
  // Prefer the URL's own basename if it looks like a real filename;
  // otherwise fall back to a format-appropriate default.
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last && /\.[A-Za-z0-9]+$/.test(last)) return last;
  } catch { /* invalid URL — fall through */ }
  if (format && DEFAULT_FILE_NAME_BY_FORMAT[format]) return DEFAULT_FILE_NAME_BY_FORMAT[format];
  return 'dataset.jsonl';
}

async function defaultUploader(apiKey: string, fileName: string, bytes: Uint8Array): Promise<{ id: string }> {
  const client = new OpenAI({ apiKey });
  // OpenAI SDK accepts a Web File; arraybuffer→File works in Node 20+.
  // Wrap as Blob first so TS sees a clean BlobPart shape regardless
  // of the underlying ArrayBuffer/SharedArrayBuffer lib distinction.
  const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
  const file = new File([blob], fileName, { type: 'application/octet-stream' });
  const created = await client.files.create({
    file,
    purpose: 'fine-tune',
  });
  return { id: created.id };
}

/**
 * Resolve a dataset URL to an OpenAI file id, uploading the bytes if
 * the input isn't already a file-id reference.
 */
export async function translateDatasetToOpenAIFileId(
  datasetUrl: string,
  format: string | undefined,
  deps: TranslateDeps = {},
): Promise<{ file_id: string; cached: boolean; uploaded_bytes: number }> {
  if (OPENAI_FILE_ID_RE.test(datasetUrl)) {
    return { file_id: datasetUrl, cached: false, uploaded_bytes: 0 };
  }

  if (datasetUrl.startsWith('gs://') || datasetUrl.startsWith('s3://')) {
    throw new FineTuneUploadError(
      'UNSUPPORTED_SCHEME',
      `dataset_url uses ${datasetUrl.split(':')[0]}:// — provide a signed https URL or pre-upload via openai.files.create and pass the file-id`,
      { dataset_url: datasetUrl },
    );
  }

  if (!/^https:\/\//.test(datasetUrl)) {
    throw new FineTuneUploadError(
      'UNSUPPORTED_SCHEME',
      `dataset_url must be an https:// URL or a file-id; got "${datasetUrl.slice(0, 32)}…"`,
      { dataset_url: datasetUrl },
    );
  }

  const cached = cache.get(datasetUrl);
  if (cached) {
    return { file_id: cached, cached: true, uploaded_bytes: 0 };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new FineTuneUploadError(
      'PROVIDER_NOT_CONFIGURED',
      'OPENAI_API_KEY missing — cannot upload dataset',
    );
  }

  // Fetch the bytes from the tenant's signed URL.
  const fetcher = deps.fetcher ?? ((url: string) => fetch(url));
  let bytes: Uint8Array;
  try {
    const res = await fetcher(datasetUrl);
    if (!res.ok) {
      throw new FineTuneUploadError(
        'FETCH_FAILED',
        `dataset fetch returned ${res.status} ${res.statusText}`,
        { status: res.status },
      );
    }
    const buf = await res.arrayBuffer();
    bytes = new Uint8Array(buf);
  } catch (err) {
    if (err instanceof FineTuneUploadError) throw err;
    throw new FineTuneUploadError(
      'FETCH_FAILED',
      err instanceof Error ? err.message : String(err),
    );
  }

  // Upload to OpenAI Files API.
  const fileName = fileNameFor(datasetUrl, format);
  let uploaded;
  try {
    uploaded = await (deps.uploader ?? defaultUploader)(apiKey, fileName, bytes);
  } catch (err) {
    throw new FineTuneUploadError(
      'UPLOAD_FAILED',
      err instanceof Error ? err.message : String(err),
      { sdk_error: err instanceof Error ? err.name : 'unknown' },
    );
  }

  cache.set(datasetUrl, uploaded.id);
  logger.info('finetune.upload: translated dataset to OpenAI file', {
    source_url_host: (() => { try { return new URL(datasetUrl).host; } catch { return 'unknown'; } })(),
    file_id: uploaded.id,
    bytes: bytes.byteLength,
  });

  return { file_id: uploaded.id, cached: false, uploaded_bytes: bytes.byteLength };
}
