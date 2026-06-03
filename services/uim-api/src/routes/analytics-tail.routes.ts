// Phase 7 UIM Step 4b.15 — analytics tail routes (reconciliation,
// bi-cube, qa-signoff, sla-evidence).
//
// Carves the last 4 analytics routes from
// src/pages/api/v2/uim/analytics/ into uim-api as a single
// module. All four are small (70-110 LOC) and share dependencies
// on the analytics service + ETL scheduler + qa-signoff store
// already carved in 4b.13/4b.14/this slice.
//
//   GET  /api/v1/uim/analytics/reconciliation
//        5-check readiness scorecard (replay checkpoint, KPI
//        definitions, semantic dictionary, ETL failure-free, ETL
//        completion observed).
//
//   GET  /api/v1/uim/analytics/bi-cube
//        Publishes the BI cube deployment artifact + data
//        dictionary. artifact_hash = SHA256 of the payload so
//        consumers can detect schema changes.
//
//   GET  /api/v1/uim/analytics/qa-signoff
//        Returns latest + full history of QA sign-offs for the
//        caller's tenant/franchise scope.
//   POST /api/v1/uim/analytics/qa-signoff
//        Body: signoff_status, signed_off_by, signed_off_role,
//        checklist booleans, optional notes. Appends a new record.
//
//   GET  /api/v1/uim/analytics/sla-evidence
//        v0.8 Phase 4 exit gate evidence pack (5 checks +
//        readiness_score + status).

import { createHash } from 'node:crypto';
import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';
import {
  computeUimAnalyticsKpis,
  UIM_ANALYTICS_DEFAULT_LOW_STOCK_THRESHOLD,
  UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
  UIM_ANALYTICS_SEMANTIC_DICTIONARY,
} from '../services/analytics.service.js';
import { getUimEtlTelemetrySummary } from '../services/etl-scheduler.js';
import {
  createUimQaSignoffRecord,
  getLatestUimQaSignoffRecord,
  listUimQaSignoffRecords,
} from '../services/qa-signoff-store.js';

const router = Router();

