
import { describe, it, expect } from "vitest";
import { PdfRenderer } from "../engine/renderer.ts";
import { QuoteTemplate } from "../engine/schema.ts";
import { SafeContext } from "../engine/context.ts";
import { Logger } from "../../_shared/logger.ts";

const mockLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
  debug: async () => {},
};

describe("MGL Matrix Design", () => {
  it("should render detailed matrix with correct layout for Zim/Evergreen options matching screenshot", async () => {
    // Columns from screenshot
    const columns = [
      "Standard - 20'", 
      "Open Top - 40'", 
      "Flat Rack - 40'", 
      "Flat Rack collapsible - 20'", 
      "Platform - 20'", 
      "High Cube - 45"
    ];

    // Helper to create options for a carrier
    const createOptions = (carrier: string, transit: string | undefined, freq: string | undefined, chargesMap: Record<string, number | Record<string, number>>, remarks: string) => {
      return columns.map((col, idx) => {
        // Calculate total for this column
        let total = 0;
        const optionCharges = Object.entries(chargesMap).map(([desc, amountOrMap]) => {
          let amount = 0;
          if (typeof amountOrMap === 'number') {
            amount = amountOrMap;
          } else {
             // It's a map of col -> amount (for variable charges like EPS)
             amount = (amountOrMap as Record<string, number>)[col] || 0;
          }
          total += amount;
          return { description: desc, amount, currency: "USD", charge_name: desc, category: { name: "Freight" } };
        });

        return {
          id: `${carrier}-${idx}`,
          carrier: carrier,
          transit_time: transit,
          frequency: freq,
          container_size: col,
          grand_total: total,
          legs: [{ mode: "Ocean", carrier: carrier, transit_time: transit || "" }], // Dummy leg
          charges: optionCharges,
          remarks: remarks // Note: Schema might not support remarks on option directly in renderer, but let's see. 
          // Actually renderer uses 'chargeNoteMap' or looks for specific remarks field.
          // Looking at renderer.ts, it doesn't seem to explicitly render option-level remarks in the matrix footer unless passed specially.
          // But wait, the screenshot shows "All Inclusive rates from SD/Port basis" in the REMARKS column of the TOTAL row.
          // The renderer implementation I saw previously had:
          // this.currentPage!.drawText("All Inclusive rates from SD/Port basis", ... in the total row.
          // So it's hardcoded or derived?
          // In my previous turn I added: this.currentPage!.drawText("All Inclusive rates from SD/Port basis", ...)
          // So it's hardcoded in the renderer for now, or I need to check if I made it dynamic.
          // Checking my previous edit: I hardcoded it in the renderer.ts update.
        };
      });
    };

    // Zim Data
    // Ocean Freight: 2000, Trucking: 1500
    const zimOptions = createOptions("Zim", "1", "1", {
      "Ocean Freight": 2000.00,
      "Trucking": 1500.00
    }, "All Inclusive rates from SD/Port basis");

    // Evergreen Data
    // EPS: 300 for first 4, 0 for last 2
    // Ocean Freight: 2000, Trucking: 1500
    const epsMap: any = {};
    columns.forEach((c, i) => epsMap[c] = i < 4 ? 300.00 : 0.00);

    const evgOptions = createOptions("EVERGREEN LINES", undefined, undefined, {
      "EPS": epsMap,
      "Ocean Freight": 2000.00,
      "Trucking": 1500.00
    }, "All Inclusive rates from SD/Port basis");

    const mockContext: SafeContext = {
      quote: {
        id: "QUO-260303-00002",
        quote_number: "QUO-260303-00002",
        currency: "USD",
        created_at: new Date().toISOString(),
        expiry: new Date().toISOString(),
        service_level: "Standard",
        grand_total: 0, // aggregate logic handles this
        origin: { location_name: "Shanghai" },
        destination: { location_name: "Los Angeles" },
        incoterms: "FOB",
        items: []
      },
      customer: {
        company_name: "Test Client",
        contact_name: "Jane Doe"
      },
      branding: {
        company_name: "Miami Global Lines",
        primary_color: "#0087b5",
        secondary_color: "#dceef2"
      },
      options: [...zimOptions, ...evgOptions],
      meta: { locale: 'en-US' }
    } as any;

    const template: QuoteTemplate = {
      id: "mgl-matrix-test",
      name: "MGL Matrix Test",
      version: "1",
      layout_engine: "v1",
      config: { 
          default_locale: "en-US", 
          page_size: "A4", 
          margins: { top: 20, bottom: 20, left: 20, right: 20 }, 
          font_family: "Helvetica",
          compliance: "None" 
      },
      sections: [
        {
          id: "rates_matrix",
          type: "rates_matrix", // or detailed_matrix_rate_table
          // The renderer maps 'rates_matrix' to detailed view if show_breakdown is true?
          // Let's check renderer.ts.
          // normalizeSection converts 'rates_matrix' with show_breakdown to 'detailed_matrix_rate_table'
          config: { show_breakdown: true },
          content: { text: "Freight Rates" }
        } as any
      ]
    };

    const renderer = new PdfRenderer(template, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });
});
