import { logger } from '@/lib/logger';

export interface ContainerTypeApiDTO {
  id: number;
  sourceId: string;
  name: string;
  description: string;
  isActive: boolean;
  code?: string;
}

export interface ContainerSizeApiDTO {
  id: number;
  sourceId: string;
  containerTypeSourceId: string;
  name: string;
  description: string;
  isActive: boolean;
  isoCode?: string;
}

const MIN_LOADING_MS = 500;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestJson<T>(url: string, options: RequestInit, timeoutMs = 7000): Promise<T> {
  const startedAt = Date.now();
  const correlationId = crypto.randomUUID();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.headers || {}),
          'x-correlation-id': correlationId,
        },
      });

      if (!response.ok) {
        let errorBody: any = null;
        try {
          errorBody = await response.json();
        } catch {
          // ignore json parse error
        }

        const retryable = response.status >= 500 || response.status === 429 || response.status === 503;
        const errorMessage = errorBody?.error || `HTTP ${response.status}`;
        if (!retryable || attempt >= MAX_RETRIES) {
          throw new Error(errorMessage);
        }

        await sleep(2 ** (attempt - 1) * 300);
        continue;
      }

      const payload = await response.json();
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_MS) {
        await sleep(MIN_LOADING_MS - elapsed);
      }
      return payload;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error('Network request failed');
      if (attempt >= MAX_RETRIES) break;
      await sleep(2 ** (attempt - 1) * 300);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('Request failed');
}

export async function fetchContainerTypesApi(tenantId: string, userId?: string): Promise<ContainerTypeApiDTO[]> {
  const payload = await requestJson<{ data: ContainerTypeApiDTO[] }>(
    '/api/v1/container-types',
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
        ...(userId ? { 'x-user-id': userId } : {}),
      },
    }
  );

  return Array.isArray(payload.data) ? payload.data : [];
}

export async function fetchContainerSizesApi(tenantId: string, typeId?: string, userId?: string): Promise<ContainerSizeApiDTO[]> {
  const query = typeId ? `?typeId=${encodeURIComponent(typeId)}` : '';
  const payload = await requestJson<{ data: ContainerSizeApiDTO[] }>(
    `/api/v1/container-sizes${query}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
        ...(userId ? { 'x-user-id': userId } : {}),
      },
    }
  );

  return Array.isArray(payload.data) ? payload.data : [];
}

export function logContainerMetadataError(scope: string, error: unknown): void {
  logger.warn(`[ContainerMetadataAPI] ${scope} failed`, error);
}
