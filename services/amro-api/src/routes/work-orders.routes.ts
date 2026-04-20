/**
 * Work Orders Routes
 * Express routes for work package and task management
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { WorkOrdersService } from '../services/work-orders.service';
import {
  CreateWorkPackageRequest,
  UpdateWorkPackageRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  ErrorResponse,
  MaintenanceType,
} from '../types/amro.types';
import { asyncHandler } from '../utils/asyncHandler';
import { workPackagesStream } from '../realtime/work-packages-stream';

const router = Router();
const workOrdersService = new WorkOrdersService();

function getFranchiseId(req: AuthRequest): string | null {
  const fromHeader = String(req.header('x-franchise-id') || '').trim();
  if (fromHeader) return fromHeader;
  const fromUser = String((req.user as Record<string, unknown> | undefined)?.franchise_id || '').trim();
  return fromUser || null;
}

type V2CreateWorkPackageRequest = {
  aircraft_id?: string;
  maintenance_type?: string;
  planned_window?: string;
  station?: string;
  priority?: string;
  scope_items?: string[];
};

function mapV2CreatePayloadToV1Request(request: V2CreateWorkPackageRequest): CreateWorkPackageRequest {
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
    title,
    description: scopeItems.length > 1 ? scopeItems.join('; ') : undefined,
    maintenance_type: maintenanceType,
    work_type: maintenanceType,
    planned_start_date: plannedStartDate,
    planned_end_date: plannedEndDate,
  };
}

// ============================================================================
// WORK PACKAGES
// ============================================================================

/**
 * GET /api/v1/work-packages
 * Get all work packages for the tenant
 */
router.get(
  '/amro/work-package-titles',
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

    const items = await workOrdersService.getWorkPackageTitles(tenantId, franchiseId);
    res.status(200).json({
      version: 'v2',
      interface: 'list-work-package-titles',
      output: {
        items,
        total: items.length,
      },
    });
    return;
  }),
);

router.get(
  '/work-packages',
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

    const workPackages = await workOrdersService.getWorkPackages(tenantId);
    res.json({
      data: workPackages,
      count: workPackages.length,
    });
    return;
  }),
);

/**
 * GET /api/v2/amro/work-packages
 * Alias for /work-packages to support /api/v2/amro/* path prefix
 */
