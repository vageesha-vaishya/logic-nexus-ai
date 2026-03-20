/**
 * Work Orders Routes
 * Express routes for work package and task management
 */

import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { WorkOrdersService } from '../services/work-orders.service';
import {
  CreateWorkPackageRequest,
  UpdateWorkPackageRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  ErrorResponse,
} from '../types/amro.types';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const workOrdersService = new WorkOrdersService();

// ============================================================================
// WORK PACKAGES
// ============================================================================

/**
 * GET /api/v1/work-packages
 * Get all work packages for the tenant
 */
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
