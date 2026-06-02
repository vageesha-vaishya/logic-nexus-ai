import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      /**
       * 32-hex-char trace id parsed from W3C `traceparent` header, or a
       * freshly-generated id when no parent context was passed. Stored on
       * gateway.llm_invocations.trace_id so the audit row joins to
       * caller-side traces in the observability stack. Per design §10.2.
       */
      traceId: string;
      /** 16-hex-char parent span id from W3C traceparent, if present. */
      parentSpanId?: string;
    }
  }
}

/** W3C Trace Context: traceparent = "version-trace_id-parent_id-flags".
 *  version=00; trace_id is 32 hex chars; parent_id is 16 hex chars.
 *  Returns null when shape is invalid. */
function parseTraceparent(header?: string): { traceId: string; parentSpanId: string } | null {
  if (!header) return null;
  const parts = header.trim().split('-');
  if (parts.length !== 4) return null;
  const [version, traceId, parentSpanId, flags] = parts;
  if (version !== '00') return null;
  if (!/^[0-9a-f]{32}$/.test(traceId ?? '')) return null;
  if (!/^[0-9a-f]{16}$/.test(parentSpanId ?? '')) return null;
  if (!/^[0-9a-f]{2}$/.test(flags ?? '')) return null;
  if (traceId === '0'.repeat(32)) return null;       // all-zero trace_id is "invalid" per spec
  if (parentSpanId === '0'.repeat(16)) return null;
  return { traceId: traceId!, parentSpanId: parentSpanId! };
}

/** Generate a fresh W3C-shaped trace_id (32 hex chars, leading bits non-zero). */
function newTraceId(): string {
  // Strip the dashes from a UUIDv4 → 32 hex chars. UUIDv4 sets the
  // version nibble at position 12 to 0x4 and the variant at position 16
  // to one of 0x8/0x9/0xa/0xb — so the trace_id is never all-zero.
  return randomUUID().replace(/-/g, '');
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingCorr = req.header('x-correlation-id')?.trim();
  req.requestId = incomingCorr || randomUUID();

  const tp = parseTraceparent(req.header('traceparent'));
  if (tp) {
    req.traceId = tp.traceId;
    req.parentSpanId = tp.parentSpanId;
  } else {
    req.traceId = newTraceId();
  }

  res.setHeader('x-correlation-id', req.requestId);
  res.setHeader('x-request-id', req.requestId);
  res.setHeader('x-trace-id', req.traceId);
  next();
}
