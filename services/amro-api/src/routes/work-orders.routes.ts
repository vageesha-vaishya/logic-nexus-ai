/**
 * Work Orders Routes
 * Express routes for work package and task management
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { WorkOrdersService } from '../services/work-orders.service';
import {
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  ErrorResponse,
  MaintenanceType,
} from '../types/amro.types';
import { asyncHandler } from '../utils/asyncHandler';
import { workOrdersStream } from '../realtime/work-orders-stream';

const router = Router();
const workOrdersService = new WorkOrdersService();

function getFranchiseId(req: AuthRequest): string | null {
  const fromHeader = String(req.header('x-franchise-id') || '').trim();
  if (fromHeader) return fromHeader;
  const fromUser = String((req.user as Record<string, unknown> | undefined)?.franchise_id || '').trim();
  return fromUser || null;
}

type V2CreateWorkOrderRequest = {
  aircraft_id?: string;
  title?: string;
  work_order_title_id?: string;
  work_order_template_id?: string;
  maintenance_type?: string;
  planned_window?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  station?: string;
  priority?: string;
  scope_items?: string[];
};

function mapV2CreatePayloadToV1Request(request: V2CreateWorkOrderRequest): CreateWorkOrderRequest {
  const normalizedMaintenanceType = String(request.maintenance_type || '').trim().toLowerCase();
  const maintenanceType: MaintenanceType =
    normalizedMaintenanceType === 'base' ||
    normalizedMaintenanceType === 'component' ||
    normalizedMaintenanceType === 'inspection' ||
    normalizedMaintenanceType === 'overhaul' ||
    normalizedMaintenanceType === 'repair' ||
    normalizedMaintenanceType === 'upgrade' ||
    normalizedMaintenanceType === 'modification'
      ? normalizedMaintenanceType
      : 'line';
  const [plannedStartDateRaw, plannedEndDateRaw] = String(request.planned_window || '').split('|');
  const plannedStartDate = plannedStartDateRaw?.trim() || undefined;
  const plannedEndDate = plannedEndDateRaw?.trim() || undefined;
  const scopeItems = Array.isArray(request.scope_items)
    ? request.scope_items
        .map((item) => String(item || '').trim())
        .filter((item) => item.length > 0)
    : [];
  const title = scopeItems[0] || 'AMRO Work Package';

  return {
    aircraft_id: String(request.aircraft_id || '').trim(),
    title: String(request.title || title || '').trim() || undefined,
    work_order_title_id: String(request.work_order_title_id || '').trim() || undefined,
    work_order_template_id: String(request.work_order_template_id || '').trim() || undefined,
    description: scopeItems.length > 1 ? scopeItems.join('; ') : undefined,
    maintenance_type: maintenanceType,
    work_type: maintenanceType,
    planned_start_date: String(request.planned_start_date || plannedStartDate || '').trim() || undefined,
    planned_end_date: String(request.planned_end_date || plannedEndDate || '').trim() || undefined,
  };
}

// ============================================================================
// WORK PACKAGES
// ============================================================================

/**
 * GET /api/v1/work-orders
 * Get all work packages for the tenant
 */
router.get(
  '/amro/work-order-titles',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const items = await workOrdersService.getWorkOrderTitles(tenantId, franchiseId);
    res.status(200).json({
      version: 'v2',
      interface: 'list-work-order-titles',
      output: {
        items,
        total: items.length,
      },
    });
    return;
  }),
);

router.get(
  '/work-orders',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const workOrders = await workOrdersService.getWorkOrders(tenantId, franchiseId);
    res.json({
      data: workOrders,
      count: workOrders.length,
    });
    return;
  }),
);

/**
 * GET /api/v2/amro/work-orders
 * Alias for /work-orders to support /api/v2/amro/* path prefix
 */
