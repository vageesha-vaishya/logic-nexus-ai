/**
 * Directive Applicability REST routes.
 *
 * Per docs/plans/2026-06-04-directive-applicability-surface-design.md
 * slice S2. Backs the AmroDirectiveDetailPage applicability tab +
 * aircraft-side directive list + human review queue.
 *
 * Endpoints shipped in S2:
 *   GET   /amro/directives/:directiveId/applicability     verdicts for one directive
 *   GET   /amro/aircraft/:aircraftId/applicability        verdicts for one aircraft
 *   POST  /amro/directives/applicability/check            single LLM call + persist
 *   POST  /amro/directives/applicability/batch            sync fan-out (cap 20 pairs)
 *   GET   /amro/directives/applicability/queue            human review queue
 *   PATCH /amro/directives/applicability/:verdictId       accept/override/snooze
 *
 * Deferred to S3 (needs BullMQ — not yet in amro-api deps):
 *   POST  /amro/directives/:directiveId/applicability/batch     directive × fleet
 *   POST  /amro/aircraft/:aircraftId/applicability/batch        every directive × aircraft
 *
 * Both deferred endpoints are batch-eval triggers that fan-out 30-400
 * LLM calls — would time out in a single HTTP request. The /batch
 * endpoint below accepts an explicit pair list (cap 20) and is
 * synchronous: useful for ad-hoc verification but NOT for fleet-wide
 * rerun.
 *
 * Auth: standard auth middleware (req.tenantId required).
 */

import { Router } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

type JsonRecord = Record<string, unknown>;

const router = Router();

function getAmroClient(): SupabaseClient {
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
    db: { schema: 'amro' as 'public' },
  });
}

function getPublicClient(): SupabaseClient {
  const url = String(process.env.AMRO_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = String(
    process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '',
  ).trim();
  return createClient(url, serviceKey);
}

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

const VALID_STATUS = new Set([
  'awaiting_review', 'accepted', 'overridden', 'superseded', 'obsolete',
]);

// ── GET /amro/directives/:directiveId/applicability ─────────────────
router.get(
  '/amro/directives/:directiveId/applicability',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) { unauthorized(res); return; }
    const supabase = getAmroClient();
    const tenantId = String(req.tenantId);
    const directiveId = String(req.params.directiveId);
    const status = String(req.query.status || '').trim();

    let query = supabase
      .from('directive_applicability')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('directive_id', directiveId)
      .order('created_at', { ascending: false });

    if (status && VALID_STATUS.has(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({
        error: `Failed to list applicability verdicts: ${error.message}`,
        code: 'APPLICABILITY_LIST_FAILED',
        statusCode: 500,
      });
      return;
    }
    res.json({ records: data ?? [], total: (data ?? []).length });
  }),
);

// ── GET /amro/aircraft/:aircraftId/applicability ────────────────────
router.get(
  '/amro/aircraft/:aircraftId/applicability',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) { unauthorized(res); return; }
    const supabase = getAmroClient();
    const tenantId = String(req.tenantId);
    const aircraftId = String(req.params.aircraftId);
    const status = String(req.query.status || '').trim();

    let query = supabase
      .from('directive_applicability')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('aircraft_id', aircraftId)
      .order('created_at', { ascending: false });

    if (status && VALID_STATUS.has(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({
        error: `Failed to list applicability verdicts: ${error.message}`,
        code: 'APPLICABILITY_LIST_FAILED',
        statusCode: 500,
      });
      return;
    }
    res.json({ records: data ?? [], total: (data ?? []).length });
  }),
);

