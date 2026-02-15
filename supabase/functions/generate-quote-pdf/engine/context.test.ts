import { describe, it, expect } from "vitest";
import { mapQuoteItemsToRawItems } from "./context";

describe("mapQuoteItemsToRawItems", () => {
  it("maps weight_kg and volume_cbm with commodity name", () => {
    const items = [
      {
        quantity: 2,
        weight_kg: 100,
        volume_cbm: 4,
        master_commodities: { name: "Electronics" },
        container_types: { name: "40HC", code: "40HC" },
      },
    ];

    const result = mapQuoteItemsToRawItems(items);

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      container_type: "40HC",
      quantity: 2,
      commodity: "Electronics",
      weight: 100,
      volume: 4,
    });
  });

  it("falls back to total_weight and total_volume when per-item fields missing", () => {
    const items = [
      {
        quantity: 1,
        total_weight: 7,
        total_volume: 3,
        container_types: { code: "20DR" },
      },
    ];

    const result = mapQuoteItemsToRawItems(items);

    expect(result[0].weight).toBe(7);
    expect(result[0].volume).toBe(3);
    expect(result[0].container_type).toBe("20DR");
  });
});
