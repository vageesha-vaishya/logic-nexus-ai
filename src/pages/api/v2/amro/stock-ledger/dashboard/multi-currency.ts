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
import { loadP2Settings } from './p2SettingsStore';

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
    enforceAnyPermission(auth.permissions || [], ['inventory.read', 'dashboards.view']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const supabase = getSupabaseAdminClient();
    const settings = await loadP2Settings(supabase, tenantId);
    const baseCurrency = String(req.query.base_currency || 'USD').toUpperCase();
    const baseRate = settings.fx_rates[baseCurrency] || 1;

    const { data, error } = await supabase
      .from('amro_stock_ledger_transactions')
      .select('currency,total_cost,movement_type')
      .eq('tenant_id', tenantId)
      .eq('is_voided', false);
    if (error) throw error;

    const currencyTotals = (data || []).reduce<Record<string, { currency: string; raw_total: number; base_total: number; txn_count: number }>>((acc, row) => {
      const currency = String((row as Record<string, unknown>).currency || 'USD').toUpperCase();
      const raw = Number((row as Record<string, unknown>).total_cost || 0);
      const rate = settings.fx_rates[currency] || 1;
      const converted = raw * (rate / baseRate);
      if (!acc[currency]) {
        acc[currency] = { currency, raw_total: 0, base_total: 0, txn_count: 0 };
      }
      acc[currency].raw_total += raw;
      acc[currency].base_total += converted;
      acc[currency].txn_count += 1;
      return acc;
    }, {});

    const records = Object.values(currencyTotals).sort((a, b) => b.base_total - a.base_total);
    const totalBase = records.reduce((sum, row) => sum + row.base_total, 0);

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-multi-currency-dashboard',
      output: {
        base_currency: baseCurrency,
        base_rate: baseRate,
        fx_rates: settings.fx_rates,
        records,
        total_base_value: totalBase,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
