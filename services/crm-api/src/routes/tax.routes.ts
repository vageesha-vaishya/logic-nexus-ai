import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { TaxService } from '../services/tax.service.js';
import { ErrorResponse, TaxCalculationRequest, TaxExemptionCertificateUploadRequest } from '../types/crm.types.js';

const router = Router();
const taxService = new TaxService();

function isAddress(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const address = value as Record<string, unknown>;
  return ['street', 'city', 'state', 'zip', 'country'].every((field) => typeof address[field] === 'string');
}

function isValidTaxCalculateRequest(value: unknown): value is TaxCalculationRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const body = value as Record<string, unknown>;
  if (!isAddress(body.origin) || !isAddress(body.destination) || !Array.isArray(body.items)) {
    return false;
  }
  if (body.customerId !== undefined && typeof body.customerId !== 'string') {
    return false;
  }

  return body.items.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }
    const taxItem = item as Record<string, unknown>;
    if (typeof taxItem.amount !== 'number' || Number.isNaN(taxItem.amount) || taxItem.amount < 0) {
      return false;
    }
    if (taxItem.id !== undefined && typeof taxItem.id !== 'string') {
      return false;
    }
    if (taxItem.taxCode !== undefined && typeof taxItem.taxCode !== 'string') {
      return false;
    }
    return true;
  });
}

function isValidExemptionUploadRequest(value: unknown): value is TaxExemptionCertificateUploadRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (
    typeof body.accountId !== 'string' ||
    typeof body.certificateNumber !== 'string' ||
    typeof body.issuingAuthority !== 'string' ||
    typeof body.exemptionType !== 'string' ||
    typeof body.expirationDate !== 'string'
  ) {
    return false;
  }
  if (body.documentUrl !== undefined && typeof body.documentUrl !== 'string') {
    return false;
  }
  return true;
}

router.post('/v1/tax/calculate', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401
      } as ErrorResponse);
      return;
    }

    if (!isValidTaxCalculateRequest(req.body)) {
      res.status(400).json({
        error: 'Invalid payload: origin, destination, and items[] are required',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      } as ErrorResponse);
      return;
    }

    const result = await taxService.calculateTax(req.tenantId, req.body);
    res.status(200).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to calculate tax';
    res.status(500).json({
      error: message,
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500
    } as ErrorResponse);
  }
});

router.post('/v1/tax/exemptions/certificates', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401
      } as ErrorResponse);
      return;
    }

    if (!isValidExemptionUploadRequest(req.body)) {
      res.status(400).json({
        error: 'Invalid payload for exemption certificate upload',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      } as ErrorResponse);
      return;
    }

    const certificate = await taxService.uploadExemptionCertificate(req.tenantId, req.userId, req.body);
    res.status(201).json(certificate);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to upload exemption certificate';
    if (message === 'Account not found') {
      res.status(404).json({
        error: message,
        code: 'NOT_FOUND',
        statusCode: 404
      } as ErrorResponse);
      return;
    }
    res.status(500).json({
      error: message,
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500
    } as ErrorResponse);
  }
});

export default router;
