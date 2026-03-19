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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

export class WorkOrdersService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
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

    return data as WorkPackage;
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

    return data as WorkPackage;
  }

  /**
   * Delete a work package
   * Explicitly filters by tenant_id
   */
  async deleteWorkPackage(tenantId: string, id: string): Promise<void> {
    // Verify work package belongs to tenant
    await this.getWorkPackage(tenantId, id);

    const { error } = await this.supabase
      .from('work_packages')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete work package: ${error.message}`);
    }
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

    return data as Task;
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
    // Verify task belongs to tenant
    await this.getTask(tenantId, id);

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

    return data as Task;
  }

  /**
   * Delete a task
   * Explicitly filters by tenant_id
   */
  async deleteTask(tenantId: string, id: string): Promise<void> {
    // Verify task belongs to tenant
    await this.getTask(tenantId, id);

    const { error } = await this.supabase
      .from('tasks')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }
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
