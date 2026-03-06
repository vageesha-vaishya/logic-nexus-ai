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
      return Array.isArray(data) ? data : [];
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