router.get(
  '/amro/work-orders',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    try {
      const workOrders = await workOrdersService.getWorkOrders(tenantId, franchiseId);
      res.json({
        items: workOrders,
        pagination: {
          page: 1,
          page_size: workOrders.length,
          total_items: workOrders.length,
          total_pages: 1,
        },
        count: workOrders.length,
      });
    } catch (error) {
      console.error('[AMRO API] Failed to fetch work packages:', error);
      res.status(500).json({
        error: 'Failed to fetch work packages',
        code: 'WORK_PACKAGES_FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return;
  }),
);

router.get('/work-orders/stream', (req: AuthRequest, res: Response): void => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    res.status(401).json({
      error: 'Missing tenant context',
      code: 'MISSING_TENANT',
      statusCode: 401,
    } as ErrorResponse);
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const writeEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  writeEvent('connected', { ok: true, at: new Date().toISOString() });

  const unsubscribe = workOrdersStream.subscribe((event) => {
    if (event.tenantId !== tenantId) {
      return;
    }
    writeEvent('work-order-change', event);
  });

  const heartbeat = setInterval(() => {
    writeEvent('heartbeat', { at: new Date().toISOString() });
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

/**
 * GET /api/v1/work-orders/:id
 * Get a specific work package
 */
router.get(
  '/work-orders/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    const { id } = req.params;

    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const workOrder = await workOrdersService.getWorkOrder(tenantId, id, franchiseId);
    res.json({ data: workOrder });
    return;
  }),
);

/**
 * GET /api/v2/amro/work-orders/:id
 * Alias for /work-orders/:id to support /api/v2/amro/* path prefix
 */
router.get(
  '/amro/work-orders/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    const { id } = req.params;

    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const workOrder = await workOrdersService.getWorkOrder(tenantId, id, franchiseId);
    if (!workOrder) {
      res.status(404).json({
        error: 'Work package not found',
        code: 'NOT_FOUND',
        statusCode: 404,
      } as ErrorResponse);
      return;
    }
    // Wrap in the format expected by the frontend
    res.json({
      data: {
        work_order: workOrder,
      },
    });
    return;
  }),
);

/**
 * POST /api/v1/work-orders
 * Create a new work package
 */
router.post(
  '/work-orders',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const request: CreateWorkOrderRequest = req.body;

    if (!request.aircraft_id || (!request.title && !request.work_order_title_id) || !request.maintenance_type) {
      res.status(400).json({
        error: 'Missing required fields: aircraft_id, (title or work_order_title_id), maintenance_type',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
      return;
    }

    const workOrder = await workOrdersService.createWorkOrder(tenantId, userId, request, getFranchiseId(req));
    res.status(201).json({ data: workOrder });
    return;
  }),
);

router.post(
  '/amro/work-orders',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const request = req.body as CreateWorkOrderRequest;
    if (!request.aircraft_id || (!request.title && !request.work_order_title_id) || !request.maintenance_type) {
      res.status(400).json({
        error: 'Missing required fields: aircraft_id, (title or work_order_title_id), maintenance_type',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
      return;
    }

    const workOrder = await workOrdersService.createWorkOrder(tenantId, userId, request, getFranchiseId(req));
    res.status(201).json({
      version: 'v2',
      interface: 'create-work-order',
      output: {
        id: workOrder.id,
        work_order_number: workOrder.work_order_number || workOrder.work_order_number || workOrder.id,
        status: workOrder.status,
        generated_tasks_count: Number(workOrder.generated_tasks_count || 0),
      },
    });
    return;
  }),
);

router.patch(
  '/amro/work-orders/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { id } = req.params;
    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const request: UpdateWorkOrderRequest = req.body;
    const franchiseId = getFranchiseId(req);
    const workOrder = await workOrdersService.updateWorkOrder(tenantId, id, userId, request, franchiseId);
    res.status(200).json({
      version: 'v2',
      interface: 'update-work-order',
      output: {
        id: workOrder.id,
        work_order_number: workOrder.work_order_number || workOrder.work_order_number || workOrder.id,
        status: workOrder.status,
      },
    });
    return;
  }),
);

