
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
              optionCharges.push({
                id: cell.id,
                charge_name: row.row_name,
                description: row.row_name,
                amount: Number(cell.amount || 0),
                total: Number(cell.amount || 0),
                currency: row.currency,
                rate_option_id: mglOpt.id,
                category: { name: "Freight" }, // Default category
                include_in_total: row.include_in_total,
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