// ── GET /amro/directives/applicability/queue ────────────────────────
// Human review queue: awaiting_review + optional confidence ceiling.
router.get(
  '/amro/directives/applicability/queue',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) { unauthorized(res); return; }
    const supabase = getAmroClient();
    const tenantId = String(req.tenantId);
    const maxConfidence = Number(req.query.max_confidence);
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    let query = supabase
      .from('directive_applicability')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'awaiting_review')
      .order('confidence', { ascending: true })  // lowest confidence first
      .order('created_at', { ascending: false })
      .limit(limit);

    if (Number.isFinite(maxConfidence) && maxConfidence >= 0 && maxConfidence <= 1) {
      query = query.lte('confidence', maxConfidence);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({
        error: `Failed to load review queue: ${error.message}`,
        code: 'APPLICABILITY_QUEUE_FAILED',
        statusCode: 500,
      });
      return;
    }
    res.json({ records: data ?? [], total: (data ?? []).length });
  }),
);

// ── Helper: load directive + aircraft, build LLM input ──────────────
async function buildLlmInput(
  publicClient: SupabaseClient,
  directiveId: string,
  aircraftId: string,
): Promise<{ input: JsonRecord; directiveSnapshot: JsonRecord; aircraftSnapshot: JsonRecord } | { error: string }> {
  const { data: directive, error: dErr } = await publicClient
    .from('directives')
    .select('id, directive_no, code_form_no, description, ata_code, applicability, method_of_compliance, effective_date, issuing_authority, kind, relevant_ata_chapters')
    .eq('id', directiveId)
    .maybeSingle();
  if (dErr) return { error: `Failed to load directive: ${dErr.message}` };
  if (!directive) return { error: `Directive ${directiveId} not found` };

  const { data: aircraft, error: aErr } = await publicClient
    .from('aircraft')
    .select('id, registration, manufacturer, model, serial_number')
    .eq('id', aircraftId)
    .maybeSingle();
  if (aErr) return { error: `Failed to load aircraft: ${aErr.message}` };
  if (!aircraft) return { error: `Aircraft ${aircraftId} not found` };

  const d = directive as JsonRecord;
  const a = aircraft as JsonRecord;

  const input = {
    directive: {
      issuing_authority: String(d.issuing_authority ?? 'OTHER'),
      directive_id: String(d.directive_no ?? d.code_form_no ?? d.id ?? ''),
      kind: String(d.kind ?? 'OTHER'),
      title: String(d.description ?? ''),
      effective_date: String(d.effective_date ?? ''),
      applies_to: String(d.applicability ?? ''),
      compliance_action: String(d.method_of_compliance ?? ''),
      relevant_ata_chapters: Array.isArray(d.relevant_ata_chapters)
        ? d.relevant_ata_chapters
        : (typeof d.ata_code === 'string' && d.ata_code ? [d.ata_code] : []),
    },
    aircraft: {
      manufacturer: String(a.manufacturer ?? 'Unknown'),
      model: String(a.model ?? 'Unknown'),
      serial_number: String(a.serial_number ?? 'Unknown'),
      registration: String(a.registration ?? 'Unknown'),
      engines: [],
      configurations: [],
      hours_since_new: null,
      cycles_since_new: null,
    },
  };

  return {
    input,
    directiveSnapshot: d,
    aircraftSnapshot: a,
  };
}

