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
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import {
  buildCsv,
  getEntityConfig,
  parseBulkOperation,
  parseExportRequested,
  parsePagination,
  parseSearch,
  parseSort,
  resolveEntity,
  sanitizeWritePayload,
  sendError,
  validatePayload,
  writeAuditRecord,
  HttpError,
} from './shared';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';

const ENTITY_UNAVAILABLE = new Set<string>();
const ENTITY_COLUMN_OVERRIDES = new Map<string, Set<string>>();
const ENTITY_SEARCH_COLUMN_OVERRIDES = new Map<string, Set<string>>();

function isV2Enabled(): boolean {
  const normalized = String(process.env.AMRO_MASTER_DATA_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function asBodyObject(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function splitColumns(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getActiveColumns(entity: string, listColumns: string): string[] {
  const override = ENTITY_COLUMN_OVERRIDES.get(entity);
  if (override) {
    return Array.from(override);
  }
  return splitColumns(listColumns);
}

function getActiveSearchableColumns(entity: string, searchableColumns: string[]): string[] {
  const override = ENTITY_SEARCH_COLUMN_OVERRIDES.get(entity);
  if (override) {
    return Array.from(override);
  }
  return [...searchableColumns];
}

function getSelectClause(entity: string, listColumns: string): string {
  const columns = getActiveColumns(entity, listColumns);
  if (!columns.length) {
    return '*';
  }
  return columns.join(',');
}

function extractMissingColumn(errorMessage: string): string | null {
  const direct = errorMessage.match(/column\s+([a-zA-Z0-9_."]+)\s+does not exist/i);
  if (direct?.[1]) {
    return direct[1].replace(/"/g, '');
  }
  const postgrest = errorMessage.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i);
  if (postgrest?.[1]) {
    return postgrest[1];
  }
  return null;
}

function isMissingTableError(errorMessage: string): boolean {
  return (
    /Could not find the table/i.test(errorMessage) ||
    /relation\s+["']?[a-zA-Z0-9_.]+["']?\s+does not exist/i.test(errorMessage)
  );
}

function markMissingColumn(entity: string, rawColumnName: string, listColumns: string, searchableColumns: string[]): boolean {
  const normalized = rawColumnName.replace(/^public\./, '');
  const column = normalized.includes('.') ? normalized.split('.').slice(-1)[0] : normalized;
  if (!column) {
    return false;
  }
  const columns = new Set(getActiveColumns(entity, listColumns));
  const hadColumn = columns.delete(column);
  if (hadColumn) {
    ENTITY_COLUMN_OVERRIDES.set(entity, columns);
  }
  const activeSearchable = new Set(getActiveSearchableColumns(entity, searchableColumns));
  const hadSearchColumn = activeSearchable.delete(column);
  if (hadSearchColumn) {
    ENTITY_SEARCH_COLUMN_OVERRIDES.set(entity, activeSearchable);
  }
  return hadColumn || hadSearchColumn;
}

function resolveSortColumn(entity: string, requestedSortBy: string, listColumns: string): string {
  const columns = getActiveColumns(entity, listColumns);
  if (!columns.length) {
    return requestedSortBy || 'updated_at';
  }
  if (requestedSortBy && columns.includes(requestedSortBy)) {
    return requestedSortBy;
  }
  if (columns.includes('updated_at')) {
    return 'updated_at';
  }
  if (columns.includes('created_at')) {
    return 'created_at';
  }
  return columns[0];
}

function matchesSearch(row: Record<string, unknown>, searchableColumns: string[], search: string): boolean {
  if (!search) return true;
  const searchLower = search.toLowerCase();
  return searchableColumns.some((column) => {
    const value = row[column];
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(searchLower);
  });
}

function isValidationOnly(req: ApiRequest, body: Record<string, unknown>): boolean {
  const queryFlag = String(req.query.validate_only || req.query.validateOnly || '')
    .trim()
    .toLowerCase();
  if (queryFlag === 'true' || queryFlag === '1' || queryFlag === 'yes' || queryFlag === 'on') {
    return true;
  }
  const bodyFlag = String(body.validate_only || body.validateOnly || '')
    .trim()
    .toLowerCase();
  return bodyFlag === 'true' || bodyFlag === '1' || bodyFlag === 'yes' || bodyFlag === 'on';
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const compatibilityDecision = resolveGatewayCompatibility(req, {
    tenantId: ctx.tenantId,
    franchiseId: ctx.franchiseId,
  });
  applyCompatibilityResponseHeaders(res, compatibilityDecision, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      throw new HttpError(`Method ${req.method} Not Allowed`, 405);
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;
    const entity = resolveEntity(req.query.entity);
    const entityConfig = getEntityConfig(entity);
    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      enforceAnyPermission(auth.permissions || [], ['view_amro_dashboard', 'edit_aircraft_records']);
      const search = parseSearch(req);
      const exportRequested = parseExportRequested(req);
      const { page, pageSize, start, end } = parsePagination(req);
      const { sortBy, ascending } = parseSort(req, entity);

      if (ENTITY_UNAVAILABLE.has(entity)) {
        res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          output: {
            entity,
            records: [],
            page,
            page_size: pageSize,
            total: 0,
          },
        });
        return;
      }

      let finalData: unknown[] = [];
      let finalCount = 0;
      let currentSortBy = resolveSortColumn(entity, sortBy, entityConfig.listColumns);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const selectClause = getSelectClause(entity, entityConfig.listColumns);
        const searchableColumns = getActiveSearchableColumns(entity, entityConfig.searchableColumns);
        let query = supabase
          .from(entityConfig.table)
          .select(selectClause, { count: 'exact' })
          .eq('tenant_id', tenantId)
          .order(currentSortBy, { ascending })
          .range(start, end);

        if (franchiseId) {
          query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
        }
        if (search && !franchiseId && searchableColumns.length) {
          const clauses = searchableColumns.map((column) => `${column}.ilike.%${search}%`);
          query = query.or(clauses.join(','));
        }

        const { data, count, error } = await query;
        if (!error) {
          finalData = Array.isArray(data) ? data : [];
          finalCount = count || 0;
          break;
        }

        const errorMessage = String(error.message || '');
        if (isMissingTableError(errorMessage)) {
          ENTITY_UNAVAILABLE.add(entity);
          finalData = [];
          finalCount = 0;
          break;
        }

        const missingColumn = extractMissingColumn(errorMessage);
        if (missingColumn && markMissingColumn(entity, missingColumn, entityConfig.listColumns, entityConfig.searchableColumns)) {
          currentSortBy = resolveSortColumn(entity, currentSortBy, entityConfig.listColumns);
          continue;
        }

        throw new HttpError(errorMessage, 400);
      }

      const rawRows = (finalData || []) as Record<string, unknown>[];
      const activeSearchableColumns = getActiveSearchableColumns(entity, entityConfig.searchableColumns);
      const rows = franchiseId && search ? rawRows.filter((row) => matchesSearch(row, activeSearchableColumns, search)) : rawRows;
      if (exportRequested) {
        const csv = buildCsv(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="amro-${entity}.csv"`);
        res.status(200).end(csv);
        return;
      }
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          records: rows,
          page,
          page_size: pageSize,
          total: finalCount || rows.length,
        },
      });
      return;
    }

    enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records', 'create_maintenance_request']);
    const body = asBodyObject(req.body);
    const validationOnly = isValidationOnly(req, body);
    const { isBulkImport, records } = parseBulkOperation(body);

    if (isBulkImport) {
      if (!records.length) {
        throw new HttpError('records are required for bulk import', 400);
      }
      if (records.length > 500) {
        throw new HttpError('bulk import supports up to 500 records per request', 400);
      }
      const prepared = records.map((record) => sanitizeWritePayload(entity, record));
      const validationResults = prepared.map((record, index) => ({
        index,
        issues: validatePayload(entity, record),
      }));
      const invalidRows = validationResults.filter((result) => result.issues.length > 0);
      if (validationOnly) {
        res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          output: {
            entity,
            validation: {
              mode: 'bulk_import',
              is_valid: invalidRows.length === 0,
              total_records: prepared.length,
              invalid_records: invalidRows.length,
              results: validationResults,
            },
          },
        });
        return;
      }
      if (invalidRows.length > 0) {
        throw new HttpError(`Validation failed for ${invalidRows.length} record(s)`, 422);
      }
      const insertRows = prepared.map((record) => ({
        ...record,
        tenant_id: tenantId,
        franchise_id: franchiseId,
        updated_by: auth.userId,
      }));
      const { data, error } = await supabase
        .from(entityConfig.table)
        .insert(insertRows)
        .select(entityConfig.listColumns);
      if (error) throw new HttpError(error.message, 400);
      await writeAuditRecord({
        tenantId,
        franchiseId,
        userId: auth.userId,
        entity,
        action: 'bulk_import',
        afterData: {
          count: insertRows.length,
        },
      });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          imported_count: insertRows.length,
          records: data || [],
        },
      });
      return;
    }

    const payload = sanitizeWritePayload(entity, body);
    const issues = validatePayload(entity, payload);
    if (validationOnly) {
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          validation: {
            mode: 'single',
            is_valid: issues.length === 0,
            issues,
          },
        },
      });
      return;
    }
    if (issues.length > 0) {
      throw new HttpError('Validation failed', 422);
    }
    const insertPayload = {
      ...payload,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      created_by: auth.userId,
      updated_by: auth.userId,
    };
    const { data, error } = await supabase
      .from(entityConfig.table)
      .insert(insertPayload)
      .select(entityConfig.listColumns)
      .maybeSingle();
    if (error) throw new HttpError(error.message, 400);
    await writeAuditRecord({
      tenantId,
      franchiseId,
      userId: auth.userId,
      entity,
      action: 'create',
      entityId: String(((data as unknown as Record<string, unknown> | null)?.id) || ''),
      afterData: data,
    });
    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      output: {
        entity,
        record: data,
      },
    });
  } catch (error) {
    sendError(res, error, ctx.correlationId);
  }
}
