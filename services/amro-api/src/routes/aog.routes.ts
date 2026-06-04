/**
 * AOG (Aircraft on Ground) alert REST routes.
 *
 * Per docs/plans/2026-06-04-aog-alert-surface-design.md slice S2.
 * Backs the AogAlertsListPage + AogAlertDetailPage that host the
 * AogTriagePanel.
 *
 * Endpoints:
 *   GET   /amro/aog/alerts                 list (status, airport filters)
 *   GET   /amro/aog/alerts/:id             read with aircraft join
 *   POST  /amro/aog/alerts                 create (status='declared')
 *   PATCH /amro/aog/alerts/:id             partial update
 *   POST  /amro/aog/alerts/:id/triage      proxy to llm-aog-triage Edge Fn
 *                                          + persist last_triage_output
 *   POST  /amro/aog/alerts/:id/convert     create work_order + link back
 *   POST  /amro/aog/alerts/:id/resolve     close alert
 *
 * Auth: standard auth middleware (req.tenantId required).
 * RLS on amro.aog_alerts handles tenant scoping at the DB layer.
 */

import { Router } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

type JsonRecord = Record<string, unknown>;

const router = Router();

function getSupabaseAdminClient(): SupabaseClient {
  const url = String(
    process.env.AMRO_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '',
  ).replace(/\/$/, '');
  const serviceKey = String(
    process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '',
  ).trim();
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceKey, {
    db: { schema: 'amro' as 'public' },  // type cast — amro is a real schema
  });
}

function normalizeString(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

const VALID_STATUS = new Set([
  'declared', 'triaged', 'assigned', 'in_progress', 'resolved', 'cancelled',
]);
const VALID_PRIORITY = new Set([
  'P1_AOG_CRITICAL', 'P2_AOG_URGENT', 'P3_AOG_PLANNED', 'P4_DEFER_MEL',
]);
const VALID_REPORTER_ROLE = new Set([
  'flight_crew', 'maintenance', 'ground_ops', 'engineering', 'other',
]);

function badRequest(res: import('express').Response, message: string): void {
  res.status(400).json({
    error: message,
    code: 'INVALID_REQUEST',
    statusCode: 400,
  });
}

function unauthorized(res: import('express').Response): void {
  res.status(401).json({
    error: 'Missing tenant context',
    code: 'MISSING_TENANT',
    statusCode: 401,
  });
}

function notFound(res: import('express').Response, id: string): void {
  res.status(404).json({
    error: `AOG alert ${id} not found`,
    code: 'AOG_ALERT_NOT_FOUND',
    statusCode: 404,
  });
}

// ── GET /amro/aog/alerts ────────────────────────────────────────────
router.get(
  '/amro/aog/alerts',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) {
      unauthorized(res);
      return;
    }
    const supabase = getSupabaseAdminClient();
    const tenantId = String(req.tenantId);
    const status = String(req.query.status || '').trim();
    const airport = String(req.query.airport_iata || '').trim().toUpperCase();
    const aircraftId = String(req.query.aircraft_id || '').trim();
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    let query = supabase
      .from('aog_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('reported_at', { ascending: false })
      .limit(limit);

    if (status && VALID_STATUS.has(status)) {
      query = query.eq('status', status);
    } else if (status === 'active') {
      // Composite shortcut: anything not closed.
      query = query.not('status', 'in', '(resolved,cancelled)');
    }
    if (airport && /^[A-Z]{3}$/.test(airport)) {
      query = query.eq('airport_iata', airport);
    }
    if (aircraftId) {
      query = query.eq('aircraft_id', aircraftId);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({
        error: `Failed to list AOG alerts: ${error.message}`,
        code: 'AOG_ALERTS_LIST_FAILED',
        statusCode: 500,
      });
      return;
    }

    res.json({
      records: data ?? [],
      total: (data ?? []).length,
    });
  }),
);

// ── GET /amro/aog/alerts/:id ────────────────────────────────────────
router.get(
  '/amro/aog/alerts/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) {
      unauthorized(res);
      return;
    }
    const supabase = getSupabaseAdminClient();
    const tenantId = String(req.tenantId);
    const id = String(req.params.id);

    const { data, error } = await supabase
      .from('aog_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      res.status(500).json({
        error: `Failed to load AOG alert: ${error.message}`,
        code: 'AOG_ALERT_READ_FAILED',
        statusCode: 500,
      });
      return;
    }
    if (!data) {
      notFound(res, id);
      return;
    }

    // Join aircraft (lives in public schema — use a second client without
    // amro schema scoping).
    const publicClient = createClient(
      String(process.env.AMRO_SUPABASE_URL || process.env.SUPABASE_URL || ''),
      String(process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
    );
    let aircraft: JsonRecord | null = null;
    if ((data as JsonRecord).aircraft_id) {
      const { data: a } = await publicClient
        .from('aircraft')
        .select('id, registration, manufacturer, model, serial_number')
        .eq('id', (data as JsonRecord).aircraft_id as string)
        .maybeSingle();
      aircraft = (a as JsonRecord | null) ?? null;
    }

    res.json({ ...data, aircraft });
  }),
);

