// Phase 4 Sales Step 4 — lifted from services/crm-api/src/routes/leads.routes.ts
// and rewired to SalesEventType + salesEventsProducer (sales.leads topic).
//
// Route path kept as /crm/v1/leads for now so existing frontend callers
// (LeadNew, LeadDetail, Leads, pipeline-service) keep working without
// a coordinated URL rename. The vite proxy directs /api/crm/v1/leads to
// sales-api specifically (more-specific prefix wins over /api/crm).
// Rename to /sales/v1/leads is its own follow-up slice.

import { Router, Request } from 'express';
import { LeadsService } from '../services/leads.service.js';
import { CreateLeadRequest, DeleteLeadsRequest, ErrorResponse, UpdateLeadRequest } from '../types/sales.types.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SalesEventType } from '../events/sales-events.types.js';
import { salesEventsProducer } from '../events/sales-events.producer.js';

interface AuthRequest extends Request {
  tenantId?: string;
  franchiseId?: string | null;
  userId?: string;
}

const router = Router();
const leadsService = new LeadsService();

router.get(
  '/crm/v1/leads',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const leads = await leadsService.getLeads(req.tenantId, req.franchiseId);
    res.json({ data: leads, count: leads.length, totalCount: leads.length });
  }),
);

router.get(
  '/crm/v1/leads/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const lead = await leadsService.getLead(req.tenantId, req.params.id, req.franchiseId);
    res.json({ data: lead });
  }),
);

router.post(
  '/crm/v1/leads',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const payload: CreateLeadRequest = req.body;
    if (!payload.first_name || !payload.last_name || !payload.status || !payload.source) {
      res.status(400).json({
        error: 'Missing required fields: first_name, last_name, status, source',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
      return;
    }
    const lead = await leadsService.createLead(req.tenantId, req.userId, payload, req.franchiseId);
    salesEventsProducer.publishLeadEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      SalesEventType.LEAD_CREATED,
      { ...lead },
    );
    if (lead.status === 'qualified') {
      salesEventsProducer.publishLeadEvent(
        req.tenantId,
        req.franchiseId ?? null,
        req.userId,
        SalesEventType.LEAD_QUALIFIED,
        { ...lead },
      );
    }
    res.status(201).json({ data: lead });
  }),
);

router.patch(
  '/crm/v1/leads/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const payload: UpdateLeadRequest = req.body;
    const lead = await leadsService.updateLead(req.tenantId, req.params.id, payload, req.franchiseId);
    salesEventsProducer.publishLeadEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      SalesEventType.LEAD_UPDATED,
      { ...lead },
    );
    if (lead.status === 'qualified') {
      salesEventsProducer.publishLeadEvent(
        req.tenantId,
        req.franchiseId ?? null,
        req.userId,
        SalesEventType.LEAD_QUALIFIED,
        { ...lead },
      );
    }
    res.json({ data: lead });
  }),
);

router.delete(
  '/crm/v1/leads/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const deleted = await leadsService.deleteLead(req.tenantId, req.params.id, req.franchiseId);
    if (!deleted) {
      res.status(404).json({
        error: `Lead ${req.params.id} not found`,
        code: 'LEAD_NOT_FOUND',
        statusCode: 404,
      } as ErrorResponse);
      return;
    }
    salesEventsProducer.publishLeadEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      SalesEventType.LEAD_DELETED,
      { id: req.params.id, deleted: true },
    );
    res.status(204).send();
  }),
);

router.delete(
  '/crm/v1/leads',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const payload = req.body as DeleteLeadsRequest;
    if (!Array.isArray(payload?.ids)) {
      res.status(400).json({
        error: 'Missing required field: ids[]',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
      return;
    }
    const deletedCount = await leadsService.deleteLeads(req.tenantId, payload.ids, req.franchiseId);
    salesEventsProducer.publishLeadEvent(
      req.tenantId,
      req.franchiseId ?? null,
      req.userId,
      SalesEventType.LEAD_DELETED,
      { ids: payload.ids, deletedCount, bulkDeleted: true },
    );
    res.json({ data: { deletedCount } });
  }),
);

export default router;
