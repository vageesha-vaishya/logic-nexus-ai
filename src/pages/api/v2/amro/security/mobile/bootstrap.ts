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
import {
  enforceMobileSecurityHeaders,
  evaluateMobileThreatSignals,
  issueMobileSessionBinding,
  rotateMobileSessionNonce,
  validateMobileSessionBinding,
} from './shared';

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
    enforceAnyPermission(auth.permissions || [], ['*', 'mobile.app.access', 'amro.mobile.access', 'inventory.read', 'dashboards.view']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });

    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const action = String(body.action || 'bootstrap').trim().toLowerCase();
    const rawDeviceId = String(body.device_id || '').trim();
    if (!rawDeviceId) throw new Error('device_id is required');

    const mobileContext = enforceMobileSecurityHeaders(req, {
      minimumTlsVersion: 1.3,
      requirePinning: true,
      requireAttestation: true,
    });
    const threat = evaluateMobileThreatSignals(req);
    if (threat.decision === 'block') {
      throw new Error('Forbidden: high-risk mobile posture');
    }

    if (action === 'refresh') {
      const bindingId = String(body.binding_id || '').trim();
      const nonce = String(body.session_nonce || '').trim();
      if (!bindingId || !nonce) throw new Error('binding_id and session_nonce are required for refresh');
      const validated = validateMobileSessionBinding({
        bindingId,
        userId: auth.userId,
        rawDeviceId,
      });
      const rotated = rotateMobileSessionNonce({
        bindingId: validated.bindingId,
        expectedNonce: nonce,
      });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-mobile-security-refresh',
        output: {
          binding_id: rotated.bindingId,
          session_nonce: rotated.sessionNonce,
          refresh_token_family: rotated.refreshTokenFamily,
          expires_at: rotated.expiresAt,
          threat_decision: threat.decision,
          threat_score: threat.score,
        },
      });
      return;
    }

    const biometricStrength = String(body.biometric_strength || 'device').trim().toLowerCase();
    const binding = issueMobileSessionBinding({
      userId: auth.userId,
      tenantId: String(access.tenantId || ''),
      franchiseId: access.franchiseId || null,
      platform: mobileContext.platform,
      rawDeviceId,
      biometricStrength:
        biometricStrength === 'none' || biometricStrength === 'strong' ? biometricStrength : 'device',
    });

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-mobile-security-bootstrap',
      output: {
        binding_id: binding.bindingId,
        session_nonce: binding.sessionNonce,
        refresh_token_family: binding.refreshTokenFamily,
        expires_at: binding.expiresAt,
        mobile_context: {
          platform: mobileContext.platform,
          app_version: mobileContext.appVersion,
          app_build: mobileContext.appBuild,
          attestation_provider: mobileContext.attestationProvider,
          certificate_pinning_mode: mobileContext.certificatePinningMode,
          tls_version: mobileContext.tlsVersion,
        },
        threat_assessment: threat,
        requirements: {
          tls_minimum: '1.3',
          certificate_pinning: 'strict',
          token_rotation: 'mandatory_per_refresh',
          biometric: 'device_or_strong',
        },
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