// ── POST /amro/directives/applicability/check ───────────────────────
// Single (directive × aircraft) → LLM → persist verdict.
router.post(
  '/amro/directives/applicability/check',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) { unauthorized(res); return; }
    const tenantId = String(req.tenantId);
    const payload = (req.body || {}) as JsonRecord;
    const directiveId = String(payload.directive_id ?? '').trim();
    const aircraftId = String(payload.aircraft_id ?? '').trim();
    if (!directiveId || !aircraftId) {
      badRequest(res, 'directive_id and aircraft_id required');
      return;
    }

    const publicClient = getPublicClient();
    const built = await buildLlmInput(publicClient, directiveId, aircraftId);
    if ('error' in built) {
      badRequest(res, built.error);
      return;
    }

    // Invoke Edge Function
    const fnUrl = `${String(process.env.AMRO_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1/llm-directive-applicability`;
    const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const callRes = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: `Bearer ${authHeader}` } : {}),
      },
      body: JSON.stringify(built.input),
    });
    const llmBody = await callRes.json().catch(() => ({}));
    if (!callRes.ok) {
      res.status(callRes.status).json({
        error: 'Directive applicability LLM call failed',
        code: 'APPLICABILITY_LLM_FAILED',
        details: llmBody,
        statusCode: callRes.status,
      });
      return;
    }

    const result = llmBody as {
      invocation_id?: string;
      output?: JsonRecord;
    };
    const output = (result.output ?? {}) as JsonRecord;

    // Persist verdict
    const amro = getAmroClient();
    const insertRow: JsonRecord = {
      tenant_id: tenantId,
      directive_id: directiveId,
      aircraft_id: aircraftId,
      applies: Boolean(output.applies),
      confidence: Number(output.confidence ?? 0),
      reasoning: typeof output.reasoning === 'string' ? output.reasoning : null,
      matched_criteria: Array.isArray(output.matched_criteria) ? output.matched_criteria : [],
      unmatched_criteria: Array.isArray(output.unmatched_criteria) ? output.unmatched_criteria : [],
      ata_chapters_touched: Array.isArray(output.ata_chapters_touched) ? output.ata_chapters_touched : [],
      recommended_followup: typeof output.recommended_followup === 'string' ? output.recommended_followup : null,
      invocation_id: result.invocation_id ?? null,
      llm_model: typeof output.model === 'string' ? output.model : null,
      aircraft_snapshot_jsonb: built.aircraftSnapshot,
      directive_snapshot_jsonb: built.directiveSnapshot,
      status: 'awaiting_review',
    };

    const { data: verdict, error: insertErr } = await amro
      .from('directive_applicability')
      .insert([insertRow])
      .select()
      .single();

    if (insertErr) {
      res.status(500).json({
        error: `Failed to persist verdict: ${insertErr.message}`,
        code: 'APPLICABILITY_PERSIST_FAILED',
        statusCode: 500,
      });
      return;
    }

    res.json({
      verdict,
      invocation_id: result.invocation_id,
    });
  }),
);

// ── POST /amro/directives/applicability/batch ───────────────────────
// Synchronous fan-out for up to 20 (directive_id, aircraft_id) pairs.
// Useful for ad-hoc operator verification. Fleet-wide batches need
// the deferred S3 BullMQ worker.
router.post(
  '/amro/directives/applicability/batch',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) { unauthorized(res); return; }
    const tenantId = String(req.tenantId);
    const payload = (req.body || {}) as JsonRecord;
    const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
    if (pairs.length === 0) {
      badRequest(res, 'pairs array required (1-20 entries of {directive_id, aircraft_id})');
      return;
    }
    if (pairs.length > 20) {
      badRequest(res, `pairs limited to 20 per request (got ${pairs.length}); use the (TODO) S3 batch worker for fleet-wide eval`);
      return;
    }

    const publicClient = getPublicClient();
    const amro = getAmroClient();
    const fnUrl = `${String(process.env.AMRO_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1/llm-directive-applicability`;
    const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

    const results: Array<{
      directive_id: string;
      aircraft_id: string;
      verdict?: JsonRecord;
      invocation_id?: string;
      error?: string;
    }> = [];

    for (const raw of pairs as JsonRecord[]) {
      const directiveId = String((raw as JsonRecord).directive_id ?? '').trim();
      const aircraftId = String((raw as JsonRecord).aircraft_id ?? '').trim();
      if (!directiveId || !aircraftId) {
        results.push({
          directive_id: directiveId,
          aircraft_id: aircraftId,
          error: 'directive_id and aircraft_id required',
        });
        continue;
      }
      const built = await buildLlmInput(publicClient, directiveId, aircraftId);
      if ('error' in built) {
        results.push({ directive_id: directiveId, aircraft_id: aircraftId, error: built.error });
        continue;
      }
      const callRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: `Bearer ${authHeader}` } : {}),
        },
        body: JSON.stringify(built.input),
      });
      const llmBody = await callRes.json().catch(() => ({}));
      if (!callRes.ok) {
        results.push({
          directive_id: directiveId,
          aircraft_id: aircraftId,
          error: (llmBody as { error?: { message?: string } })?.error?.message ?? 'LLM call failed',
        });
        continue;
      }
      const result = llmBody as { invocation_id?: string; output?: JsonRecord };
      const output = (result.output ?? {}) as JsonRecord;

      const { data: verdict, error: insertErr } = await amro
        .from('directive_applicability')
        .insert([{
          tenant_id: tenantId,
          directive_id: directiveId,
          aircraft_id: aircraftId,
          applies: Boolean(output.applies),
          confidence: Number(output.confidence ?? 0),
          reasoning: typeof output.reasoning === 'string' ? output.reasoning : null,
          matched_criteria: Array.isArray(output.matched_criteria) ? output.matched_criteria : [],
          unmatched_criteria: Array.isArray(output.unmatched_criteria) ? output.unmatched_criteria : [],
          ata_chapters_touched: Array.isArray(output.ata_chapters_touched) ? output.ata_chapters_touched : [],
          recommended_followup: typeof output.recommended_followup === 'string' ? output.recommended_followup : null,
          invocation_id: result.invocation_id ?? null,
          aircraft_snapshot_jsonb: built.aircraftSnapshot,
          directive_snapshot_jsonb: built.directiveSnapshot,
          status: 'awaiting_review',
        }])
        .select()
        .single();

      if (insertErr) {
        results.push({
          directive_id: directiveId,
          aircraft_id: aircraftId,
          error: insertErr.message,
        });
        continue;
      }
      results.push({
        directive_id: directiveId,
        aircraft_id: aircraftId,
        verdict: verdict as JsonRecord,
        invocation_id: result.invocation_id,
      });
    }

    const success = results.filter((r) => !r.error).length;
    res.json({
      results,
      total: results.length,
      success,
      failed: results.length - success,
    });
  }),
);

