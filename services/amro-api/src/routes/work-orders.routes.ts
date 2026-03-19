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

const router = Router();
const workOrdersService = new WorkOrdersService();

// ============================================================================
// WORK PACKAGES
// ============================================================================

/**
 * GET /api/v1/work-packages
 * Get all work packages for the tenant
 */
router.get('/work-packages', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error fetching work packages:', err);
    res.status(500).json({
      error: 'Failed to fetch work packages',
      code: 'FETCH_ERROR',
      statusCode: 500,
    } as ErrorResponse);
  }
});

/**
 * GET /api/v1/work-packages/:id
 * Get a specific work package
 */
router.get('/work-packages/:id', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error fetching work package:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      return res.status(404).json({
        error: 'Work package not found',
        code: 'NOT_FOUND',
        statusCode: 404,
      } as ErrorResponse);
    }
    res.status(500).json({
      error: 'Failed to fetch work package',
      code: 'FETCH_ERROR',
      statusCode: 500,
    } as ErrorResponse);
  }
});

/**
 * POST /api/v1/work-packages
 * Create a new work package
 */
router.post('/work-packages', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error creating work package:', err);
    res.status(500).json({
      error: 'Failed to create work package',
      code: 'CREATE_ERROR',
      statusCode: 500,
    } as ErrorResponse);
  }
});

/**
 * PATCH /api/v1/work-packages/:id
 * Update a work package
 */
router.patch('/work-packages/:id', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error updating work package:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      return res.status(404).json({
        error: 'Work package not found',
        code: 'NOT_FOUND',
        statusCode: 404,
      } as ErrorResponse);
    }
    res.status(500).json({
      error: 'Failed to update work package',
      code: 'UPDATE_ERROR',
      statusCode: 500,
    } as ErrorResponse);
  }
});

/**
 * DELETE /api/v1/work-packages/:id
 * Delete a work package
 */
router.delete('/work-packages/:id', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error deleting work package:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      return res.status(404).json({
        error: 'Work package not found',
        code: 'NOT_FOUND',
        statusCode: 404,
      } as ErrorResponse);
    }
    res.status(500).json({
      error: 'Failed to delete work package',
      code: 'DELETE_ERROR',
      statusCode: 500,
    } as ErrorResponse);
  }
});

// ============================================================================
// TASKS
// ============================================================================

/**
 * GET /api/v1/work-packages/:workPackageId/tasks
 * Get all tasks for a work package
 */
router.get('/work-packages/:workPackageId/tasks', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({
      error: 'Failed to fetch tasks',
      code: 'FETCH_ERROR',
      statusCode: 500,
    } as ErrorResponse);
  }
});

/**
 * GET /api/v1/tasks/:id
 * Get a specific task
 */
router.get('/tasks/:id', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error fetching task:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'NOT_FOUND',
        statusCode: 404,
      } as ErrorResponse);
    }
    res.status(500).json({
      error: 'Failed to fetch task',
      code: 'FETCH_ERROR',
      statusCode: 500,
    } as ErrorResponse);
  }
});

/**
 * POST /api/v1/work-packages/:workPackageId/tasks
 * Create a new task
 */
router.post('/work-packages/:workPackageId/tasks', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({
      error: 'Failed to create task',
      code: 'CREATE_ERROR',
      statusCode: 500,
    } as ErrorResponse);
  }
});

/**
 * PATCH /api/v1/tasks/:id
 * Update a task
 */
router.patch('/tasks/:id', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error updating task:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'NOT_FOUND',
        statusCode: 404,
      } as ErrorResponse);
    }
    res.status(500).json({
      error: 'Failed to update task',
      code: 'UPDATE_ERROR',
      statusCode: 500,
    } as ErrorResponse);
  }
});

/**
 * DELETE /api/v1/tasks/:id
 * Delete a task
 */
router.delete('/tasks/:id', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error deleting task:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'NOT_FOUND',
        statusCode: 404,
      } as ErrorResponse);
    }
    res.status(500).json({
      error: 'Failed to delete task',
      code: 'DELETE_ERROR',
      statusCode: 500,
    } as ErrorResponse);
  }
});

export default router;