const DEFAULT_DASHBOARD_LATENCY_TARGET_MS = 2200;

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function bad(res: Response, message: string): void {
  res.status(400).json({
    error: message,
    code: 'INVALID_REQUEST',
    statusCode: 400,
  } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function toBody(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object') return input as Record<string, unknown>;
  return {};
}

function readBoolean(value: unknown): boolean {
  return value === true || String(value || '').trim().toLowerCase() === 'true';
}

// ── GET /v1/uim/analytics/reconciliation ────────────────────────────
router.get(
  '/v1/uim/analytics/reconciliation',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    try {
      const supabase = getServiceRoleClient();
      const analytics = await computeUimAnalyticsKpis(
        supabase,
        { tenantId: authReq.tenantId, franchiseId: authReq.franchiseId || null },
        { lowStockThreshold: UIM_ANALYTICS_DEFAULT_LOW_STOCK_THRESHOLD },
      );
      const etlTelemetry = getUimEtlTelemetrySummary({
        tenantId: authReq.tenantId,
        franchiseId: authReq.franchiseId || undefined,
      });

      const checks = [
        {
          key: 'projection_replay_checkpoint',
          label: 'Projection replay checkpoint present',
          passed: Number(analytics.snapshot.replay_version || 0) > 0,
          details: `Replay version ${Number(analytics.snapshot.replay_version || 0)}`,
        },
        {
          key: 'kpi_model_definitions_available',
          label: 'KPI model definitions available',
          passed: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS.length >= 7,
          details: `${UIM_ANALYTICS_KPI_MODEL_DEFINITIONS.length} KPI definitions loaded`,
        },
        {
          key: 'semantic_dictionary_available',
          label: 'BI semantic dictionary available',
          passed:
            UIM_ANALYTICS_SEMANTIC_DICTIONARY.dimensions.length > 0 &&
            UIM_ANALYTICS_SEMANTIC_DICTIONARY.measures.length > 0,
          details: `${UIM_ANALYTICS_SEMANTIC_DICTIONARY.dimensions.length} dimensions, ${UIM_ANALYTICS_SEMANTIC_DICTIONARY.measures.length} measures`,
        },
        {
          key: 'etl_failure_clear',
          label: 'ETL failure queue clear',
          passed: Number(etlTelemetry.failed_runs || 0) === 0,
          details: `Failed runs ${Number(etlTelemetry.failed_runs || 0)}`,
        },
        {
          key: 'etl_completed_run_seen',
          label: 'At least one ETL completion observed',
          passed: Number(etlTelemetry.completed_runs || 0) > 0,
          details: `Completed runs ${Number(etlTelemetry.completed_runs || 0)}`,
        },
      ];
      const passedCount = checks.filter((item) => item.passed).length;
      const score = Math.round((passedCount / checks.length) * 100);
      const status = passedCount === checks.length ? 'ready' : 'pending';

      return res.status(200).json({
        version: 'v1',
        interface: 'uim-analytics-reconciliation',
        output: {
          tenant_id: authReq.tenantId,
          franchise_id: authReq.franchiseId || null,
          readiness: { status, score, checks },
          snapshot: {
            replay_version: Number(analytics.snapshot.replay_version || 0),
            generated_at: analytics.snapshot.generated_at,
            etl_completed_runs: Number(etlTelemetry.completed_runs || 0),
            etl_failed_runs: Number(etlTelemetry.failed_runs || 0),
          },
        },
      });
    } catch (err) {
      logger.error('uim.analytics.reconciliation error', { error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to compute reconciliation',
        code: 'UIM_ANALYTICS_RECONCILIATION_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

// ── GET /v1/uim/analytics/bi-cube ───────────────────────────────────
router.get(
  '/v1/uim/analytics/bi-cube',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const artifactPayload = {
      cube: UIM_ANALYTICS_SEMANTIC_DICTIONARY,
      kpi_model_definitions: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
      generated_at: new Date().toISOString(),
    };
    const artifactHash = createHash('sha256').update(JSON.stringify(artifactPayload)).digest('hex');

    return res.status(200).json({
      version: 'v1',
      interface: 'uim-analytics-bi-cube',
      output: {
        tenant_id: authReq.tenantId,
        franchise_id: authReq.franchiseId || null,
        deployment_artifact: {
          artifact_id: `uim-bi-cube-${artifactHash.slice(0, 12)}`,
          artifact_hash: artifactHash,
          artifact_version: UIM_ANALYTICS_SEMANTIC_DICTIONARY.version,
          published_at: artifactPayload.generated_at,
          deployment_target: 'uim_inventory_analytics_cube',
        },
        data_dictionary: {
          cube_name: UIM_ANALYTICS_SEMANTIC_DICTIONARY.cube_name,
          dimensions: UIM_ANALYTICS_SEMANTIC_DICTIONARY.dimensions,
          measures: UIM_ANALYTICS_SEMANTIC_DICTIONARY.measures,
          kpi_model_definitions: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
          publication_status: 'published',
        },
      },
    });
  }),
);

// ── GET /v1/uim/analytics/qa-signoff ────────────────────────────────
router.get(
  '/v1/uim/analytics/qa-signoff',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const records = listUimQaSignoffRecords(authReq.tenantId, authReq.franchiseId || null);
    const latest = getLatestUimQaSignoffRecord(authReq.tenantId, authReq.franchiseId || null);

    return res.status(200).json({
      version: 'v1',
      interface: 'uim-analytics-qa-signoff',
      output: {
        tenant_id: authReq.tenantId,
        franchise_id: authReq.franchiseId || null,
        latest,
        records,
      },
    });
  }),
);

// ── POST /v1/uim/analytics/qa-signoff ───────────────────────────────
router.post(
  '/v1/uim/analytics/qa-signoff',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const body = toBody(req.body);
    const signedOffBy = String(body.signed_off_by || '').trim();
    if (!signedOffBy) return bad(res, 'signed_off_by is required');
    const signedOffRole = String(body.signed_off_role || '').trim();
    if (!signedOffRole) return bad(res, 'signed_off_role is required');

    const signoff = createUimQaSignoffRecord({
      tenant_id: authReq.tenantId,
      franchise_id: authReq.franchiseId || null,
      signoff_status:
        String(body.signoff_status || '').trim().toLowerCase() === 'revoked'
          ? 'revoked'
          : 'signed_off',
      signed_off_by: signedOffBy,
      signed_off_role: signedOffRole,
      checklist: {
        reconciliation_verified: readBoolean(body.reconciliation_verified),
        latency_target_met: readBoolean(body.latency_target_met),
        data_dictionary_published: readBoolean(body.data_dictionary_published),
        bi_cube_deployed: readBoolean(body.bi_cube_deployed),
      },
      notes: String(body.notes || ''),
    });

    return res.status(200).json({
      version: 'v1',
      interface: 'uim-analytics-qa-signoff',
      output: {
        tenant_id: authReq.tenantId,
        franchise_id: authReq.franchiseId || null,
        signoff,
      },
    });
  }),
);

