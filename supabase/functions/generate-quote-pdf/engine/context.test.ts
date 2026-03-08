import { describe, it, expect } from "vitest";
import { buildSafeContextWithValidation, mapQuoteItemsToRawItems } from "./context";

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
    expect(result[0]).toMatchObject({
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

  it("combines container size and type when both are available", () => {
    const items = [
      {
        quantity: 3,
        weight_kg: 12,
        volume_cbm: 2,
        container_sizes: { code: "40HC", name: "40 High Cube" },
        container_types: { code: "GP", name: "General Purpose" },
      },
    ];

    const result = mapQuoteItemsToRawItems(items);

    expect(result[0].container_type).toBe("40HC GP");
  });
});

describe("buildSafeContextWithValidation", () => {
  it("emits warning when container type is unresolved", () => {
    const payload = {
      quote: {
        quote_number: "Q-1",
        created_at: new Date().toISOString(),
        status: "draft",
        total_amount: 100,
        currency: "USD",
      },
      items: [
        {
          quantity: 1,
          commodity: "Electronics",
          weight: 100,
          volume: 4,
          container_type: "Container",
        },
      ],
      charges: [
        {
          description: "Freight",
          amount: 100,
          currency: "USD",
        },
      ],
    };

    const result = buildSafeContextWithValidation(payload);
    expect(result.warnings.some((w) => w.includes("container type is missing"))).toBe(true);
  });
});