router.get(
  '/amro/work-packages',
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

    try {
      const workPackages = await workOrdersService.getWorkPackages(tenantId);
      res.json({
        items: workPackages,
        pagination: {
          page: 1,
          page_size: workPackages.length,
          total_items: workPackages.length,
          total_pages: 1,
        },
        count: workPackages.length,
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

router.get('/work-packages/stream', (req: AuthRequest, res: Response): void => {
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

  const unsubscribe = workPackagesStream.subscribe((event) => {
    if (event.tenantId !== tenantId) {
      return;
    }
    writeEvent('work-package-change', event);
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
 * GET /api/v1/work-packages/:id
 * Get a specific work package
 */
router.get(
  '/work-packages/:id',
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

    const workPackage = await workOrdersService.getWorkPackage(tenantId, id);
    res.json({ data: workPackage });
    return;
  }),
);

/**
 * GET /api/v2/amro/work-packages/:id
 * Alias for /work-packages/:id to support /api/v2/amro/* path prefix
 */
router.get(
  '/amro/work-packages/:id',
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

    const workPackage = await workOrdersService.getWorkPackage(tenantId, id);
    if (!workPackage) {
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
        work_package: workPackage,
      },
    });
    return;
  }),
);

/**
 * POST /api/v1/work-packages
 * Create a new work package
 */
router.post(
  '/work-packages',
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

    const request: CreateWorkPackageRequest = req.body;

    if (!request.aircraft_id || !request.title || !request.maintenance_type) {
      res.status(400).json({
        error: 'Missing required fields: aircraft_id, title, maintenance_type',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
      return;
    }

    const workPackage = await workOrdersService.createWorkPackage(tenantId, userId, request);
    res.status(201).json({ data: workPackage });
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

    const request = req.body as CreateWorkPackageRequest;
    if (!request.aircraft_id || !request.title || !request.maintenance_type) {
      res.status(400).json({
        error: 'Missing required fields: aircraft_id, title, maintenance_type',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
      return;
    }

    const workPackage = await workOrdersService.createWorkPackage(tenantId, userId, request);
    res.status(201).json({
      version: 'v2',
      interface: 'create-work-order',
      output: {
        id: workPackage.id,
        work_order_number: workPackage.work_package_number || workPackage.work_order_number || workPackage.id,
        work_package_number: workPackage.work_package_number || workPackage.work_order_number || workPackage.id,
        status: workPackage.status,
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
    const request: UpdateWorkPackageRequest = req.body;
    const workPackage = await workOrdersService.updateWorkPackage(tenantId, id, userId, request);
    res.status(200).json({
      version: 'v2',
      interface: 'update-work-order',
      output: {
        id: workPackage.id,
        work_order_number: workPackage.work_package_number || workPackage.work_order_number || workPackage.id,
        work_package_number: workPackage.work_package_number || workPackage.work_order_number || workPackage.id,
        status: workPackage.status,
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
    await workOrdersService.deleteWorkPackage(tenantId, id, userId);
    res.status(204).send();
    return;
  }),
);

router.get(
  '/amro/work-orders/:id',
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
    const workPackage = await workOrdersService.getWorkPackage(tenantId, id);
    res.status(200).json({
      version: 'v2',
      interface: 'get-work-order',
      output: {
        work_package: workPackage,
      },
    });
    return;
  }),
);

router.get(
  '/amro/work-orders',
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

    const workPackages = await workOrdersService.getWorkPackages(tenantId);
    const records = workPackages.map((row) => ({
      id: row.id,
      work_order_number: row.work_package_number || row.work_order_number || row.id,
      work_package_number: row.work_package_number || row.work_order_number || row.id,
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
  '/amro/work-packages',
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

    const v2Request = req.body as V2CreateWorkPackageRequest;
    const interfaceName = String(req.query.interface || '').trim().toLowerCase();
    if (interfaceName === 'create-work-package-template') {
      res.status(404).json({
        error: 'Interface create-work-package-template is handled by work-package-template routes',
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

    const workPackage = await workOrdersService.createWorkPackage(tenantId, userId, request);
    res.status(201).json({
      data: {
        id: workPackage.id,
        code: workPackage.work_order_number || workPackage.work_package_number || workPackage.id,
        status: workPackage.status,
      },
    });
    return;
  }),
);

/**
 * PATCH /api/v1/work-packages/:id
 * Update a work package
 */
router.patch(
  '/work-packages/:id',
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

    const request: UpdateWorkPackageRequest = req.body;
    const workPackage = await workOrdersService.updateWorkPackage(tenantId, id, userId, request);
    res.json({ data: workPackage });
    return;
  }),
);

/**
 * DELETE /api/v1/work-packages/:id
 * Delete a work package
 */
router.delete(
  '/work-packages/:id',
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

    await workOrdersService.deleteWorkPackage(tenantId, id, userId);
    res.status(204).send();
    return;
  }),
);

// ============================================================================
// TASKS
// ============================================================================

/**
 * GET /api/v1/work-packages/:workPackageId/tasks
 * Get all tasks for a work package
 */
router.get(
  '/work-packages/:workPackageId/tasks',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const { workPackageId } = req.params;

    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const tasks = await workOrdersService.getTasks(tenantId, workPackageId);
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

    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const task = await workOrdersService.getTask(tenantId, id);
    res.json({ data: task });
    return;
  }),
);

/**
 * POST /api/v1/work-packages/:workPackageId/tasks
 * Create a new task
 */
router.post(
  '/work-packages/:workPackageId/tasks',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { workPackageId } = req.params;

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
      work_package_id: req.body?.work_package_id || workPackageId,
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
  '/work-packages/:workPackageId/materials',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const { workPackageId } = req.params;

    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
      return;
    }

    const materials = await workOrdersService.getMaterials(tenantId, workPackageId);
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
