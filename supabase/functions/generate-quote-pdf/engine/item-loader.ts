type LoggerLike = {
  warn: (message: string, meta?: Record<string, unknown>) => Promise<unknown> | unknown;
  info: (message: string, meta?: Record<string, unknown>) => Promise<unknown> | unknown;
};

type SelectResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

type SafeSelectFn = (
  table: string,
  primarySelect: string,
  fallbackSelect: string,
  apply: (q: any) => any,
  context: string,
) => Promise<SelectResult<any>>;

const ITEM_TABLE_CANDIDATES = [
  {
    table: "quote_items",
    primarySelect: `
      *,
      container_sizes (code, name),
      container_types (code, name),
      master_commodities (name)
    `,
    fallbackSelect: "*",
  },
  {
    table: "quote_items_core",
    primarySelect: "*",
    fallbackSelect: "*",
  },
] as const;

const isSchemaTableError = (message: string): boolean =>
  /schema cache|does not exist|could not find the table|relation|permission denied for schema/i.test(message);

export async function fetchQuoteItemsWithFallbacks(
  quoteId: string,
  safeSelect: SafeSelectFn,
  logger: LoggerLike,
): Promise<any[]> {
  let lastErrorMessage = "";

  for (const candidate of ITEM_TABLE_CANDIDATES) {
    const { data, error } = await safeSelect(
      candidate.table,
      candidate.primarySelect,
      candidate.fallbackSelect,
      (q) => q.eq("quote_id", quoteId),
      `${candidate.table} fetch`,
    );

    if (!error) {
      if (candidate.table !== "quote_items") {
        await logger.warn(`Primary quote items view unavailable; using fallback table ${candidate.table}`);
      }
      
      const items = Array.isArray(data) ? data : [];
      
      // If we got items from a fallback source (like quote_items_core), they might lack joined data
      if (candidate.table === "quote_items_core" && items.length > 0) {
        // Fetch master_commodities to manually join
        // @ts-ignore
        const commodityIds = [...new Set(items.map(i => i.commodity_id).filter(Boolean))];
        
        if (commodityIds.length > 0) {
          try {
            const { data: comms, error: cError } = await safeSelect(
               "master_commodities",
               "id, name",
               "id, name",
               // @ts-ignore
               (q) => q.in("id", commodityIds),
               "master_commodities manual join"
            );
            
            // @ts-ignore
            if (!cError && comms) {
               // @ts-ignore
               const commMap = new Map(comms.map((c: any) => [c.id, c.name]));
               items.forEach((item: any) => {
                  // @ts-ignore
                  if (item.commodity_id && commMap.has(item.commodity_id)) {
                      // @ts-ignore
                      item.master_commodities = { name: commMap.get(item.commodity_id) };
                      // Also set 'commodity' field directly if needed by consumer
                      // @ts-ignore
                      item.commodity = commMap.get(item.commodity_id);
                  }
               });
            }
          } catch (e: any) {
             await logger.warn(`Failed to manually join commodities: ${e.message}`);
          }
        }
        
        // Ensure every item has at least a commodity name from product_name if missing
        items.forEach((item: any) => {
           if (!item.commodity && !item.master_commodities?.name) {
               item.commodity = item.product_name || "General Cargo";
               // Log warning if fallback used
               // await logger.warn(`Item ${item.id} missing commodity, using product_name: ${item.commodity}`);
           }
        });
      }
      
      return items;
    }

    const message = String(error.message || "");
    lastErrorMessage = message;

    if (isSchemaTableError(message)) {
      await logger.warn(`Quote items fetch failed for ${candidate.table}; trying next fallback`, {
        error: message,
      });
      continue;
    }

    await logger.warn(`Quote items fetch failed for ${candidate.table} with non-schema error`, {
      error: message,
    });
  }

  if (lastErrorMessage) {
    await logger.warn("Proceeding with empty quote items due to unresolved item source", {
      error: lastErrorMessage,
    });
  }

  return [];
}

export { isSchemaTableError };
