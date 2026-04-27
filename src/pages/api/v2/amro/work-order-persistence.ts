import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';

type CreateWorkOrderInput = {
  tenantId: string;
  franchiseId: string;
  userId: string;
  workOrderTemplateId?: string;
  aircraftId: string;
  maintenanceType: string;
  plannedWindowFrom: string;
  plannedWindowTo: string;
  station: string;
  priority: string;
  scopeItems: string[];
  creationTriggerSource: string;
  creationTriggerReferenceId: string;
  creationTriggeredAt: string;
  engineerPlan: Record<string, unknown>;
};

type TransitionWorkOrderInput = {
  tenantId: string;
  franchiseId: string;
  userId: string;
  workOrderId: string;
  currentStatus: string;
  targetStatus: string;
  reasonCode: string;
  actorSignature: string;
  expectedVersion: number;
  actorRole: string;
  transitionId: string;
  gateName: string;
  workflowInputPayload: Record<string, unknown>;
  workflowUserContext: Record<string, unknown>;
};

type CloneWorkOrderInput = {
  tenantId: string;
  franchiseId: string;
  userId: string;
  templateId: string;
  templateVersion: string;
  templateName: string;
  aircraftId: string;
  overrideFields: Record<string, unknown>;
};

export type PersistedWorkOrder = {
  work_order_id: string;
  status: string;
  version: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  inherited_tasks_count?: number;
  generated_tasks_count?: number;
};

function parseRpcResponse(data: unknown): PersistedWorkOrder {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    throw new Error('persistence layer returned an invalid response');
  }
  const record = row as Record<string, unknown>;
  return {
    work_order_id: String(record.work_order_id || ''),
    status: String(record.status || ''),
    version: Number.parseInt(String(record.version || '1'), 10) || 1,
    created_at: String(record.created_at || new Date().toISOString()),
    created_by: String(record.created_by || ''),
    updated_at: String(record.updated_at || new Date().toISOString()),
    updated_by: String(record.updated_by || ''),
    inherited_tasks_count: record.inherited_tasks_count == null
      ? undefined
      : (Number.parseInt(String(record.inherited_tasks_count), 10) || 0),
    generated_tasks_count: record.generated_tasks_count == null
      ? undefined
      : (Number.parseInt(String(record.generated_tasks_count), 10) || 0),
  };
}

export async function persistCreateWorkOrder(input: CreateWorkOrderInput): Promise<PersistedWorkOrder> {
  const supabase = getSupabaseAdminClient().schema('amro_ops');
  const { data, error } = await supabase.rpc('amro_ops_create_work_order', {
    p_tenant_id: input.tenantId,
    p_franchise_id: input.franchiseId,
    p_user_id: input.userId,
    p_work_order_template_id: String(input.workOrderTemplateId || '').trim() || null,
    p_aircraft_id: input.aircraftId,
    p_maintenance_type: input.maintenanceType,
    p_planned_window_from: input.plannedWindowFrom,
    p_planned_window_to: input.plannedWindowTo,
    p_station: input.station,
    p_priority: input.priority,
    p_scope_items: input.scopeItems,
    p_creation_trigger_source: input.creationTriggerSource,
    p_creation_trigger_reference_id: input.creationTriggerReferenceId,
    p_creation_triggered_at: input.creationTriggeredAt,
    p_engineer_plan: input.engineerPlan,
  });
  if (error) {
    throw new Error(error.message || 'failed to persist work package');
  }
  return parseRpcResponse(data);
}

export async function persistTransitionWorkOrder(input: TransitionWorkOrderInput): Promise<PersistedWorkOrder> {
  const supabase = getSupabaseAdminClient().schema('amro_ops');
  const { data, error } = await supabase.rpc('amro_ops_transition_work_order', {
    p_tenant_id: input.tenantId,
    p_franchise_id: input.franchiseId,
    p_user_id: input.userId,
    p_work_order_id: input.workOrderId,
    p_current_status: input.currentStatus,
    p_target_status: input.targetStatus,
    p_reason_code: input.reasonCode,
    p_actor_signature: input.actorSignature,
    p_expected_version: input.expectedVersion,
    p_actor_role: input.actorRole,
    p_transition_id: input.transitionId,
    p_gate_name: input.gateName,
    p_input_payload: input.workflowInputPayload,
    p_user_ctx: input.workflowUserContext,
  });
  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('optimistic lock') || message.includes('version mismatch')) {
      throw new Error('optimistic_lock_conflict');
    }
    throw new Error(error.message || 'failed to persist work package transition');
  }
  return parseRpcResponse(data);
}

export async function persistCloneTemplateWorkOrder(input: CloneWorkOrderInput): Promise<PersistedWorkOrder> {
  const supabase = getSupabaseAdminClient().schema('amro_ops');
  const { data, error } = await supabase.rpc('amro_ops_clone_template_work_order', {
    p_tenant_id: input.tenantId,
    p_franchise_id: input.franchiseId,
    p_user_id: input.userId,
    p_template_id: input.templateId,
    p_template_name: input.templateName,
    p_template_version: input.templateVersion,
    p_aircraft_id: input.aircraftId,
    p_override_fields: input.overrideFields,
  });
  if (error) {
    throw new Error(error.message || 'failed to persist template clone operation');
  }
  return parseRpcResponse(data);
}

export async function checkAmroOpsPersistenceHealth(maxDurationMs = 500): Promise<{ ok: boolean; elapsedMs: number }> {
  const startedAt = Date.now();
  const supabase = getSupabaseAdminClient().schema('amro_ops');
  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(new Error('persistence health timeout'));
    }, Math.max(100, maxDurationMs - 20));
  });
  const probe = (async () => {
    const { error } = await supabase.rpc('amro_ops_healthcheck');
    if (error) {
      throw new Error(error.message || 'persistence healthcheck failed');
    }
  })();
  await Promise.race([probe, timeout]);
  const elapsedMs = Date.now() - startedAt;
  return {
    ok: elapsedMs <= maxDurationMs,
    elapsedMs,
  };
}
