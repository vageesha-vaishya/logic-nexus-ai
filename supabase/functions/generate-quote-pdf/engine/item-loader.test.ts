import { describe, it, expect, vi } from "vitest";
import { fetchQuoteItemsWithFallbacks, isSchemaTableError } from "./item-loader";

describe("isSchemaTableError", () => {
  it("detects schema cache table-missing errors", () => {
    expect(isSchemaTableError("Could not find the table 'public.quote_items' in the schema cache")).toBe(true);
  });

  it("does not flag unrelated errors", () => {
    expect(isSchemaTableError("connection timeout")).toBe(false);
  });
});

describe("fetchQuoteItemsWithFallbacks", () => {
  it("returns items from quote_items when available", async () => {
    const safeSelect = vi.fn().mockResolvedValue({
      data: [{ id: "item-1" }],
      error: null,
    });
    const logger = { warn: vi.fn(), info: vi.fn() };

    const result = await fetchQuoteItemsWithFallbacks("q-1", safeSelect, logger);

    expect(result).toEqual([{ id: "item-1" }]);
    expect(safeSelect).toHaveBeenCalledTimes(1);
  });

  it("falls back to quote_items_core when quote_items is missing from schema cache", async () => {
    const safeSelect = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Could not find the table 'public.quote_items' in the schema cache" },
      })
      .mockResolvedValueOnce({
        data: [{ id: "item-core-1" }],
        error: null,
      });
    const logger = { warn: vi.fn(), info: vi.fn() };

    const result = await fetchQuoteItemsWithFallbacks("q-1", safeSelect, logger);

    expect(result).toEqual([{ id: "item-core-1", commodity: "General Cargo" }]);
    expect(safeSelect).toHaveBeenCalledTimes(2);
  });

  it("returns empty list when all item sources fail", async () => {
    const safeSelect = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Could not find the table 'public.quote_items' in the schema cache" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Could not find the table 'public.quote_items_core' in the schema cache" },
      });
    const logger = { warn: vi.fn(), info: vi.fn() };

    const result = await fetchQuoteItemsWithFallbacks("q-1", safeSelect, logger);

    expect(result).toEqual([]);
    expect(safeSelect).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("performs manual commodity join for quote_items_core", async () => {
    const safeSelect = vi
      .fn()
      // 1. quote_items fail
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Could not find the table 'public.quote_items' in the schema cache" },
      })
      // 2. quote_items_core success with commodity_id but no commodity object
      .mockResolvedValueOnce({
        data: [{ id: "item-core-1", commodity_id: "comm-1", product_name: "General Cargo" }],
        error: null,
      })
      // 3. master_commodities manual fetch
      .mockResolvedValueOnce({
        data: [{ id: "comm-1", name: "Electronics" }],
        error: null,
      });

    const logger = { warn: vi.fn(), info: vi.fn() };

    const result = await fetchQuoteItemsWithFallbacks("q-1", safeSelect, logger);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
        id: "item-core-1",
        commodity_id: "comm-1",
        master_commodities: { name: "Electronics" },
        commodity: "Electronics"
    });
    expect(safeSelect).toHaveBeenCalledTimes(3);
  });

  it("performs manual container joins for quote_items_core", async () => {
    const safeSelect = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Could not find the table 'public.quote_items' in the schema cache" },
      })
      .mockResolvedValueOnce({
        data: [{
          id: "item-core-2",
          product_name: "Cargo",
          container_type_id: "type-1",
          container_size_id: "size-1",
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: "type-1", name: "General Purpose", code: "GP" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: "size-1", name: "40 High Cube", code: "40HC" }],
        error: null,
      });

    const logger = { warn: vi.fn(), info: vi.fn() };
    const result = await fetchQuoteItemsWithFallbacks("q-1", safeSelect, logger);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "item-core-2",
      container_type_id: "type-1",
      container_size_id: "size-1",
      container_type: "GP",
      container_size: "40HC",
      container_types: { name: "General Purpose", code: "GP" },
      container_sizes: { name: "40 High Cube", code: "40HC" },
    });
    expect(safeSelect).toHaveBeenCalledTimes(4);
  });
});
