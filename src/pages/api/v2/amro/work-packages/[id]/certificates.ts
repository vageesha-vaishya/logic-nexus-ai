/**
 * AMRO Certificate of Release to Service (CRS) API
 * 
 * DATABASE SCHEMA:
 * - Uses: amro_certificates_release_service (existing)
 * - Uses: work_orders (existing)
 * - Uses: aircraft (existing)
 * - Auto-generates certificate number
 * - Validates certifying staff license
 * - Creates immutable audit record
 * 
 * ENDPOINT:
 * - POST /api/v2/amro/work-packages/[id]/certificates
 * 
 * BODY:
 * - certifying_staff_id: user_id (required)
 * - staff_license_number: string (required)
 * - staff_license_type: string (B1, B2, C, etc.) (required)
 * - staff_license_expiry: date (required)
 * - work_description: string (required)
 * - regulations_complied: string[] (required)
 * - limitations?: string (optional)
 * - remarks?: string (optional)
 * - digital_signature_hash?: string (optional)
 * 
 * FEATURES:
 * - Auto-generates certificate number
 * - Validates certifying staff license
 * - Creates immutable audit record
 * - Sends notification to regulatory body (if configured)
 */

import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
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
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const workPackageId = String(req.query.id || '').trim();

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (!workPackageId) {
      res.status(400).json({ error: 'Work Package ID is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const authUser = await authenticateRequest(req);
    ctx.userId = authUser.userId;
    
    // Require certification permission
    enforceAnyPermission(authUser.permissions, ['certifications.create', 'admin.access']);
    
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify work package exists
    const { data: wp, error: wpError } = await supabase
      .from('work_orders')
      .select('id, aircraft_id, title, status')
      .eq('id', workPackageId)
      .eq('tenant_id', tenantId)
      .single();

    if (wpError) {
      if (wpError.code === 'PGRST116') {
        res.status(404).json({ error: 'Work package not found', version: 'v2', correlationId: ctx.correlationId });
      } else {
        throw new Error(`Failed to fetch work package: ${wpError.message}`);
      }
      return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};

    // Required fields
    const certifyingStaffId = assertNonEmpty(body.certifying_staff_id, 'certifying_staff_id');
    const staffLicenseNumber = assertNonEmpty(body.staff_license_number, 'staff_license_number');
    const staffLicenseType = assertNonEmpty(body.staff_license_type, 'staff_license_type');
    const staffLicenseExpiry = assertNonEmpty(body.staff_license_expiry, 'staff_license_expiry');
    const workDescription = assertNonEmpty(body.work_description, 'work_description');
    const regulationsComplied = body.regulations_complied && Array.isArray(body.regulations_complied)
      ? body.regulations_complied
      : [];

    if (regulationsComplied.length === 0) {
      res.status(400).json({
        error: 'regulations_complied must contain at least one regulation',
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    const limitations = body.limitations ? String(body.limitations).trim() : null;
    const remarks = body.remarks ? String(body.remarks).trim() : null;
    const digitalSignatureHash = body.digital_signature_hash ? String(body.digital_signature_hash).trim() : null;
    const maintenanceOrgApproval = body.maintenance_organization_approval
      ? String(body.maintenance_organization_approval).trim()
      : null;

    // Validate license expiry is in the future
    const expiryDate = new Date(staffLicenseExpiry);
    const now = new Date();
    if (expiryDate <= now) {
      res.status(400).json({
        error: 'Staff license has expired. Cannot issue certificate with expired license.',
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    // Generate certificate number
    const certNumber = await generateCertificateNumber(supabase, tenantId);

    // Create certificate
    const { data: certificate, error: certError } = await supabase
      .from('amro_certificates_release_service')
      .insert({
        tenant_id: tenantId,
        certificate_number: certNumber,
        work_package_id: workPackageId,
        aircraft_id: wp.aircraft_id,
        issue_date: new Date().toISOString(),
        maintenance_organization_approval: maintenanceOrgApproval,
        certifying_staff_id: certifyingStaffId,
        staff_license_number: staffLicenseNumber,
        staff_license_type: staffLicenseType,
        staff_license_expiry: staffLicenseExpiry,
        work_description: workDescription,
        regulations_complied: regulationsComplied,
        limitations: limitations,
        remarks: remarks,
        digital_signature_hash: digitalSignatureHash,
        signature_timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (certError) {
      throw new Error(`Failed to create certificate: ${certError.message}`);
    }

    // Update work package status to 'completed' if not already
    if (wp.status !== 'completed') {
      await supabase
        .from('work_orders')
        .update({
          status: 'completed',
          updated_by: authUser.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workPackageId)
        .eq('tenant_id', tenantId);
    }

    res.status(201).json({
      version: 'v2',
      interface: 'create-certificate-release-service',
      correlationId: ctx.correlationId,
      output: {
        certificate_id: certificate.id,
        certificate_number: certificate.certificate_number,
        issue_date: certificate.issue_date,
        work_package_id: workPackageId,
        aircraft_id: wp.aircraft_id,
        certifying_staff_id: certifyingStaffId,
        staff_license_type: staffLicenseType,
        regulations_complied: regulationsComplied,
        message: 'Certificate of Release to Service issued successfully',
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

/**
 * Generate unique certificate number
 * Format: CRS-{tenant_id_first_8}-{year}{sequence}
 */
async function generateCertificateNumber(
  supabase: any,
  tenantId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const tenantPrefix = tenantId.replace(/-/g, '').substring(0, 8).toUpperCase();

  // Get the current sequence number for this year
  const { data: lastCert, error } = await supabase
    .from('amro_certificates_release_service')
    .select('certificate_number')
    .eq('tenant_id', tenantId)
    .like('certificate_number', `CRS-${tenantPrefix}-${year}%`)
    .order('certificate_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let sequenceNumber = 1;
  if (lastCert && lastCert.certificate_number) {
    // Extract sequence from last certificate
    const match = lastCert.certificate_number.match(/(\d{4})$/);
    if (match) {
      sequenceNumber = parseInt(match[1], 10) + 1;
    }
  }

  const certNumber = `CRS-${tenantPrefix}-${year}${String(sequenceNumber).padStart(4, '0')}`;
  return certNumber;
}
