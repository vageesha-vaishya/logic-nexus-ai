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

    expect(result).toEqual([{ id: "item-core-1" }]);
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
});
