/**
 * AMRO Enterprise Compliance API
 * 
 * Provides enterprise-grade compliance and regulatory management functionality including:
 * - AD/SB feed integration and retrieval
 * - Compliance applicability checking
 * - Digital sign-off workflow
 * - Fleet-wide compliance status
 * - Compliance reporting and exports
 * - Audit trail management
 * 
 * @module pages/api/v2/amro/compliance-enterprise
 */

import type { ApiRequest, ApiResponse } from '../_utils/types';
import { applyCors, authenticateRequest, handlePreflight } from '../_utils/http';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function sendJson(res: ApiResponse, status: number, data: unknown) {
  res.status(status).json(data);
}

function sendError(res: ApiResponse, status: number, error: string, details?: unknown) {
  res.status(status).json({
    error,
    status,
    details,
    timestamp: new Date().toISOString(),
  });
}

function generateSignatureHash(data: object): string {
  const dataString = JSON.stringify(data);
  return createHash('sha256').update(dataString).digest('hex');
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * GET /api/v2/amro/compliance-enterprise/ad-sb-feed
 * Get AD/SB regulatory feed
 */
async function handleADSBFeed(req: ApiRequest, res: ApiResponse, tenantId: string) {
  try {
    const { directive_type, regulatory_authority, applicable_only } = req.query || {};

    const supabase = getSupabaseAdminClient();

    let supabaseQuery = supabase
      .from('amro_compliance_ad_sb_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('compliance_deadline', { ascending: true });

    // Filters
    if (directive_type) {
      supabaseQuery = supabaseQuery.eq('directive_type', directive_type);
    }
    if (regulatory_authority) {
      supabaseQuery = supabaseQuery.eq('regulatory_authority', regulatory_authority);
    }
    if (applicable_only === 'true') {
      supabaseQuery = supabaseQuery.eq('applicable_to_fleet', true);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      logger.error('[Compliance API] AD/SB feed failed', { error, tenantId });
      return sendError(res, 500, 'Failed to retrieve AD/SB feed', error.message);
    }

    return sendJson(res, 200, {
      total: data?.length || 0,
      directives: data || [],
      last_updated: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[Compliance API] Unexpected error in AD/SB feed', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * POST /api/v2/amro/compliance-enterprise/:id/applicability
 * Check compliance applicability against fleet
 */
async function handleApplicability(req: ApiRequest, res: ApiResponse, tenantId: string, requirementId: string) {
  try {
    const { aircraft_model, engine_model, component_ata } = req.body || {};

    const supabase = getSupabaseAdminClient();

    // Get compliance requirement
    const { data: requirement, error: reqError } = await supabase
      .from('amro_compliance_requirements_enhanced')
      .select('*')
      .eq('id', requirementId)
      .eq('tenant_id', tenantId)
      .single();

    if (reqError || !requirement) {
      return sendError(res, 404, 'Compliance requirement not found');
    }

    // Check applicability
    const isApplicable = 
      (!aircraft_model || requirement.aircraft_model === aircraft_model) &&
      (!engine_model || !requirement.engine_model || requirement.engine_model === engine_model) &&
      (!component_ata || !requirement.component_ata || requirement.component_ata === component_ata);

    // Get affected aircraft if applicable
    let affectedAircraft: any[] = [];
    if (isApplicable && aircraft_model) {
      const { data: aircraft } = await supabase
        .from('aircraft')
        .select('id,registration,model,status')
        .eq('tenant_id', tenantId)
        .eq('model', aircraft_model)
        .eq('status', 'active');

      affectedAircraft = aircraft || [];
    }

    return sendJson(res, 200, {
      requirement_id: requirementId,
      directive_number: requirement.directive_number,
      is_applicable: isApplicable,
      affected_aircraft_count: affectedAircraft.length,
      affected_aircraft: affectedAircraft,
      reason: isApplicable ? 'Matches specified criteria' : 'Does not match applicability criteria',
    });
  } catch (err: any) {
    logger.error('[Compliance API] Unexpected error in applicability', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * POST /api/v2/amro/compliance-enterprise/:id/sign-off
 * Digital sign-off for compliance requirement
 */
async function handleSignOff(req: ApiRequest, res: ApiResponse, tenantId: string, requirementId: string, userId: string) {
  try {
    const {
      compliance_date,
      complied_method,
      compliance_reference,
      digital_signature,
      notes,
    } = req.body || {};

    if (!compliance_date || !digital_signature || !digital_signature.certifying_staff_id || !digital_signature.license_number) {
      return sendError(res, 400, 'Missing required fields', 'compliance_date and digital_signature with certifying_staff_id and license_number are required');
    }

    const supabase = getSupabaseAdminClient();

    // Get current state for audit trail
    const { data: currentRequirement, error: fetchError } = await supabase
      .from('amro_compliance_requirements_enhanced')
      .select('*')
      .eq('id', requirementId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !currentRequirement) {
      return sendError(res, 404, 'Compliance requirement not found');
    }

    // Generate cryptographic hash for signature
    const signatureHash = generateSignatureHash({
      requirement_id: requirementId,
      compliance_date,
      signed_by: userId,
      certifying_staff_id: digital_signature.certifying_staff_id,
      license_number: digital_signature.license_number,
      timestamp: new Date().toISOString(),
    });

    const digitalSignaturePayload = {
      signed_by: userId,
      signed_date: new Date().toISOString(),
      signature_hash: signatureHash,
      certifying_staff_id: digital_signature.certifying_staff_id,
      license_number: digital_signature.license_number,
      license_type: digital_signature.license_type,
      license_expiry: digital_signature.license_expiry,
      organization: digital_signature.organization,
    };

    // Update compliance requirement
    const { data: updatedRequirement, error: updateError } = await supabase
      .from('amro_compliance_requirements_enhanced')
      .update({
        compliance_status: 'complied',
        compliance_date: new Date(compliance_date),
        complied_by: userId,
        complied_method,
        compliance_reference,
        digital_signature: digitalSignaturePayload,
        updated_by: userId,
      })
      .eq('id', requirementId)
      .select()
      .single();

    if (updateError) {
      logger.error('[Compliance API] Failed to sign off', { error: updateError });
      return sendError(res, 500, 'Failed to sign off compliance', updateError.message);
    }

    // Create audit trail entry
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: 'compliance_signed_off',
      performed_by: userId,
      reason: notes || 'Compliance sign-off completed',
      before_state: {
        compliance_status: currentRequirement.compliance_status,
        compliance_date: currentRequirement.compliance_date,
      },
      after_state: {
        compliance_status: 'complied',
        compliance_date,
        signature_hash: signatureHash,
      },
      ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    };

    await supabase
      .from('amro_compliance_audit_trail')
      .insert({
        tenant_id: tenantId,
        compliance_requirement_id: requirementId,
        ...auditEntry,
      });

    logger.info('[Compliance API] Compliance signed off', {
      requirementId,
      userId,
      signatureHash: signatureHash.substring(0, 16) + '...',
    });

    return sendJson(res, 200, {
      message: 'Compliance signed off successfully',
      compliance_requirement: updatedRequirement,
      signature_hash: signatureHash,
    });
  } catch (err: any) {
    logger.error('[Compliance API] Unexpected error in sign-off', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * GET /api/v2/amro/compliance-enterprise/fleet-status
 * Get fleet-wide compliance status
 */
async function handleFleetStatus(req: ApiRequest, res: ApiResponse, tenantId: string) {
  try {
    const { regulatory_authority, aircraft_model } = req.query || {};

    const supabase = getSupabaseAdminClient();

    let supabaseQuery = supabase
      .from('amro_compliance_requirements_enhanced')
      .select('*')
      .eq('tenant_id', tenantId);

    if (regulatory_authority) {
      supabaseQuery = supabaseQuery.eq('regulatory_authority', regulatory_authority);
    }
    if (aircraft_model) {
      supabaseQuery = supabaseQuery.eq('aircraft_model', aircraft_model);
    }

    const { data: requirements, error } = await supabaseQuery;

    if (error) {
      logger.error('[Compliance API] Fleet status failed', { error });
      return sendError(res, 500, 'Failed to retrieve fleet status', error.message);
    }

    // Calculate fleet compliance statistics
    const totalRequirements = requirements?.length || 0;
    const complied = requirements?.filter((r) => r.compliance_status === 'complied').length || 0;
    const inProgress = requirements?.filter((r) => r.compliance_status === 'in_progress').length || 0;
    const notStarted = requirements?.filter((r) => r.compliance_status === 'not_started').length || 0;
    const exempted = requirements?.filter((r) => r.compliance_status === 'exempted').length || 0;

    const now = new Date();
    const overdue = requirements?.filter((r) => {
      if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
      return new Date(r.compliance_deadline) < now;
    }).length || 0;

    const compliancePercentage = totalRequirements > 0 ? (complied / totalRequirements) * 100 : 0;

    // Requirements by authority
    const requirementsByAuthority: Record<string, number> = {};
    requirements?.forEach((r) => {
      const authority = r.regulatory_authority;
      if (!requirementsByAuthority[authority]) requirementsByAuthority[authority] = 0;
      requirementsByAuthority[authority]++;
    });

    // Requirements by severity
    const requirementsBySeverity: Record<string, number> = {};
    requirements?.forEach((r) => {
      const severity = r.severity_level;
      if (!requirementsBySeverity[severity]) requirementsBySeverity[severity] = 0;
      requirementsBySeverity[severity]++;
    });

    // Upcoming deadlines (next 90 days)
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = requirements
      ?.filter((r) => {
        if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
        const deadline = new Date(r.compliance_deadline);
        return deadline >= now && deadline <= ninetyDays;
      })
      .map((r) => ({
        requirement_code: r.requirement_code,
        directive_number: r.directive_number,
        compliance_deadline: r.compliance_deadline,
        days_remaining: Math.ceil((new Date(r.compliance_deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        severity_level: r.severity_level,
        aircraft_model: r.aircraft_model,
      }))
      .sort((a, b) => a.days_remaining - b.days_remaining)
      .slice(0, 20);

    return sendJson(res, 200, {
      total_requirements: totalRequirements,
      complied,
      in_progress: inProgress,
      not_started: notStarted,
      overdue,
      exempted,
      compliance_percentage: Math.round(compliancePercentage * 100) / 100,
      requirements_by_authority: requirementsByAuthority,
      requirements_by_severity: requirementsBySeverity,
      upcoming_deadlines: upcomingDeadlines,
    });
  } catch (err: any) {
    logger.error('[Compliance API] Unexpected error in fleet status', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * POST /api/v2/amro/compliance-enterprise/export-report
 * Export compliance report
 */
async function handleExportReport(req: ApiRequest, res: ApiResponse, tenantId: string, userId: string) {
  try {
    const {
      report_type = 'fleet_status',
      date_range,
      format = 'json',
      authority,
      aircraft_model,
    } = req.body || {};

    const supabase = getSupabaseAdminClient();

    let supabaseQuery = supabase
      .from('amro_compliance_requirements_enhanced')
      .select('*')
      .eq('tenant_id', tenantId);

    if (authority) {
      supabaseQuery = supabaseQuery.eq('regulatory_authority', authority);
    }
    if (aircraft_model) {
      supabaseQuery = supabaseQuery.eq('aircraft_model', aircraft_model);
    }
    if (date_range?.start && date_range?.end) {
      supabaseQuery = supabaseQuery
        .gte('compliance_deadline', date_range.start)
        .lte('compliance_deadline', date_range.end);
    }

    const { data: requirements, error } = await supabaseQuery;

    if (error) {
      logger.error('[Compliance API] Export report failed', { error });
      return sendError(res, 500, 'Failed to export report', error.message);
    }

    const report = {
      report_id: `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      generated_at: new Date().toISOString(),
      generated_by: userId,
      report_type,
      date_range,
      data: requirements,
      format,
    };

    logger.info('[Compliance API] Report exported', {
      reportId: report.report_id,
      reportType: report_type,
      userId,
    });

    return sendJson(res, 200, {
      message: 'Report exported successfully',
      report,
    });
  } catch (err: any) {
    logger.error('[Compliance API] Unexpected error in export report', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

/**
 * GET /api/v2/amro/compliance-enterprise/analytics
 * Get compliance analytics dashboard data
 */
async function handleAnalytics(req: ApiRequest, res: ApiResponse, tenantId: string) {
  try {
    const supabase = getSupabaseAdminClient();

    // Get all compliance requirements for tenant
    const { data: requirements, error } = await supabase
      .from('amro_compliance_requirements_enhanced')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      logger.error('[Compliance API] Analytics failed', { error });
      return sendError(res, 500, 'Failed to retrieve analytics', error.message);
    }

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Calculate analytics
    const totalRequirements = requirements?.length || 0;
    const complied = requirements?.filter((r) => r.compliance_status === 'complied').length || 0;
    const overdue = requirements?.filter((r) => {
      if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
      return new Date(r.compliance_deadline) < now;
    }).length || 0;

    const due30Days = requirements?.filter((r) => {
      if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
      const deadline = new Date(r.compliance_deadline);
      return deadline >= now && deadline <= thirtyDays;
    }).length || 0;

    const due60Days = requirements?.filter((r) => {
      if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
      const deadline = new Date(r.compliance_deadline);
      return deadline > thirtyDays && deadline <= sixtyDays;
    }).length || 0;

    const due90Days = requirements?.filter((r) => {
      if (r.compliance_status === 'complied' || r.compliance_status === 'exempted') return false;
      const deadline = new Date(r.compliance_deadline);
      return deadline > sixtyDays && deadline <= ninetyDays;
    }).length || 0;

    const fleetCompliancePercentage = totalRequirements > 0 ? (complied / totalRequirements) * 100 : 0;

    // Requirements by type
    const requirementsByType: Record<string, number> = {};
    requirements?.forEach((r) => {
      const type = r.requirement_type;
      if (!requirementsByType[type]) requirementsByType[type] = 0;
      requirementsByType[type]++;
    });

    // Requirements by authority
    const requirementsByAuthority: Record<string, number> = {};
    requirements?.forEach((r) => {
      const authority = r.regulatory_authority;
      if (!requirementsByAuthority[authority]) requirementsByAuthority[authority] = 0;
      requirementsByAuthority[authority]++;
    });

    // Requirements by severity
    const requirementsBySeverity: Record<string, number> = {};
    requirements?.forEach((r) => {
      const severity = r.severity_level;
      if (!requirementsBySeverity[severity]) requirementsBySeverity[severity] = 0;
      requirementsBySeverity[severity]++;
    });

    // Cost of compliance
    const costOfCompliance = requirements?.reduce((sum, r) => {
      return sum + (Number(r.estimated_material_cost) || 0) + (Number(r.estimated_labor_hours) || 0) * 100; // Assuming $100/hr labor
    }, 0) || 0;

    // Active exemptions
    const exemptionsActive = requirements?.filter((r) => r.exemption_info?.exemption_granted).length || 0;

    return sendJson(res, 200, {
      fleet_compliance_percentage: Math.round(fleetCompliancePercentage * 100) / 100,
      overdue_requirements: overdue,
      due_30_days: due30Days,
      due_60_days: due60Days,
      due_90_days: due90Days,
      requirements_by_type: requirementsByType,
      requirements_by_authority: requirementsByAuthority,
      requirements_by_severity: requirementsBySeverity,
      cost_of_compliance: costOfCompliance,
      exemptions_active: exemptionsActive,
    });
  } catch (err: any) {
    logger.error('[Compliance API] Unexpected error in analytics', { error: err.message });
    return sendError(res, 500, 'Internal server error', err.message);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Apply CORS
  await applyCors(req, res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight(res);
  }

  // Authenticate
  const auth = await authenticateRequest(req, res);
  if (!auth) return;

  const { tenantId, userId } = auth;
  const { method, query } = req;

  try {
    // Route based on path and method
    const pathSegments = (query._path as string || '').split('/').filter(Boolean);
    
    // Pattern: /api/v2/amro/compliance-enterprise/ad-sb-feed
    if (pathSegments[0] === 'ad-sb-feed' && method === 'GET') {
      return await handleADSBFeed(req, res, tenantId);
    }

    // Pattern: /api/v2/amro/compliance-enterprise/:id/applicability
    if (pathSegments[1] === 'applicability' && method === 'POST') {
      return await handleApplicability(req, res, tenantId, pathSegments[0]);
    }

    // Pattern: /api/v2/amro/compliance-enterprise/:id/sign-off
    if (pathSegments[1] === 'sign-off' && method === 'POST') {
      return await handleSignOff(req, res, tenantId, pathSegments[0], userId);
    }

    // Pattern: /api/v2/amro/compliance-enterprise/fleet-status
    if (pathSegments[0] === 'fleet-status' && method === 'GET') {
      return await handleFleetStatus(req, res, tenantId);
    }

    // Pattern: /api/v2/amro/compliance-enterprise/export-report
    if (pathSegments[0] === 'export-report' && method === 'POST') {
      return await handleExportReport(req, res, tenantId, userId);
    }

    // Pattern: /api/v2/amro/compliance-enterprise/analytics
    if (pathSegments[0] === 'analytics' && method === 'GET') {
      return await handleAnalytics(req, res, tenantId);
    }

    return sendError(res, 404, 'Not found', 'Invalid endpoint');
  } catch (err: any) {
    logger.error('[Compliance API] Unhandled error', { error: err.message, stack: err.stack });
    return sendError(res, 500, 'Internal server error');
  }
}