// ── POST /amro/aog/alerts ───────────────────────────────────────────
router.post(
  '/amro/aog/alerts',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) {
      unauthorized(res);
      return;
    }
    const supabase = getSupabaseAdminClient();
    const tenantId = String(req.tenantId);
    const payload = (req.body || {}) as JsonRecord;

    const airport = String(payload.airport_iata || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(airport)) {
      badRequest(res, 'airport_iata required (ISO 3-letter code)');
      return;
    }
    const defectSummary = normalizeString(payload.defect_summary);
    if (!defectSummary) {
      badRequest(res, 'defect_summary required');
      return;
    }
    const reporterRole = payload.reporter_role
      ? String(payload.reporter_role).trim()
      : null;
    if (reporterRole && !VALID_REPORTER_ROLE.has(reporterRole)) {
      badRequest(res, 'reporter_role must be flight_crew|maintenance|ground_ops|engineering|other');
      return;
    }

    const insertRow: JsonRecord = {
      tenant_id: tenantId,
      franchise_id: req.headers['x-franchise-id']
        ? String(req.headers['x-franchise-id']) || null
        : null,
      aircraft_id: normalizeString(payload.aircraft_id),
      aircraft_registration: normalizeString(payload.aircraft_registration),
      airport_iata: airport,
      airport_local_time: normalizeString(payload.airport_local_time),
      reporter_user_id: normalizeString(payload.reporter_user_id) ?? req.userId ?? null,
      reporter_role: reporterRole,
      defect_summary: defectSummary,
      ata_chapter_code: normalizeString(payload.ata_chapter_code),
      severity_signal: normalizeString(payload.severity_signal),
      related_warnings: Array.isArray(payload.related_warnings) ? payload.related_warnings : [],
      mel_eligible: typeof payload.mel_eligible === 'boolean' ? payload.mel_eligible : null,
      status: 'declared',
      // alert_number left null — BEFORE-INSERT trigger fills it via
      // amro.next_aog_alert_number()
    };

    const { data, error } = await supabase
      .from('aog_alerts')
      .insert([insertRow])
      .select()
      .single();

    if (error) {
      res.status(500).json({
        error: `Failed to create AOG alert: ${error.message}`,
        code: 'AOG_ALERT_CREATE_FAILED',
        statusCode: 500,
      });
      return;
    }
    res.status(201).json(data);
  }),
);

// ── PATCH /amro/aog/alerts/:id ──────────────────────────────────────
router.patch(
  '/amro/aog/alerts/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) {
      unauthorized(res);
      return;
    }
    const supabase = getSupabaseAdminClient();
    const tenantId = String(req.tenantId);
    const id = String(req.params.id);
    const payload = (req.body || {}) as JsonRecord;

    const update: JsonRecord = {};
    if (payload.status !== undefined) {
      const s = String(payload.status).trim();
      if (!VALID_STATUS.has(s)) {
        badRequest(res, 'status invalid');
        return;
      }
      update.status = s;
    }
    if (payload.priority !== undefined) {
      const p = String(payload.priority).trim();
      if (p !== '' && !VALID_PRIORITY.has(p)) {
        badRequest(res, 'priority invalid');
        return;
      }
      update.priority = p === '' ? null : p;
    }
    if (payload.assigned_to !== undefined) {
      update.assigned_to = normalizeString(payload.assigned_to);
    }
    if (payload.estimated_recovery_hours !== undefined) {
      const v = Number(payload.estimated_recovery_hours);
      update.estimated_recovery_hours = Number.isFinite(v) ? v : null;
    }
    if (payload.ata_chapter_code !== undefined) {
      update.ata_chapter_code = normalizeString(payload.ata_chapter_code);
    }
    if (payload.severity_signal !== undefined) {
      update.severity_signal = normalizeString(payload.severity_signal);
    }
    if (payload.related_warnings !== undefined && Array.isArray(payload.related_warnings)) {
      update.related_warnings = payload.related_warnings;
    }
    if (payload.mel_eligible !== undefined) {
      update.mel_eligible = typeof payload.mel_eligible === 'boolean' ? payload.mel_eligible : null;
    }

    if (Object.keys(update).length === 0) {
      badRequest(res, 'no recognised fields to update');
      return;
    }

    const { data, error } = await supabase
      .from('aog_alerts')
      .update(update)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({
        error: `Failed to update AOG alert: ${error.message}`,
        code: 'AOG_ALERT_UPDATE_FAILED',
        statusCode: 500,
      });
      return;
    }
    if (!data) {
      notFound(res, id);
      return;
    }
    res.json(data);
  }),
);

