import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

interface PlatformDomainRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  status: string;
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

router.get(
  '/v1/platform-domains',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId) return unauthorized(res);

    try {
      const supabase = getServiceRoleClient();
      let domains: PlatformDomainRow[] = [];

      if (authReq.isPlatformAdmin) {
        const { data, error } = await supabase
          .from('platform_domains')
          .select('id, code, name, description, is_active, status')
          .eq('is_active', true);
        if (error) throw error;
        domains = (data || []) as PlatformDomainRow[];
      } else {
        const { data, error } = await supabase
          .from('tenant_active_domain_assignments')
          .select('platform_domains!inner(id, code, name, description, is_active, status)')
          .eq('tenant_id', authReq.tenantId);
        if (error) throw error;
        const seen = new Set<string>();
        for (const row of (data || []) as unknown as Array<{ platform_domains: PlatformDomainRow }>) {
          const pd = row.platform_domains;
          if (!pd || !pd.id || seen.has(pd.id)) continue;
          seen.add(pd.id);
          domains.push(pd);
        }
      }

      res.json({
        version: 'v1',
        correlationId: (req as { correlationId?: string }).correlationId || null,
        data: {
          domains,
          tenantDomainCount: domains.length,
          tenantId: authReq.tenantId ?? null,
          isPlatformAdmin: Boolean(authReq.isPlatformAdmin),
        },
      });
    } catch (err) {
      logger.error('uim.platform-domains list error', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to list platform domains',
        code: 'PLATFORM_DOMAINS_QUERY_FAILED',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
