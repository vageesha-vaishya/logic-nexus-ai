import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { LeadsService } from '../services/leads.service.js';
import { CreateLeadRequest, DeleteLeadsRequest, ErrorResponse, UpdateLeadRequest } from '../types/crm.types.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { CrmEventType } from '../events/crm-events.types.js';
import { crmEventsProducer } from '../events/crm-events.producer.js';

const router = Router();
const leadsService = new LeadsService();

router.get(
  '/crm/v1/leads',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401
      } as ErrorResponse);
      return;
    }
    const leads = await leadsService.getLeads(req.tenantId, req.franchiseId);
    res.json({ data: leads, count: leads.length, totalCount: leads.length });
  })
);

router.get(
  '/crm/v1/leads/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401
      } as ErrorResponse);
      return;
    }
    const lead = await leadsService.getLead(req.tenantId, req.params.id, req.franchiseId);
    res.json({ data: lead });
  })
);

router.post(
  '/crm/v1/leads',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401
      } as ErrorResponse);
      return;
    }
    const payload: CreateLeadRequest = req.body;
    if (!payload.first_name || !payload.last_name || !payload.status || !payload.source) {
      res.status(400).json({
        error: 'Missing required fields: first_name, last_name, status, source',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      } as ErrorResponse);
      return;
    }
    const lead = await leadsService.createLead(req.tenantId, req.userId, payload, req.franchiseId);
    crmEventsProducer.publishLeadEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      CrmEventType.LEAD_CREATED,
      { ...lead }
    );
    if (lead.status === 'qualified') {
      crmEventsProducer.publishLeadEvent(
        req.tenantId,
        req.franchiseId ?? null,
        req.userId,
        CrmEventType.LEAD_QUALIFIED,
        { ...lead }
      );
    }
    res.status(201).json({ data: lead });
  })
);

router.patch(
  '/crm/v1/leads/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401
      } as ErrorResponse);
      return;
    }
    const payload: UpdateLeadRequest = req.body;
    const lead = await leadsService.updateLead(req.tenantId, req.params.id, payload, req.franchiseId);
    crmEventsProducer.publishLeadEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      CrmEventType.LEAD_UPDATED,
      { ...lead }
    );
    if (lead.status === 'qualified') {
      crmEventsProducer.publishLeadEvent(
        req.tenantId,
        req.franchiseId ?? null,
        req.userId,
        CrmEventType.LEAD_QUALIFIED,
        { ...lead }
      );
    }
    res.json({ data: lead });
  })
);

router.delete(
  '/crm/v1/leads/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401
      } as ErrorResponse);
      return;
    }
    const deleted = await leadsService.deleteLead(req.tenantId, req.params.id, req.franchiseId);
    if (!deleted) {
      res.status(404).json({
        error: `Lead ${req.params.id} not found`,
        code: 'LEAD_NOT_FOUND',
        statusCode: 404
      } as ErrorResponse);
      return;
    }
    crmEventsProducer.publishLeadEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      CrmEventType.LEAD_UPDATED,
      { id: req.params.id, deleted: true }
    );
    res.status(204).send();
  })
);

router.delete(
  '/crm/v1/leads',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401
      } as ErrorResponse);
      return;
    }
    const payload = req.body as DeleteLeadsRequest;
    if (!Array.isArray(payload?.ids)) {
      res.status(400).json({
        error: 'Missing required field: ids[]',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      } as ErrorResponse);
      return;
    }
    const deletedCount = await leadsService.deleteLeads(req.tenantId, payload.ids, req.franchiseId);
    crmEventsProducer.publishLeadEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      CrmEventType.LEAD_UPDATED,
      { ids: payload.ids, deletedCount, bulkDeleted: true }
    );
    res.json({ data: { deletedCount } });
  })
);

export default router;
