import type { ApiRequest, ApiResponse } from '../../_utils/types';
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
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { buildPilotOptions, getPilotRoleIds, getPilotUserIds } from './pilot-users.helpers';

type CustomRoleLookupRow = {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean | null;
};

type UserCustomRoleLookupRow = {
  user_id: string;
  role_id: string;
  tenant_id: string;
};

type ProfileLookupRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_active: boolean | null;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;

    const access = await resolveAndApplyAccessContext(req, ctx);
    const compatibilityDecision = resolveGatewayCompatibility(req, {
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    applyCompatibilityResponseHeaders(res, compatibilityDecision, ctx.correlationId);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    enforceAnyPermission(auth.permissions || [], ['view_amro_dashboard', 'edit_aircraft_records']);

    const tenantId = String(access.tenantId || '').trim();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    const supabase = getSupabaseAdminClient();
    const { data: roleRows, error: roleError } = await supabase
      .from('custom_roles')
      .select('id,tenant_id,name,is_active')
      .eq('tenant_id', tenantId)
      .ilike('name', 'pilot');
    if (roleError) {
      throw new Error(roleError.message || 'Failed to load custom pilot roles');
    }

    const pilotRoleIds = getPilotRoleIds((roleRows || []) as CustomRoleLookupRow[], tenantId);
    if (!pilotRoleIds.length) {
      return res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          records: [],
        },
      });
    }

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from('user_custom_roles')
      .select('user_id,role_id,tenant_id')
      .eq('tenant_id', tenantId)
      .in('role_id', pilotRoleIds);
    if (assignmentError) {
      throw new Error(assignmentError.message || 'Failed to load pilot role assignments');
    }

    const pilotUserIds = getPilotUserIds((assignmentRows || []) as UserCustomRoleLookupRow[], pilotRoleIds, tenantId);
    if (!pilotUserIds.length) {
      return res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          records: [],
        },
      });
    }

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,email,is_active')
      .in('id', pilotUserIds);
    if (profileError) {
      throw new Error(profileError.message || 'Failed to load pilot user profiles');
    }

    const records = buildPilotOptions((profileRows || []) as ProfileLookupRow[], pilotUserIds);
    return res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      output: {
        records,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
