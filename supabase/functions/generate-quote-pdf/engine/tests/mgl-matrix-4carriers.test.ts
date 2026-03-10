
import { describe, it, expect } from "vitest";
import { PdfRenderer } from "../renderer.ts";
import { QuoteTemplate } from "../schema.ts";
import { SafeContext } from "../context.ts";
import { Logger } from "../../../_shared/logger.ts";
import { groupOptionsForMatrix } from "../matrix-helper.ts";

describe("MGL Matrix 4-Carriers Renderer", () => {
  const mockLogger = {
    info: async () => {},
    warn: async () => {},
    error: async () => {},
  } as unknown as Logger;

  const template: QuoteTemplate = {
    id: "mgl-main",
    name: "MGL-Main-Template",
    tenant_id: "mgl-tenant",
    layout: "standard",
    config: {
      page_size: "A4",
      font_family: "Helvetica",
      compliance: "None",
      default_locale: "en-US",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
    },
    sections: [
      {
        id: "matrix",
        type: "detailed_matrix_rate_table",
        config: {
          show_breakdown: true,
        },
      } as any,
    ],
  } as unknown as QuoteTemplate;

  const createOption = (carrier: string, transit: string, freq: string, container: string, amount: number, notes: string) => ({
    id: `opt-${carrier}-${container}`,
    carrier: carrier, // Added carrier
    carrier_name: carrier,
    transit_time: transit,
    frequency: freq,
    container_type: container,
    grand_total: amount,
    remarks: notes, // Mapped from notes
    charges: [
      { description: "Ocean Freight", amount: amount - 100, include_in_total: true },
      { description: "Trucking", amount: 100, include_in_total: true },
    ],
  });

  it("should preserve remarks in grouped options", () => {
    const zimOpt = createOption("Zim", "1", "1", "Standard - 20'", 2000, "All Inclusive rates from SD/Port basis");
    const evergreenOpt = createOption("Evergreen", "", "", "Standard - 20'", 2000, "All Inclusive rates from SD/Port basis");

    const groups = groupOptionsForMatrix([zimOpt, evergreenOpt]);
    
    expect(groups).toHaveLength(2);
    expect(groups[0].options[0].remarks).toBe("All Inclusive rates from SD/Port basis");
    expect(groups[1].options[0].remarks).toBe("All Inclusive rates from SD/Port basis");
  });

  const options = [
    // ZIM
    createOption("Zim", "1", "1", "Standard - 20'", 3500, "All Inclusive rates from SD/Port basis"),
    createOption("Zim", "1", "1", "Open Top - 40'", 3500, "All Inclusive rates from SD/Port basis"),
    
    // EVERGREEN
    createOption("EVERGREEN LINES", "", "", "Standard - 20'", 3800, "All Inclusive rates from SD/Port basis"),
    createOption("EVERGREEN LINES", "", "", "Open Top - 40'", 3800, "All Inclusive rates from SD/Port basis"),

    // MSC
    createOption("MSC", "", "", "Standard - 20'", 3500, "All Inclusive rates from SD/Port basis"),
    
    // COSCO
    createOption("COSCO", "", "", "Standard - 20'", 3213, "All Inclusive rates from SD/Port basis"),
  ];

  const context: SafeContext = {
    quote: {
      id: "quote-123",
      number: "NRA11211",
      currency: "USD",
      grand_total: 0,
    },
    branding: {
      company_name: "Miami Global Lines",
    },
    options: options,
    meta: {
      locale: "en-US",
    },
  } as unknown as SafeContext;

  it("should group options correctly", () => {
    const groups = groupOptionsForMatrix(options);
    console.log("Groups:", groups.map(g => g.key));
    expect(groups.length).toBe(4);
  });

  it("should keep same carrier options separated by option scope", () => {
    const scopedOptions = [
      {
        ...createOption("MSC", "N/A", "N/A", "Standard - 20'", 3330, "Option 3"),
        id: "opt-msc-1",
        option_group_key: "option-3",
      },
      {
        ...createOption("MSC", "N/A", "N/A", "Standard - 20'", 3500, "Option 5"),
        id: "opt-msc-2",
        option_group_key: "option-5",
      },
    ];

    const groups = groupOptionsForMatrix(scopedOptions);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.key)).toEqual([
      "option-3|MSC|N/A|N/A",
      "option-5|MSC|N/A|N/A",
    ]);
  });

  it("should render 4-carrier matrix without errors", async () => {
    const renderer = new PdfRenderer(template, context, mockLogger);
    await renderer.init();
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });
});