// ── POST /amro/aog/alerts/:id/triage ────────────────────────────────
// Proxies to the llm-aog-triage Edge Function (server-side rather than
// browser → Edge Function so the audit row + invocation persistence
// happen transactionally). The fleet_context is stubbed empty per the
// design's v1 decision; v2 enrichment is a separate slice (S8).

router.post(
  '/amro/aog/alerts/:id/triage',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) {
      unauthorized(res);
      return;
    }
    const supabase = getSupabaseAdminClient();
    const tenantId = String(req.tenantId);
    const id = String(req.params.id);

    // 1. Load the alert
    const { data: alert, error: alertErr } = await supabase
      .from('aog_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (alertErr) {
      res.status(500).json({
        error: `Failed to load alert: ${alertErr.message}`,
        code: 'AOG_ALERT_READ_FAILED',
        statusCode: 500,
      });
      return;
    }
    if (!alert) {
      notFound(res, id);
      return;
    }
    const alertRow = alert as JsonRecord;

    // 2. Load aircraft profile (public schema)
    const publicClient = createClient(
      String(process.env.AMRO_SUPABASE_URL || process.env.SUPABASE_URL || ''),
      String(process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
    );
    let aircraft: JsonRecord | null = null;
    if (alertRow.aircraft_id) {
      const { data: a } = await publicClient
        .from('aircraft')
        .select('registration, manufacturer, model, serial_number')
        .eq('id', alertRow.aircraft_id as string)
        .maybeSingle();
      aircraft = (a as JsonRecord | null) ?? null;
    }

    if (!aircraft) {
      badRequest(res, 'alert has no linked aircraft; triage requires aircraft profile');
      return;
    }

    // 3. Fetch fleet_context from the aggregation RPC. Replaces the
    //    stub fleet_context shipped in S2. Falls back to a stub on
    //    error so triage doesn't hard-fail if the RPC is unavailable.
    let fleetContext: JsonRecord = {
      same_type_aircraft_nearby: [],
      tools_at_airport: [],
      parts_at_airport: [],
      station_capability: 'vendor_required',
      sla_recovery_hours: 24,
    };
    try {
      const { data: fcData, error: fcErr } = await publicClient.rpc(
        'fleet_context_at_airport' as never,
        {
          p_airport_iata: String(alertRow.airport_iata),
          p_aircraft_model: String(aircraft.model ?? ''),
          p_tenant_id: tenantId,
        } as never,
      );
      if (!fcErr && fcData && typeof fcData === 'object') {
        fleetContext = fcData as JsonRecord;
      }
    } catch {
      // Swallow — stub fleet_context will be sent instead.
    }

    // 4. Build LLM input
    const llmInput = {
      alert: {
        alert_id: String(alertRow.id),
        reported_at: String(alertRow.reported_at),
        airport_iata: String(alertRow.airport_iata),
        airport_local_time: alertRow.airport_local_time ?? null,
        reporter_role: alertRow.reporter_role ?? null,
        defect_summary: String(alertRow.defect_summary),
        ata_chapter_code: alertRow.ata_chapter_code ?? null,
        severity_signal: alertRow.severity_signal ?? null,
        related_warnings: Array.isArray(alertRow.related_warnings) ? alertRow.related_warnings : [],
        mel_eligible: alertRow.mel_eligible,
      },
      aircraft: {
        manufacturer: String(aircraft.manufacturer ?? 'Unknown'),
        model: String(aircraft.model ?? 'Unknown'),
        serial_number: String(aircraft.serial_number ?? 'Unknown'),
        registration: String(aircraft.registration ?? alertRow.aircraft_registration ?? 'Unknown'),
        hours_since_new: null,
        cycles_since_new: null,
        current_mel_deferrals: [],
      },
      fleet_context: fleetContext,
    };

    // 5. Invoke the Edge Function
    const fnUrl = `${String(process.env.AMRO_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1/llm-aog-triage`;
    const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const callRes = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: `Bearer ${authHeader}` } : {}),
      },
      body: JSON.stringify(llmInput),
    });
    const llmBody = await callRes.json().catch(() => ({}));
    if (!callRes.ok) {
      res.status(callRes.status).json({
        error: 'AOG triage LLM call failed',
        code: 'AOG_TRIAGE_FAILED',
        details: llmBody,
        statusCode: callRes.status,
      });
      return;
    }

    const result = llmBody as {
      invocation_id?: string;
      output?: JsonRecord;
    };

    // 6. Persist the verdict on the alert row + flip status to 'triaged' if still 'declared'
    const triageUpdate: JsonRecord = {
      last_triage_output: result.output ?? {},
      last_triage_invocation_id: result.invocation_id ?? null,
      last_triage_at: new Date().toISOString(),
    };
    if (alertRow.status === 'declared') {
      triageUpdate.status = 'triaged';
      const priority =
        result.output && typeof result.output === 'object'
          ? (result.output as JsonRecord).priority
          : null;
      if (typeof priority === 'string' && VALID_PRIORITY.has(priority)) {
        triageUpdate.priority = priority;
      }
    }
    await supabase
      .from('aog_alerts')
      .update(triageUpdate)
      .eq('tenant_id', tenantId)
      .eq('id', id);

    res.json({
      alert_id: id,
      invocation_id: result.invocation_id,
      triage: result.output,
    });
  }),
);

