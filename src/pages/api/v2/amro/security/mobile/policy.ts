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

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
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

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-mobile-security-policy',
      output: {
        authentication: {
          oauth2: 'Authorization Code + PKCE (S256)',
          token_format: 'JWT',
          access_token_ttl_seconds: 900,
          refresh_rotation: 'one-time-use family rotation',
          biometric_gate: 'required for privileged actions',
        },
        transport_security: {
          tls_minimum: '1.3',
          certificate_pinning: 'required',
          pinned_public_key_strategy: 'dual pin set with overlap window',
        },
        data_protection: {
          at_rest: 'AES-256 (Keychain/Keystore bound keys)',
          in_transit: 'TLS 1.3',
          local_cache_policy: 'encrypted, 30-day max retention, remote wipe support',
        },
        mobile_framework_recommendation: {
          oauth: 'AppAuth (iOS + Android)',
          ios_secret_store: 'Keychain + Secure Enclave + App Attest',
          android_secret_store: 'Android Keystore + StrongBox + Play Integrity',
          cross_platform_binding: 'device-scoped session binding + nonce rotation',
        },
        threat_controls: [
          'mitm_protection_with_pinning',
          'reverse_engineering_detection',
          'jailbreak_root_detection',
          'runtime_debugger_detection',
          'sensitive_screen_and_clipboard_guardrails',
        ],
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
