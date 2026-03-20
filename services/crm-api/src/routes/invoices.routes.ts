import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { InvoicesService } from '../services/invoices.service';

const router = Router();
const invoicesService = new InvoicesService();

function resolveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to finalize invoice';
}

router.post('/v1/invoices/:id/finalize', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId || !req.tenantId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    }

    const invoiceId = req.params.id;
    const idempotencyKeyHeader = req.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyKeyHeader)
      ? idempotencyKeyHeader[0]
      : idempotencyKeyHeader;

    if (idempotencyKey && idempotencyKey.length > 128) {
      return res.status(400).json({
        error: 'Invalid idempotency key',
        code: 'INVALID_IDEMPOTENCY_KEY',
        statusCode: 400,
      });
    }

    const result = await invoicesService.finalizeInvoice(
      invoiceId,
      req.tenantId,
      req.userId,
      req.franchiseId ?? undefined,
      idempotencyKey
    );

    return res.status(200).json(result);
  } catch (error: unknown) {
    const message = resolveErrorMessage(error);

    if (message === 'Invoice not found') {
      return res.status(404).json({
        error: 'Invoice not found',
        code: 'NOT_FOUND',
        statusCode: 404,
      });
    }

    if (message.includes('cannot be finalized')) {
      return res.status(409).json({
        error: message,
        code: 'INVALID_STATE',
        statusCode: 409,
      });
    }

    return res.status(500).json({
      error: message,
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
    });
  }
});

export default router;