// ── POST /amro/aog/alerts/:id/convert ───────────────────────────────
// Creates a public.work_orders row pre-filled from the alert and links
// it back. Status flips to 'in_progress'. Minimal column mapping —
// downstream WO machinery owns the rest.

router.post(
  '/amro/aog/alerts/:id/convert',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) {
      unauthorized(res);
      return;
    }
    const supabase = getSupabaseAdminClient();
    const tenantId = String(req.tenantId);
    const id = String(req.params.id);

    const { data: alert, error: alertErr } = await supabase
      .from('aog_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (alertErr || !alert) {
      if (!alert) {
        notFound(res, id);
      } else {
        res.status(500).json({
          error: `Failed to load alert: ${alertErr?.message ?? 'unknown'}`,
          code: 'AOG_ALERT_READ_FAILED',
          statusCode: 500,
        });
      }
      return;
    }
    const alertRow = alert as JsonRecord;

    if (alertRow.work_order_id) {
      res.status(409).json({
        error: 'Alert already converted to a work order',
        code: 'AOG_ALREADY_CONVERTED',
        work_order_id: alertRow.work_order_id,
        statusCode: 409,
      });
      return;
    }

    const publicClient = createClient(
      String(process.env.AMRO_SUPABASE_URL || process.env.SUPABASE_URL || ''),
      String(process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
    );

    const woInsert: JsonRecord = {
      tenant_id: tenantId,
      title: `AOG ${alertRow.airport_iata}: ${String(alertRow.defect_summary).slice(0, 80)}`,
      description: alertRow.defect_summary,
      aircraft_id: alertRow.aircraft_id,
      priority: alertRow.priority === 'P1_AOG_CRITICAL' ? 1 : 2,
      source: 'aog_alert',
      status: 'in_progress',
    };
    const { data: wo, error: woErr } = await publicClient
      .from('work_orders')
      .insert([woInsert])
      .select('id')
      .single();
    if (woErr || !wo) {
      res.status(500).json({
        error: `Failed to create work order: ${woErr?.message ?? 'unknown'}`,
        code: 'WO_CREATE_FAILED',
        statusCode: 500,
      });
      return;
    }

    const { error: linkErr } = await supabase
      .from('aog_alerts')
      .update({ work_order_id: (wo as JsonRecord).id, status: 'in_progress' })
      .eq('tenant_id', tenantId)
      .eq('id', id);
    if (linkErr) {
      res.status(500).json({
        error: `Failed to link work order back: ${linkErr.message}`,
        code: 'AOG_LINK_FAILED',
        statusCode: 500,
      });
      return;
    }

    res.json({
      alert_id: id,
      work_order_id: (wo as JsonRecord).id,
      status: 'in_progress',
    });
  }),
);

// ── POST /amro/aog/alerts/:id/resolve ───────────────────────────────
router.post(
  '/amro/aog/alerts/:id/resolve',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) {
      unauthorized(res);
      return;
    }
    const supabase = getSupabaseAdminClient();
    const tenantId = String(req.tenantId);
    const id = String(req.params.id);
    const payload = (req.body || {}) as JsonRecord;

    const update: JsonRecord = {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: req.userId ?? null,
      resolution_summary: normalizeString(payload.resolution_summary),
    };

    const { data, error } = await supabase
      .from('aog_alerts')
      .update(update)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      res.status(500).json({
        error: `Failed to resolve AOG alert: ${error.message}`,
        code: 'AOG_RESOLVE_FAILED',
        statusCode: 500,
      });
      return;
    }
    if (!data) {
      notFound(res, id);
      return;
    }
    res.json(data);
  }),
);

export default router;
