import { createHash } from 'node:crypto';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized || null;
}

function parseDate(value: unknown): string | null {
  const normalized = asString(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function buildTaskNotes(details: Record<string, unknown>): string {
  const lines = [
    `Work Order No: ${asString(details.work_order_no)}`,
    `License No: ${asString(details.license_no)}`,
    `Place: ${asString(details.place)}`,
    `Actual Man Hours: ${asString(details.actual_man_hours)}`,
    `Remark: ${asString(details.remark)}`,
  ].filter((line) => !line.endsWith(': '));
  return lines.join('\n');
}

async function resolveTaskId(params: {
  tenantId: string;
  aircraftId: string;
  taskId: string | null;
  taskTemplateId: string | null;
}) {
  const supabase = getSupabaseAdminClient();

  if (params.taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, tenant_id, franchise_id, planned_end_date, status, task_category')
      .eq('tenant_id', params.tenantId)
      .eq('id', params.taskId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to resolve task: ${error.message}`);
    if (!data) throw new Error('Task not found for the selected context');
    return data as Record<string, unknown>;
  }

  if (!params.taskTemplateId) {
    throw new Error('task_template_id is required when task_id is not provided');
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('id, tenant_id, franchise_id, planned_end_date, status, task_category, work_orders!inner(aircraft_id)')
    .eq('tenant_id', params.tenantId)
    .eq('task_template_id', params.taskTemplateId)
    .eq('work_orders.aircraft_id', params.aircraftId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve configured task by template: ${error.message}`);
  }
  if (!data) {
    throw new Error('Configured task not found. Please configure the template first.');
  }
  return data as Record<string, unknown>;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'edit_aircraft_records', 'dashboards.view']);

    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;

    const body = asObject(req.body);
    const aircraftId = asString(body.aircraft_id);
    const taskTemplateId = asNullableString(body.task_template_id);
    const taskId = asNullableString(body.task_id);
    const details = asObject(body.details);
    const templateSnapshot = asObject(body.template_snapshot);
    if (!aircraftId) {
      res.status(400).json({ error: 'aircraft_id is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const task = await resolveTaskId({ tenantId, aircraftId, taskId, taskTemplateId });
    const resolvedTaskId = asString(task.id);
    const sourceDoc = asNullableString(details.source_doc);
    const attachmentFileName = asNullableString(details.attachment_file_name);
    const extensionDateIso = parseDate(details.extension_date);
    const doneOnDateIso = parseDate(details.done_on_date);
    const revisionDateIso = parseDate(details.done_on_date);

    const supabase = getSupabaseAdminClient();
    const taskPatch: Record<string, unknown> = {
      title: asString(details.description) || asString(templateSnapshot.description) || undefined,
      description: asString(details.description) || undefined,
      procedure_reference: asString(details.reference) || asString(templateSnapshot.reference_amp) || undefined,
      task_category: asString(details.inspection_type) || asString(task.task_category) || undefined,
      actual_end_date: doneOnDateIso || undefined,
      status: doneOnDateIso ? 'completed' : undefined,
      notes: buildTaskNotes(details) || undefined,
      source_type: 'configure_mpd_inspection_dialog',
      source_ref: sourceDoc || asString(details.reference) || undefined,
      revision_date: revisionDateIso || undefined,
      updated_by: ctx.userId || null,
    };

    const sanitizedTaskPatch = Object.fromEntries(
      Object.entries(taskPatch).filter(([, value]) => value !== undefined),
    );

    const { error: taskUpdateError } = await supabase
      .from('tasks')
      .update(sanitizedTaskPatch)
      .eq('tenant_id', tenantId)
      .eq('id', resolvedTaskId);

    if (taskUpdateError) {
      throw new Error(`Failed to update task configuration: ${taskUpdateError.message}`);
    }

    const evidenceMetadata = {
      revision_no: asNullableString(details.revision_no),
      page_no: asNullableString(details.page_no),
      book_no: asNullableString(details.book_no),
      source_doc: sourceDoc,
      attachment_file_name: attachmentFileName,
      monitoring: {
        inspection_type: asNullableString(details.inspection_type),
        ata_chapter: asNullableString(details.ata_chapter),
        reference: asNullableString(details.reference),
      },
      done_on: {
        done_on_date: asNullableString(details.done_on_date),
        applicable: Boolean(details.applicable),
        work_order_no: asNullableString(details.work_order_no),
        license_no: asNullableString(details.license_no),
        place: asNullableString(details.place),
        actual_man_hours: asNullableString(details.actual_man_hours),
        remark: asNullableString(details.remark),
      },
    };
    const hasEvidencePayload = Boolean(
      sourceDoc
      || attachmentFileName
      || asString(details.revision_no)
      || asString(details.page_no)
      || asString(details.book_no),
    );

    let evidenceInserted = false;
    if (hasEvidencePayload) {
      const evidenceUri = sourceDoc || (attachmentFileName ? `attachment://${attachmentFileName}` : `task-doc://${resolvedTaskId}`);
      const checksum = createHash('sha256').update(JSON.stringify(evidenceMetadata)).digest('hex');
      const { error: evidenceError } = await supabase
        .from('task_evidence')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          task_id: resolvedTaskId,
          evidence_type: 'document_reference',
          uri: evidenceUri,
          checksum,
          metadata: evidenceMetadata,
          captured_by: ctx.userId || null,
          created_by: ctx.userId || null,
        });
      if (evidenceError) {
        throw new Error(`Failed to insert task evidence: ${evidenceError.message}`);
      }
      evidenceInserted = true;
    }

    let dueExtensionInserted = false;
    if (extensionDateIso) {
      const { error: extensionError } = await supabase
        .from('task_due_extensions')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          task_id: resolvedTaskId,
          extension_scope: 'due_date',
          original_due_at: asNullableString(task.planned_end_date),
          extended_due_at: extensionDateIso,
          reason: asString(details.approval_remark) || 'Extension captured from Configure MPD dialog',
          approval_remark: asNullableString(details.approval_remark),
          source_type: 'configure_mpd_inspection_dialog',
          source_ref: sourceDoc || asNullableString(details.reference),
          status: 'pending',
          requested_by: ctx.userId || null,
          created_by: ctx.userId || null,
          updated_by: ctx.userId || null,
        });
      if (extensionError) {
        throw new Error(`Failed to insert due extension: ${extensionError.message}`);
      }
      dueExtensionInserted = true;
    }

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-configure-mpd-inspection-configure',
      output: {
        task_id: resolvedTaskId,
        task_updated: true,
        evidence_inserted: evidenceInserted,
        due_extension_inserted: dueExtensionInserted,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