// ── PATCH /amro/directives/applicability/:verdictId ─────────────────
// Accept / override / snooze. Override REQUIRES human_override_reason.
router.patch(
  '/amro/directives/applicability/:verdictId',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) { unauthorized(res); return; }
    const supabase = getAmroClient();
    const tenantId = String(req.tenantId);
    const verdictId = String(req.params.verdictId);
    const payload = (req.body || {}) as JsonRecord;

    const action = String(payload.action ?? '').trim();
    if (!['accept', 'override', 'snooze'].includes(action)) {
      badRequest(res, "action must be 'accept' | 'override' | 'snooze'");
      return;
    }

    const update: JsonRecord = {
      human_reviewer_id: req.userId ?? null,
      human_review_at: new Date().toISOString(),
    };

    if (action === 'accept') {
      update.status = 'accepted';
    } else if (action === 'override') {
      const reason = typeof payload.human_override_reason === 'string'
        ? payload.human_override_reason.trim()
        : '';
      if (!reason) {
        badRequest(res, 'human_override_reason required when action=override');
        return;
      }
      update.status = 'overridden';
      update.human_override_reason = reason;
      // Override may also flip the applies verdict — accept boolean in payload.
      if (typeof payload.applies === 'boolean') {
        update.applies = payload.applies;
      }
    } else {
      // snooze: leave status awaiting_review, but stamp reviewer so
      // queue ordering reflects "someone's looking at this".
      update.status = 'awaiting_review';
    }

    const { data, error } = await supabase
      .from('directive_applicability')
      .update(update)
      .eq('tenant_id', tenantId)
      .eq('id', verdictId)
      .select()
      .single();

    if (error) {
      res.status(500).json({
        error: `Failed to update verdict: ${error.message}`,
        code: 'APPLICABILITY_UPDATE_FAILED',
        statusCode: 500,
      });
      return;
    }
    if (!data) {
      res.status(404).json({
        error: `Verdict ${verdictId} not found`,
        code: 'APPLICABILITY_NOT_FOUND',
        statusCode: 404,
      });
      return;
    }
    res.json(data);
  }),
);

export default router;
