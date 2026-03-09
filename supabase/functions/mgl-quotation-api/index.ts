import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { serveWithLogger } from '../_shared/logger.ts';
import { validatePayload } from './validation.ts';
import type { RateOptionPayload } from './validation.ts';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
};

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), ...CORS_HEADERS },
  });
}

function calculateTotals(payload: RateOptionPayload) {
  const totalsByEquipment: Record<string, number> = {};
  const keys = payload.equipmentColumns.map((c) => c.key);
  keys.forEach((key) => {
    totalsByEquipment[key] = 0;
  });

  for (const row of payload.chargeRows || []) {
    const include = row.includeInTotal !== false;
    for (const key of keys) {
      const amount = Number(row.valuesByEquipment?.[key] ?? 0);
      if (include) totalsByEquipment[key] = Number((totalsByEquipment[key] + amount).toFixed(2));
    }
  }

  const grandTotal = Number(Object.values(totalsByEquipment).reduce((sum, value) => sum + value, 0).toFixed(2));
  return { totalsByEquipment, grandTotal };
}

async function validateStandaloneUniqueness(
  adminSupabase: any,
  tenantId: string,
  payload: RateOptionPayload,
) {
  if (!payload.standaloneMode || !payload.quoteId || !payload.optionOrdinal) return [];

  const errors: string[] = [];
  const query = adminSupabase
    .from('rate_options')
    .select('id, option_name, option_ordinal, rate_type')
    .eq('tenant_id', tenantId)
    .eq('quote_id', payload.quoteId);

  if (payload.quoteVersionId) query.eq('quote_version_id', payload.quoteVersionId);
  if (payload.id) query.neq('id', payload.id);

  const { data, error } = await query;
  if (error) return [`Unable to validate standalone option uniqueness: ${error.message}`];

  const desiredName = payload.optionName || `Option ${payload.optionOrdinal}`;
  const duplicate = (data || []).some((row: any) => String(row.option_name || '') === desiredName);
  const duplicateOrdinal = (data || []).some(
    (row: any) =>
      Number(row.option_ordinal || 0) === Number(payload.optionOrdinal || 0) &&
      Number(payload.optionOrdinal || 0) > 0,
  );
  const duplicateRateType = payload.rateType
    ? (data || []).some((row: any) => String(row.rate_type || '') === String(payload.rateType))
    : false;
  const existingCount = Array.isArray(data) ? data.length : 0;
  if (duplicate) {
    errors.push(`Standalone option ${payload.optionOrdinal} already exists for this quote context`);
  }
  if (duplicateOrdinal) {
    errors.push(`Standalone option ordinal ${payload.optionOrdinal} already exists for this quote context`);
  }
  if (duplicateRateType) {
    errors.push(`Standalone rate type ${payload.rateType} already exists for this quote context`);
  }
  if (existingCount >= 4) {
    errors.push('Standalone mode supports a maximum of 4 options per quote context');
  }
  return errors;
}

