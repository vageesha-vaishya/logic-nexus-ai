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
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import { loadP2Settings, saveP2Settings } from './p2SettingsStore';

const READ_PERMISSIONS = ['inventory.read', 'dashboards.view'];
const WRITE_PERMISSIONS = ['inventory.admin'];

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PUT', 'PATCH', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    if (!['GET', 'PUT', 'PATCH'].includes(req.method || '')) {
      res.setHeader('Allow', ['GET', 'PUT', 'PATCH']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions || [], req.method === 'GET' ? READ_PERMISSIONS : WRITE_PERMISSIONS);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const supabase = getSupabaseAdminClient();
    const settings = await loadP2Settings(supabase, tenantId);

    if (req.method === 'GET') {
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-reconciliation-policy',
        output: {
          policy: settings.alert_policy,
        },
      });
      return;
    }

    const policyInput =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>).policy
        : undefined;
    const nextPolicy = {
      ...settings.alert_policy,
      ...(policyInput && typeof policyInput === 'object' ? (policyInput as Record<string, unknown>) : {}),
    };
    const savedSettings = await saveP2Settings(supabase, tenantId, {
      ...settings,
      alert_policy: nextPolicy as typeof settings.alert_policy,
    });
    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-reconciliation-policy-update',
      output: {
        policy: savedSettings.alert_policy,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
