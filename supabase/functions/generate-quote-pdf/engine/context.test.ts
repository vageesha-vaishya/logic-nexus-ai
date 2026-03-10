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

    expect(result[0].container_type).toBe("Dry Standard");
    expect(result[0].container_size).toBe("40FT");
  });

  it("deduplicates container labels when size and type are identical", () => {
    const items = [
      {
        quantity: 1,
        weight_kg: 5,
        volume_cbm: 1,
        container_sizes: { code: "40HC" },
        container_types: { code: "40HC" },
      },
    ];

    const result = mapQuoteItemsToRawItems(items);
    expect(result[0].container_type).toBe("40HC");
  });

  it("keeps container size when type is unavailable", () => {
    const items = [
      {
        quantity: 1,
        weight_kg: 8,
        volume_cbm: 1,
        container_sizes: { code: "20FT", name: "20ft" },
      },
    ];

    const result = mapQuoteItemsToRawItems(items);

    expect(result[0].container_type).toBe("Container");
    expect(result[0].container_size).toBe("20FT");
  });

  it("maps standard, refrigerated, and open-top container configurations", () => {
    const items = [
      {
        quantity: 1,
        weight_kg: 10,
        volume_cbm: 2,
        container_sizes: { code: "20FT" },
        container_types: { code: "GP" },
      },
      {
        quantity: 1,
        weight_kg: 10,
        volume_cbm: 2,
        container_sizes: { code: "40FT" },
        container_types: { code: "RF" },
      },
      {
        quantity: 1,
        weight_kg: 10,
        volume_cbm: 2,
        container_sizes: { code: "40FT HC" },
        container_types: { code: "OT" },
      },
    ];

    const result = mapQuoteItemsToRawItems(items);
    expect(result.map((item) => item.container_type)).toEqual(["Dry Standard", "Reefer", "Open Top"]);
  });

  it("derives container labels from commodity text when ids are unavailable", () => {
    const items = [
      { quantity: 1, product_name: "20GP Containerized Machinery", total_weight: 1000, total_volume: 10 },
      { quantity: 1, commodity_description: "40ft refrigerated cargo", total_weight: 1200, total_volume: 12 },
      { quantity: 1, description: "Open-top 40ft heavy equipment", total_weight: 900, total_volume: 8 },
    ];

    const result = mapQuoteItemsToRawItems(items);
    expect(result.map((item) => item.container_type)).toEqual(["Dry Standard", "Reefer", "Open Top"]);
  });

  it("maps cargo container combos with typeId and sizeId", () => {
    const items = [
      { sizeId: "20", typeId: "dry", quantity: 1, commodity: "Cargo" },
      { sizeId: "40ft", typeId: "open_top", quantity: -1, commodity: "Cargo" },
    ];

    const result = mapQuoteItemsToRawItems(items);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      container_type: "Dry Standard",
      container_size: "20FT",
      quantity: 1,
    });
    expect(result[1]).toMatchObject({
      container_type: "Open Top",
      container_size: "40FT",
      quantity: -1,
    });
  });

  it("preserves positive negative and zero quantities across container types", () => {
    const items = [
      { sizeId: "20ft", typeId: "gp", quantity: 1, commodity: "Cargo" },
      { sizeId: "40ft", typeId: "rf", quantity: 0, commodity: "Cargo" },
      { sizeId: "40", typeId: "ot", quantity: -1, commodity: "Cargo" },
      { sizeId: "45", typeId: "flat_rack", quantity: "", commodity: "Cargo" },
    ];

    const result = mapQuoteItemsToRawItems(items);
    expect(result.map((item) => item.container_type)).toEqual([
      "Dry Standard",
      "Reefer",
      "Open Top",
      "Flat Rack",
    ]);
    expect(result.map((item) => item.container_size)).toEqual(["20FT", "40FT", "40FT", "45FT"]);
    expect(result.map((item) => item.quantity)).toEqual([1, 0, -1, 0]);
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

  it("maps quantity aliases for renderer compatibility", () => {
    const payload = {
      quote: {
        quote_number: "Q-2",
        created_at: new Date().toISOString(),
        status: "draft",
        total_amount: 100,
        currency: "USD",
      },
      items: [
        {
          qty: 4,
          commodity: "Food",
          weight: 200,
          volume: 10,
          container_size: "40FT",
          container_type: "RF",
        },
      ],
      charges: [{ description: "Freight", amount: 100, currency: "USD" }],
    };

    const result = buildSafeContextWithValidation(payload);
    expect(result.context.items[0].qty).toBe(4);
    expect(result.context.items[0].quantity).toBe(4);
    expect(result.context.items[0].container_type).toBe("RF");
    expect(result.context.items[0].container_size).toBe("40FT");
  });

  it("keeps zero and negative quantities for item and charge totals", () => {
    const payload = {
      quote: {
        quote_number: "Q-3",
        created_at: new Date().toISOString(),
        status: "draft",
        total_amount: 100,
        currency: "USD",
      },
      items: [
        {
          quantity: 0,
          commodity: "Food",
          weight: 200,
          volume: 10,
          container_size: "20FT",
          container_type: "GP",
        },
      ],
      charges: [{ description: "Freight", amount: 100, currency: "USD", quantity: -1 }],
    };

    const result = buildSafeContextWithValidation(payload);
    expect(result.context.items[0].quantity).toBe(0);
    expect(result.context.items[0].qty).toBe(0);
    expect(result.context.charges[0].qty).toBe(-1);
    expect(result.context.charges[0].unit_price).toBe(-100);
  });

  it("preserves option scope fields for matrix grouping", () => {
    const payload = {
      quote: {
        quote_number: "Q-4",
        created_at: new Date().toISOString(),
        status: "draft",
        total_amount: 100,
        currency: "USD",
      },
      charges: [{ description: "Freight", amount: 100, currency: "USD" }],
      options: [
        {
          id: "opt-1",
          option_group_key: "scope-1",
          option_name: "Rate Option 1",
          rate_option_name: "Rate Option 1",
          grand_total: 1000,
          legs: [],
          charges: [],
        },
      ],
    };

    const result = buildSafeContextWithValidation(payload);
    expect(result.context.options?.[0]).toMatchObject({
      id: "opt-1",
      option_group_key: "scope-1",
      option_name: "Rate Option 1",
      rate_option_name: "Rate Option 1",
      rate_option_id: "opt-1",
    });
  });
});
