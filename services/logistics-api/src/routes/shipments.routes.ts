// Phase 5 logistics-api — shipments routes.
// Path: /logistics/v1/shipments. The vite proxy directs /api/logistics
// to logistics-api.

import { Router, Request } from 'express';
import { ShipmentsService } from '../services/shipments.service.js';
import {
  CreateShipmentRequest,
  ErrorResponse,
  UpdateShipmentRequest,
} from '../types/logistics.types.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { LogisticsEventType } from '../events/logistics-events.types.js';
import { logisticsEventsProducer } from '../events/logistics-events.producer.js';

interface AuthRequest extends Request {
  tenantId?: string;
  franchiseId?: string | null;
  userId?: string;
}

const router = Router();
const shipmentsService = new ShipmentsService();

const missingContextError = (code: 'MISSING_TENANT' | 'MISSING_CONTEXT' = 'MISSING_TENANT'): ErrorResponse => ({
  error: code === 'MISSING_TENANT' ? 'Missing tenant context' : 'Missing tenant or user context',
  code,
  statusCode: 401,
});

router.get(
  '/logistics/v1/shipments',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId) {
      res.status(401).json(missingContextError());
      return;
    }
    const shipments = await shipmentsService.listShipments(req.tenantId, req.franchiseId);
    res.json({ data: shipments, count: shipments.length, totalCount: shipments.length });
  }),
);

router.get(
  '/logistics/v1/shipments/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId) {
      res.status(401).json(missingContextError());
      return;
    }
    const shipment = await shipmentsService.getShipment(req.tenantId, req.params.id, req.franchiseId);
    res.json({ data: shipment });
  }),
);

router.post(
  '/logistics/v1/shipments',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json(missingContextError('MISSING_CONTEXT'));
      return;
    }
    const payload: CreateShipmentRequest = req.body;
    const shipment = await shipmentsService.createShipment(req.tenantId, req.userId, payload, req.franchiseId);
    logisticsEventsProducer.publishShipmentEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      LogisticsEventType.SHIPMENT_CREATED,
      { ...shipment },
    );
    res.status(201).json({ data: shipment });
  }),
);

router.patch(
  '/logistics/v1/shipments/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json(missingContextError('MISSING_CONTEXT'));
      return;
    }
    const payload: UpdateShipmentRequest = req.body;
    const shipment = await shipmentsService.updateShipment(req.tenantId, req.params.id, payload, req.franchiseId);
    // logistics.shipment.delivered is emitted via DB trigger (Phase 5
    // commit 5276a577); we just emit the generic update here.
    logisticsEventsProducer.publishShipmentEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      LogisticsEventType.SHIPMENT_UPDATED,
      { ...shipment },
    );
    res.json({ data: shipment });
  }),
);

router.delete(
  '/logistics/v1/shipments/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json(missingContextError('MISSING_CONTEXT'));
      return;
    }
    const deleted = await shipmentsService.deleteShipment(req.tenantId, req.params.id, req.franchiseId);
    if (!deleted) {
      res.status(404).json({
        error: `Shipment ${req.params.id} not found`,
        code: 'SHIPMENT_NOT_FOUND',
        statusCode: 404,
      } as ErrorResponse);
      return;
    }
    logisticsEventsProducer.publishShipmentEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      LogisticsEventType.SHIPMENT_CANCELLED,
      { id: req.params.id, deleted: true },
    );
    res.status(204).send();
  }),
);

export default router;
