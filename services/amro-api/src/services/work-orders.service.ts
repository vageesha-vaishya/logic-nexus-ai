/**
 * Work Orders Service
 * Business logic for work package and task management with explicit tenant filtering
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  WorkPackage,
  Task,
  Material,
  CreateWorkPackageRequest,
  UpdateWorkPackageRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
} from '../types/amro.types';
import { amroEventsProducer } from '../events/amro-events.producer';
import { AmroEventType } from '../events/amro-events.types';

// Simple logger utility (use your actual logger if available)
const logger = {
  error: (message: string, context?: Record<string, any>) => {
    console.error(`[ERROR] ${message}`, context || '');
  },
};

export class WorkOrdersService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate that service role key is available (fail fast at startup)
    // ⚠️ SECURITY: Service role key has full database access.
    // Never log, expose in errors, or share this key.
    if (!supabaseServiceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY environment variable is required. ' +
        'This key must be kept secret and never logged or exposed.'
      );
    }
  }

  // ============================================================================
  // WORK PACKAGES
  // ============================================================================

  /**
   * Get all work packages for a tenant
   * Explicitly filters by tenant_id (belt and suspenders approach)
   */
  async getWorkPackages(tenantId: string): Promise<WorkPackage[]> {
    const { data, error } = await this.supabase
      .from('work_packages')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch work packages: ${error.message}`);
    }

    return data as WorkPackage[];
  }

  /**
   * Get a specific work package
   * Explicitly filters by tenant_id
   */
  async getWorkPackage(tenantId: string, id: string): Promise<WorkPackage> {
    const { data, error } = await this.supabase
      .from('work_packages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch work package: ${error.message}`);
    }

    if (!data) {
      throw new Error('Work package not found');
    }

    return data as WorkPackage;
  }

  /**
   * Create a new work package
   * Explicitly sets tenant_id
   */
  async createWorkPackage(
    tenantId: string,
    userId: string,
    request: CreateWorkPackageRequest,
  ): Promise<WorkPackage> {
    // Generate work package number (could be enhanced with sequence tables)
    const workPackageNumber = `WP-${Date.now()}`;

    const { data, error } = await this.supabase
      .from('work_packages')
      .insert({
        tenant_id: tenantId,
        aircraft_id: request.aircraft_id,
        work_package_number: workPackageNumber,
        title: request.title,
        description: request.description,
        maintenance_type: request.maintenance_type,
        status: 'planning',
        planned_start_date: request.planned_start_date,
        planned_completion_date: request.planned_completion_date,
        estimated_labor_hours: request.estimated_labor_hours,
        estimated_cost: request.estimated_cost,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create work package: ${error.message}`);
    }

    const workPackage = data as WorkPackage;

    // Publish work order created event (fire-and-forget)
    amroEventsProducer.publishWorkOrderEvent(
      tenantId,
      userId,
      AmroEventType.WORK_ORDER_CREATED,
      {
        id: workPackage.id,
        work_package_id: workPackage.id,
        work_package_number: workPackage.work_package_number,
        aircraft_id: workPackage.aircraft_id,
        title: workPackage.title,
        description: workPackage.description,
        maintenance_type: workPackage.maintenance_type,
        status: workPackage.status,
        estimated_cost: workPackage.estimated_cost,
        estimated_labor_hours: workPackage.estimated_labor_hours,
      },
    );

    return workPackage;
  }

  /**
   * Update a work package
   * Explicitly filters by tenant_id
   */
  async updateWorkPackage(
    tenantId: string,
    id: string,
    userId: string,
    request: UpdateWorkPackageRequest,
  ): Promise<WorkPackage> {
    // Verify work package belongs to tenant
    await this.getWorkPackage(tenantId, id);

    const updateData: Record<string, any> = {
      ...request,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('work_packages')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update work package: ${error.message}`);
    }

    const workPackage = data as WorkPackage;

    // Publish work order updated event (fire-and-forget)
    amroEventsProducer.publishWorkOrderEvent(
      tenantId,
      userId,
      AmroEventType.WORK_ORDER_UPDATED,
      {
        id: workPackage.id,
        work_package_id: workPackage.id,
        work_package_number: workPackage.work_package_number,
        aircraft_id: workPackage.aircraft_id,
        title: workPackage.title,
        description: workPackage.description,
        maintenance_type: workPackage.maintenance_type,
        status: workPackage.status,
        estimated_cost: workPackage.estimated_cost,
        estimated_labor_hours: workPackage.estimated_labor_hours,
        actual_cost: workPackage.actual_cost,
        actual_labor_hours: workPackage.actual_labor_hours,
      },
    );

    return workPackage;
  }

  /**
   * Delete a work package
   * Explicitly filters by tenant_id
   */
  async deleteWorkPackage(tenantId: string, id: string, userId: string): Promise<void> {
    // Verify work package belongs to tenant and get it for event data
    const workPackage = await this.getWorkPackage(tenantId, id);

    const { error } = await this.supabase
      .from('work_packages')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete work package: ${error.message}`);
    }

    // Publish work order deleted event (fire-and-forget)
    amroEventsProducer.publishWorkOrderEvent(
      tenantId,
      userId,
      AmroEventType.WORK_ORDER_DELETED,
      {
        id: workPackage.id,
        work_package_id: workPackage.id,
        work_package_number: workPackage.work_package_number,
        aircraft_id: workPackage.aircraft_id,
        title: workPackage.title,
      },
    );
  }

  // ============================================================================
  // TASKS
  // ============================================================================

  /**
   * Get all tasks for a work package
   * Explicitly filters by tenant_id
   */
  async getTasks(tenantId: string, workPackageId: string): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('work_package_id', workPackageId)
      .order('sequence_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return data as Task[];
  }

  /**
   * Get a specific task
   * Explicitly filters by tenant_id
   */
  async getTask(tenantId: string, id: string): Promise<Task> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch task: ${error.message}`);
    }

    if (!data) {
      throw new Error('Task not found');
    }

    return data as Task;
  }

  /**
   * Create a new task
   * Explicitly sets tenant_id
   */
  async createTask(
    tenantId: string,
    userId: string,
    request: CreateTaskRequest,
  ): Promise<Task> {
    // Generate task number
    const taskNumber = `TASK-${Date.now()}`;

    const { data, error } = await this.supabase
      .from('tasks')
      .insert({
        tenant_id: tenantId,
        work_package_id: request.work_package_id,
        task_number: taskNumber,
        title: request.title,
        description: request.description,
        status: 'pending',
        sequence_number: request.sequence_number,
        planned_start_date: request.planned_start_date,
        planned_completion_date: request.planned_completion_date,
        required_qualification: request.required_qualification,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    const task = data as Task;

    // Publish task created event (fire-and-forget)
    amroEventsProducer.publishTaskEvent(
      tenantId,
      userId,
      AmroEventType.TASK_CREATED,
      {
        id: task.id,
        task_id: task.id,
        task_number: task.task_number,
        work_package_id: task.work_package_id,
        title: task.title,
        description: task.description,
        status: task.status,
        sequence_number: task.sequence_number,
        required_qualification: task.required_qualification,
      },
    );

    return task;
  }

  /**
   * Update a task
   * Explicitly filters by tenant_id
   */
  async updateTask(
    tenantId: string,
    id: string,
    userId: string,
    request: UpdateTaskRequest,
  ): Promise<Task> {
    // Verify task belongs to tenant and get current state
    const previousTask = await this.getTask(tenantId, id);

    const updateData: Record<string, any> = {
      ...request,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('tasks')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }

    const task = data as Task;

    // Publish task updated event (fire-and-forget)
    amroEventsProducer.publishTaskEvent(
      tenantId,
      userId,
      AmroEventType.TASK_UPDATED,
      {
        id: task.id,
        task_id: task.id,
        task_number: task.task_number,
        work_package_id: task.work_package_id,
        title: task.title,
        description: task.description,
        status: task.status,
        sequence_number: task.sequence_number,
        assigned_to: task.assigned_to,
        required_qualification: task.required_qualification,
      },
    );

    // Publish TASK_STARTED event if status transitions to in_progress
    if (request.status === 'in_progress' && previousTask.status !== 'in_progress') {
      amroEventsProducer.publishTaskEvent(
        tenantId,
        userId,
        AmroEventType.TASK_STARTED,
        {
          id: task.id,
          task_id: task.id,
          task_number: task.task_number,
          work_package_id: task.work_package_id,
          title: task.title,
          description: task.description,
          status: task.status,
          assigned_to: task.assigned_to,
          started_at: new Date().toISOString(),
        },
      );
    }

    // Publish TASK_COMPLETED event if status transitions to completed
    if (request.status === 'completed' && previousTask.status !== 'completed') {
      amroEventsProducer.publishTaskEvent(
        tenantId,
        userId,
        AmroEventType.TASK_COMPLETED,
        {
          id: task.id,
          task_id: task.id,
          task_number: task.task_number,
          work_package_id: task.work_package_id,
          title: task.title,
          description: task.description,
          status: task.status,
          assigned_to: task.assigned_to,
          completed_at: new Date().toISOString(),
        },
      );
    }

    return task;
  }

  /**
   * Delete a task
   * Explicitly filters by tenant_id
   */
  async deleteTask(tenantId: string, id: string, userId: string): Promise<void> {
    // Verify task belongs to tenant and get it for event data
    const task = await this.getTask(tenantId, id);

    const { error } = await this.supabase
      .from('tasks')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }

    // Publish task deleted event (fire-and-forget)
    amroEventsProducer.publishTaskEvent(
      tenantId,
      userId,
      AmroEventType.TASK_DELETED,
      {
        id: task.id,
        task_id: task.id,
        task_number: task.task_number,
        work_package_id: task.work_package_id,
        title: task.title,
      },
    );
  }

  /**
   * Record a maintenance event (execution, sign-off, etc.)
   * Publishes MAINTENANCE_EVENT_RECORDED event
   */
  async recordMaintenanceEvent(
    tenantId: string,
    userId: string,
    taskId: string,
    eventData: {
      executed_by: string;
      evidence_captured: boolean;
      event_type?: string;
      sign_off_date?: string;
      notes?: string;
    },
  ): Promise<void> {
    // Verify task belongs to tenant
    const task = await this.getTask(tenantId, taskId);

    // Publish maintenance event recorded event (fire-and-forget with error logging)
    amroEventsProducer.publishMaintenanceEvent(
      tenantId,
      userId,
      {
        id: `maint-${Date.now()}`,
        task_id: task.id,
        task_number: task.task_number,
        work_package_id: task.work_package_id,
        executed_by: eventData.executed_by,
        evidence_captured: eventData.evidence_captured,
        event_type: eventData.event_type || 'execution',
        sign_off_date: eventData.sign_off_date || new Date().toISOString(),
        notes: eventData.notes,
        recorded_at: new Date().toISOString(),
      },
    ).catch(err => {
      logger.error('Failed to publish maintenance event', {
        error: err.message,
        taskId,
        tenantId,
      });
    });
  }

  // ============================================================================
  // MATERIALS
  // ============================================================================

  /**
   * Get all materials for a work package
   * Explicitly filters by tenant_id
   */
  async getMaterials(tenantId: string, workPackageId: string): Promise<Material[]> {
    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('work_package_id', workPackageId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch materials: ${error.message}`);
    }

    return data as Material[];
  }

  /**
   * Get a specific material
   * Explicitly filters by tenant_id
   */
  async getMaterial(tenantId: string, id: string): Promise<Material> {
    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch material: ${error.message}`);
    }

    if (!data) {
      throw new Error('Material not found');
    }

    return data as Material;
  }
}