// ── GET /v1/uim/analytics/sla-evidence ──────────────────────────────
router.get(
  '/v1/uim/analytics/sla-evidence',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    try {
      const supabase = getServiceRoleClient();
      const analytics = await computeUimAnalyticsKpis(
        supabase,
        { tenantId: authReq.tenantId, franchiseId: authReq.franchiseId || null },
        { lowStockThreshold: UIM_ANALYTICS_DEFAULT_LOW_STOCK_THRESHOLD },
      );
      const etlTelemetry = getUimEtlTelemetrySummary({
        tenantId: authReq.tenantId,
        franchiseId: authReq.franchiseId || undefined,
      });
      const signoff = getLatestUimQaSignoffRecord(authReq.tenantId, authReq.franchiseId || null);
      const latencyTarget = Number(
        process.env.UIM_ANALYTICS_DASHBOARD_LATENCY_TARGET_MS || DEFAULT_DASHBOARD_LATENCY_TARGET_MS,
      );

      const evidenceChecks = [
        {
          key: 'kpi_model_complete',
          passed: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS.length >= 7,
          details: `${UIM_ANALYTICS_KPI_MODEL_DEFINITIONS.length} KPI definitions`,
        },
        {
          key: 'semantic_dictionary_complete',
          passed:
            UIM_ANALYTICS_SEMANTIC_DICTIONARY.dimensions.length > 0 &&
            UIM_ANALYTICS_SEMANTIC_DICTIONARY.measures.length > 0,
          details: `${UIM_ANALYTICS_SEMANTIC_DICTIONARY.dimensions.length} dimensions and ${UIM_ANALYTICS_SEMANTIC_DICTIONARY.measures.length} measures`,
        },
        {
          key: 'etl_failures_clear',
          passed: Number(etlTelemetry.failed_runs || 0) === 0,
          details: `failed_runs=${Number(etlTelemetry.failed_runs || 0)}`,
        },
        {
          key: 'qa_signoff_present',
          passed: Boolean(signoff && signoff.signoff_status === 'signed_off'),
          details: signoff ? `latest_signoff=${signoff.signoff_status}` : 'latest_signoff=none',
        },
        {
          key: 'replay_checkpoint_present',
          passed: Number(analytics.snapshot.replay_version || 0) > 0,
          details: `replay_version=${Number(analytics.snapshot.replay_version || 0)}`,
        },
      ];
      const passCount = evidenceChecks.filter((item) => item.passed).length;
      const readinessScore = Math.round((passCount / evidenceChecks.length) * 100);

      return res.status(200).json({
        version: 'v1',
        interface: 'uim-analytics-sla-evidence',
        output: {
          tenant_id: authReq.tenantId,
          franchise_id: authReq.franchiseId || null,
          gate: 'v0.8-phase-4-exit',
          generated_at: new Date().toISOString(),
          performance_targets: {
            dashboard_latency_target_ms:
              Number.isFinite(latencyTarget) && latencyTarget > 0
                ? Math.floor(latencyTarget)
                : DEFAULT_DASHBOARD_LATENCY_TARGET_MS,
          },
          evidence_checks: evidenceChecks,
          readiness_score: readinessScore,
          status: readinessScore === 100 ? 'ready' : 'pending',
        },
      });
    } catch (err) {
      logger.error('uim.analytics.sla-evidence error', { error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to compute SLA evidence',
        code: 'UIM_ANALYTICS_SLA_EVIDENCE_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