router.delete(
  '/amro/work-orders/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { id } = req.params;
    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const franchiseId = getFranchiseId(req);
    await workOrdersService.deleteWorkOrder(tenantId, id, userId, franchiseId);
    res.status(204).send();
    return;
  }),
);

router.get(
  '/amro/work-orders/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    const { id } = req.params;
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const workOrder = await workOrdersService.getWorkOrder(tenantId, id, franchiseId);
    res.status(200).json({
      version: 'v2',
      interface: 'get-work-order',
      output: {
        work_order: workOrder,
      },
    });
    return;
  }),
);

router.get(
  '/amro/work-orders',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const workOrders = await workOrdersService.getWorkOrders(tenantId, franchiseId);
    const records = workOrders.map((row) => ({
      id: row.id,
      work_order_number: row.work_order_number || row.work_order_number || row.id,
      title: row.title,
      aircraft_id: row.aircraft_id,
      status: row.status,
      priority: 3,
      maintenance_type: row.maintenance_type,
      planned_start_date: row.planned_start_date,
      planned_end_date: row.planned_end_date,
      assigned_to: row.assigned_to,
      source: null,
      created_at: row.created_at,
    }));

    res.status(200).json({
      version: 'v2',
      interface: 'list-work-orders',
      output: {
        records,
        total: records.length,
        page: 1,
        page_size: records.length,
      },
    });
    return;
  }),
);

router.post(
  '/amro/work-orders',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const v2Request = req.body as V2CreateWorkOrderRequest;
    const interfaceName = String(req.query.interface || '').trim().toLowerCase();
    if (interfaceName === 'create-work-order-template') {
      res.status(404).json({
        error: 'Interface create-work-order-template is handled by work-order-template routes',
        code: 'NOT_FOUND',
        statusCode: 404,
      } as ErrorResponse);
      return;
    }
    const request = mapV2CreatePayloadToV1Request(v2Request);

    if (!request.aircraft_id) {
      res.status(400).json({
        error: 'Missing required field: aircraft_id',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
      return;
    }

    const workOrder = await workOrdersService.createWorkOrder(tenantId, userId, request, getFranchiseId(req));
    res.status(201).json({
      data: {
        id: workOrder.id,
        code: workOrder.work_order_number || workOrder.work_order_number || workOrder.id,
        status: workOrder.status,
        generated_tasks_count: Number(workOrder.generated_tasks_count || 0),
      },
    });
    return;
  }),
);

/**
 * PATCH /api/v1/work-orders/:id
 * Update a work package
 */
router.patch(
  '/work-orders/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { id } = req.params;

    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const request: UpdateWorkOrderRequest = req.body;
    const franchiseId = getFranchiseId(req);
    const workOrder = await workOrdersService.updateWorkOrder(tenantId, id, userId, request, franchiseId);
    res.json({ data: workOrder });
    return;
  }),
);

/**
 * DELETE /api/v1/work-orders/:id
 * Delete a work package
 */
router.delete(
  '/work-orders/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { id } = req.params;

    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const franchiseId = getFranchiseId(req);
    await workOrdersService.deleteWorkOrder(tenantId, id, userId, franchiseId);
    res.status(204).send();
    return;
  }),
);

// ============================================================================
// TASKS
// ============================================================================

/**
 * GET /api/v1/work-orders/:workOrderId/tasks
 * Get all tasks for a work package
 */
router.get(
  '/work-orders/:workOrderId/tasks',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const { workOrderId } = req.params;
    const franchiseId = getFranchiseId(req);

    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const tasks = await workOrdersService.getTasks(tenantId, workOrderId, franchiseId);
    res.json({
      data: tasks,
      count: tasks.length,
    });
    return;
  }),
);

/**
 * GET /api/v1/tasks/:id
 * Get a specific task
 */
