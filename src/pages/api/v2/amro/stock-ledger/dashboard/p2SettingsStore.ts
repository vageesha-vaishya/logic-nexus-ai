import { parseReconciliationPolicy, type ReconciliationPolicy } from '../shared';

type SupabaseAdmin = {
  from: (table: string) => any;
};

const SETTINGS_KEY = 'stock_ledger_p2_settings';

export type ReportTemplateConfig = {
  id: string;
  name: string;
  report_type: 'stock-balance' | 'transaction-history' | 'valuation-summary';
  filters: Record<string, unknown>;
  columns: string[];
  created_at: string;
  updated_at: string;
};

export type ScheduledExportConfig = {
  id: string;
  template_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  timezone: string;
  next_run_at: string;
  destinations: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type AlertPolicy = ReconciliationPolicy & {
  stale_approval_hours: number;
  backdated_posting_window_days: number;
  notify_severity_threshold: 'info' | 'warning' | 'critical';
};

export type P2Settings = {
  report_templates: ReportTemplateConfig[];
  scheduled_exports: ScheduledExportConfig[];
  alert_policy: AlertPolicy;
  fx_rates: Record<string, number>;
};

const DEFAULT_SETTINGS: P2Settings = {
  report_templates: [],
  scheduled_exports: [],
  alert_policy: {
    ...parseReconciliationPolicy({}),
    stale_approval_hours: 24,
    backdated_posting_window_days: 7,
    notify_severity_threshold: 'warning',
  },
  fx_rates: {
    USD: 1,
    EUR: 1.08,
    GBP: 1.26,
    AED: 0.27,
    INR: 0.012,
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeAlertPolicy(value: unknown): AlertPolicy {
  const record = asRecord(value);
  const base = parseReconciliationPolicy(record);
  const staleApprovalHours = Number(record.stale_approval_hours);
  const backdatedWindow = Number(record.backdated_posting_window_days);
  const severity = String(record.notify_severity_threshold || 'warning').toLowerCase();
  return {
    ...base,
    stale_approval_hours: Number.isFinite(staleApprovalHours) ? Math.max(1, Math.min(720, Math.floor(staleApprovalHours))) : 24,
    backdated_posting_window_days: Number.isFinite(backdatedWindow) ? Math.max(1, Math.min(365, Math.floor(backdatedWindow))) : 7,
    notify_severity_threshold: severity === 'info' || severity === 'critical' ? severity : 'warning',
  };
}

function normalizeTemplate(value: unknown, nowIso: string): ReportTemplateConfig | null {
  const row = asRecord(value);
  const id = String(row.id || '').trim();
  const name = String(row.name || '').trim();
  const reportType = String(row.report_type || '').trim();
  if (!id || !name) return null;
  if (reportType !== 'stock-balance' && reportType !== 'transaction-history' && reportType !== 'valuation-summary') return null;
  return {
    id,
    name,
    report_type: reportType,
    filters: asRecord(row.filters),
    columns: Array.isArray(row.columns) ? row.columns.map((item) => String(item)).filter((item) => item) : [],
    created_at: row.created_at ? String(row.created_at) : nowIso,
    updated_at: row.updated_at ? String(row.updated_at) : nowIso,
  };
}

function normalizeSchedule(value: unknown, nowIso: string): ScheduledExportConfig | null {
  const row = asRecord(value);
  const id = String(row.id || '').trim();
  const templateId = String(row.template_id || '').trim();
  const frequency = String(row.frequency || '').trim();
  if (!id || !templateId) return null;
  if (frequency !== 'daily' && frequency !== 'weekly' && frequency !== 'monthly') return null;
  return {
    id,
    template_id: templateId,
    frequency,
    timezone: String(row.timezone || 'UTC'),
    next_run_at: row.next_run_at ? String(row.next_run_at) : nowIso,
    destinations: Array.isArray(row.destinations) ? row.destinations.map((item) => String(item)).filter((item) => item) : ['in_app'],
    enabled: row.enabled !== false,
    created_at: row.created_at ? String(row.created_at) : nowIso,
    updated_at: row.updated_at ? String(row.updated_at) : nowIso,
  };
}

function normalizeSettings(value: unknown): P2Settings {
  const nowIso = new Date().toISOString();
  const record = asRecord(value);
  const reportTemplates = Array.isArray(record.report_templates)
    ? record.report_templates.map((item) => normalizeTemplate(item, nowIso)).filter((item): item is ReportTemplateConfig => item !== null)
    : [];
  const scheduledExports = Array.isArray(record.scheduled_exports)
    ? record.scheduled_exports.map((item) => normalizeSchedule(item, nowIso)).filter((item): item is ScheduledExportConfig => item !== null)
    : [];
  const fxRatesInput = asRecord(record.fx_rates);
  const fxRates = Object.entries(fxRatesInput).reduce<Record<string, number>>((acc, [currency, rate]) => {
    const numeric = Number(rate);
    if (!Number.isFinite(numeric) || numeric <= 0) return acc;
    acc[currency.toUpperCase()] = numeric;
    return acc;
  }, {});
  return {
    report_templates: reportTemplates,
    scheduled_exports: scheduledExports,
    alert_policy: normalizeAlertPolicy(record.alert_policy),
    fx_rates: Object.keys(fxRates).length > 0 ? fxRates : DEFAULT_SETTINGS.fx_rates,
  };
}

export async function loadP2Settings(supabase: SupabaseAdmin, tenantId: string): Promise<P2Settings> {
  const { data, error } = await supabase
    .from('tenant_profile')
    .select('emergency_contact_info')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  const info = asRecord(data?.emergency_contact_info);
  const settings = normalizeSettings(info[SETTINGS_KEY]);
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    alert_policy: settings.alert_policy,
    fx_rates: settings.fx_rates,
  };
}

export async function saveP2Settings(supabase: SupabaseAdmin, tenantId: string, nextSettings: P2Settings): Promise<P2Settings> {
  const normalized = normalizeSettings(nextSettings);
  const { data, error } = await supabase
    .from('tenant_profile')
    .select('tenant_id,emergency_contact_info')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  const existingInfo = asRecord(data?.emergency_contact_info);
  const mergedInfo = {
    ...existingInfo,
    [SETTINGS_KEY]: normalized,
  };
  if (!data?.tenant_id) {
    const { error: insertError } = await supabase.from('tenant_profile').insert({
      tenant_id: tenantId,
      emergency_contact_info: mergedInfo,
    });
    if (insertError) throw insertError;
    return normalized;
  }
  const { error: updateError } = await supabase
    .from('tenant_profile')
    .update({ emergency_contact_info: mergedInfo })
    .eq('tenant_id', tenantId);
  if (updateError) throw updateError;
  return normalized;
}
