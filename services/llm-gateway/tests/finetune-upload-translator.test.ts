// §9.1.d — bucket→OpenAI file id translator tests. Fetcher + uploader
// are mocked via the translator's deps hook (no SDK boundary mocking
// needed). Cache behaviour is verified via clearTranslatorCacheForTesting.

import { jest } from '@jest/globals';

const {
  translateDatasetToOpenAIFileId,
  FineTuneUploadError,
  clearTranslatorCacheForTesting,
} = await import('../src/finetune/openaiUpload.js');

function fakeResponse(bytes: Uint8Array, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  };
}

describe('translateDatasetToOpenAIFileId', () => {
  beforeEach(() => {
    clearTranslatorCacheForTesting();
    process.env.OPENAI_API_KEY = 'sk-test';
  });
  afterAll(() => { delete process.env.OPENAI_API_KEY; });

  it('passes through OpenAI file ids without uploading', async () => {
    const result = await translateDatasetToOpenAIFileId('file-abc12345', 'jsonl');
    expect(result).toEqual({ file_id: 'file-abc12345', cached: false, uploaded_bytes: 0 });
  });

  it('fetches https URL bytes and uploads them, returning the new file id', async () => {
    const fetcher = jest.fn(async () => fakeResponse(new Uint8Array([1, 2, 3, 4])));
    const uploader = jest.fn(async () => ({ id: 'file-uploaded789' }));
    const result = await translateDatasetToOpenAIFileId(
      'https://example.com/datasets/training.jsonl',
      'jsonl',
      { fetcher: fetcher as never, uploader: uploader as never },
    );
    expect(result).toEqual({ file_id: 'file-uploaded789', cached: false, uploaded_bytes: 4 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(uploader).toHaveBeenCalledTimes(1);
    const [, fileName, bytes] = uploader.mock.calls[0] as [string, string, Uint8Array];
    expect(fileName).toBe('training.jsonl');
    expect(bytes.byteLength).toBe(4);
  });

  it('falls back to a format-appropriate file name when URL has no extension', async () => {
    const uploader = jest.fn(async () => ({ id: 'file-newname111' }));
    await translateDatasetToOpenAIFileId(
      'https://example.com/api/blob/12345',
      'csv',
      {
        fetcher: (async () => fakeResponse(new Uint8Array([0]))) as never,
        uploader: uploader as never,
      },
    );
    const [, fileName] = uploader.mock.calls[0] as [string, string, Uint8Array];
    expect(fileName).toBe('dataset.csv');
  });

  it('serves subsequent calls for the same URL from cache', async () => {
    const fetcher = jest.fn(async () => fakeResponse(new Uint8Array([9, 9])));
    const uploader = jest.fn(async () => ({ id: 'file-cached222' }));
    const url = 'https://example.com/d.jsonl';

    const first = await translateDatasetToOpenAIFileId(url, 'jsonl', { fetcher: fetcher as never, uploader: uploader as never });
    const second = await translateDatasetToOpenAIFileId(url, 'jsonl', { fetcher: fetcher as never, uploader: uploader as never });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.file_id).toBe('file-cached222');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(uploader).toHaveBeenCalledTimes(1);
  });

  it('rejects gs:// with UNSUPPORTED_SCHEME', async () => {
    await expect(
      translateDatasetToOpenAIFileId('gs://bucket/dataset.jsonl', 'jsonl'),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_SCHEME' });
  });

  it('rejects s3:// with UNSUPPORTED_SCHEME', async () => {
    await expect(
      translateDatasetToOpenAIFileId('s3://bucket/dataset.jsonl', 'jsonl'),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_SCHEME' });
  });

  it('rejects http:// (insecure) with UNSUPPORTED_SCHEME', async () => {
    await expect(
      translateDatasetToOpenAIFileId('http://example.com/d.jsonl', 'jsonl'),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_SCHEME' });
  });

  it('surfaces FETCH_FAILED when the bucket returns non-2xx', async () => {
    await expect(
      translateDatasetToOpenAIFileId(
        'https://example.com/expired.jsonl',
        'jsonl',
        {
          fetcher: (async () => fakeResponse(new Uint8Array(), { ok: false, status: 403, statusText: 'Forbidden' })) as never,
        },
      ),
    ).rejects.toMatchObject({ code: 'FETCH_FAILED' });
  });

  it('surfaces FETCH_FAILED when fetch itself throws', async () => {
    await expect(
      translateDatasetToOpenAIFileId('https://example.com/d.jsonl', 'jsonl', {
        fetcher: (async () => { throw new Error('DNS failure'); }) as never,
      }),
    ).rejects.toMatchObject({ code: 'FETCH_FAILED' });
  });

  it('surfaces UPLOAD_FAILED when the OpenAI uploader throws', async () => {
    await expect(
      translateDatasetToOpenAIFileId('https://example.com/d.jsonl', 'jsonl', {
        fetcher: (async () => fakeResponse(new Uint8Array([0]))) as never,
        uploader: (async () => { throw new Error('upload quota exceeded'); }) as never,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_FAILED' });
  });

  it('throws PROVIDER_NOT_CONFIGURED when OPENAI_API_KEY missing', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(
      translateDatasetToOpenAIFileId('https://example.com/d.jsonl', 'jsonl', {
        fetcher: (async () => fakeResponse(new Uint8Array([0]))) as never,
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
  });

  it('FineTuneUploadError carries code + details', () => {
    const err = new FineTuneUploadError('FETCH_FAILED', 'oops', { status: 500 });
    expect(err.code).toBe('FETCH_FAILED');
    expect(err.details).toEqual({ status: 500 });
    expect(err.name).toBe('FineTuneUploadError');
  });
});
