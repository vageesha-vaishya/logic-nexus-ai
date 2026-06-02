import type { NextFunction, Request, Response } from 'express';
import type { GatewayErrorBody, GatewayErrorCode } from '../types/gateway.types.js';
import { logger } from '../utils/logger.js';

export class GatewayError extends Error {
  constructor(
    public readonly code: GatewayErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId ?? 'unknown';
  let body: GatewayErrorBody;
  let status: number;

  if (err instanceof GatewayError) {
    status = err.status;
    body = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        request_id: requestId,
      },
    };
  } else {
    const message = err instanceof Error ? err.message : String(err);
    status = 500;
    body = {
      error: {
        code: 'INTERNAL',
        message: `Unhandled error: ${message}`,
        request_id: requestId,
      },
    };
  }

  logger.error('request failed', {
    request_id: requestId,
    status,
    code: body.error.code,
    method: req.method,
    path: req.path,
    err_message: body.error.message,
  });

  res.status(status).json(body);
}
