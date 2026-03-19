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
import { logger } from '../utils/logger';

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
  asyncHandler(async (req: AuthRequest, res) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
    }

    const workPackages = await workOrdersService.getWorkPackages(tenantId);
    res.json({
      data: workPackages,
      count: workPackages.length,
    });
  }),
);

/**
 * GET /api/v1/work-packages/:id
 * Get a specific work package
 */
router.get(
  '/work-packages/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
    }

    const workPackage = await workOrdersService.getWorkPackage(tenantId, id);
    res.json({ data: workPackage });
  }),
);

/**
 * POST /api/v1/work-packages
 * Create a new work package
 */
router.post(
  '/work-packages',
  asyncHandler(async (req: AuthRequest, res) => {
    const tenantId = req.tenantId;
    const userId = req.userId;

    if (!tenantId || !userId) {
      return res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
    }

    const request: CreateWorkPackageRequest = req.body;

    if (!request.aircraft_id || !request.title || !request.maintenance_type) {
      return res.status(400).json({
        error: 'Missing required fields: aircraft_id, title, maintenance_type',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
    }

    const workPackage = await workOrdersService.createWorkPackage(tenantId, userId, request);
    res.status(201).json({ data: workPackage });
  }),
);

/**
 * PATCH /api/v1/work-packages/:id
 * Update a work package
 */
router.patch(
  '/work-packages/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { id } = req.params;

    if (!tenantId || !userId) {
      return res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
    }

    const request: UpdateWorkPackageRequest = req.body;
    const workPackage = await workOrdersService.updateWorkPackage(tenantId, id, userId, request);
    res.json({ data: workPackage });
  }),
);

/**
 * DELETE /api/v1/work-packages/:id
 * Delete a work package
 */
router.delete(
  '/work-packages/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
    }

    await workOrdersService.deleteWorkPackage(tenantId, id);
    res.status(204).send();
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
  asyncHandler(async (req: AuthRequest, res) => {
    const tenantId = req.tenantId;
    const { workPackageId } = req.params;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
    }

    const tasks = await workOrdersService.getTasks(tenantId, workPackageId);
    res.json({
      data: tasks,
      count: tasks.length,
    });
  }),
);

/**
 * GET /api/v1/tasks/:id
 * Get a specific task
 */
router.get(
  '/tasks/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
    }

    const task = await workOrdersService.getTask(tenantId, id);
    res.json({ data: task });
  }),
);

/**
 * POST /api/v1/work-packages/:workPackageId/tasks
 * Create a new task
 */
router.post(
  '/work-packages/:workPackageId/tasks',
  asyncHandler(async (req: AuthRequest, res) => {
    const tenantId = req.tenantId;
    const userId = req.userId;

    if (!tenantId || !userId) {
      return res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
    }

    const request: CreateTaskRequest = req.body;

    if (!request.title || request.sequence_number === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: title, sequence_number',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      } as ErrorResponse);
    }

    const task = await workOrdersService.createTask(tenantId, userId, request);
    res.status(201).json({ data: task });
  }),
);

/**
 * PATCH /api/v1/tasks/:id
 * Update a task
 */
router.patch(
  '/tasks/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { id } = req.params;

    if (!tenantId || !userId) {
      return res.status(401).json({
        error: 'Missing tenant or user context',
        code: 'MISSING_CONTEXT',
        statusCode: 401,
      } as ErrorResponse);
    }

    const request: UpdateTaskRequest = req.body;
    const task = await workOrdersService.updateTask(tenantId, id, userId, request);
    res.json({ data: task });
  }),
);

/**
 * DELETE /api/v1/tasks/:id
 * Delete a task
 */
router.delete(
  '/tasks/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
      } as ErrorResponse);
    }

    await workOrdersService.deleteTask(tenantId, id);
    res.status(204).send();
  }),
);

export default router;
