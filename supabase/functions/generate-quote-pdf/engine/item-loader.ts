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
      
      if (candidate.table === "quote_items_core" && items.length > 0) {
        const commodityIds = [...new Set(items.map(i => i.commodity_id).filter(Boolean))];
        const containerTypeIds = [...new Set(items.map(i => i.container_type_id).filter(Boolean))];
        const containerSizeIds = [...new Set(items.map(i => i.container_size_id).filter(Boolean))];
        
        if (commodityIds.length > 0) {
          try {
            const { data: comms, error: cError } = await safeSelect(
               "master_commodities",
               "id, name",
               "id, name",
               (q) => q.in("id", commodityIds),
               "master_commodities manual join"
            );
            
            if (!cError && comms) {
               const commMap = new Map(comms.map((c: any) => [c.id, c.name]));
               items.forEach((item: any) => {
                  if (item.commodity_id && commMap.has(item.commodity_id)) {
                      item.master_commodities = { name: commMap.get(item.commodity_id) };
                      item.commodity = commMap.get(item.commodity_id);
                  }
               });
            }
          } catch (e: any) {
             await logger.warn(`Failed to manually join commodities: ${e.message}`);
          }
        }

        if (containerTypeIds.length > 0) {
          try {
            const { data: types, error: typeError } = await safeSelect(
              "container_types",
              "id, name, code",
              "id, name, code",
              (q) => q.in("id", containerTypeIds),
              "container_types manual join",
            );

            if (!typeError && types) {
              const typeMap = new Map(types.map((t: any) => [t.id, t]));
              items.forEach((item: any) => {
                if (item.container_type_id && typeMap.has(item.container_type_id)) {
                  const match = typeMap.get(item.container_type_id);
                  item.container_types = {
                    name: match?.name,
                    code: match?.code,
                  };
                  item.container_type = item.container_type || match?.code || match?.name;
                }
              });
            }
          } catch (e: any) {
            await logger.warn(`Failed to manually join container types: ${e.message}`);
          }
        }

        if (containerSizeIds.length > 0) {
          try {
            const { data: sizes, error: sizeError } = await safeSelect(
              "container_sizes",
              "id, name, code",
              "id, name, code",
              (q) => q.in("id", containerSizeIds),
              "container_sizes manual join",
            );

            if (!sizeError && sizes) {
              const sizeMap = new Map(sizes.map((s: any) => [s.id, s]));
              items.forEach((item: any) => {
                if (item.container_size_id && sizeMap.has(item.container_size_id)) {
                  const match = sizeMap.get(item.container_size_id);
                  item.container_sizes = {
                    name: match?.name,
                    code: match?.code,
                  };
                  item.container_size = item.container_size || match?.code || match?.name;
                }
              });
            }
          } catch (e: any) {
            await logger.warn(`Failed to manually join container sizes: ${e.message}`);
          }
        }

        items.forEach((item: any) => {
           if (!item.commodity && !item.master_commodities?.name) {
               item.commodity = item.product_name || "General Cargo";
           }
        });

        const unresolvedContainerTypes = items.filter(
          (item: any) => item.container_type_id && !item.container_types?.code && !item.container_types?.name,
        ).length;
        const unresolvedContainerSizes = items.filter(
          (item: any) => item.container_size_id && !item.container_sizes?.code && !item.container_sizes?.name,
        ).length;

        if (unresolvedContainerTypes > 0 || unresolvedContainerSizes > 0) {
          await logger.warn("Container mapping unresolved for fallback quote items", {
            quote_id: quoteId,
            unresolved_container_types: unresolvedContainerTypes,
            unresolved_container_sizes: unresolvedContainerSizes,
          });
        }
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
