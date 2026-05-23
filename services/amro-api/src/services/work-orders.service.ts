/**
 * Work Orders Service
 * Business logic for work package and task management with explicit tenant filtering
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  WorkOrder,
  Task,
  Material,
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  AmroAssetSummary,
  AmroQualificationSummary,
  AmroComplianceSummary,
  AmroEvidenceSummary,
  AmroForecastRecommendation,
} from '../types/amro.types.js';
import { amroEventsProducer } from '../events/amro-events.producer.js';
import { AmroEventType } from '../events/amro-events.types.js';
import { withSpan } from '../instrumentation/amro-tracing.js';
import { workOrdersStream } from '../realtime/work-orders-stream.js';
import { logger } from '../utils/logger.js';

type WorkOrderTemplateTaskItem = {
  task_template_id: string | null;
  sequence_order: number;
  title: string;
  description: string | null;
  task_category: string;
  estimated_duration_hours: number | null;
  complexity_level: number | null;
  notes: string | null;
};

type TaskInsertPayload = {
  tenant_id: string;
  franchise_id: string | null;
  work_order_id: string;
  task_number: string;
  title: string;
  description: string | null;
  task_category: string;
  estimated_duration_hours: string | null;
  complexity_level: number | null;
  sequence_order: number;
  status: 'pending';
  notes: string | null;
  created_by: string;
  updated_by: string;
};

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class WorkOrdersService {
  private supabase: SupabaseClient;

  private sanitizeSegment(value: string, fallback: string): string {
    const normalized = String(value || '').trim().toUpperCase();
    const compact = normalized.replace(/[^A-Z0-9-]/g, '');
    return compact || fallback;
  }

  private parseHoursFromInterval(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(2));
    const text = String(value).trim();
    if (!text) return null;
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(Number(text).toFixed(2));
    const daysMatch = text.match(/(-?\d+)\s+day/);
    const days = daysMatch ? Number(daysMatch[1]) : 0;
    const timeMatch = text.match(/(\d+):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const hours = Number(timeMatch[1]);
      const mins = Number(timeMatch[2]);
      const secs = Number(timeMatch[3] || 0);
      const total = (days * 24) + hours + (mins / 60) + (secs / 3600);
      return Number(total.toFixed(2));
    }
    const hourWord = text.match(/(-?\d+(?:\.\d+)?)\s*hour/);
    if (hourWord) return Number(Number(hourWord[1]).toFixed(2));
    return null;
  }

  private toIntervalLiteral(value: unknown): string | null {
    const hours = this.asNullableNumber(value);
    return hours === null ? null : `${hours} hours`;
  }

  private parseWorkOrderSequence(workOrderNumber: string, targetYear: number): number {
    const match = String(workOrderNumber || '').match(/^WP-(.+)-(\d{4})-(\d+)-([A-Z0-9-]+)$/);
    if (!match) return 0;
    const year = Number.parseInt(match[2], 10);
    const seq = Number.parseInt(match[3], 10);
    if (!Number.isFinite(year) || !Number.isFinite(seq) || year !== targetYear) return 0;
    return seq;
  }

  private async resolveAircraftRegistration(tenantId: string, aircraftId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('aircraft')
      .select('registration,tail_number')
      .eq('tenant_id', tenantId)
      .eq('id', aircraftId)
      .limit(1);
    if (error) {
      throw new Error(`Failed to resolve aircraft registration: ${error.message}`);
    }
    const row = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null;
    const registration = String(row?.registration || row?.tail_number || '').trim();
    return this.sanitizeSegment(registration, 'UNKNOWN');
  }

  private async resolveTitleCodeAndText(
    tenantId: string,
    params: { workOrderTitleId?: string; title?: string; franchiseId?: string | null },
  ): Promise<{ title: string; wpTitle: string; workOrderTitleId: string | null }> {
    const titleId = String(params.workOrderTitleId || '').trim();
    const inputTitle = String(params.title || '').trim();

    if (titleId) {
      let query = this.supabase
        .from('work_orders_title')
        .select('id,title,wp_title,franchise_id')
        .eq('tenant_id', tenantId)
        .eq('id', titleId)
        .limit(1);
      if (params.franchiseId) {
        query = query.or(`franchise_id.is.null,franchise_id.eq.${params.franchiseId}`);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to resolve work package title by id: ${error.message}`);
      }
      const row = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null;
      if (!row) {
        throw new Error('Selected work package title is not available for tenant scope');
      }
      return {
        title: String(row.title || '').trim(),
        wpTitle: this.sanitizeSegment(String(row.wp_title || ''), 'GENERAL'),
        workOrderTitleId: String(row.id || '').trim() || null,
      };
    }

    if (inputTitle) {
      let query = this.supabase
        .from('work_orders_title')
        .select('id,title,wp_title,franchise_id')
        .eq('tenant_id', tenantId)
        .eq('title', inputTitle)
        .limit(1);
      if (params.franchiseId) {
        query = query.or(`franchise_id.is.null,franchise_id.eq.${params.franchiseId}`);
      }
      const { data, error } = await query;
      if (!error) {
        const row = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null;
        if (row) {
          return {
            title: String(row.title || '').trim(),
            wpTitle: this.sanitizeSegment(String(row.wp_title || ''), 'GENERAL'),
            workOrderTitleId: String(row.id || '').trim() || null,
          };
        }
      }
      return {
        title: inputTitle,
        wpTitle: this.sanitizeSegment(inputTitle, 'GENERAL'),
        workOrderTitleId: null,
      };
    }

    throw new Error('Either title or work_order_title_id is required');
  }

  private async generateNextWorkOrderNumber(
    tenantId: string,
    aircraftRegistration: string,
    wpTitle: string,
  ): Promise<string> {
    const currentYear = new Date().getUTCFullYear();
    const { data, error } = await this.supabase
      .from('work_orders')
      .select('work_order_number')
      .eq('tenant_id', tenantId)
      .ilike('work_order_number', `WP-%-${currentYear}-%`);
    if (error) {
      throw new Error(`Failed to generate work package sequence: ${error.message}`);
    }

    const maxSeq = (Array.isArray(data) ? data : []).reduce((max, row) => {
      const current = this.parseWorkOrderSequence(String((row as Record<string, unknown>).work_order_number || ''), currentYear);
      return current > max ? current : max;
    }, 0);
    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `WP-${aircraftRegistration}-${currentYear}-${nextSeq}-${wpTitle}`;
  }

  async getWorkOrderTitles(
    tenantId: string,
    franchiseId?: string | null,
  ): Promise<Array<{ id: string; title: string; wp_title: string; tenant_id: string; franchise_id: string | null }>> {
    let query = this.supabase
      .from('work_orders_title')
      .select('id,title,wp_title,tenant_id,franchise_id')
      .eq('tenant_id', tenantId)
      .order('title', { ascending: true });

    if (franchiseId) {
      query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch work package titles: ${error.message}`);
    }

    return (Array.isArray(data) ? data : [])
      .map((row) => ({
        id: String((row as Record<string, unknown>).id || ''),
        title: String((row as Record<string, unknown>).title || ''),
        wp_title: String((row as Record<string, unknown>).wp_title || ''),
        tenant_id: String((row as Record<string, unknown>).tenant_id || ''),
        franchise_id: (row as Record<string, unknown>).franchise_id
          ? String((row as Record<string, unknown>).franchise_id)
          : null,
      }))
      .filter((item) => item.id && item.title && item.wp_title);
  }

  private getWorkOrderNumber(workOrder: WorkOrder): string {
    return workOrder.work_order_number ?? workOrder.work_order_number ?? '';
  }

  private getTaskSequence(task: Task): number | undefined {
    return task.sequence_order ?? task.sequence_number;
  }

  private getTaskRequiredQualification(task: Task): string | undefined {
    if (task.required_qualification) {
      return task.required_qualification;
    }
    const rating = task.qualifications_json?.rating;
    return typeof rating === 'string' ? rating : undefined;
  }

  private asNullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private asPositiveInt(value: unknown, fallback: number): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
  }

  private asNullableNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private asNullableComplexity(value: unknown): number | null {
    const parsed = this.asNullableNumber(value);
    if (parsed === null) return null;
    const rounded = Math.trunc(parsed);
    if (rounded < 1 || rounded > 5) return null;
    return rounded;
  }

  private parseTemplateTasks(rawTasksJson: unknown, templateId: string): WorkOrderTemplateTaskItem[] {
    let parsed: unknown = rawTasksJson;
    if (typeof rawTasksJson === 'string') {
      const normalized = rawTasksJson.trim();
      try {
        parsed = normalized ? JSON.parse(normalized) : [];
      } catch {
        throw new Error(`Invalid tasks_json in template ${templateId}: JSON parse failed`);
      }
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`Invalid tasks_json in template ${templateId}: expected JSON array`);
    }

    const normalizedTasks = parsed.map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(
          `Invalid tasks_json in template ${templateId}: element at index ${index} must be an object`
        );
      }
      const row = entry as Record<string, unknown>;
      const sequenceOrder = this.asPositiveInt(row.sequence_order, index + 1);
      const taskTemplateId = String(row.task_template_id || '').trim() || null;
      if (taskTemplateId && !UUID_V4_REGEX.test(taskTemplateId)) {
        throw new Error(
          `Invalid tasks_json in template ${templateId}: task_template_id at index ${index} is not a valid UUID`
        );
      }

      const title = String(
        row.title ||
        row.task_title ||
        row.description ||
        row.code_form_no ||
        `Template Task ${sequenceOrder}`
      ).trim();

      return {
        task_template_id: taskTemplateId,
        sequence_order: sequenceOrder,
        title: title || `Template Task ${sequenceOrder}`,
        description: this.asNullableText(row.description),
        task_category: String(row.task_category || row.category_code || 'general').trim() || 'general',
        estimated_duration_hours: this.parseHoursFromInterval(row.estimated_duration_hours ?? row.estimated_man_hours),
        complexity_level: this.asNullableComplexity(row.complexity_level),
        notes: this.asNullableText(row.reference_amp),
      } as WorkOrderTemplateTaskItem;
    });

    const duplicateGuard = new Set<string>();
    for (const task of normalizedTasks) {
      const key = task.task_template_id
        ? `task_template_id:${task.task_template_id}`
        : `sequence:${task.sequence_order}|title:${task.title.toLowerCase()}`;
      if (duplicateGuard.has(key)) {
        throw new Error(`Duplicate task template entry detected in template ${templateId}: ${key}`);
      }
      duplicateGuard.add(key);
    }
    return normalizedTasks;
  }

  private buildTaskInsertPayloads(params: {
    tenantId: string;
    franchiseId?: string | null;
    workOrderId: string;
    workOrderNumber: string;
    userId: string;
    templateTasks: WorkOrderTemplateTaskItem[];
  }): TaskInsertPayload[] {
    return params.templateTasks.map((templateTask, index) => {
      const sequence = this.asPositiveInt(templateTask.sequence_order, index + 1);
      return {
        tenant_id: params.tenantId,
        franchise_id: params.franchiseId || null,
        work_order_id: params.workOrderId,
        task_number: `${params.workOrderNumber}-${String(sequence).padStart(3, '0')}`,
        title: templateTask.title,
        description: templateTask.description,
        task_category: templateTask.task_category || 'general',
        estimated_duration_hours: this.toIntervalLiteral(templateTask.estimated_duration_hours),
        complexity_level: templateTask.complexity_level,
        sequence_order: sequence,
        status: 'pending',
        notes: templateTask.notes,
        created_by: params.userId,
        updated_by: params.userId,
      };
    });
  }

  private async createTasksFromTemplateForWorkOrder(params: {
    tenantId: string;
    userId: string;
    franchiseId?: string | null;
    workOrderId: string;
    workOrderNumber: string;
    workOrderTemplateId: string;
  }): Promise<number> {
    let templateQuery = this.supabase
      .from('work_order_templates')
      .select('id,tasks_json,franchise_id')
      .eq('tenant_id', params.tenantId)
      .eq('id', params.workOrderTemplateId)
      .is('deleted_at', null)
      .limit(1);

    if (params.franchiseId) {
      templateQuery = templateQuery.or(`franchise_id.is.null,franchise_id.eq.${params.franchiseId}`);
    }

    const { data: template, error: templateError } = await templateQuery.single();
    if (templateError) {
      throw new Error(`Failed to load work package template tasks: ${templateError.message}`);
    }

    const templateTasks = this.parseTemplateTasks(
      (template as Record<string, unknown>).tasks_json,
      params.workOrderTemplateId
    );
    if (templateTasks.length === 0) {
      logger.info('work-order-template-has-no-tasks', {
        workOrderTemplateId: params.workOrderTemplateId,
        workOrderId: params.workOrderId,
        tenantId: params.tenantId,
      });
      return 0;
    }

    const { count: existingCount, error: duplicateCheckError } = await this.supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', params.tenantId)
      .eq('work_order_id', params.workOrderId);

    if (duplicateCheckError) {
      throw new Error(`Failed duplicate task guard check: ${duplicateCheckError.message}`);
    }
    if ((existingCount || 0) > 0) {
      throw new Error('Duplicate task creation prevented: tasks already exist for work package');
    }

    const payloads = this.buildTaskInsertPayloads({
      tenantId: params.tenantId,
      franchiseId: params.franchiseId,
      workOrderId: params.workOrderId,
      workOrderNumber: params.workOrderNumber,
      userId: params.userId,
      templateTasks,
    });

    const chunkSize = 200;
    let createdCount = 0;
    for (let index = 0; index < payloads.length; index += chunkSize) {
      const chunk = payloads.slice(index, index + chunkSize);
      const { error: insertError } = await this.supabase.from('tasks').insert(chunk);
      if (insertError) {
        throw new Error(`Failed to create tasks from template: ${insertError.message}`);
      }
      createdCount += chunk.length;
    }

    return createdCount;
  }

  private async resolveValidAircraftId(
    tenantId: string,
    requestedAircraftId: string | undefined,
    userId: string,
  ): Promise<string> {
    const candidateId = String(requestedAircraftId || '').trim();
    const isUuidCandidate = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateId);
    if (candidateId && isUuidCandidate) {
      const { data, error } = await this.supabase
        .from('aircraft')
        .select('id,status')
        .eq('tenant_id', tenantId)
        .eq('id', candidateId)
        .limit(1);

      if (error) {
        throw new Error(`Failed to resolve aircraft: ${error.message}`);
      }

      const candidate = (data ?? [])[0] as { id?: string; status?: string } | undefined;
      const candidateStatus = String(candidate?.status || '').toLowerCase();
      if (candidate?.id && candidateStatus !== 'retired') {
        return candidate.id;
      }
    }

    const { data: existingData, error: existingError } = await this.supabase
      .from('aircraft')
      .select('id,status')
      .eq('tenant_id', tenantId)
      .neq('status', 'retired')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (existingError) {
      throw new Error(`Failed to load tenant aircraft: ${existingError.message}`);
    }

    const existing = (existingData ?? [])[0] as { id?: string } | undefined;
    if (existing?.id) {
      return existing.id;
    }

    const stamp = Date.now().toString(36).toUpperCase();
    const serial = `AUTO-${tenantId.slice(0, 8)}-${stamp}`;
    const registration = `AUTO-${stamp.slice(-6)}`;

    const { data: created, error: createError } = await this.supabase
      .from('aircraft')
      .insert({
        tenant_id: tenantId,
        registration,
        aircraft_type: 'auto_seeded',
        manufacturer: 'System',
        model: 'AMRO Bootstrap',
        serial_number: serial,
        status: 'active',
        created_by: userId,
      })
      .select('id')
      .single();

    if (createError) {
      throw new Error(`Failed to provision tenant aircraft: ${createError.message}`);
    }

    const createdId = String((created as { id?: string } | null)?.id || '').trim();
    if (!createdId) {
      throw new Error('Failed to provision tenant aircraft: missing aircraft id');
    }
    return createdId;
  }

  constructor() {
    const supabaseUrl = String(
      process.env.AMRO_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        '',
    ).replace(/\/$/, '');
    const supabaseServiceKey =
      process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  async getWorkOrders(tenantId: string, franchiseId?: string | null): Promise<WorkOrder[]> {
    let query = this.supabase
      .from('work_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch work packages: ${error.message}`);
    }

    return data as WorkOrder[];
  }

  /**
   * Get a specific work package
   * Explicitly filters by tenant_id
   */
  async getWorkOrder(tenantId: string, id: string, franchiseId?: string | null): Promise<WorkOrder> {
    let query = this.supabase
      .from('work_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }

    const { data, error } = await query.single();

    if (error) {
      throw new Error(`Failed to fetch work package: ${error.message}`);
    }

    if (!data) {
      throw new Error('Work package not found');
    }

    return data as WorkOrder;
  }

  /**
   * Create a new work package
   * Explicitly sets tenant_id
   * Wrapped with distributed tracing
   */
  async createWorkOrder(
    tenantId: string,
    userId: string,
    request: CreateWorkOrderRequest,
    franchiseId?: string | null,
  ): Promise<WorkOrder> {
    return withSpan(
      'work_order.create',
      async () => {
        const plannedEndDate = request.planned_end_date ?? request.planned_completion_date;
        const aircraftId = await this.resolveValidAircraftId(tenantId, request.aircraft_id, userId);
        const aircraftRegistration = await this.resolveAircraftRegistration(tenantId, aircraftId);
        const titleResolution = await this.resolveTitleCodeAndText(tenantId, {
          workOrderTitleId: request.work_order_title_id,
          title: request.title,
          franchiseId: franchiseId || null,
        });
        const workOrderNumber = await this.generateNextWorkOrderNumber(
          tenantId,
          aircraftRegistration,
          titleResolution.wpTitle,
        );

        const { data, error } = await this.supabase
          .from('work_orders')
          .insert({
            tenant_id: tenantId,
            franchise_id: franchiseId || null,
            aircraft_id: aircraftId,
            work_order_number: workOrderNumber,
            title: titleResolution.title,
            work_order_template_id: request.work_order_template_id || null,
            work_order_title_id: titleResolution.workOrderTitleId,
            description: request.description,
            work_type: request.work_type ?? 'general',
            maintenance_type: request.maintenance_type,
            status: 'planning',
            planned_start_date: request.planned_start_date,
            planned_end_date: plannedEndDate,
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

        const workOrder = data as WorkOrder & { generated_tasks_count?: number };
        let generatedTasksCount = 0;

        if (request.work_order_template_id) {
          try {
            generatedTasksCount = await this.createTasksFromTemplateForWorkOrder({
              tenantId,
              userId,
              franchiseId,
              workOrderId: workOrder.id,
              workOrderNumber: this.getWorkOrderNumber(workOrder) || workOrderNumber,
              workOrderTemplateId: request.work_order_template_id,
            });
            workOrder.generated_tasks_count = generatedTasksCount;
            logger.info('work-order-template-task-generation-complete', {
              tenantId,
              workOrderId: workOrder.id,
              workOrderTemplateId: request.work_order_template_id,
              generatedTasksCount,
            });
          } catch (taskCreationError) {
            logger.error('work-order-template-task-generation-failed', {
              tenantId,
              workOrderId: workOrder.id,
              workOrderTemplateId: request.work_order_template_id,
              message: taskCreationError instanceof Error ? taskCreationError.message : String(taskCreationError),
            });
            const { error: rollbackError } = await this.supabase
              .from('work_orders')
              .delete()
              .eq('tenant_id', tenantId)
              .eq('id', workOrder.id);
            if (rollbackError) {
              logger.error('work-order-template-task-generation-rollback-failed', {
                tenantId,
                workOrderId: workOrder.id,
                message: rollbackError.message,
              });
            }
            const reason = taskCreationError instanceof Error ? taskCreationError.message : 'unknown task generation error';
            throw new Error(`Failed to create tasks from template and rolled back work package: ${reason}`);
          }
        }

        // Publish work order created event (fire-and-forget)
        amroEventsProducer.publishWorkOrderEvent(
          tenantId,
          userId,
          AmroEventType.WORK_ORDER_CREATED,
          {
            id: workOrder.id,
            work_order_id: workOrder.id,
            work_order_number: this.getWorkOrderNumber(workOrder) || workOrderNumber,
            aircraft_id: aircraftId,
            title: workOrder.title,
            description: workOrder.description,
            maintenance_type: workOrder.maintenance_type,
            status: workOrder.status,
            estimated_cost: workOrder.estimated_cost,
            estimated_labor_hours: workOrder.estimated_labor_hours,
            generated_tasks_count: generatedTasksCount,
          },
        );

        workOrdersStream.publish({
          type: 'created',
          tenantId,
          userId,
          at: new Date().toISOString(),
          workOrder: {
            id: workOrder.id,
            title: workOrder.title,
            status: workOrder.status,
            work_order_number: this.getWorkOrderNumber(workOrder),
            maintenance_type: workOrder.maintenance_type,
          },
        });

        return workOrder;
      },
      {
        tenant_id: tenantId,
        user_id: userId,
        aircraft_id: request.aircraft_id,
        maintenance_type: request.maintenance_type,
        work_order_template_id: request.work_order_template_id,
        work_order_title_id: request.work_order_title_id,
      },
    );
  }

  /**
   * Update a work package
   * Explicitly filters by tenant_id
   */
  async updateWorkOrder(
    tenantId: string,
    id: string,
    userId: string,
    request: UpdateWorkOrderRequest,
    franchiseId?: string | null,
  ): Promise<WorkOrder> {
    // Verify work package belongs to tenant
    await this.getWorkOrder(tenantId, id, franchiseId || null);

    const updateData: Record<string, any> = {
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    if (request.title !== undefined) updateData.title = request.title;
    if (request.description !== undefined) updateData.description = request.description;
    if (request.status !== undefined) updateData.status = request.status;
    if (request.work_type !== undefined) updateData.work_type = request.work_type;
    if (request.planned_start_date !== undefined) {
      updateData.planned_start_date = request.planned_start_date;
    }
    if (request.planned_end_date !== undefined || request.planned_completion_date !== undefined) {
      updateData.planned_end_date = request.planned_end_date ?? request.planned_completion_date;
    }
    if (request.actual_start_date !== undefined) updateData.actual_start_date = request.actual_start_date;
    if (request.actual_end_date !== undefined || request.actual_completion_date !== undefined) {
      updateData.actual_end_date = request.actual_end_date ?? request.actual_completion_date;
    }
    if (request.estimated_labor_hours !== undefined) {
      updateData.estimated_labor_hours = request.estimated_labor_hours;
    }
    if (request.actual_labor_hours !== undefined) updateData.actual_labor_hours = request.actual_labor_hours;
    if (request.estimated_cost !== undefined) updateData.estimated_cost = request.estimated_cost;
    if (request.actual_cost !== undefined) updateData.actual_cost = request.actual_cost;
    if (request.assigned_to !== undefined) updateData.assigned_to = request.assigned_to;

    let query = this.supabase
      .from('work_orders')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      throw new Error(`Failed to update work package: ${error.message}`);
    }

    const workOrder = data as WorkOrder;

    // Publish work order updated event (fire-and-forget)
    amroEventsProducer.publishWorkOrderEvent(
      tenantId,
      userId,
      AmroEventType.WORK_ORDER_UPDATED,
      {
        id: workOrder.id,
        work_order_id: workOrder.id,
        work_order_number: this.getWorkOrderNumber(workOrder),
        aircraft_id: workOrder.aircraft_id,
        title: workOrder.title,
        description: workOrder.description,
        maintenance_type: workOrder.maintenance_type,
        status: workOrder.status,
        estimated_cost: workOrder.estimated_cost,
        estimated_labor_hours: workOrder.estimated_labor_hours,
        actual_cost: workOrder.actual_cost,
        actual_labor_hours: workOrder.actual_labor_hours,
      },
    );

    workOrdersStream.publish({
      type: 'updated',
      tenantId,
      userId,
      at: new Date().toISOString(),
      workOrder: {
        id: workOrder.id,
        title: workOrder.title,
        status: workOrder.status,
        work_order_number: this.getWorkOrderNumber(workOrder),
        maintenance_type: workOrder.maintenance_type,
      },
    });

    return workOrder;
  }

  /**
   * Delete a work package
   * Explicitly filters by tenant_id
   */
  async deleteWorkOrder(tenantId: string, id: string, userId: string, franchiseId?: string | null): Promise<void> {
    // Verify work package belongs to tenant and get it for event data
    const workOrder = await this.getWorkOrder(tenantId, id, franchiseId || null);

    let query = this.supabase
      .from('work_orders')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Failed to delete work package: ${error.message}`);
    }

    // Publish work order deleted event (fire-and-forget)
    amroEventsProducer.publishWorkOrderEvent(
      tenantId,
      userId,
      AmroEventType.WORK_ORDER_DELETED,
      {
        id: workOrder.id,
        work_order_id: workOrder.id,
        work_order_number: this.getWorkOrderNumber(workOrder),
        aircraft_id: workOrder.aircraft_id,
        title: workOrder.title,
      },
    );

    workOrdersStream.publish({
      type: 'deleted',
      tenantId,
      userId,
      at: new Date().toISOString(),
      workOrder: {
        id: workOrder.id,
        title: workOrder.title,
        status: workOrder.status,
        work_order_number: this.getWorkOrderNumber(workOrder),
        maintenance_type: workOrder.maintenance_type,
      },
    });
  }

  // ============================================================================
  // TASKS
  // ============================================================================

  /**
   * Get all tasks for a work package
   * Explicitly filters by tenant_id
   */
  async getTasks(tenantId: string, workOrderId: string, franchiseId?: string | null): Promise<Task[]> {
    let query = this.supabase
      .from('tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('work_order_id', workOrderId)
      .order('sequence_order', { ascending: true });

    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return data as Task[];
  }

  /**
   * Get a specific task
   * Explicitly filters by tenant_id
   */
  async getTask(tenantId: string, id: string, franchiseId?: string | null): Promise<Task> {
    let query = this.supabase
      .from('tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }

    const { data, error } = await query.single();

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
   * Wrapped with distributed tracing
   */
  async createTask(
    tenantId: string,
    userId: string,
    request: CreateTaskRequest,
  ): Promise<Task> {
    return withSpan(
      'task.create',
      async () => {
        const taskNumber = `TASK-${Date.now()}`;
        const sequenceOrder = request.sequence_order ?? request.sequence_number;
        const plannedEndDate = request.planned_end_date ?? request.planned_completion_date;
        const workOrderId = request.work_order_id ?? request.work_order_id;
        if (!workOrderId) {
          throw new Error('work_order_id is required');
        }
        const taskQualifications = request.qualifications_json
          ?? (request.required_qualification ? { rating: request.required_qualification } : undefined);

        const { data, error } = await this.supabase
          .from('tasks')
          .insert({
            tenant_id: tenantId,
            work_order_id: workOrderId,
            task_number: taskNumber,
            title: request.title,
            description: request.description,
            task_category: request.task_category ?? 'general',
            status: 'pending',
            sequence_order: sequenceOrder,
            planned_start_date: request.planned_start_date,
            planned_end_date: plannedEndDate,
            qualifications_json: taskQualifications,
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
            work_order_id: task.work_order_id ?? task.work_order_id,
            title: task.title,
            description: task.description,
            status: task.status,
            sequence_number: this.getTaskSequence(task),
            required_qualification: this.getTaskRequiredQualification(task),
          },
        );

        return task;
      },
      {
        tenant_id: tenantId,
        user_id: userId,
        work_order_id: request.work_order_id ?? request.work_order_id,
        sequence_order: request.sequence_order ?? request.sequence_number,
      },
    );
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
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    if (request.title !== undefined) updateData.title = request.title;
    if (request.description !== undefined) updateData.description = request.description;
    if (request.status !== undefined) updateData.status = request.status;
    if (request.task_category !== undefined) updateData.task_category = request.task_category;
    if (request.sequence_order !== undefined || request.sequence_number !== undefined) {
      updateData.sequence_order = request.sequence_order ?? request.sequence_number;
    }
    if (request.planned_start_date !== undefined) {
      updateData.planned_start_date = request.planned_start_date;
    }
    if (request.planned_end_date !== undefined || request.planned_completion_date !== undefined) {
      updateData.planned_end_date = request.planned_end_date ?? request.planned_completion_date;
    }
    if (request.actual_start_date !== undefined) updateData.actual_start_date = request.actual_start_date;
    if (request.actual_end_date !== undefined || request.actual_completion_date !== undefined) {
      updateData.actual_end_date = request.actual_end_date ?? request.actual_completion_date;
    }
    if (request.assigned_technician_id !== undefined) updateData.assigned_technician_id = request.assigned_technician_id;
    if (request.qualifications_json !== undefined || request.required_qualification !== undefined) {
      updateData.qualifications_json = request.qualifications_json
        ?? (request.required_qualification ? { rating: request.required_qualification } : null);
    }

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
        work_order_id: task.work_order_id ?? task.work_order_id,
        title: task.title,
        description: task.description,
        status: task.status,
        sequence_number: this.getTaskSequence(task),
        assigned_technician_id: task.assigned_technician_id,
        required_qualification: this.getTaskRequiredQualification(task),
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
          work_order_id: task.work_order_id ?? task.work_order_id,
          title: task.title,
          description: task.description,
          status: task.status,
          assigned_technician_id: task.assigned_technician_id,
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
          work_order_id: task.work_order_id ?? task.work_order_id,
          title: task.title,
          description: task.description,
          status: task.status,
          assigned_technician_id: task.assigned_technician_id,
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
        work_order_id: task.work_order_id ?? task.work_order_id,
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
    try {
      amroEventsProducer.publishMaintenanceEvent(
        tenantId,
        userId,
        {
          id: `maint-${Date.now()}`,
          task_id: task.id,
          task_number: task.task_number,
          work_order_id: task.work_order_id ?? task.work_order_id,
          executed_by: eventData.executed_by,
          evidence_captured: eventData.evidence_captured,
          event_type: eventData.event_type || 'execution',
          sign_off_date: eventData.sign_off_date || new Date().toISOString(),
          notes: eventData.notes,
          recorded_at: new Date().toISOString(),
        },
      );
    } catch (err) {
      logger.error('Failed to publish maintenance event', {
        error: err instanceof Error ? err.message : String(err),
        taskId,
        tenantId,
      });
    }
  }

  // ============================================================================
  // MATERIALS
  // ============================================================================

  /**
   * Get all materials for a work package
   * Explicitly filters by tenant_id
   */
  async getMaterials(tenantId: string, workOrderId: string): Promise<Material[]> {
    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('work_order_id', workOrderId)
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

  async getAssetSummaries(tenantId: string): Promise<AmroAssetSummary[]> {
    const { data, error } = await this.supabase
      .from('aircraft')
      .select('id,tenant_id,franchise_id,registration,aircraft_type,serial_number,status')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch asset summaries: ${error.message}`);
    }

    return (data ?? []) as AmroAssetSummary[];
  }

  async getQualificationSummaries(tenantId: string): Promise<AmroQualificationSummary[]> {
    const { data, error } = await this.supabase
      .from('staff_qualifications')
      .select('id,tenant_id,staff_id,qualification_name,rating,can_certify_release,expiration_date,is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('expiration_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch qualification summaries: ${error.message}`);
    }

    return (data ?? []) as AmroQualificationSummary[];
  }

  async getComplianceSummary(tenantId: string): Promise<AmroComplianceSummary> {
    const eventsResponse = await this.supabase
      .from('maintenance_events')
      .select('id,evidence_captured')
      .eq('tenant_id', tenantId);
    if (eventsResponse.error) {
      throw new Error(`Failed to fetch compliance event summary: ${eventsResponse.error.message}`);
    }

    const tasksResponse = await this.supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('qa_verified_at', 'is', null)
      .neq('status', 'completed');
    if (tasksResponse.error) {
      throw new Error(`Failed to fetch pending sign-off summary: ${tasksResponse.error.message}`);
    }

    const qualifications = await this.getQualificationSummaries(tenantId);
    const authorityCoverage = Array.from(new Set(qualifications.map((row) => row.rating).filter(Boolean)));
    const events = eventsResponse.data ?? [];
    const evidenceCapturedEvents = events.filter((event) => Boolean((event as { evidence_captured?: boolean }).evidence_captured)).length;

    return {
      totalEvents: events.length,
      evidenceCapturedEvents,
      pendingSignOffTasks: tasksResponse.count ?? 0,
      authorityCoverage,
      activeRulePacks: Math.max(authorityCoverage.length, 1),
    };
  }

  async getEvidenceSummaries(tenantId: string): Promise<AmroEvidenceSummary[]> {
    const { data, error } = await this.supabase
      .from('maintenance_events')
      .select('id,task_id,event_type,event_hash,created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Failed to fetch evidence summaries: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const typed = row as {
        id: string;
        task_id: string | null;
        event_type?: string | null;
        event_hash?: string | null;
        created_at: string;
      };
      return {
        id: typed.id,
        entity_type: typed.event_type === 'release' ? 'release' : typed.event_type === 'inspection' ? 'inspection' : 'task',
        entity_id: typed.task_id || typed.id,
        hash: typed.event_hash || `evt-${typed.id}`,
        immutable: true,
        created_at: typed.created_at,
      } as AmroEvidenceSummary;
    });
  }

  async getForecastRecommendations(tenantId: string): Promise<AmroForecastRecommendation[]> {
    const { data, error } = await this.supabase
      .from('work_orders')
      .select('id,work_order_number,status,maintenance_type,planned_start_date')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to fetch forecast recommendations: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{
      id: string;
      work_order_number: string;
      status: string;
      maintenance_type: string;
      planned_start_date?: string | null;
    }>;

    return rows.map((row) => {
      const status = String(row.status || '').toLowerCase();
      const riskScore =
        status === 'in_progress'
          ? 0.84
          : status === 'scheduled'
            ? 0.72
            : status === 'planning'
              ? 0.65
              : status === 'on_hold'
                ? 0.79
                : 0.41;
      const trigger: AmroForecastRecommendation['trigger'] =
        row.maintenance_type === 'line' ? 'telemetry' : row.planned_start_date ? 'calendar' : 'reliability';
      return {
        id: `rec-${row.id}`,
        digital_twin_reference: `DT-${row.work_order_number || row.id}`,
        risk_score: riskScore,
        trigger,
        recommendation:
          riskScore >= 0.8
            ? 'Escalate pre-maintenance inspection and allocate certifying engineer'
            : riskScore >= 0.7
              ? 'Advance required parts reservation and technician readiness review'
              : 'Maintain current plan and continue telemetry monitoring',
      };
    });
  }

  async getSchedulingSummary(tenantId: string): Promise<{
    planning: number;
    scheduled: number;
    in_progress: number;
    completed: number;
    next_slot_at: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('work_orders')
      .select('status,planned_start_date')
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to fetch scheduling summary: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{ status: string; planned_start_date?: string | null }>;
    const nextSlot = rows
      .map((row) => row.planned_start_date || null)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;

    return {
      planning: rows.filter((row) => row.status === 'planning').length,
      scheduled: rows.filter((row) => row.status === 'scheduled').length,
      in_progress: rows.filter((row) => row.status === 'in_progress').length,
      completed: rows.filter((row) => row.status === 'completed' || row.status === 'closed').length,
      next_slot_at: nextSlot,
    };
  }

  async getIntegrationSummary(tenantId: string): Promise<{
    callbacks_published: number;
    replay_queue_depth: number;
    adapter_health: 'healthy' | 'degraded';
  }> {
    const { count, error } = await this.supabase
      .from('maintenance_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to fetch integration summary: ${error.message}`);
    }

    const callbacks = count ?? 0;
    const replayQueueDepth = callbacks > 100 ? 2 : 0;
    return {
      callbacks_published: callbacks,
      replay_queue_depth: replayQueueDepth,
      adapter_health: replayQueueDepth > 0 ? 'degraded' : 'healthy',
    };
  }
}
