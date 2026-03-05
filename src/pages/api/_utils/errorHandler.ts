import type { ApiResponse } from './types';
import { ConnectionPoolException, QueryTimeoutException, SQLException, ServiceUnavailableException } from './errors';

export function sendErrorResponse(res: ApiResponse, error: unknown, correlationId: string): void {
  const fallback = { error: 'Internal Server Error', correlationId };

  if (error instanceof ServiceUnavailableException) {
    res.status(503).json({ error: error.message, code: error.name, correlationId });
    return;
  }
  if (error instanceof ConnectionPoolException) {
    res.status(503).json({ error: error.message, code: error.name, correlationId });
    return;
  }
  if (error instanceof QueryTimeoutException) {
    res.status(500).json({ error: error.message, code: error.name, correlationId });
    return;
  }
  if (error instanceof SQLException) {
    res.status(500).json({ error: error.message, code: error.name, correlationId });
    return;
  }

  const message = error instanceof Error ? error.message : '';
  if (message === 'Unauthorized') {
    res.status(401).json({ error: message, correlationId });
    return;
  }
  if (message === 'Forbidden') {
    res.status(403).json({ error: message, correlationId });
    return;
  }
  if (message === 'HTTPS required') {
    res.status(403).json({ error: message, correlationId });
    return;
  }
  if (message.startsWith('Invalid')) {
    const code = message.includes('typeId') ? 'INVALID_TYPE_ID' : 'INVALID_REQUEST';
    res.status(400).json({ error: message, code, correlationId });
    return;
  }

  res.status(500).json(fallback);
}
