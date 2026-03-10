
import { Logger } from "../../_shared/logger.ts";

async function safeSelectWithTableFallback(
  safeSelect: any,
  primaryTable: string,
  legacyTable: string,
  selectClause: string,
  apply: (q: any) => any,
  context: string,
  logger: Logger,
): Promise<{ data: any[]; tableUsed: string; error: any }> {
  const primary = await safeSelect(primaryTable, selectClause, selectClause, apply, `${context} (${primaryTable})`);
  const primaryData = Array.isArray(primary?.data) ? primary.data : [];
  if (!primary?.error) {
    return { data: primaryData, tableUsed: primaryTable, error: null };
  }

  const primaryErrorMsg = String(primary.error?.message || "");
  const shouldFallback = /does not exist|relation|schema cache|column/i.test(primaryErrorMsg);
  if (!shouldFallback) {
    return { data: primaryData, tableUsed: primaryTable, error: primary.error };
  }

  await logger.warn(`Falling back to legacy table ${legacyTable} for ${context}`, {
    primary_table: primaryTable,
    legacy_table: legacyTable,
    error: primaryErrorMsg,
  });

  const legacy = await safeSelect(legacyTable, selectClause, selectClause, apply, `${context} (${legacyTable})`);
  const legacyData = Array.isArray(legacy?.data) ? legacy.data : [];
  if (legacy?.error) {
    return { data: legacyData, tableUsed: legacyTable, error: legacy.error };
  }
  return { data: legacyData, tableUsed: legacyTable, error: null };
}

function normalizeMode(value: any): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "sea") return "ocean";
  if (normalized === "truck") return "road";
  return normalized;
}

function inferChargeCategory(row: any): string {
  const code = String(row?.row_code || "").trim().toLowerCase();
  const name = String(row?.row_name || "").trim().toLowerCase();
  const token = `${code} ${name}`;
  if (token.includes("fuel")) return "Fuel";
  if (token.includes("security")) return "Security";
  if (token.includes("custom")) return "Customs";
  if (token.includes("handling")) return "Handling";
  if (token.includes("delivery") || token.includes("oncarriage")) return "On-Carriage";
  if (token.includes("air")) return "Air Freight";
  if (token.includes("ocean") || token.includes("sea")) return "Ocean Freight";
  return "Freight";
}

function inferLegForRow(row: any, legs: any[]): any | null {
  if (!Array.isArray(legs) || legs.length === 0) return null;
  const rowLegId = row?.leg_id || row?.rate_option_leg_id || row?.option_leg_id || row?.leg_ref_id;
  if (rowLegId) {
    const direct = legs.find((leg: any) => leg?.id === rowLegId);
    if (direct) return direct;
  }

  const sequenceRaw = row?.sequence_no ?? row?.leg_sequence ?? row?.leg_sequence_no ?? row?.segment_no;
  const sequenceNo = Number(sequenceRaw);
  if (Number.isFinite(sequenceNo)) {
    const bySequence = legs.find((leg: any) => Number(leg?.sequence_no) === sequenceNo);
    if (bySequence) return bySequence;
  }

  const rowMode = normalizeMode(row?.transport_mode || row?.mode || row?.segment_mode);
  if (rowMode) {
    const byMode = legs.find((leg: any) => normalizeMode(leg?.transport_mode || leg?.mode) === rowMode);
    if (byMode) return byMode;
  }

  const code = String(row?.row_code || "").trim().toLowerCase();
  const name = String(row?.row_name || "").trim().toLowerCase();
  const token = `${code} ${name}`;

  if (token.includes("oncarriage") || token.includes("delivery") || token.includes("last mile")) {
    return legs[legs.length - 1];
  }

  if (token.includes("precarriage") || token.includes("pickup") || token.includes("origin")) {
    return legs[0];
  }

  if (token.includes("ocean") || token.includes("sea") || token.includes("vessel")) {
    const oceanLeg = legs.find((leg: any) => normalizeMode(leg?.transport_mode || leg?.mode) === "ocean");
    if (oceanLeg) return oceanLeg;
  }

  if (token.includes("air") || token.includes("flight") || token.includes("uplift")) {
    const airLeg = legs.find((leg: any) => normalizeMode(leg?.transport_mode || leg?.mode) === "air");
    if (airLeg) return airLeg;
  }

  if (legs.length === 1) {
    return legs[0];
  }

  return null;
}

