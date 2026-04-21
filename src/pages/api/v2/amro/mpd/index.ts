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
  mapMpdPayloadToTaskTemplateInput,
  mapTaskTemplateRowToMpd,
  parseExportRequested,
  parsePagination,
  parseSort,
  parseTaskTemplateRowsWithFallback,
  taskTemplateSelectColumns,
  validateMpdInput,
  type TaskTemplateModelColumn,
  type TaskTemplateSequenceColumn,
} from './shared';

function isEnabled(): boolean {
  const normalized = String(process.env.AMRO_MPD_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

type QueryBuildInput = {
  tenantId: string;
  franchiseId: string | null;
  search: string;
  ataCode: string;
  categoryCode: string;
  isMandatory: string;
  modelId: string;
  sortBy: string;
  ascending: boolean;
  start?: number;
  end?: number;
};

function toSortColumn(sortBy: string, sequenceColumn: TaskTemplateSequenceColumn): string {
  if (sortBy === 'tt_sequence' || sortBy === 'task_template_id') return sequenceColumn;
  return sortBy;
}

function applyListFilters(
  query: any,
  args: QueryBuildInput,
  modelColumn: TaskTemplateModelColumn,
) {
  if (args.franchiseId) {
    query = query.or(`franchise_id.is.null,franchise_id.eq.${args.franchiseId}`);
  }
  if (args.search) {
    const escaped = args.search.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    query = query.or(`description.ilike.%${escaped}%,ata_code.ilike.%${escaped}%,reference_amp.ilike.%${escaped}%,code_form_no.ilike.%${escaped}%`);
  }
  if (args.ataCode) query = query.eq('ata_code', args.ataCode);
  if (args.categoryCode) query = query.eq('category_code', args.categoryCode);
  if (args.isMandatory) query = query.eq('is_mandatory', args.isMandatory === 'true');
  if (args.modelId) query = query.eq(modelColumn, args.modelId);
  if (args.start !== undefined && args.end !== undefined) {
    query = query.range(args.start, args.end);
  }
  return query;
}

async function runListQuery(
  options: {
    sequenceColumn: TaskTemplateSequenceColumn;
    modelColumn: TaskTemplateModelColumn;
    args: QueryBuildInput;
    withRange: boolean;
  },
): Promise<{ data: Record<string, unknown>[] | null; error: { message?: string } | null; count: number | null }> {
  const supabase = getSupabaseAdminClient();
  const sortColumn = toSortColumn(options.args.sortBy, options.sequenceColumn);

  let query = supabase
    .from('task_templates')
    .select(taskTemplateSelectColumns(options.sequenceColumn, options.modelColumn), { count: 'exact' })
    .eq('tenant_id', options.args.tenantId)
    .order(sortColumn, { ascending: options.args.ascending, nullsFirst: false });

  query = applyListFilters(query, options.args, options.modelColumn);
  if (!options.withRange) {
    query = query.limit(5000);
  }

  return query as unknown as { data: Record<string, unknown>[] | null; error: { message?: string } | null; count: number | null };
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

    if (req.method === 'GET') {
      const { page, pageSize, start, end } = parsePagination(req);
      const exportRequested = parseExportRequested(req);
      const search = String(req.query.search || '').trim();
      const ataCode = String(req.query.ata_code || '').trim();
      const categoryCode = String(req.query.category_code || '').trim();
      const isMandatory = String(req.query.is_mandatory || '').trim().toLowerCase();
      const modelId = String(req.query.model_id || req.query.modelId || '').trim();
      const { sortBy, ascending } = parseSort(req);

      const listArgs: QueryBuildInput = {
        tenantId,
        franchiseId,
        search,
        ataCode,
        categoryCode,
        isMandatory,
        modelId,
        sortBy,
        ascending,
        start,
        end,
      };

      const listWithFallback = async (
        sequenceColumn: TaskTemplateSequenceColumn,
        modelColumn: TaskTemplateModelColumn,
      ) => runListQuery({ sequenceColumn, modelColumn, args: listArgs, withRange: !exportRequested });

      const {
        data,
        error,
        count,
        sequenceColumn,
        modelColumn,
      } = await parseTaskTemplateRowsWithFallback<Record<string, unknown>[]>(listWithFallback);

      if (error) {
        throw new Error(`Failed to query MPD records: ${error.message}`);
      }

      const records = (Array.isArray(data) ? data : []).map((row) =>
        mapTaskTemplateRowToMpd(row as Record<string, unknown>, sequenceColumn, modelColumn),
      );

      if (exportRequested) {
        const csv = buildCsv(records);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="mpd-export-${Date.now()}.csv"`);
        res.status(200).end(csv);
        return;
      }

      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-mpd-list',
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
    const issues = validateMpdInput(payload, 'create');
    if (issues.length > 0) {
      res.status(400).json({ error: 'Validation failed', issues, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const insertWithFallback = async (
      sequenceColumn: TaskTemplateSequenceColumn,
      modelColumn: TaskTemplateModelColumn,
    ): Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }> => {
      const supabase = getSupabaseAdminClient();
      const row = {
        ...mapMpdPayloadToTaskTemplateInput(payload, modelColumn),
        tenant_id: tenantId,
        franchise_id: franchiseId,
      };
      const result = await supabase
        .from('task_templates')
        .insert(row)
        .select(taskTemplateSelectColumns(sequenceColumn, modelColumn))
        .limit(1)
        .maybeSingle();
      return result as unknown as { data: Record<string, unknown> | null; error: { message?: string } | null };
    };

    const {
      data: inserted,
      error: insertError,
      sequenceColumn,
      modelColumn,
    } = await parseTaskTemplateRowsWithFallback<Record<string, unknown>>(insertWithFallback);

    if (insertError) {
      throw new Error(`Failed to create MPD record: ${insertError.message}`);
    }

    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-mpd-create',
      output: {
        record: mapTaskTemplateRowToMpd(
          (inserted || {}) as Record<string, unknown>,
          sequenceColumn,
          modelColumn,
        ),
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