serveWithLogger(async (req, logger, adminSupabase) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });

  const { user, error: authError } = await requireAuth(req, logger);
  if (authError || !user) return json(req, 401, { error: 'Unauthorized', details: authError });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'Invalid JSON body' });
  }

  const action = String(body?.action || '').trim();
  const tenantId = body?.tenantId;
  if (!tenantId) return json(req, 400, { error: 'tenantId is required' });

  const logAudit = async (meta: Record<string, unknown>) => {
    await adminSupabase.from('quotation_audit_logs').insert({
      tenant_id: tenantId,
      quote_id: body?.quoteId || null,
      quote_version_id: body?.quoteVersionId || null,
      rate_option_id: body?.rateOptionId || body?.payload?.id || null,
      action,
      actor_id: user.id,
      actor_email: user.email || null,
      request_id: req.headers.get('x-request-id') || null,
      metadata: meta,
    });
  };

  const persistHistory = async (rateOptionId: string, eventType: string, snapshot: Record<string, unknown>) => {
    const { data: latest } = await adminSupabase
      .from('rate_option_history')
      .select('revision_no')
      .eq('rate_option_id', rateOptionId)
      .order('revision_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    const revision = Number(latest?.revision_no || 0) + 1;

    await adminSupabase.from('rate_option_history').insert({
      tenant_id: tenantId,
      rate_option_id: rateOptionId,
      revision_no: revision,
      event_type: eventType,
      snapshot,
      changed_by: user.id,
    });
  };

  if (action === 'upsert_template') {
    const payload = body?.payload || {};
    const id = payload.id || crypto.randomUUID();

    const { data, error } = await adminSupabase
      .from('templates')
      .upsert({
        id,
        tenant_id: tenantId,
        quote_id: payload.quoteId || null,
        quote_version_id: payload.quoteVersionId || null,
        template_name: payload.templateName || 'MGL-Main-Template',
        config: payload.config || {},
        is_active: payload.isActive !== false,
        created_by: payload.id ? undefined : user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) return json(req, 400, { error: error.message });

    await logAudit({ result: 'template_upserted', templateId: data.id });
    return json(req, 200, { data });
  }

  if (action === 'list_templates') {
    const query = adminSupabase
      .from('templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });

    if (body.quoteId) query.eq('quote_id', body.quoteId);

    const { data, error } = await query;
    if (error) return json(req, 400, { error: error.message });
    return json(req, 200, { data: data || [] });
  }

  if (action === 'delete_rate_option') {
    const rateOptionId = String(body.rateOptionId || '');
    if (!rateOptionId) return json(req, 400, { error: 'rateOptionId is required' });

    const { error } = await adminSupabase
      .from('rate_options')
      .delete()
      .eq('id', rateOptionId)
      .eq('tenant_id', tenantId);

    if (error) return json(req, 400, { error: error.message });

    await logAudit({ result: 'rate_option_deleted', rateOptionId });
    return json(req, 200, { success: true });
  }

  if (action === 'get_rate_option') {
    const rateOptionId = String(body.rateOptionId || '');
    if (!rateOptionId) return json(req, 400, { error: 'rateOptionId is required' });

    const { data: option, error: optionError } = await adminSupabase
      .from('rate_options')
      .select('*')
      .eq('id', rateOptionId)
      .eq('tenant_id', tenantId)
      .single();

    if (optionError) return json(req, 404, { error: optionError.message });

    const [{ data: legs }, { data: rows }, { data: cells }] = await Promise.all([
      adminSupabase
        .from('rate_option_legs')
        .select('*')
        .eq('rate_option_id', rateOptionId)
        .order('sequence_no', { ascending: true }),
      adminSupabase
        .from('rate_charge_rows')
        .select('*')
        .eq('rate_option_id', rateOptionId)
        .order('sort_order', { ascending: true }),
      adminSupabase
        .from('rate_charge_cells')
        .select('*')
        .eq('tenant_id', tenantId),
    ]);

    const cellsByRow = new Map<string, Array<any>>();
    (cells || []).forEach((cell: any) => {
      const rowCells = cellsByRow.get(cell.charge_row_id) || [];
      rowCells.push(cell);
      cellsByRow.set(cell.charge_row_id, rowCells);
    });

    const responseRows = (rows || []).map((row: any) => {
      const valuesByEquipment: Record<string, number> = {};
      (cellsByRow.get(row.id) || []).forEach((cell: any) => {
        valuesByEquipment[cell.equipment_key] = Number(cell.amount || 0);
      });
      return {
        id: row.id,
        rowCode: row.row_code,
        rowName: row.row_name,
        currency: row.currency,
        includeInTotal: row.include_in_total,
        remarks: row.remarks,
        sortOrder: row.sort_order,
        valuesByEquipment,
      };
    });

    return json(req, 200, {
      data: {
        ...option,
        rateType: option.rate_type || undefined,
        rateValidUntil: option.rate_valid_until || undefined,
        containerType: option.container_type || undefined,
        containerSize: option.container_size || undefined,
        commodityType: option.commodity_type || undefined,
        hsCode: option.hs_code || undefined,
        imdgClass: option.imdg_class || undefined,
        temperatureControlMinC: option.temperature_control_min_c ?? undefined,
        temperatureControlMaxC: option.temperature_control_max_c ?? undefined,
        oversizedLengthCm: option.oversized_length_cm ?? undefined,
        oversizedWidthCm: option.oversized_width_cm ?? undefined,
        oversizedHeightCm: option.oversized_height_cm ?? undefined,
        originCode: option.origin_code || undefined,
        destinationCode: option.destination_code || undefined,
        standaloneMode: option.standalone_mode ?? undefined,
        optionOrdinal: option.option_ordinal ?? undefined,
        multimodalRuleConfig: option.multimodal_rule_config || {},
        transitPoints: option.transit_points || [],
        legConnections: option.leg_connections || [],
        legs: legs || [],
        chargeRows: responseRows,
      },
    });
  }

  if (action === 'upsert_rate_option') {
    const payload = body?.payload as RateOptionPayload;
    if (!payload) return json(req, 400, { error: 'payload is required' });

    const validationErrors = validatePayload(payload);
    if (validationErrors.length > 0) {
      return json(req, 400, { error: 'Validation failed', issues: validationErrors });
    }
    const standaloneErrors = await validateStandaloneUniqueness(adminSupabase, tenantId, payload);
    if (standaloneErrors.length > 0) {
      return json(req, 400, { error: 'Validation failed', issues: standaloneErrors });
    }

    const { totalsByEquipment, grandTotal } = calculateTotals(payload);
    const rateOptionId = payload.id || crypto.randomUUID();

    const { data: optionRecord, error: optionError } = await adminSupabase
      .from('rate_options')
      .upsert({
        id: rateOptionId,
        tenant_id: tenantId,
        quote_id: payload.quoteId,
        quote_version_id: payload.quoteVersionId || null,
        template_id: payload.templateId || null,
        option_name: payload.optionName || null,
        carrier_name: payload.carrierName,
        rate_type: payload.rateType || null,
        rate_valid_until: payload.rateValidUntil || null,
        transit_time_days: payload.transitTimeDays || null,
        frequency_per_week: payload.frequencyPerWeek || null,
        mode: payload.mode || 'multimodal',
        equipment_columns: payload.equipmentColumns || [],
        transit_points: payload.transitPoints || [],
        leg_connections: payload.legConnections || [],
        container_type: payload.containerType || null,
        container_size: payload.containerSize || null,
        commodity_type: payload.commodityType || null,
        hs_code: payload.hsCode || null,
        imdg_class: payload.imdgClass || null,
        temperature_control_min_c: payload.temperatureControlMinC ?? null,
        temperature_control_max_c: payload.temperatureControlMaxC ?? null,
        oversized_length_cm: payload.oversizedLengthCm ?? null,
        oversized_width_cm: payload.oversizedWidthCm ?? null,
        oversized_height_cm: payload.oversizedHeightCm ?? null,
        origin_code: payload.originCode || null,
        destination_code: payload.destinationCode || null,
        standalone_mode: payload.standaloneMode === true,
        option_ordinal: payload.optionOrdinal || null,
        multimodal_rule_config: payload.multimodalRuleConfig || {},
        remarks: payload.remarks || null,
        total_by_equipment: totalsByEquipment,
        grand_total: grandTotal,
        created_by: payload.id ? undefined : user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (optionError) return json(req, 400, { error: optionError.message });

    await adminSupabase.from('rate_option_legs').delete().eq('rate_option_id', rateOptionId);
    if ((payload.legs || []).length > 0) {
      const legsPayload = payload.legs.map((leg) => ({
        id: leg.id || crypto.randomUUID(),
        rate_option_id: rateOptionId,
        tenant_id: tenantId,
        sequence_no: leg.sequenceNo,
        transport_mode: leg.mode,
        origin_code: leg.originCode,
        destination_code: leg.destinationCode,
        origin_name: leg.originName || null,
        destination_name: leg.destinationName || null,
        carrier_name: leg.carrierName || null,
        transit_days: leg.transitDays || null,
        frequency_per_week: leg.frequencyPerWeek || null,
      }));
      const { error: legsError } = await adminSupabase.from('rate_option_legs').insert(legsPayload);
      if (legsError) return json(req, 400, { error: legsError.message });
    }

    await adminSupabase.from('rate_charge_rows').delete().eq('rate_option_id', rateOptionId);

    for (const row of payload.chargeRows || []) {
      const rowId = row.id || crypto.randomUUID();
      const { error: rowError } = await adminSupabase.from('rate_charge_rows').insert({
        id: rowId,
        rate_option_id: rateOptionId,
        tenant_id: tenantId,
        row_code: row.rowCode || null,
        row_name: row.rowName,
        currency: row.currency || 'USD',
        include_in_total: row.includeInTotal !== false,
        remarks: row.remarks || null,
        sort_order: row.sortOrder || 1000,
      });
      if (rowError) return json(req, 400, { error: rowError.message });

      const cellRecords = Object.entries(row.valuesByEquipment || {}).map(([key, value]) => ({
        id: crypto.randomUUID(),
        charge_row_id: rowId,
        tenant_id: tenantId,
        equipment_key: key,
        amount: Number(value || 0),
      }));

      if (cellRecords.length > 0) {
        const { error: cellsError } = await adminSupabase.from('rate_charge_cells').insert(cellRecords);
        if (cellsError) return json(req, 400, { error: cellsError.message });
      }
    }

    await persistHistory(rateOptionId, payload.id ? 'updated' : 'created', {
      payload,
      totalsByEquipment,
      grandTotal,
    });

    await logAudit({
      result: payload.id ? 'rate_option_updated' : 'rate_option_created',
      rateOptionId,
      grandTotal,
    });

    return json(req, 200, {
      data: {
        ...optionRecord,
        totalsByEquipment,
        grandTotal,
      },
    });
  }

  if (action === 'list_rate_history') {
    const rateOptionId = String(body.rateOptionId || '');
    if (!rateOptionId) return json(req, 400, { error: 'rateOptionId is required' });

    const { data, error } = await adminSupabase
      .from('rate_option_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('rate_option_id', rateOptionId)
      .order('revision_no', { ascending: false });

    if (error) return json(req, 400, { error: error.message });
    return json(req, 200, { data: data || [] });
  }

  if (action === 'calculate_only') {
    const payload = body?.payload as RateOptionPayload;
    if (!payload) return json(req, 400, { error: 'payload is required' });
    const validationErrors = validatePayload(payload);
    if (validationErrors.length > 0) {
      return json(req, 400, { error: 'Validation failed', issues: validationErrors });
    }

    return json(req, 200, { data: calculateTotals(payload) });
  }

  await logger.warn('Unsupported action for mgl-quotation-api', { action });
  return json(req, 400, { error: `Unsupported action: ${action}` });
});
