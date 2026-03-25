import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';

export type WorkflowTxStatus = 'STARTED' | 'SUCCESS' | 'FAILED';

type WorkflowTransactionLogInput = {
  transitionId: string;
  gateName: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  userContext: Record<string, unknown>;
  status: WorkflowTxStatus;
};

type WorkflowTransactionLogRecord = {
  tx_id: string;
  transition_id: string;
  gate_name: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  tx_timestamp: string;
  user_ctx: Record<string, unknown>;
  tx_status: WorkflowTxStatus;
};

const MASKED_VALUE = '***';
const SENSITIVE_SEGMENTS = ['password', 'secret', 'credential', 'token', 'authorization', 'signature', 'pii', 'ssn'];

function isSensitiveKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return SENSITIVE_SEGMENTS.some((segment) => normalized.includes(segment));
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, nestedValue]) => {
    if (isSensitiveKey(key)) {
      acc[key] = MASKED_VALUE;
      return acc;
    }
    acc[key] = sanitizeValue(nestedValue);
    return acc;
  }, {});
}

function serializePayload(value: Record<string, unknown>): string {
  return JSON.stringify(sanitizeValue(value));
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
}

function createTxId(): string {
  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `wf-tx-${now}-${random}`;
}

export async function logWorkflowTransaction(input: WorkflowTransactionLogInput): Promise<WorkflowTransactionLogRecord> {
  const supabase = getSupabaseAdminClient();
  const inputPayload = sanitizeValue(input.inputPayload) as Record<string, unknown>;
  const outputPayload = sanitizeValue(input.outputPayload) as Record<string, unknown>;
  const userContext = sanitizeValue(input.userContext) as Record<string, unknown>;
  const record: WorkflowTransactionLogRecord = {
    tx_id: createTxId(),
    transition_id: input.transitionId,
    gate_name: input.gateName,
    input_payload: inputPayload,
    output_payload: outputPayload,
    tx_timestamp: new Date().toISOString(),
    user_ctx: userContext,
    tx_status: input.status,
  };
  const { error } = await supabase
    .schema('amro_audit')
    .from('amro_workflow_tx_log')
    .insert({
      tx_id: record.tx_id,
      transition_id: record.transition_id,
      gate_name: record.gate_name,
      input_payload: serializePayload(inputPayload),
      output_payload: serializePayload(outputPayload),
      tx_timestamp: record.tx_timestamp,
      user_ctx: userContext,
      tx_status: record.tx_status,
    });
  if (error) {
    throw new Error(error.message || 'failed to persist workflow transaction log');
  }
  return record;
}

export async function fetchWorkflowTransactionLogByTransitionId(
  transitionId: string,
): Promise<WorkflowTransactionLogRecord | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .schema('amro_audit')
    .from('amro_workflow_tx_log')
    .select('tx_id, transition_id, gate_name, input_payload, output_payload, tx_timestamp, user_ctx, tx_status')
    .eq('transition_id', transitionId)
    .order('tx_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message || 'failed to fetch workflow transaction log');
  }
  if (!data) return null;
  const raw = data as Record<string, unknown>;
  return {
    tx_id: String(raw.tx_id || ''),
    transition_id: String(raw.transition_id || ''),
    gate_name: String(raw.gate_name || ''),
    input_payload: parsePayload(raw.input_payload),
    output_payload: parsePayload(raw.output_payload),
    tx_timestamp: String(raw.tx_timestamp || ''),
    user_ctx: parsePayload(raw.user_ctx),
    tx_status: String(raw.tx_status || 'FAILED') as WorkflowTxStatus,
  };
}

export function sanitizeWorkflowPayload(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(value) as Record<string, unknown>;
}