router.get(
  '/tasks/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const franchiseId = getFranchiseId(req);

    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const task = await workOrdersService.getTask(tenantId, id, franchiseId);
    res.json({ data: task });
    return;
  }),
);

/**
 * POST /api/v1/work-orders/:workOrderId/tasks
 * Create a new task
 */
router.post(
  '/work-orders/:workOrderId/tasks',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { workOrderId } = req.params;

    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const request: CreateTaskRequest = {
      ...req.body,
      work_order_id: req.body?.work_order_id || workOrderId,
    };
    const sequenceOrder = request.sequence_order ?? request.sequence_number;

    if (!request.title || sequenceOrder === undefined) {
      res.status(400).json({
        error: 'Missing required fields: title, sequence_order',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
      return;
    }

    const task = await workOrdersService.createTask(tenantId, userId, request);
    res.status(201).json({ data: task });
    return;
  }),
);

/**
 * PATCH /api/v1/tasks/:id
 * Update a task
 */
router.patch(
  '/tasks/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { id } = req.params;

    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const request: UpdateTaskRequest = req.body;
    const task = await workOrdersService.updateTask(tenantId, id, userId, request);
    res.json({ data: task });
    return;
  }),
);

/**
 * DELETE /api/v1/tasks/:id
 * Delete a task
 */
router.delete(
  '/tasks/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { id } = req.params;

    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    await workOrdersService.deleteTask(tenantId, id, userId);
    res.status(204).send();
    return;
  }),
);

router.get(
  '/work-orders/:workOrderId/materials',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const { workOrderId } = req.params;

    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const materials = await workOrdersService.getMaterials(tenantId, workOrderId);
    res.json({
      data: materials,
      count: materials.length,
    });
    return;
  }),
);

router.get(
  '/materials/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const material = await workOrdersService.getMaterial(tenantId, id);
    res.json({ data: material });
    return;
  }),
);

router.get(
  '/assets',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const assets = await workOrdersService.getAssetSummaries(tenantId);
    res.json({
      data: assets,
      count: assets.length,
    });
    return;
  }),
);

router.get(
  '/qualifications',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const qualifications = await workOrdersService.getQualificationSummaries(tenantId);
    res.json({
      data: qualifications,
      count: qualifications.length,
    });
    return;
  }),
);

router.get(
  '/compliance/summary',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const summary = await workOrdersService.getComplianceSummary(tenantId);
    res.json({ data: summary });
    return;
  }),
);

router.get(
  '/evidence',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const evidence = await workOrdersService.getEvidenceSummaries(tenantId);
    res.json({
      data: evidence,
      count: evidence.length,
    });
    return;
  }),
);

router.get(
  '/forecast/recommendations',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const recommendations = await workOrdersService.getForecastRecommendations(tenantId);
    res.json({
      data: recommendations,
      count: recommendations.length,
    });
    return;
  }),
);

router.get(
  '/scheduling/summary',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const summary = await workOrdersService.getSchedulingSummary(tenantId);
    res.json({ data: summary });
    return;
  }),
);

router.get(
  '/integration/summary',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }
    const summary = await workOrdersService.getIntegrationSummary(tenantId);
    res.json({ data: summary });
    return;
  }),
);

router.post(
  '/tasks/:id/maintenance-events',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { id } = req.params;
    const { executed_by, evidence_captured, event_type, sign_off_date, notes } = req.body ?? {};

    if (!tenantId || !userId) {
      res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    if (!executed_by || evidence_captured === undefined) {
      res.status(400).json({
        error: 'Missing required fields: executed_by, evidence_captured',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
      return;
    }

    await workOrdersService.recordMaintenanceEvent(tenantId, userId, id, {
      executed_by,
      evidence_captured,
      event_type,
      sign_off_date,
      notes,
    });

    res.status(201).json({
      data: {
        task_id: id,
        executed_by,
        evidence_captured,
      },
    });
    return;
  }),
);

export default router;
