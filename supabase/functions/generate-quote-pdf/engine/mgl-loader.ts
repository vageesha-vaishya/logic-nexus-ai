
import { Logger } from "../../_shared/logger.ts";

export async function fetchMglOptions(
  supabaseClient: any,
  versionId: string,
  safeSelect: any,
  logger: Logger
): Promise<any[]> {
  const options: any[] = [];

  // Check for MGL Rate Options
  const { data: mglOptions, error: mglError } = await safeSelect(
    "rate_options",
    "*",
    "*",
    (q: any) => q.eq("quote_version_id", versionId),
    "rate_options fetch"
  );

  if (!mglError && mglOptions && mglOptions.length > 0) {
    await logger.info(`Found ${mglOptions.length} MGL options. Mapping to standard structure...`);

    for (const mglOpt of mglOptions) {
      // Fetch Legs
      const { data: mglLegs } = await safeSelect(
        "rate_option_legs",
        "*",
        "*",
        (q: any) => q.eq("rate_option_id", mglOpt.id).order("sequence_no", { ascending: true }),
        `mgl legs fetch ${mglOpt.id}`
      );

      // Fetch Charge Rows
      const { data: mglRows } = await safeSelect(
        "rate_charge_rows",
        "*",
        "*",
        (q: any) => q.eq("rate_option_id", mglOpt.id).order("sort_order", { ascending: true }),
        `mgl rows fetch ${mglOpt.id}`
      );

      // Fetch Charge Cells
      const rowIds = (mglRows || []).map((r: any) => r.id);
      let mglCells: any[] = [];
      if (rowIds.length > 0) {
        const { data: cellsData } = await safeSelect(
          "rate_charge_cells",
          "*",
          "*",
          (q: any) => q.in("charge_row_id", rowIds),
          `mgl cells fetch ${mglOpt.id}`
        );
        mglCells = cellsData || [];
      }

      // Determine Columns (Equipment Keys)
      let equipmentKeys: string[] = [];
      if (mglOpt.equipment_columns && Array.isArray(mglOpt.equipment_columns)) {
        equipmentKeys = mglOpt.equipment_columns.map((c: any) => (typeof c === "string" ? c : c.key || c.id));
      }

      if (equipmentKeys.length === 0) {
        // Fallback to distinct keys in cells
        const keys = new Set(mglCells.map((c: any) => c.equipment_key));
        equipmentKeys = Array.from(keys);
      }

      // Create a "Standard Option" for each equipment key
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

        // Map Legs
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

        // Create the synthetic option
        const syntheticOption = {
          id: `${mglOpt.id}_${eqKey}`,
          rate_option_id: mglOpt.id,
          carrier: mglOpt.carrier_name,
          carrier_name: mglOpt.carrier_name,
          transit_time: mglOpt.transit_time_days ? String(mglOpt.transit_time_days) : null,
          frequency: mglOpt.frequency_per_week ? String(mglOpt.frequency_per_week) : null,
          container_type: eqKey,
          container_size: eqKey,
          grand_total: optionTotal,
          legs: optionLegs,
          charges: optionCharges,
          remarks: mglOpt.notes || mglOpt.remarks,
          is_mgl: true,
        };

        options.push(syntheticOption);
      }
    }
  }

  return options;
}