export async function fetchMglOptions(
  supabaseClient: any,
  versionId: string,
  safeSelect: any,
  logger: Logger
): Promise<any[]> {
  const options: any[] = [];

  const { data: mglOptions, error: mglError, tableUsed: optionsTable } = await safeSelectWithTableFallback(
    safeSelect,
    "rate_options",
    "mgl_rate_options",
    "*",
    (q: any) => q.eq("quote_version_id", versionId),
    "rate options fetch",
    logger,
  );

  if (!mglError && mglOptions && mglOptions.length > 0) {
    await logger.info(`Found ${mglOptions.length} MGL options from ${optionsTable}. Mapping to standard structure...`);

    for (const mglOpt of mglOptions) {
      const { data: mglLegs, error: mglLegsError, tableUsed: legsTable } = await safeSelectWithTableFallback(
        safeSelect,
        "rate_option_legs",
        "mgl_rate_option_legs",
        "*",
        (q: any) => q.eq("rate_option_id", mglOpt.id).order("sequence_no", { ascending: true }),
        `mgl legs fetch ${mglOpt.id}`,
        logger,
      );
      if (mglLegsError) {
        await logger.warn(`Failed to fetch legs for MGL option ${mglOpt.id}`, { error: String(mglLegsError?.message || mglLegsError) });
      }

      const { data: mglRows, error: mglRowsError, tableUsed: rowsTable } = await safeSelectWithTableFallback(
        safeSelect,
        "rate_charge_rows",
        "mgl_rate_charge_rows",
        "*",
        (q: any) => q.eq("rate_option_id", mglOpt.id).order("sort_order", { ascending: true }),
        `mgl rows fetch ${mglOpt.id}`,
        logger,
      );
      if (mglRowsError) {
        await logger.warn(`Failed to fetch charge rows for MGL option ${mglOpt.id}`, { error: String(mglRowsError?.message || mglRowsError) });
      }

      const rowIds = (mglRows || []).map((r: any) => r.id);
      let mglCells: any[] = [];
      if (rowIds.length > 0) {
        const { data: cellsData, error: cellsError } = await safeSelectWithTableFallback(
          safeSelect,
          "rate_charge_cells",
          "mgl_rate_charge_cells",
          "*",
          (q: any) => q.in("charge_row_id", rowIds),
          `mgl cells fetch ${mglOpt.id}`,
          logger,
        );
        mglCells = cellsData || [];
        if (cellsError) {
          await logger.warn(`Failed to fetch charge cells for MGL option ${mglOpt.id}`, { error: String(cellsError?.message || cellsError) });
        }
      }

      let equipmentKeys: string[] = [];
      if (mglOpt.equipment_columns && Array.isArray(mglOpt.equipment_columns)) {
        equipmentKeys = mglOpt.equipment_columns.map((c: any) => (typeof c === "string" ? c : c.key || c.id));
      }

      if (equipmentKeys.length === 0) {
        const keys = new Set(mglCells.map((c: any) => c.equipment_key));
        equipmentKeys = Array.from(keys);
      }

      if (equipmentKeys.length === 0) {
        await logger.warn(`No equipment keys found for MGL option ${mglOpt.id}. Skipping option.`);
        continue;
      }

      if ((mglRows || []).length === 0) {
        await logger.warn(`No charge rows found for MGL option ${mglOpt.id} (table=${rowsTable}).`);
      }

      for (const eqKey of equipmentKeys) {
        const optionCharges = [];
        let optionTotal = 0;

        if (mglRows) {
          for (const row of mglRows) {
            const cell = mglCells.find((c: any) => c.charge_row_id === row.id && c.equipment_key === eqKey);
            if (cell) {
              const mappedLeg = inferLegForRow(row, mglLegs || []);
              const mappedMode = normalizeMode(
                row?.transport_mode ||
                row?.mode ||
                row?.segment_mode ||
                mappedLeg?.transport_mode ||
                mappedLeg?.mode,
              );
              optionCharges.push({
                id: cell.id,
                charge_name: row.row_name,
                description: row.row_name,
                amount: Number(cell.amount || 0),
                total: Number(cell.amount || 0),
                currency: row.currency,
                rate_option_id: mglOpt.id,
                category: { name: inferChargeCategory(row) },
                include_in_total: row.include_in_total,
                basis: row.basis || "Per Ctr",
                note: row.remarks || "",
                quantity: 1,
                unit_price: Number(cell.amount || 0),
                leg_id: mappedLeg?.id || null,
                transport_mode: mappedMode || null,
              });
              if (row.include_in_total) {
                optionTotal += Number(cell.amount || 0);
              }
            }
          }
        }

        const optionLegs = (mglLegs || []).map((l: any) => ({
          id: l.id,
          sequence_id: l.sequence_no,
          mode: l.transport_mode,
          transport_mode: l.transport_mode,
          pol: l.origin_name || l.origin_code,
          pod: l.destination_name || l.destination_code,
          carrier: l.carrier_name,
          carrier_name: l.carrier_name,
          transit_time: l.transit_days ? `${l.transit_days} Days` : null,
        }));

        const transitTimeDays = Number(mglOpt.transit_time_days);
        const frequencyPerWeek = Number(mglOpt.frequency_per_week);

        const syntheticOption = {
          id: `${mglOpt.id}_${eqKey}`,
          rate_option_id: mglOpt.id,
          carrier: mglOpt.carrier_name,
          carrier_name: mglOpt.carrier_name,
          transit_time: Number.isFinite(transitTimeDays) ? `${transitTimeDays} Days` : null,
          frequency: Number.isFinite(frequencyPerWeek) ? `${frequencyPerWeek} / week` : null,
          container_type: eqKey,
          container_size: eqKey,
          grand_total: optionTotal,
          legs: optionLegs,
          charges: optionCharges,
          remarks: mglOpt.notes || mglOpt.remarks,
          is_mgl: true,
        };

        if (optionCharges.length === 0) {
          await logger.warn(`No charge cells mapped for MGL option ${mglOpt.id} equipment ${eqKey}`);
        }

        if (optionLegs.length === 0) {
          await logger.warn(`No legs found for MGL option ${mglOpt.id} equipment ${eqKey} (table=${legsTable})`);
        }

        options.push(syntheticOption);
      }
    }
  }

  return options;
}
