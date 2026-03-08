
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PdfRenderer } from "./engine/renderer.ts";
import { buildSafeContextWithValidation } from "./engine/context.ts";
import { Logger } from "../_shared/logger.ts";

// Mock Logger
const logger = new Logger("test-context");

// Mock Template with Detailed Matrix
const mockTemplate = {
  name: "MGL-Main-Template",
  config: {
    page_size: "A4",
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    default_locale: "en-US",
    colors: {
      primary: "#0087b5",
      secondary: "#dceef2",
      accent: "#333333",
      text: "#000000"
    }
  },
  layout: [
    {
      id: "header",
      type: "header",
      content: { text: "MGL QUOTE TEST" },
      height: 50
    },
    {
      id: "matrix_section",
      type: "detailed_matrix_rate_table",
      config: {
        title: "Rate Options Matrix",
        group_by: ["carrier", "transit_time", "frequency"],
        show_total: true,
        show_breakdown: true
      },
      content: {
        text: "Freight Rates Breakdown"
      }
    }
  ]
};

// Mock Raw Data mimicking the migration seed data
const mockRawData = {
  quote: {
    quote_number: "QUO-MGL-MATRIX-TEST",
    created_at: new Date().toISOString(),
    status: "draft",
    currency: "USD",
    service_level: "Standard",
    origin: { location_name: "Shanghai" },
    destination: { location_name: "Los Angeles" },
    customer_id: "cust-123"
  },
  customer: {
    company_name: "MGL Matrix Test Customer",
    contact_name: "Test User"
  },
  options: [
    // MSC - 20SD
    {
      id: "opt-1",
      carrier: "MSC",
      transit_time: "25 Days",
      frequency: "Weekly",
      container_size: "20SD",
      grand_total: 1650,
      charges: [
        { description: "Freight", amount: 1500, currency: "USD" },
        { description: "THC/O", amount: 150, currency: "USD", note: "THC/O" }
      ],
      legs: [{ carrier: "MSC", mode: "Ocean", pol: "Shanghai", pod: "Los Angeles" }]
    },
    // MSC - 40SD
    {
      id: "opt-2",
      carrier: "MSC",
      transit_time: "25 Days",
      frequency: "Weekly",
      container_size: "40SD",
      grand_total: 2950,
      charges: [
        { description: "Freight", amount: 2800, currency: "USD" },
        { description: "THC/O", amount: 150, currency: "USD", note: "THC/O" }
      ],
      legs: [{ carrier: "MSC", mode: "Ocean", pol: "Shanghai", pod: "Los Angeles" }]
    },
    // MSC - 40HQ
    {
      id: "opt-3",
      carrier: "MSC",
      transit_time: "25 Days",
      frequency: "Weekly",
      container_size: "40HQ",
      grand_total: 3050,
      charges: [
        { description: "Freight", amount: 2900, currency: "USD" },
        { description: "THC/O", amount: 150, currency: "USD", note: "THC/O" }
      ],
      legs: [{ carrier: "MSC", mode: "Ocean", pol: "Shanghai", pod: "Los Angeles" }]
    },
    
    // Maersk - 20SD (Includes Remarks)
    {
      id: "opt-4",
      carrier: "Maersk",
      transit_time: "22 Days",
      frequency: "Weekly",
      container_size: "20SD",
      grand_total: 1700,
      remarks: "Rates subject to space availability.",
      charges: [
        { description: "Freight", amount: 1550, currency: "USD", note: "Includes BAF" },
        { description: "Doc Fee", amount: 50, currency: "USD", note: "Doc Fee" },
        { description: "THC/O", amount: 100, currency: "USD", note: "THC/O" }
      ],
      legs: [{ carrier: "Maersk", mode: "Ocean", pol: "Shanghai", pod: "Los Angeles" }]
    },
    // Maersk - 40SD
    {
      id: "opt-5",
      carrier: "Maersk",
      transit_time: "22 Days",
      frequency: "Weekly",
      container_size: "40SD",
      grand_total: 3100,
      remarks: "Rates subject to space availability.",
      charges: [
        { description: "Freight", amount: 2950, currency: "USD", note: "Includes BAF" },
        { description: "Doc Fee", amount: 50, currency: "USD", note: "Doc Fee" },
        { description: "THC/O", amount: 100, currency: "USD", note: "THC/O" }
      ],
      legs: [{ carrier: "Maersk", mode: "Ocean", pol: "Shanghai", pod: "Los Angeles" }]
    },

    // CMA CGM - 40HQ Only
    {
      id: "opt-6",
      carrier: "CMA CGM",
      transit_time: "28 Days",
      frequency: "Bi-Weekly",
      container_size: "40HQ",
      grand_total: 3200,
      charges: [
        { description: "Freight", amount: 3000, currency: "USD", note: "Subject to GRI" },
        { description: "THC/O", amount: 200, currency: "USD", note: "THC/O" }
      ],
      legs: [{ carrier: "CMA CGM", mode: "Ocean", pol: "Shanghai", pod: "Los Angeles" }]
    },

    // Hapag-Lloyd - All 3
    {
      id: "opt-7",
      carrier: "Hapag-Lloyd",
      transit_time: "24 Days",
      frequency: "Weekly",
      container_size: "20SD",
      grand_total: 1600,
      charges: [
        { description: "Freight", amount: 1600, currency: "USD" }
      ],
      legs: [{ carrier: "Hapag-Lloyd", mode: "Ocean", pol: "Shanghai", pod: "Los Angeles" }]
    },
    {
      id: "opt-8",
      carrier: "Hapag-Lloyd",
      transit_time: "24 Days",
      frequency: "Weekly",
      container_size: "40SD",
      grand_total: 2900,
      charges: [
        { description: "Freight", amount: 2900, currency: "USD" }
      ],
      legs: [{ carrier: "Hapag-Lloyd", mode: "Ocean", pol: "Shanghai", pod: "Los Angeles" }]
    },
    {
      id: "opt-9",
      carrier: "Hapag-Lloyd",
      transit_time: "24 Days",
      frequency: "Weekly",
      container_size: "40HQ",
      grand_total: 3000,
      charges: [
        { description: "Freight", amount: 3000, currency: "USD" }
      ],
      legs: [{ carrier: "Hapag-Lloyd", mode: "Ocean", pol: "Shanghai", pod: "Los Angeles" }]
    }
  ],
  mode: "ocean"
};

async function runTest() {
  console.log("Starting PDF Generation Test...");

  try {
    // 1. Validate Data
    const { context, warnings } = buildSafeContextWithValidation(mockRawData, logger);
    if (warnings.length > 0) {
      console.warn("Validation Warnings:", warnings);
    }
    
    // 2. Render PDF
    const renderer = new PdfRenderer(mockTemplate, context, logger);
    const pdfBytes = await renderer.render();
    
    console.log(`PDF Generated Successfully! Size: ${pdfBytes.length} bytes`);
    
    // 3. Write to file
    try {
        await Deno.writeFile("test_output.pdf", pdfBytes);
        console.log("Saved to test_output.pdf");
    } catch (err) {
        console.error("Failed to write file:", err);
    }

    console.log("Test Passed.");
  } catch (e) {
    console.error("Test Failed:", e);
    if (e.stack) console.error(e.stack);
  }
}

runTest();
