export type FetchFailureKind = 'network' | 'timeout' | 'client' | 'server' | 'cors' | 'auth' | 'unknown';

export type FetchFailureMeta = {
  kind: FetchFailureKind;
  statusCode?: number;
  message: string;
};

export type RetryPolicy = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 250,
  maxDelayMs: 2500,
};

function readStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = (error as Record<string, unknown>).status;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const code = (error as Record<string, unknown>).statusCode;
  if (typeof code === 'number' && Number.isFinite(code)) return code;
  return undefined;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message || 'Unknown error';
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Unknown error';
}

export function classifyFetchFailure(error: unknown): FetchFailureMeta {
  const statusCode = readStatusCode(error);
  const message = readMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('abort')) {
    return { kind: 'timeout', statusCode, message };
  }
  if (lower.includes('cors') || lower.includes('cross-origin')) {
    return { kind: 'cors', statusCode, message };
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
    return { kind: 'network', statusCode, message };
  }
  if (statusCode === 401 || statusCode === 403 || lower.includes('jwt') || lower.includes('auth') || lower.includes('token')) {
    return { kind: 'auth', statusCode, message };
  }
  if (typeof statusCode === 'number') {
    if (statusCode >= 500) return { kind: 'server', statusCode, message };
    if (statusCode >= 400) return { kind: 'client', statusCode, message };
  }
  return { kind: 'unknown', statusCode, message };
}

export function shouldRetryFailure(meta: FetchFailureMeta, attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): boolean {
  if (attempt >= policy.maxRetries) return false;
  if (meta.kind === 'network' || meta.kind === 'timeout' || meta.kind === 'server' || meta.kind === 'cors') return true;
  if (meta.kind === 'auth' || meta.kind === 'client') return false;
  return attempt < Math.min(policy.maxRetries, 1);
}

export function getRetryDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  const factor = Math.max(0, attempt);
  const jitter = Math.floor(Math.random() * 80);
  const delay = policy.baseDelayMs * 2 ** factor + jitter;
  return Math.min(delay, policy.maxDelayMs);
}

export function describeFetchFailure(meta: FetchFailureMeta): string {
  if (meta.kind === 'auth') return 'Authentication expired. Please sign in again.';
  if (meta.kind === 'cors') return 'Connection was blocked by browser security policy.';
  if (meta.kind === 'timeout') return 'The request timed out. Please try again.';
  if (meta.kind === 'network') return 'Network connection failed. Check your internet and retry.';
  if (meta.kind === 'server') return 'Server error occurred while loading data.';
  if (meta.kind === 'client') return 'Request could not be processed with current filters.';
  return meta.message || 'Unexpected error occurred while loading data.';
}

export async function runWithRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  onRetry?: (attempt: number, meta: FetchFailureMeta) => void,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      const meta = classifyFetchFailure(error);
      if (!shouldRetryFailure(meta, attempt, policy)) {
        throw error;
      }
      onRetry?.(attempt + 1, meta);
      const delay = getRetryDelayMs(attempt, policy);
      await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}
