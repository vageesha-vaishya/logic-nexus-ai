import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-correlation-id')?.trim();
  req.requestId = incoming || randomUUID();
  res.setHeader('x-correlation-id', req.requestId);
  res.setHeader('x-request-id', req.requestId);
  next();
}
