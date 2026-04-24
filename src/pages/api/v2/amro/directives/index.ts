import type { ApiRequest, ApiResponse } from '../../../_utils/types';
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
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import {
  asObject,
  buildCsv,
  directiveSelectColumns,
  mapDirectiveRowToRecord,
  mapPayloadToDirectiveInput,
  parseExportRequested,
  parsePagination,
  parseSort,
  validateDirectiveInput,
} from './shared';

function isEnabled(): boolean {
  const normalized = String(process.env.AMRO_DIRECTIVES_V2_ENABLED || process.env.AMRO_MPD_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

type QueryBuildInput = {
  tenantId: string;
  franchiseId: string | null;
  search: string;
  ataCode: string;
  directiveTypeId: string;
  isMandatory: string;
  modelId: string;
  sortBy: string;
  ascending: boolean;
  start?: number;
  end?: number;
};

function applyListFilters(query: any, args: QueryBuildInput) {
  if (args.franchiseId) {
    query = query.or(`franchise_id.is.null,franchise_id.eq.${args.franchiseId}`);
  }
  if (args.search) {
    const escaped = args.search.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    query = query.or(`description.ilike.%${escaped}%,ata_code.ilike.%${escaped}%,reference_amp.ilike.%${escaped}%,code_form_no.ilike.%${escaped}%`);
  }
  if (args.ataCode) query = query.eq('ata_code', args.ataCode);
  if (args.directiveTypeId) query = query.eq('directives_type_id', args.directiveTypeId);
  if (args.isMandatory) query = query.eq('is_mandatory', args.isMandatory === 'true');
  if (args.modelId) query = query.eq('assembly_models', args.modelId);
  if (args.start !== undefined && args.end !== undefined) query = query.range(args.start, args.end);
  return query;
}

async function fetchDirectiveTypeLabelMap(tenantId: string, franchiseId: string | null): Promise<Map<string, string>> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('directives_type')
    .select('id,code,name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (franchiseId) {
    query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
  }

  const { data } = await query.limit(1000);
  const map = new Map<string, string>();
  for (const row of (Array.isArray(data) ? data : [])) {
    const id = String((row as Record<string, unknown>).id || '').trim();
    const code = String((row as Record<string, unknown>).code || '').trim();
    const name = String((row as Record<string, unknown>).name || '').trim();
    if (!id) continue;
    map.set(id, code && name ? `${code} - ${name}` : (code || name));
  }
  return map;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const startedAt = Date.now();

  try {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions || [], ['dashboards.view', 'view_amro_dashboard', 'edit_aircraft_records']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });

    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    if (!tenantId && !access.isPlatformAdmin) {
      res.status(400).json({ error: 'Tenant scope missing', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      const lookup = String(req.query.lookup || '').trim().toLowerCase();
      if (lookup === 'directive-types') {
        let typeQuery = supabase
          .from('directives_type')
          .select('id,code,name,is_active')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (franchiseId) {
          typeQuery = typeQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
        }
        const { data, error } = await typeQuery.limit(1000);
        if (error) throw new Error(`Failed to load directive types: ${error.message}`);
        const records = (Array.isArray(data) ? data : []).map((row) => {
          const item = row as Record<string, unknown>;
          const id = String(item.id || '').trim();
          const code = String(item.code || '').trim();
          const name = String(item.name || '').trim();
          return {
            id,
            code,
            name,
            label: code && name ? `${code} - ${name}` : (code || name),
          };
        }).filter((row) => row.id && row.label);
        res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          interface: 'amro-directives-type-list',
          output: { records },
        });
        return;
      }

      const { page, pageSize, start, end } = parsePagination(req);
      const exportRequested = parseExportRequested(req);
      const search = String(req.query.search || '').trim();
      const ataCode = String(req.query.ata_code || '').trim();
      const directiveTypeId = String(req.query.directives_type_id || '').trim();
      const isMandatory = String(req.query.is_mandatory || '').trim().toLowerCase();
      const modelId = String(req.query.model_id || req.query.modelId || '').trim();
      const { sortBy, ascending } = parseSort(req);

      const listArgs: QueryBuildInput = {
        tenantId,
        franchiseId,
        search,
        ataCode,
        directiveTypeId,
        isMandatory,
        modelId,
        sortBy,
        ascending,
        start,
        end,
      };

      let query = supabase
        .from('directives')
        .select(directiveSelectColumns, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order(listArgs.sortBy, { ascending: listArgs.ascending, nullsFirst: false });

      query = applyListFilters(query, listArgs);
      if (exportRequested) query = query.limit(5000);

      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to query directives records: ${error.message}`);

      const directiveTypeLabelById = await fetchDirectiveTypeLabelMap(tenantId, franchiseId);
      const records = (Array.isArray(data) ? data : []).map((row) =>
        mapDirectiveRowToRecord(row as unknown as Record<string, unknown>, directiveTypeLabelById),
      );

      if (exportRequested) {
        const csv = buildCsv(records);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="directives-export-${Date.now()}.csv"`);
        res.status(200).end(csv);
        return;
      }

      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-directives-list',
        output: {
          page,
          page_size: pageSize,
          total: Number(count || 0),
          latency_ms: Date.now() - startedAt,
          records,
        },
      });
      return;
    }

    const payload = asObject(req.body);
    const issues = validateDirectiveInput(payload, 'create');
    if (issues.length > 0) {
      res.status(400).json({ error: 'Validation failed', issues, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const row = {
      ...mapPayloadToDirectiveInput(payload),
      tenant_id: tenantId,
      franchise_id: franchiseId,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('directives')
      .insert(row)
      .select(directiveSelectColumns)
      .limit(1)
      .maybeSingle();

    if (insertError) {
      throw new Error(`Failed to create directives record: ${insertError.message}`);
    }

    const directiveTypeLabelById = await fetchDirectiveTypeLabelMap(tenantId, franchiseId);

    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-directives-create',
      output: {
        record: mapDirectiveRowToRecord((inserted || {}) as Record<string, unknown>, directiveTypeLabelById),
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
