import type { ApiResponse } from './types';
import { ConnectionPoolException, QueryTimeoutException, SQLException, ServiceUnavailableException } from './errors';

type ErrorResponseOptions = {
  apiVersion?: 'v1' | 'v2';
};

function withVersion(payload: Record<string, unknown>, options: ErrorResponseOptions): Record<string, unknown> {
  if (options.apiVersion !== 'v2') return payload;
  return { ...payload, version: 'v2' };
}

export function sendErrorResponse(res: ApiResponse, error: unknown, correlationId: string, options: ErrorResponseOptions = {}): void {
  const fallback = withVersion({ error: 'Internal Server Error', correlationId }, options);

  if (error instanceof ServiceUnavailableException) {
    res.status(503).json(withVersion({ error: error.message, code: error.name, correlationId }, options));
    return;
  }
  if (error instanceof ConnectionPoolException) {
    res.status(503).json(withVersion({ error: error.message, code: error.name, correlationId }, options));
    return;
  }
  if (error instanceof QueryTimeoutException) {
    res.status(500).json(withVersion({ error: error.message, code: error.name, correlationId }, options));
    return;
  }
  if (error instanceof SQLException) {
    res.status(500).json(withVersion({ error: error.message, code: error.name, correlationId }, options));
    return;
  }

  const message = error instanceof Error ? error.message : '';
  if (message === 'Unauthorized') {
    res.status(401).json(withVersion({ error: message, correlationId }, options));
    return;
  }
  if (message === 'Forbidden') {
    res.status(403).json(withVersion({ error: message, correlationId }, options));
    return;
  }
  if (message.startsWith('Forbidden:')) {
    res.status(403).json(withVersion({ error: message, correlationId }, options));
    return;
  }
  if (message === 'HTTPS required') {
    res.status(403).json(withVersion({ error: message, correlationId }, options));
    return;
  }
  if (message === 'CSRF validation failed') {
    res.status(403).json(withVersion({ error: message, correlationId }, options));
    return;
  }
  if (message.startsWith('Invalid')) {
    const code = message.includes('typeId') ? 'INVALID_TYPE_ID' : 'INVALID_REQUEST';
    res.status(400).json(withVersion({ error: message, code, correlationId }, options));
    return;
  }

  res.status(500).json(fallback);
}
